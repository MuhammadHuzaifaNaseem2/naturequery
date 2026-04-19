'use client'

import { useState, useEffect } from 'react'
import {
  Database, Loader2, CheckCircle2, XCircle, Eye, EyeOff,
  Building2, User, ChevronLeft, X
} from 'lucide-react'
import { testConnection, fetchSchema, DBCredentials, DatabaseSchema } from '@/actions/db'
import { getUserTeams } from '@/actions/team'
import type { DatabaseType } from '@/lib/db-drivers'

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
      <path d="M12 21 Q10 24 11 26" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M20 21 Q22 24 21 26" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  mysql: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#00758F" />
      {/* Dolphin simplified */}
      <path d="M6 20 Q10 10 16 12 Q22 14 26 10 Q24 18 18 18 Q14 18 12 22 Q9 26 6 20z" fill="white" opacity="0.9" />
      <circle cx="22" cy="11" r="1.5" fill="#F29111" />
      <path d="M6 20 Q7 22 9 21" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  mariadb: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#C0765A" />
      {/* Sea lion silhouette */}
      <path d="M8 22 Q8 14 14 12 Q20 10 22 14 Q24 18 20 20 Q16 22 14 20 Q12 18 14 16" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="13" r="1.5" fill="white" />
      <path d="M8 22 Q6 25 8 26 Q11 27 12 24" fill="white" opacity="0.7" />
    </svg>
  ),
  sqlserver: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#CC2927" />
      {/* S shape */}
      <path d="M11 11 Q11 9 16 9 Q21 9 21 12 Q21 15 16 15.5 Q11 16 11 19.5 Q11 23 16 23 Q21 23 21 21" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
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
      <line x1="19" y1="19" x2="23" y2="23" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  snowflake: (
    <svg viewBox="0 0 32 32" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#29B5E8" />
      {/* Snowflake — 6 arms */}
      <line x1="16" y1="4" x2="16" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
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
      <path d="M10.5 14 L6 12M10.5 16 L6 16M10.5 18 L7 20" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M21.5 14 L26 12M21.5 16 L26 16M21.5 18 L25 20" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
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
      <path d="M9 24 L9 8 L23 24 L23 8" stroke="#00E599" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M16 5 L26 10.5 V21.5 L16 27 L6 21.5 V10.5Z" fill="none" stroke="#4FF8D2" strokeWidth="2" />
      <line x1="11" y1="13" x2="21" y2="13" stroke="#4FF8D2" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="13" x2="16" y2="21" stroke="#4FF8D2" strokeWidth="2.5" strokeLinecap="round" />
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
      <path d="M16 29 C8 29 5 22 8 16 C10 12 12 14 12 11 C12 8 14 5 16 3 C16 3 15 9 19 12 C21 13.5 23 12 23 12 C25 17 24 29 16 29Z" fill="#FFA000" />
      <path d="M16 29 C11 29 9 24 11 19 C12.5 15 15 17 15 14 C17 17 19 15 20 18 C21.5 22 20 29 16 29Z" fill="#FFCA28" />
    </svg>
  ),
}

