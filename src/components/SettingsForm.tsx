'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Building2,
  User,
  ChevronLeft,
  X,
  ClipboardPaste,
} from 'lucide-react'
import { testConnection, fetchSchema, DBCredentials, DatabaseSchema } from '@/actions/db'
import { getUserTeams } from '@/actions/team'
import type { DatabaseType } from '@/lib/db-drivers'
import { parseConnectionString } from '@/lib/parse-connection-string'

interface SettingsFormProps {
  onSchemaFetched?: (schema: DatabaseSchema) => void
  onConnectionSuccess?: (credentials: DBCredentials, schema: DatabaseSchema) => void
  onClose?: () => void
}

// Real SVG logos for each database
const DB_LOGOS: Record<string, React.ReactNode> = {
  postgresql: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#336791" />
      {/* Elephant head silhouette */}
      <ellipse cx="16" cy="15" rx="7" ry="8" fill="white" opacity="0.92" />
      <ellipse cx="16" cy="10" rx="5" ry="4" fill="#336791" />
      {/* Eyes */}
      <circle cx="13.5" cy="13" r="1.2" fill="#336791" />
      <circle cx="18.5" cy="13" r="1.2" fill="#336791" />
      {/* Tusks */}
      <path
        d="M12 21 Q10 24 11 26"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M20 21 Q22 24 21 26"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  mysql: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#00758F" />
      {/* Dolphin simplified */}
      <path
        d="M6 20 Q10 10 16 12 Q22 14 26 10 Q24 18 18 18 Q14 18 12 22 Q9 26 6 20z"
        fill="white"
        opacity="0.9"
      />
      <circle cx="22" cy="11" r="1.5" fill="#F29111" />
      <path
        d="M6 20 Q7 22 9 21"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  mariadb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#C0765A" />
      {/* Sea lion silhouette */}
      <path
        d="M8 22 Q8 14 14 12 Q20 10 22 14 Q24 18 20 20 Q16 22 14 20 Q12 18 14 16"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="13" r="1.5" fill="white" />
      <path d="M8 22 Q6 25 8 26 Q11 27 12 24" fill="white" opacity="0.7" />
    </svg>
  ),
  sqlserver: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#CC2927" />
      {/* S shape */}
      <path
        d="M11 11 Q11 9 16 9 Q21 9 21 12 Q21 15 16 15.5 Q11 16 11 19.5 Q11 23 16 23 Q21 23 21 21"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  sqlite: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      {/* Blue egg/cylinder body */}
      <ellipse cx="14" cy="16" rx="7" ry="11" fill="#003B57" />
      <ellipse cx="14" cy="7" rx="7" ry="3.5" fill="#0F80CC" />
      {/* Antenna/tail */}
      <path d="M21 9 L27 4" stroke="#0F80CC" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="27" cy="4" r="2" fill="#0F80CC" />
    </svg>
  ),
  oracle: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#F80000" />
      {/* Oracle O shape — ring */}
      <path d="M16 8 A8 8 0 1 1 15.99 8Z" fill="none" stroke="white" strokeWidth="5" />
    </svg>
  ),
  db2: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#052FAD" />
      {/* IBM blue stripe logo simplified — 3 horizontal bars */}
      <rect x="6" y="9" width="20" height="3" rx="1" fill="white" />
      <rect x="6" y="14.5" width="20" height="3" rx="1" fill="white" />
      <rect x="6" y="20" width="20" height="3" rx="1" fill="white" />
    </svg>
  ),
  redshift: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#205B99" />
      {/* AWS Redshift — layered diamond/chevron */}
      <path d="M16 5 L22 9.5 L22 22.5 L16 27 L10 22.5 L10 9.5Z" fill="#5294CF" />
      <path d="M16 5 L22 9.5 L16 13 L10 9.5Z" fill="#8CC4F0" />
      <path d="M5 12 L10 9.5 L10 22.5 L5 20Z" fill="#3F72B3" />
      <path d="M27 12 L22 9.5 L22 22.5 L27 20Z" fill="#3F72B3" />
    </svg>
  ),
  bigquery: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      {/* Google BigQuery — magnifier on hexagon */}
      <path d="M16 3 L27 9.5 V22.5 L16 29 L5 22.5 V9.5Z" fill="#4285F4" />
      <circle cx="15" cy="15" r="5.5" fill="white" opacity="0.95" />
      <circle cx="15" cy="15" r="3.5" fill="#4285F4" />
      <line
        x1="19"
        y1="19"
        x2="23"
        y2="23"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  snowflake: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#29B5E8" />
      {/* Snowflake — 6 arms */}
      <line x1="16" y1="4" x2="16" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line
        x1="7.5"
        y1="7.5"
        x2="24.5"
        y2="24.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="24.5"
        y1="7.5"
        x2="7.5"
        y2="24.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="3" fill="white" />
      {/* Arm tips */}
      <circle cx="16" cy="5" r="1.5" fill="white" />
      <circle cx="16" cy="27" r="1.5" fill="white" />
      <circle cx="5" cy="16" r="1.5" fill="white" />
      <circle cx="27" cy="16" r="1.5" fill="white" />
    </svg>
  ),
  cockroachdb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#6933FF" />
      {/* Cockroach body */}
      <ellipse cx="16" cy="14" rx="5.5" ry="7" fill="white" opacity="0.92" />
      {/* Eyes */}
      <circle cx="13.5" cy="12" r="1.3" fill="#6933FF" />
      <circle cx="18.5" cy="12" r="1.3" fill="#6933FF" />
      {/* Legs */}
      <path
        d="M10.5 14 L6 12M10.5 16 L6 16M10.5 18 L7 20"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M21.5 14 L26 12M21.5 16 L26 16M21.5 18 L25 20"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Antennae */}
      <path d="M14 7 L11 4M18 7 L21 4" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  clickhouse: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1C1C1C" />
      {/* ClickHouse logo — vertical bars, last one shorter (yellow) */}
      <rect x="4" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="10" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="16" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="22" y="8" width="4" height="8" rx="1" fill="#FAFF69" />
    </svg>
  ),
  duckdb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      {/* DuckDB — concentric circles (eye) */}
      <circle cx="16" cy="16" r="14" fill="#FFF200" />
      <circle cx="16" cy="16" r="9" fill="#1C1C1C" />
      <circle cx="16" cy="16" r="5" fill="white" />
      <circle cx="18.5" cy="13.5" r="2.5" fill="white" />
      <circle cx="19.5" cy="13" r="1.2" fill="#1C1C1C" />
    </svg>
  ),
  neon: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#0C0C0C" />
      {/* Neon N shape with glow */}
      <path
        d="M9 24 L9 8 L23 24 L23 8"
        stroke="#00E599"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  planetscale: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#0C0C0C" />
      {/* PlanetScale — slashed circle */}
      <circle cx="16" cy="16" r="10" fill="none" stroke="white" strokeWidth="2" />
      <line x1="8" y1="24" x2="24" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  turso: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#0D1117" />
      {/* Turso hexagon + T */}
      <path
        d="M16 5 L26 10.5 V21.5 L16 27 L6 21.5 V10.5Z"
        fill="none"
        stroke="#4FF8D2"
        strokeWidth="2"
      />
      <line
        x1="11"
        y1="13"
        x2="21"
        y2="13"
        stroke="#4FF8D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="13"
        x2="16"
        y2="21"
        stroke="#4FF8D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  mongodb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      {/* MongoDB leaf */}
      <path d="M16 3 C14 9 9 12 9 18 A7 7 0 0 0 23 18 C23 12 18 9 16 3Z" fill="#10AA50" />
      <path d="M16 3 C18 9 23 12 23 18" fill="#3FA037" opacity="0.5" />
      <rect x="15" y="22" width="2" height="7" rx="1" fill="#10AA50" />
    </svg>
  ),
  cassandra: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1287B1" />
      {/* Cassandra eye logo */}
      <ellipse cx="16" cy="16" rx="12" ry="6" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="3.5" fill="white" />
      <circle cx="16" cy="16" r="1.8" fill="#1287B1" />
    </svg>
  ),
  dynamodb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#4053D6" />
      {/* DynamoDB — stacked cylinders */}
      <ellipse cx="16" cy="10" rx="9" ry="3.5" fill="#7B8CDE" />
      <rect x="7" y="10" width="18" height="5" fill="#4053D6" />
      <ellipse cx="16" cy="15" rx="9" ry="3.5" fill="#7B8CDE" />
      <rect x="7" y="15" width="18" height="5" fill="#4053D6" />
      <ellipse cx="16" cy="20" rx="9" ry="3.5" fill="#7B8CDE" />
      <rect x="7" y="20" width="18" height="2" fill="#4053D6" />
      <ellipse cx="16" cy="22" rx="9" ry="3.5" fill="#5C6BC0" />
    </svg>
  ),
  firestore: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      {/* Firebase/Firestore flame */}
      <path
        d="M16 29 C8 29 5 22 8 16 C10 12 12 14 12 11 C12 8 14 5 16 3 C16 3 15 9 19 12 C21 13.5 23 12 23 12 C25 17 24 29 16 29Z"
        fill="#FFA000"
      />
      <path
        d="M16 29 C11 29 9 24 11 19 C12.5 15 15 17 15 14 C17 17 19 15 20 18 C21.5 22 20 29 16 29Z"
        fill="#FFCA28"
      />
    </svg>
  ),
}

