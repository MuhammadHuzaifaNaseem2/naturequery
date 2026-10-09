import { z } from 'zod'
import { DB_TYPES } from '@shared/db-types'
import { ROW_LIMIT_CHOICES, SECRET_KEYS, TIMEOUT_CHOICES } from '@shared/types'
import { NqError } from '@shared/errors'

export const CONNECTION_ID = /^(?:sample|[A-Za-z0-9_-]{1,128})$/
const QUERY_ID = /^[A-Za-z0-9_-]{1,64}$/

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

const port = z.coerce
  .number({ message: 'Enter a port number.' })
  .int('Enter a whole port number.')
  .min(1, 'The port must be between 1 and 65535.')
  .max(65535, 'The port must be between 1 and 65535.')

const tls = z.object({
  mode: z.enum(['disable', 'prefer', 'require', 'verify-ca', 'verify-full']),
  caPath: optionalText(1024),
})

const ssh = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port,
  user: z.string().trim().max(255),
  auth: z.enum(['password', 'key']),
  privateKeyPath: optionalText(1024),
  hostKeyFingerprint: optionalText(200),
})

const secrets = z
  .object({
    password: z.string().max(4096),
    connectionString: z.string().max(8192),
    sshPassword: z.string().max(4096),
    sshPrivateKey: z.string().max(65536),
    sshPassphrase: z.string().max(4096),
    serviceAccountKey: z.string().max(65536),
    authToken: z.string().max(8192),
    secretAccessKey: z.string().max(4096),
    caCertificate: z.string().max(65536),
  })
  .partial()

export const connectionInputSchema = z.object({
  id: z.string().regex(CONNECTION_ID).optional(),
  name: z.string().trim().min(1, 'Give this connection a name.').max(120),
  type: z.enum(DB_TYPES),
  color: optionalText(20),
  host: optionalText(255),
  port: port.optional(),
  database: optionalText(255),
  user: optionalText(255),
  tls: tls.optional(),
  ssh: ssh.optional(),
  sqlserver: z
    .object({
      instance: optionalText(128),
      auth: z.enum(['sql', 'windows']),
      domain: optionalText(255),
      encrypt: z.boolean(),
      trustServerCertificate: z.boolean(),
    })
    .optional(),
  oracle: z.object({ connectAs: z.enum(['service', 'sid']) }).optional(),
  sqlite: z.object({ path: z.string().trim().min(1).max(1024) }).optional(),
  mongodb: z.object({ useConnectionString: z.boolean(), authSource: optionalText(255) }).optional(),
  clickhouse: z.object({ protocol: z.enum(['http', 'https']) }).optional(),
  snowflake: z
    .object({
      account: z.string().trim().max(255),
      warehouse: optionalText(255),
      role: optionalText(255),
      schema: optionalText(255),
    })
    .optional(),
  bigquery: z
    .object({
      projectId: z.string().trim().max(255),
      location: optionalText(64),
      keyFilePath: optionalText(1024),
    })
    .optional(),
  dynamodb: z
    .object({ region: z.string().trim().max(64), endpoint: optionalText(1024) })
    .optional(),
  firestore: z
    .object({ projectId: z.string().trim().max(255), keyFilePath: optionalText(1024) })
    .optional(),
  cassandra: z
    .object({ datacenter: z.string().trim().max(255), keyspace: optionalText(255) })
    .optional(),
  turso: z.object({ url: z.string().trim().max(1024) }).optional(),
  lastUsedAt: z.string().max(64).optional(),
  secrets: secrets.optional(),
  clearSecrets: z.array(z.enum(SECRET_KEYS)).max(SECRET_KEYS.length).optional(),
  sshPrivateKeyPath: optionalText(1024),
  serviceAccountKeyPath: optionalText(1024),
})

export type ValidConnectionInput = z.infer<typeof connectionInputSchema>

export const connectionIdSchema = z.string().regex(CONNECTION_ID, 'Unknown connection.')

export const queryRequestSchema = z.object({
  connectionId: connectionIdSchema,
  text: z
    .string()
    .max(1_000_000, 'This query is too long. Queries can be up to one million characters.')
    .refine((value) => value.trim().length > 0, 'Write a query first.'),
  queryId: z.string().regex(QUERY_ID),
  source: z.enum(['editor', 'ai', 'preview', 'sample']),
  question: z.string().max(4000).optional(),
})

export const queryIdSchema = z.string().regex(QUERY_ID)
/** IDs of history entries and saved queries (UUIDs). */
export const recordIdSchema = z.string().regex(QUERY_ID)

export const settingsPatchSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark', 'dim', 'forest']),
    rowLimit: z
      .number()
      .refine((value) => (ROW_LIMIT_CHOICES as readonly number[]).includes(value)),
    queryTimeoutSeconds: z
      .number()
      .refine((value) => (TIMEOUT_CHOICES as readonly number[]).includes(value)),
    editorFontSize: z.number().int().min(10).max(24),
    reviewAiSql: z.boolean(),
    shareSampleRowsForCharts: z.boolean(),
    checkForUpdates: z.boolean(),
    onboardingCompleted: z.boolean(),
  })
  .partial()
  .strict()

export const historyQuerySchema = z
  .object({
    search: z.string().max(200).optional(),
    connectionId: connectionIdSchema.optional(),
    limit: z.number().int().min(1).max(500).optional(),
    before: z.string().max(64).optional(),
  })
  .strict()

export const savedQueryInputSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
  name: z.string().trim().min(1, 'Give this query a name.').max(200),
  connectionId: connectionIdSchema.optional(),
  text: z.string().min(1).max(1_000_000),
  question: z.string().max(4000).optional(),
  description: z.string().max(2000).optional(),
})

export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']),
  columns: z.array(z.string().max(1024)).min(1).max(2000),
  rows: z.array(z.array(z.unknown()).max(2000)).max(250_000),
  suggestedName: z.string().trim().min(1).max(120),
})

export const themeSchema = z.enum(['system', 'light', 'dark', 'dim', 'forest'])
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const windowChromeSchema = z.object({
  background: hexColor,
  symbol: hexColor,
  dark: z.boolean(),
})
export const fileKindSchema = z.enum(['sqlite', 'service-account', 'ssh-key', 'ca-certificate'])
export const externalUrlSchema = z.string().url().max(2048)
export const clipboardTextSchema = z.string().max(20_000_000)

/** Parses IPC input and turns schema failures into a readable validation error. */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const where = issue?.path?.length ? ` (${issue.path.join('.')})` : ''
  throw new NqError(
    'VALIDATION',
    issue?.message ? issue.message : 'Check the values and try again.',
    {
      detail: `Invalid input${where}`,
    }
  )
}
