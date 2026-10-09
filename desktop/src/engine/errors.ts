import { NqError } from '@shared/errors'
import { redact } from '@shared/redact'
import type { AppError } from '@shared/types'
import { DB_TYPE_INFO, type DbType } from '@shared/db-types'

export interface ErrorContext {
  type: DbType
  host?: string
  port?: number
  database?: string
  /** True when the query was canceled by the user. */
  canceled?: boolean
  timeoutSeconds?: number
  phase: 'connect' | 'query' | 'schema'
}

interface DriverErrorLike {
  code?: string | number
  errno?: number
  number?: number
  message?: string
  sqlState?: string
  originalError?: DriverErrorLike
  cause?: DriverErrorLike
}

function codeOf(error: DriverErrorLike): string {
  const nested = error.originalError ?? error.cause
  return String(error.code ?? error.number ?? nested?.code ?? nested?.number ?? '')
}

function textOf(error: DriverErrorLike): string {
  const nested = error.originalError ?? error.cause
  return [error.message, nested?.message].filter(Boolean).join(' | ')
}

/** Turns a driver or network error into a message a business user can act on. */
export function describeError(error: unknown, context: ErrorContext): AppError {
  if (error instanceof NqError) return error.toJSON()
  const err = (error ?? {}) as DriverErrorLike
  const code = codeOf(err)
  const text = textOf(err) || String(error)
  const detail = redact(text).slice(0, 2000)
  const label = DB_TYPE_INFO[context.type].label
  const where = context.host ? `${context.host}${context.port ? `:${context.port}` : ''}` : label
  const make = (code: AppError['code'], message: string, hint?: string): AppError => ({
    code,
    message,
    hint,
    detail,
  })

  if (context.canceled) return make('CANCELED', 'The query was canceled.')

  // Network reachability
  if (code === 'ECONNREFUSED' || /ECONNREFUSED|connection refused/i.test(text)) {
    return make(
      'CONNECTION_REFUSED',
      `Could not connect to ${where}. The server refused the connection.`,
      `Check that ${label} is running and accepting connections on port ${context.port ?? 'the configured port'}. For a server on another computer, check its firewall allows this port.`
    )
  }
  if (
    ['ENOTFOUND', 'EAI_AGAIN', 'EAI_NONAME'].includes(code) ||
    /getaddrinfo|ENOTFOUND/i.test(text)
  ) {
    return make(
      'HOST_NOT_FOUND',
      `The server name "${context.host ?? ''}" could not be found.`,
      'Check the spelling, or try the IP address. If the server is on a company network, connect to the VPN first.'
    )
  }
  const namedInstanceFailure =
    context.type === 'sqlserver' &&
    context.phase === 'connect' &&
    /Port for \S+ not found|Failed to connect to [^ ]+\\|SQL Server Browser/i.test(text)
  if (namedInstanceFailure) {
    return make(
      'CONNECTION_REFUSED',
      'Could not reach the SQL Server named instance.',
      'Make sure the "SQL Server Browser" service is running and TCP/IP is enabled in SQL Server Configuration Manager. Or enter the instance\'s TCP port instead of its name.'
    )
  }
  if (
    ['ETIMEDOUT', 'ETIMEOUT', 'ESOCKETTIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code) ||
    /timeout expired|timed out|ETIMEDOUT/i.test(text)
  ) {
    if (context.phase === 'query') {
      return make(
        'TIMEOUT',
        `The query ran longer than ${context.timeoutSeconds ?? 60} seconds and was stopped.`,
        'Add filters or a LIMIT to make it faster, or raise the time limit in Settings.'
      )
    }
    return make(
      'TIMEOUT',
      `${where} did not respond in time.`,
      'Check your network or VPN, and that the server firewall allows connections from this computer.'
    )
  }
  if (
    ['ECONNRESET', 'EPIPE'].includes(code) ||
    /socket hang up|connection reset|Connection terminated unexpectedly/i.test(text)
  ) {
    return make(
      'NETWORK',
      `The connection to ${where} was interrupted.`,
      "Try again. If this keeps happening, check the network, VPN, or the server's connection limits."
    )
  }

  // TLS
  if (
    /does not support SSL|does(?:n't| not) support secure conn+ection|server does not support (ssl|tls|encryption)|SSL is not enabled|not configured for SSL/i.test(
      text
    )
  ) {
    return make(
      'TLS',
      `${where} does not support encrypted connections.`,
      'Change Connection security to "Prefer encryption" or "No encryption". Only use an unencrypted connection on a network you trust.'
    )
  }
  if (
    /self[- ]signed certificate|unable to verify the first certificate|unable to get local issuer|certificate has expired|Hostname\/IP does not match|altnames|CERT_|certificate verify failed|DEPTH_ZERO/i.test(
      text
    )
  ) {
    return make(
      'TLS',
      `The server's security certificate could not be verified.`,
      'If this server uses a self-signed certificate, choose "Encrypt, trust server certificate", or add your company\'s certificate authority file under Connection security.'
    )
  }
  if (/pg_hba\.conf.*no encryption|SSL off/i.test(text)) {
    return make(
      'TLS',
      'The server requires an encrypted connection.',
      'Change Connection security to "Encrypt, trust server certificate" or "Verify certificate".'
    )
  }

  // Authentication
  if (
    ['28P01', '28000', 'ER_ACCESS_DENIED_ERROR', '1045', 'ELOGIN', '18456'].includes(code) ||
    /password authentication failed|Access denied for user|Login failed for user|ORA-01017|Authentication failed|AuthenticationFailed|invalid username\/password|Incorrect username or password/i.test(
      text
    )
  ) {
    return make(
      'AUTH_FAILED',
      'The database rejected the user name or password.',
      'Check the credentials with your database administrator. Passwords are case-sensitive.'
    )
  }
  if (
    ['3D000', 'ER_BAD_DB_ERROR', '1049', '4060'].includes(code) ||
    /database "[^"]+" does not exist|Unknown database|Cannot open database/i.test(text)
  ) {
    return make(
      'NOT_FOUND',
      `The database "${context.database ?? ''}" was not found on this server, or this account cannot open it.`,
      'Check the database name. Names can be case-sensitive.'
    )
  }
  if (/no pg_hba\.conf entry/i.test(text)) {
    return make(
      'AUTH_FAILED',
      'The server does not allow connections from this computer.',
      "Ask your database administrator to allow this computer's address in pg_hba.conf."
    )
  }

  // Query execution
  const readOnlyViolation =
    ['25006', '1792', 'ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION'].includes(code) ||
    (context.phase === 'query' && /read-only transaction|READ ONLY/i.test(text))
  if (readOnlyViolation) {
    return make(
      'READ_ONLY',
      'This query tried to change data, so it was stopped.',
      'NatureQuery only runs read-only queries.'
    )
  }
  if (
    code === '57014' ||
    /statement timeout|max_execution_time|max_statement_time|exceeded timeout/i.test(text)
  ) {
    return make(
      'TIMEOUT',
      `The query ran longer than ${context.timeoutSeconds ?? 60} seconds and was stopped.`,
      'Add filters or a LIMIT to make it faster, or raise the time limit in Settings.'
    )
  }

  if (context.phase === 'query') {
    // Database errors (syntax, unknown column...) are most useful verbatim.
    return {
      code: 'DATABASE_ERROR',
      message: cleanDatabaseMessage(text),
      detail: code ? `Error code ${code}` : undefined,
    }
  }
  return make('DATABASE_ERROR', `Could not connect to ${where}.`, cleanDatabaseMessage(text))
}

function cleanDatabaseMessage(text: string): string {
  const first = redact(text.split(' | ')[0] ?? text).trim()
  return first.length > 600 ? `${first.slice(0, 600)}…` : first || 'The database returned an error.'
}