// Switched off on the website for now, but NatureQuery Desktop connects to them.
const DESKTOP_APP_TYPES: string[] = ['turso', 'dynamodb', 'firestore', 'cassandra']

/** Databases whose certificate the website checks, unless the user trusts it as it is. */
const CERTIFICATE_CHECK_TYPES = new Set<DatabaseType>([
  'postgresql',
  'neon',
  'cockroachdb',
  'redshift',
  'mysql',
  'mariadb',
  'planetscale',
  'sqlserver',
  'clickhouse',
])

const DB_OPTIONS: {
  group: string
  items: { type: string; label: string; port: number; soon?: boolean }[]
}[] = [
  {
    group: 'SQL',
    items: [
      { type: 'postgresql' as const, label: 'PostgreSQL', port: 5432 },
      { type: 'mysql' as const, label: 'MySQL', port: 3306 },
      { type: 'mariadb' as const, label: 'MariaDB', port: 3306 },
      { type: 'sqlserver' as const, label: 'SQL Server', port: 1433 },
      { type: 'sqlite' as const, label: 'SQLite', port: 0 },
      { type: 'oracle' as const, label: 'Oracle', port: 1521 },
      { type: 'db2' as const, label: 'IBM Db2', port: 50000, soon: true },
    ],
  },
  {
    group: 'Cloud / Distributed',
    items: [
      { type: 'redshift' as const, label: 'Redshift', port: 5439 },
      { type: 'bigquery' as const, label: 'BigQuery', port: 443 },
      { type: 'snowflake' as const, label: 'Snowflake', port: 443 },
      { type: 'cockroachdb' as const, label: 'CockroachDB', port: 26257 },
      { type: 'clickhouse' as const, label: 'ClickHouse', port: 8443 },
      { type: 'duckdb' as const, label: 'DuckDB', port: 0, soon: true },
    ],
  },
  {
    group: 'Serverless / Edge',
    items: [
      { type: 'neon' as const, label: 'Neon', port: 5432 },
      { type: 'planetscale' as const, label: 'PlanetScale', port: 3306 },
      { type: 'turso' as const, label: 'Turso', port: 443, soon: true },
    ],
  },
  {
    group: 'NoSQL',
    items: [
      { type: 'mongodb' as const, label: 'MongoDB', port: 27017 },
      { type: 'cassandra' as const, label: 'Cassandra', port: 9042, soon: true },
      { type: 'dynamodb' as const, label: 'DynamoDB', port: 443, soon: true },
      { type: 'firestore' as const, label: 'Firestore', port: 443, soon: true },
    ],
  },
]