const DB_OPTIONS: { group: string; items: { type: string; label: string; port: number; soon?: boolean }[] }[] = [
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
      { type: 'clickhouse' as const, label: 'ClickHouse', port: 8123 },
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

export default function SettingsForm({ onSchemaFetched, onConnectionSuccess, onClose }: SettingsFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [dbType, setDbType] = useState<DatabaseType | null>(null)
  const [credentials, setCredentials] = useState<DBCredentials>({
    host: 'localhost',
    port: 5432,
    database: '',
    user: '',
    password: '',
    dbType: 'postgresql',
    teamId: '',
  })

  const [teams, setTeams] = useState<any[]>([])
  const [showPassword, setShowPassword] = useState(false)
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
    setCredentials((prev) => ({
      ...prev,
      dbType: type,
      port: port || prev.port,
      host: type === 'sqlite' ? '' : 'localhost',
      database: '',
      user: '',
      password: ''
    }))
    setConnectionStatus('idle')
    setStatusMessage('')
    setSchema(null)
    setStep(2)
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

  const isFormValid = dbType === 'sqlite'
    ? !!credentials.database
    : !!(credentials.host && credentials.port && credentials.database && credentials.user && credentials.password)

  const selectedDbLabel = DB_OPTIONS.flatMap(g => g.items).find(i => i.type === dbType)?.label || 'Database'

  return (
    <div className="glass-card rounded-2xl p-0 shadow-2xl max-w-2xl w-full animate-scaleIn overflow-hidden border border-border/50 flex flex-col max-h-[85vh] bg-background">

      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50 bg-secondary/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="p-2 hover:bg-secondary/80 rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shadow-lg border border-border/50 overflow-hidden">
            {step === 2 && dbType && DB_LOGOS[dbType]
              ? <div className="w-8 h-8 flex items-center justify-center">{DB_LOGOS[dbType]}</div>
              : <Database className="w-5 h-5 text-primary" />
            }
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {step === 1 ? 'Select Source' : `Configure ${selectedDbLabel}`}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {step === 1 ? 'Choose an engine to connect' : 'Enter your credentials securely'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary/80 rounded-full transition-colors text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 pl-1">
                  {group}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map(({ type, label, port, soon }) => (
                    <button
                      key={type}
                      disabled={soon}
                      onClick={() => !soon && handleSelectDatabase(type as DatabaseType, port)}
                      className={`relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border group outline-none
                        ${soon
                          ? 'bg-secondary/20 border-border/20 opacity-50 cursor-not-allowed'
                          : 'bg-secondary/40 border-border/50 hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary'
                        }
                      `}
                    >
                      <div className={`p-1 rounded-xl ${soon ? 'opacity-40 grayscale' : ''}`}>
                        {DB_LOGOS[type] ?? <Database className="w-8 h-8 text-muted-foreground" />}
                      </div>
                      <span className="text-xs font-semibold tracking-wide text-center text-foreground">
                        {label}
                      </span>
                      {soon && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[9px] font-bold uppercase tracking-wider">
                          Soon
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
            <div className="bg-secondary/20 p-5 rounded-xl border border-border/50">
              <label className="block text-sm font-semibold mb-2 text-foreground/90">Connect into Workspace</label>
              <div className="relative">
                <select
                  value={credentials.teamId || ''}
                  onChange={(e) => handleInputChange('teamId', e.target.value)}
                  className="w-full px-4 py-3 pl-10 bg-background border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm transition-all hover:border-primary/50 cursor-pointer text-foreground"
                >
                  <option value="">Personal Workspace</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {!credentials.teamId ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {dbType === 'sqlite' ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Database File Path</label>
                  <input
                    type="text"
                    value={credentials.database}
                    onChange={(e) => handleInputChange('database', e.target.value)}
                    placeholder="/path/to/database.db"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:border-primary/50 text-foreground"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">
                        {dbType === 'bigquery' ? '(Not Needed)' : dbType === 'snowflake' ? 'Account Identifier' : dbType === 'mongodb' ? 'Host / Cluster' : 'Host'}
                      </label>
                      <input
                        type="text"
                        value={credentials.host}
                        onChange={(e) => handleInputChange('host', e.target.value)}
                        placeholder={
                          dbType === 'snowflake' ? 'xy12345.snowflakecomputing.com' :
                            dbType === 'mongodb' ? 'cluster0.abc.mongodb.net' :
                              dbType === 'neon' ? 'ep-xxx.us-east-1.aws.neon.tech' :
                                dbType === 'planetscale' ? 'aws.connect.psdb.cloud' :
                                  dbType === 'cockroachdb' ? 'free-tier.gcp-us-central1.cockroachlabs.cloud' :
                                    'localhost'
                        }
                        disabled={dbType === 'bigquery'}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all hover:border-primary/50 text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Port</label>
                      <input
                        type="number"
                        value={credentials.port}
                        onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
                        placeholder="5432"
                        disabled={dbType === 'bigquery' || dbType === 'snowflake'}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all hover:border-primary/50 text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery' ? 'Project ID' : dbType === 'snowflake' ? 'Database / Warehouse' : 'Database Name'}
                    </label>
                    <input
                      type="text"
                      value={credentials.database}
                      onChange={(e) => handleInputChange('database', e.target.value)}
                      placeholder={
                        dbType === 'bigquery' ? 'my-gcp-project-id' :
                          dbType === 'snowflake' ? 'MY_DATABASE/COMPUTE_WH' :
                            dbType === 'oracle' ? 'ORCL' :
                              dbType === 'mongodb' ? 'myDatabase' :
                                'my_database'
                      }
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:border-primary/50 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery' ? 'Client Email' : 'Username'}
                    </label>
                    <input
                      type="text"
                      value={credentials.user}
                      onChange={(e) => handleInputChange('user', e.target.value)}
                      placeholder={
                        dbType === 'bigquery' ? 'service-account@project.iam.gserviceaccount.com' :
                          dbType === 'mysql' || dbType === 'mariadb' || dbType === 'planetscale' ? 'root' :
                            dbType === 'sqlserver' ? 'sa' :
                              dbType === 'oracle' ? 'system' :
                                'postgres'
                      }
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:border-primary/50 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      {dbType === 'bigquery' ? 'Private Key (paste full key including \\n)' : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={credentials.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder={dbType === 'bigquery' ? '-----BEGIN PRIVATE KEY-----...' : 'Enter password'}
                        className="w-full px-4 py-2.5 pr-10 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:border-primary/50 text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {statusMessage && (
                <div
                  className={`flex items-center gap-2 p-3 mt-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${connectionStatus === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20'
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

            <div className="flex gap-3 pt-6 border-t border-border/50">
              <button
                onClick={handleTestConnection}
                disabled={!isFormValid || isTestingConnection || isFetchingSchema}
                className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 border border-border/50 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-foreground"
              >
                {isTestingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Test Connection</>
                )}
              </button>
              <button
                onClick={handleFetchSchema}
                disabled={!isFormValid || isFetchingSchema || isTestingConnection}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                {isFetchingSchema ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Fetch Schema</>
                )}
              </button>
            </div>

            {schema && schema.tables.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground">Schema Preview</h3>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">{schema.tables.length} tables found</span>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-3 seamless-scrollbar pr-2">
                  {schema.tables.map((table) => (
                    <div key={table.tableName} className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-foreground">
                        <Database className="w-3.5 h-3.5 text-muted-foreground" />
                        {table.tableName}
                      </h4>
                      <div className="space-y-1.5 ml-1">
                        {table.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className={`font-medium ${col.isPrimaryKey ? 'text-primary' : 'text-muted-foreground'}`}>
                              {col.name}
                            </span>
                            <span className="text-muted-foreground/50 text-[10px] uppercase font-mono tracking-wider">{col.type}</span>
                            {col.isPrimaryKey && (
                              <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[9px] font-bold uppercase tracking-wider">
                                PK
                              </span>
                            )}
                            {!col.nullable && !col.isPrimaryKey && (
                              <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded text-[9px] font-bold uppercase tracking-wider">
                                NOT NULL
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
                    onClick={() => onConnectionSuccess(credentials, schema)}
                    className="w-full mt-6 px-4 py-3.5 bg-green-500 hover:bg-green-400 text-white rounded-xl text-sm font-bold tracking-wide hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    Save & Connect Database
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {onClose && (
        <div className="border-t border-border/50 bg-secondary/10 p-3 mt-auto">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
