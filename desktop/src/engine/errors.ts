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
  name?: string
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

  const specific = engineSpecificError(context, err.name ?? '', text, make)
  if (specific) return specific

  // Oracle listener and call timeouts
  if (/ORA-12514|ORA-12505|NJS-518|NJS-519/.test(text)) {
    return make(
      'NOT_FOUND',
      `The Oracle listener at ${where} does not know the service name or SID "${context.database ?? ''}".`,
      'Check the service name (for example ORCLPDB1) and whether to connect by service name or SID.'
    )
  }
  if (/NJS-123|DPI-1067|call timeout of \d+ ms/i.test(text)) {
    return make(
      'TIMEOUT',
      `The query ran longer than ${context.timeoutSeconds ?? 60} seconds and was stopped.`,
      'Add filters or a FETCH FIRST clause to make it faster, or raise the time limit in Settings.'
    )
  }

  // Supabase's pooler answers an unknown project or user with code ENOTFOUND, which
  // would otherwise read as an unknown server name below.
  if (/tenant\/user \S+ not found|tenant or user not found/i.test(text)) {
    return make(
      'AUTH_FAILED',
      "Supabase couldn't find this project and user.",
      "For the Session pooler, the user name is postgres.your-project-ref and the host is the pooler for your project's region. Copy both from Connect in Supabase."
    )
  }

  // Network reachability
  if (
    code === 'ECONNREFUSED' ||
    /ECONNREFUSED|connection refused|ORA-12541|NJS-503|NJS-511/i.test(text)
  ) {
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
      context.host
        ? `The server name "${context.host}" could not be found.`
        : 'The server in the connection settings could not be found.',
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
    /password authentication failed|Access denied for user|Login failed for user|ORA-01017|Authentication failed|AuthenticationFailed|invalid username\/password|Incorrect username or password|and\/or password are incorrect/i.test(
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
    /database "[^"]+" does not exist|Unknown database|Cannot open database|Database \S+ does(?:n't| not) exist/i.test(
      text
    )
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
    ['57014', 'ER_QUERY_TIMEOUT', '3024', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(code) ||
    /statement timeout|max_execution_time|max_statement_time|maximum statement execution time|exceeded timeout|Query inactivity timeout/i.test(
      text
    )
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

type Make = (code: AppError['code'], message: string, hint?: string) => AppError

/** Messages for cloud services and engines with their own error vocabulary. */
function engineSpecificError(
  context: ErrorContext,
  name: string,
  text: string,
  make: Make
): AppError | null {
  switch (context.type) {
    case 'snowflake':
      if (/394508|394507|multi-factor|\bMFA\b/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'This Snowflake account requires multi-factor sign-in.',
          'Use key pair sign-in or a programmatic access token instead of the password. Your Snowflake administrator can set either up.'
        )
      }
      if (/390100|Incorrect username or password/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'Snowflake rejected the user name or password.',
          'Check the credentials and the account identifier. A programmatic access token can be entered in the password field.'
        )
      }
      if (/390144|390186|JWT token is invalid/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'Snowflake rejected the key pair sign-in.',
          "Check that this user's public key is set in Snowflake (ALTER USER ... SET RSA_PUBLIC_KEY) and that the private key file matches it."
        )
      }
      if (/390422|not allowed to access Snowflake/i.test(text)) {
        return make(
          'AUTH_FAILED',
          "Snowflake's network policy does not allow connections from this computer.",
          'Connect to the company VPN, or ask your Snowflake administrator to allow this network.'
        )
      }
      if (/No active warehouse selected/i.test(text)) {
        return make(
          'VALIDATION',
          'No warehouse is selected for this connection.',
          'Edit the connection and enter a warehouse that your role can use.'
        )
      }
      if (/390201|warehouse '?\S*'? does not exist or not authorized/i.test(text)) {
        return make(
          'NOT_FOUND',
          'The warehouse was not found, or this role cannot use it.',
          'Check the warehouse and role names in the connection settings.'
        )
      }
      if (
        /390189|Role '?\S*'? (?:specified in the connect string )?(?:does not exist|is not granted)/i.test(
          text
        )
      ) {
        return make(
          'AUTH_FAILED',
          'That role does not exist or is not granted to this user.',
          'Leave Role empty to use your default role, or check the name.'
        )
      }
      if (
        /250001|Could not connect to Snowflake backend|snowflakecomputing\.(?:com|cn).*(?:ENOTFOUND|getaddrinfo)/i.test(
          text
        )
      ) {
        return make(
          'HOST_NOT_FOUND',
          'Could not reach this Snowflake account.',
          'Check the account identifier (for example myorg-myaccount), and your network or proxy settings.'
        )
      }
      return null

    case 'bigquery':
    case 'firestore': {
      const product = context.type === 'bigquery' ? 'BigQuery' : 'Cloud Firestore'
      if (/invalid_grant|Invalid JWT Signature|invalid_client|account not found/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'Google rejected the service account key.',
          'The key may have been deleted or rotated. Create a new JSON key for the service account in the Google Cloud console.'
        )
      }
      if (
        /has not been used in project|SERVICE_DISABLED|API has not been enabled|it is disabled/i.test(
          text
        )
      ) {
        return make(
          'NOT_FOUND',
          `The ${product} API is turned off for this Google Cloud project.`,
          'Enable it in the Google Cloud console under "APIs & Services", wait a minute, then try again.'
        )
      }
      if (/The database .* does not exist/i.test(text)) {
        return make(
          'NOT_FOUND',
          'This Firestore database was not found.',
          'Check the project ID. Leave Database empty for the default database.'
        )
      }
      if (
        /Access Denied|PERMISSION_DENIED|Missing or insufficient permissions|does not have [\w.]+ permission/i.test(
          text
        )
      ) {
        return make(
          'AUTH_FAILED',
          'The service account does not have permission for this.',
          context.type === 'bigquery'
            ? 'Give the service account the "BigQuery Data Viewer" and "BigQuery Job User" roles on the project.'
            : 'Give the service account the "Cloud Datastore Viewer" role on the project.'
        )
      }
      if (/Not found: Project|project .* (?:was )?not found|Unknown project/i.test(text)) {
        return make(
          'NOT_FOUND',
          'The Google Cloud project was not found.',
          'Check the project ID in the connection settings.'
        )
      }
      return null
    }

    case 'dynamodb':
      if (
        name === 'UnrecognizedClientException' ||
        /security token included in the request is invalid/i.test(text)
      ) {
        return make(
          'AUTH_FAILED',
          'AWS did not recognize the access key ID.',
          'Check the access key ID, and that the key is still active in IAM.'
        )
      }
      if (
        name === 'InvalidSignatureException' ||
        /signature we calculated does not match/i.test(text)
      ) {
        return make(
          'AUTH_FAILED',
          'AWS rejected the secret access key.',
          'Check the secret access key. AWS shows it only once, when the key is created.'
        )
      }
      if (name === 'AccessDeniedException' || /is not authorized to perform/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'This AWS key is not allowed to read DynamoDB.',
          'Ask your AWS administrator for the dynamodb:ListTables, DescribeTable, Scan and PartiQLSelect permissions.'
        )
      }
      if (name === 'ResourceNotFoundException') {
        return make(
          'NOT_FOUND',
          'The table was not found in this region.',
          'Check the table name (it is case-sensitive) and the region.'
        )
      }
      return null

    case 'cassandra': {
      const centers = /only found hosts in data centers: \[([^\]]*)\]/i.exec(text)
      if (centers || /localDataCenter/i.test(text)) {
        return make(
          'VALIDATION',
          'The data center name does not match this cluster.',
          centers
            ? `This cluster's data centers are: ${centers[1]}.`
            : 'Run "nodetool status" on a node to see the data center names.'
        )
      }
      const keyspace = /Keyspace '?([^' ]+)'? does not exist/i.exec(text)
      if (keyspace) {
        return make(
          'NOT_FOUND',
          `The keyspace "${keyspace[1]}" was not found.`,
          'Check the keyspace name, or leave it empty to browse all keyspaces.'
        )
      }
      if (/requires authentication|Authentication provider not set/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'This cluster requires a user name and password.',
          'Enter the credentials in the connection settings.'
        )
      }
      return null
    }

    case 'mongodb':
      if (/isn't whitelisted|IP access list/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'MongoDB Atlas does not allow connections from this computer.',
          "Add this computer's IP address to the cluster's IP Access List in MongoDB Atlas."
        )
      }
      if (/not authorized on \S+ to execute command|requires authentication/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'This MongoDB user cannot read this database.',
          'Check the database name, or ask your administrator for the "read" role on it.'
        )
      }
      return null

    case 'clickhouse':
      if (/plain HTTP request was sent to HTTPS port/i.test(text)) {
        return make(
          'TLS',
          'This ClickHouse port expects HTTPS.',
          'Change the protocol to HTTPS. ClickHouse Cloud uses HTTPS on port 8443.'
        )
      }
      if (/wrong version number|EPROTO/i.test(text)) {
        return make(
          'TLS',
          'This ClickHouse port does not use HTTPS.',
          'Change the protocol to HTTP, or use the HTTPS port (usually 8443).'
        )
      }
      return null

    case 'turso':
      if (/HTTP status 40[13]|Unauthorized/i.test(text)) {
        return make(
          'AUTH_FAILED',
          'The database rejected the auth token.',
          'Create a new token, for example with "turso db tokens create <database>", and paste it into the connection.'
        )
      }
      if (/HTTP status 404/i.test(text)) {
        return make(
          'NOT_FOUND',
          'No database was found at this URL.',
          'Check the database URL, for example libsql://my-db-myorg.turso.io.'
        )
      }
      if (/URL_INVALID|URL_SCHEME_NOT_SUPPORTED|Invalid URL/i.test(text)) {
        return make(
          'VALIDATION',
          'The database URL is not valid.',
          'Use a URL that starts with libsql://, https:// or http://.'
        )
      }
      return null

    default:
      return null
  }
}

function cleanDatabaseMessage(text: string): string {
  const first = redact(text.split(' | ')[0] ?? text).trim()
  return first.length > 600 ? `${first.slice(0, 600)}…` : first || 'The database returned an error.'
}