export default function SettingsForm({
  onSchemaFetched,
  onConnectionSuccess,
  onClose,
}: SettingsFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [dbType, setDbType] = useState<DatabaseType | null>(null)
  // connectionName is intentionally separate from credentials so the paste
  // handler can never accidentally write a URI (including its password) into it.
  const [connectionName, setConnectionName] = useState('')
  const [nameError, setNameError] = useState('')
  const [credentials, setCredentials] = useState<DBCredentials>({
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: '',
    dbType: 'postgresql',
    teamId: '',
    verifyCertificate: true,
  })
  const [pasteError, setPasteError] = useState('')

  const CONNECTION_STRING_RE = /^(postgresql|postgres|mysql|mongodb(\+srv)?|redis|sqlite):\/\//i

  const sanitizeName = (raw: string) =>
    raw
      .trim()
      .slice(0, 50)
      .replace(/[<>"'&]/g, '') // strip XSS chars

  const validateName = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return 'Connection name is required.'
    if (CONNECTION_STRING_RE.test(trimmed))
      return 'Connection name cannot be a connection string. Enter a friendly name like "Production DB".'
    if (trimmed.length > 50) return 'Max 50 characters.'
    return ''
  }

  const handleNameChange = (raw: string) => {
    // Silently block connection-string pastes — user should use the button below
    if (CONNECTION_STRING_RE.test(raw.trim())) {
      setNameError(
        'That looks like a connection string — use the "Paste connection string" button below instead.'
      )
      return
    }
    setConnectionName(raw.slice(0, 50))
    setNameError(validateName(raw))
  }

  const [teams, setTeams] = useState<any[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const hidePasswordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const revealPassword = () => {
    if (hidePasswordTimer.current) clearTimeout(hidePasswordTimer.current)
    setShowPassword(true)
    hidePasswordTimer.current = setTimeout(() => setShowPassword(false), 10_000)
  }
  const hidePassword = () => {
    if (hidePasswordTimer.current) clearTimeout(hidePasswordTimer.current)
    setShowPassword(false)
  }
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isFetchingSchema, setIsFetchingSchema] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)

  useEffect(() => {
    async function loadTeams() {
      const result = await getUserTeams()
      if (result.success && result.data) {
        setTeams(result.data as any[])
      }
    }
    loadTeams()
  }, [])

  const handleInputChange = (field: keyof DBCredentials, value: string | number) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    setConnectionStatus('idle')
    setStatusMessage('')
  }

  const handleSelectDatabase = (type: DatabaseType, port: number) => {
    setDbType(type)
    setConnectionName('')
    setNameError('')
    setCredentials((prev) => ({
      ...prev,
      dbType: type,
      port: port || prev.port,
      host: '',
      database: '',
      user: '',
      password: '',
      verifyCertificate: true,
    }))
    setPasteError('')
    setConnectionStatus('idle')
    setStatusMessage('')
    setSchema(null)
    setStep(2)
  }

  const handlePasteConnectionString = async () => {
    setPasteError('')
    try {
      const text = await navigator.clipboard.readText()
      const result = parseConnectionString(text)
      if (!result.success) {
        // Empty clipboard → show nothing; malformed → show the error
        if (result.error) setPasteError(result.error)
        return
      }
      // IMPORTANT: never set connectionName here — the name field is for a
      // human-readable label only and must never contain credential data.
      setCredentials((prev) => ({
        ...prev,
        user: result.data.user,
        password: result.data.password,
        host: result.data.host,
        port: result.data.port ?? prev.port,
        database: result.data.database,
      }))
      setShowPassword(false) // always hide password after paste — never expose it
      setConnectionStatus('idle')
      setStatusMessage('')
    } catch {
      setPasteError('Could not read clipboard. Please paste manually.')
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setConnectionStatus('idle')
    setStatusMessage('')

    const result = await testConnection(credentials)

    setIsTestingConnection(false)
    if (result.success) {
      setConnectionStatus('success')
      setStatusMessage(result.message || 'Connection successful')
    } else {
      setConnectionStatus('error')
      setStatusMessage(result.error || 'Connection failed')
    }
  }

  const handleFetchSchema = async () => {
    setIsFetchingSchema(true)
    setStatusMessage('')

    const result = await fetchSchema(credentials)

    setIsFetchingSchema(false)
    if (result.success && result.data) {
      setSchema(result.data)
      setConnectionStatus('success')
      setStatusMessage(`Found ${result.data.tables.length} tables`)
      onSchemaFetched?.(result.data)
    } else {
      setConnectionStatus('error')
      setStatusMessage(result.error || 'Failed to fetch schema')
    }
  }

  const isFormValid =
    !!connectionName.trim() &&
    !validateName(connectionName) &&
    (dbType === 'sqlite'
      ? !!credentials.database
      : !!(
          credentials.host &&
          credentials.port &&
          credentials.database &&
          credentials.user &&
          credentials.password
        ))

  const selectedDbLabel =
    DB_OPTIONS.flatMap((g) => g.items).find((i) => i.type === dbType)?.label || 'Database'

  return (
    <div
      role="dialog"
      aria-labelledby="add-connection-title"
      className="rounded-lg shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] max-w-2xl w-full animate-fadeIn overflow-hidden border border-border flex flex-col max-h-[85vh] bg-card"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 z-10 bg-card">
        <div className="flex items-center gap-4">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              aria-label="Back to the list of databases"
              className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-md bg-card flex items-center justify-center border border-border overflow-hidden">
            {step === 2 && dbType && DB_LOGOS[dbType] ? (
              <div className="w-8 h-8 flex items-center justify-center">{DB_LOGOS[dbType]}</div>
            ) : (
              <Database className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 id="add-connection-title" className="text-base font-semibold text-foreground">
              {step === 1 ? 'Connect a database' : `Connect ${selectedDbLabel}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === 1
                ? 'Pick the kind of database. You enter its details next.'
                : 'The password is encrypted before it is stored.'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div
        className="overflow-y-auto w-full flex-1 seamless-scrollbar"
        style={{
          scrollbarGutter: 'stable',
          contain: 'paint',
          transform: 'translateZ(0)',
        }}
      >
        {step === 1 ? (
          <div className="p-6 space-y-8 min-h-[400px]">
            {DB_OPTIONS.map(({ group, items }) => (
              <div key={group}>
                <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">
                  {group}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map(({ type, label, port, soon }) => (
                    <button
                      key={type}
                      disabled={soon}
                      title={
                        soon && DESKTOP_APP_TYPES.includes(type)
                          ? `${label} works in NatureQuery Desktop today`
                          : undefined
                      }
                      onClick={() => !soon && handleSelectDatabase(type as DatabaseType, port)}
                      className={`relative flex flex-col items-center justify-center gap-2.5 p-4 rounded-md border group outline-none transition-colors
                        ${
                          soon
                            ? 'border-border/60 opacity-50 cursor-not-allowed'
                            : 'bg-card border-border hover:border-foreground/30 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/60'
                        }
                      `}
                    >
                      <div className={`p-1 ${soon ? 'opacity-40 grayscale' : ''}`}>
                        {DB_LOGOS[type] ?? <Database className="w-8 h-8 text-muted-foreground" />}
                      </div>
                      <span className="text-xs font-medium text-center text-foreground">
                        {label}
                      </span>
                      {soon && (
                        <span className="absolute top-1.5 right-2 font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
                          {DESKTOP_APP_TYPES.includes(type) ? 'Desktop app' : 'Soon'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Workspace Selector */}
            <div className="p-4 rounded-md border border-border">
              <label className="block text-sm font-medium mb-2 text-foreground">Workspace</label>
              <div className="relative">
                <select
                  value={credentials.teamId || ''}
                  onChange={(e) => handleInputChange('teamId', e.target.value)}
                  className="w-full px-3 py-2 pl-10 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 appearance-none transition-colors hover:border-foreground/30 cursor-pointer text-foreground"
                >
                  <option value="">Personal Workspace</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {!credentials.teamId ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Connection Name — intentionally separate from credentials */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">
                  Connection name <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-1">
                    (shown in your sidebar)
                  </span>
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Production DB, Analytics, Supabase Staging"
                  maxLength={50}
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full px-3 py-2 bg-card border rounded-md text-sm focus:outline-none transition-colors text-foreground ${
                    nameError
                      ? 'border-destructive'
                      : 'border-input hover:border-foreground/30 focus:border-foreground/40'
                  }`}
                />
                {nameError ? (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {nameError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {connectionName.length}/50. Don’t put passwords or connection strings in the
                    name.
                  </p>
                )}
              </div>

              {/* Paste connection string — only for network databases */}
              {dbType !== 'sqlite' && (
                <div>
                  <button
                    type="button"
                    onClick={handlePasteConnectionString}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-border hover:border-foreground/30 rounded-md transition-colors"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste connection string (postgresql://...)
                  </button>
                  {pasteError && (
                    <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {pasteError}
                    </p>
                  )}
                </div>
              )}

              {dbType === 'sqlite' ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">
                    Database file path
                  </label>
                  <input
                    type="text"
                    value={credentials.database}
                    onChange={(e) => handleInputChange('database', e.target.value)}
                    placeholder="/path/to/database.db"
                    className="w-full px-3 py-2 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 transition-all hover:border-foreground/30 text-foreground"
                  />
                </div>
              ) : (
                <>
                  {/* Honeypot: absorbs browser autofill so real fields stay empty */}
                  <div aria-hidden="true" style={{ display: 'none' }}>
                    <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      tabIndex={-1}
                    />
                  </div>

                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">
                        {dbType === 'bigquery'
                          ? 'Host (not needed)'
                          : dbType === 'snowflake'
                            ? 'Account identifier'
                            : dbType === 'mongodb'
                              ? 'Host / Cluster'
                              : 'Host'}
                      </label>
                      <input
                        type="text"
                        value={credentials.host}
                        onChange={(e) => handleInputChange('host', e.target.value)}
                        autoComplete="off"
                        placeholder={
                          dbType === 'snowflake'
                            ? 'xy12345.snowflakecomputing.com'
                            : dbType === 'mongodb'
                              ? 'cluster0.abc.mongodb.net'
                              : dbType === 'neon'
                                ? 'ep-xxx.us-east-1.aws.neon.tech'
                                : dbType === 'planetscale'
                                  ? 'aws.connect.psdb.cloud'
                                  : dbType === 'cockroachdb'
                                    ? 'free-tier.gcp-us-central1.cockroachlabs.cloud'
                                    : 'localhost'
                        }
                        disabled={dbType === 'bigquery'}
                        className="w-full px-3 py-2 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 disabled:opacity-50 transition-all hover:border-foreground/30 text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">
                        Port
                      </label>
                      <input
                        type="number"
                        value={credentials.port}
                        onChange={(e) =>
                          handleInputChange('port', parseInt(e.target.value) || 5432)
                        }
                        autoComplete="off"
                        placeholder="5432"
                        disabled={dbType === 'bigquery' || dbType === 'snowflake'}
                        className="w-full px-3 py-2 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 disabled:opacity-50 transition-all hover:border-foreground/30 text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery'
                        ? 'Project ID'
                        : dbType === 'snowflake'
                          ? 'Database / Warehouse'
                          : 'Database name'}
                    </label>
                    <input
                      type="text"
                      value={credentials.database}
                      onChange={(e) => handleInputChange('database', e.target.value)}
                      autoComplete="off"
                      placeholder={
                        dbType === 'bigquery'
                          ? 'my-gcp-project-id'
                          : dbType === 'snowflake'
                            ? 'MY_DATABASE/COMPUTE_WH'
                            : dbType === 'oracle'
                              ? 'ORCL'
                              : dbType === 'mongodb'
                                ? 'myDatabase'
                                : 'my_database'
                      }
                      className="w-full px-3 py-2 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 transition-all hover:border-foreground/30 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery' ? 'Client email' : 'Username'}
                    </label>
                    <input
                      type="text"
                      value={credentials.user}
                      onChange={(e) => handleInputChange('user', e.target.value)}
                      autoComplete="off"
                      placeholder={
                        dbType === 'bigquery'
                          ? 'service-account@project.iam.gserviceaccount.com'
                          : dbType === 'mysql' || dbType === 'mariadb' || dbType === 'planetscale'
                            ? 'root'
                            : dbType === 'sqlserver'
                              ? 'sa'
                              : dbType === 'oracle'
                                ? 'system'
                                : 'postgres'
                      }
                      className="w-full px-3 py-2 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 transition-all hover:border-foreground/30 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery'
                        ? 'Private key (paste the full key, including \\n)'
                        : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={credentials.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        autoComplete="new-password"
                        placeholder={
                          dbType === 'bigquery'
                            ? '-----BEGIN PRIVATE KEY-----...'
                            : 'Enter password'
                        }
                        className="w-full px-3 py-2 pr-10 bg-card border border-input rounded-md text-sm focus:outline-none focus:border-foreground/40 transition-all hover:border-foreground/30 text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => (showPassword ? hidePassword() : revealPassword())}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {dbType && CERTIFICATE_CHECK_TYPES.has(dbType) && (
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <label
                          htmlFor="trust-certificate"
                          className="block text-sm font-medium text-foreground"
                        >
                          Trust this server&apos;s certificate
                        </label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Only for databases that sign their own certificate, such as Amazon RDS,
                          Heroku, Aiven or Supabase&apos;s direct connection. The connection stays
                          encrypted.
                        </p>
                      </div>
                      <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          id="trust-certificate"
                          type="checkbox"
                          className="peer sr-only"
                          checked={credentials.verifyCertificate === false}
                          onChange={(e) => {
                            setCredentials((prev) => ({
                              ...prev,
                              verifyCertificate: !e.target.checked,
                            }))
                            setConnectionStatus('idle')
                            setStatusMessage('')
                          }}
                        />
                        <div className="h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60"></div>
                      </label>
                    </div>
                  )}
                </>
              )}

              {statusMessage && (
                <div
                  className={`flex items-center gap-2 p-3 mt-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                    connectionStatus === 'success'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  {connectionStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t border-border">
              <button
                onClick={handleTestConnection}
                disabled={!isFormValid || isTestingConnection || isFetchingSchema}
                className="btn-secondary flex-1 h-10"
              >
                {isTestingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-label="Testing" />
                ) : (
                  <>Test connection</>
                )}
              </button>
              <button
                onClick={handleFetchSchema}
                disabled={!isFormValid || isFetchingSchema || isTestingConnection}
                className="btn-primary flex-1 h-10"
              >
                {isFetchingSchema ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading tables" />
                ) : (
                  <>Load tables</>
                )}
              </button>
            </div>

            {schema && schema.tables.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border animate-fadeIn">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Tables found
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {schema.tables.length}
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-3 seamless-scrollbar pr-2">
                  {schema.tables.map((table) => (
                    <div key={table.tableName} className="rounded-md p-3 border border-border">
                      <h4 className="font-mono font-medium text-[13px] mb-2 flex items-center gap-2 text-foreground">
                        <Database className="w-3.5 h-3.5 text-muted-foreground" />
                        {table.tableName}
                      </h4>
                      <div className="space-y-1.5 ml-1">
                        {table.columns.map((col) => (
                          <div key={col.name} className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-mono ${col.isPrimaryKey ? 'text-foreground' : 'text-muted-foreground'}`}
                            >
                              {col.name}
                            </span>
                            <span className="text-muted-foreground/50 text-[10px] uppercase font-mono tracking-wider">
                              {col.type}
                            </span>
                            {col.isPrimaryKey && (
                              <span className="px-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-primary border border-primary/40 rounded">
                                key
                              </span>
                            )}
                            {!col.nullable && !col.isPrimaryKey && (
                              <span className="px-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground border border-border rounded">
                                required
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {onConnectionSuccess && (
                  <button
                    onClick={() => {
                      const err = validateName(connectionName)
                      if (err) {
                        setNameError(err)
                        return
                      }
                      onConnectionSuccess(
                        { ...credentials, name: sanitizeName(connectionName) },
                        schema
                      )
                    }}
                    className="btn-primary w-full mt-6 h-11"
                  >
                    Save and connect
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {onClose && (
        <div className="border-t border-border p-3 mt-auto">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
