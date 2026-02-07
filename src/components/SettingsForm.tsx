'use client'

import { useState } from 'react'
import { Database, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { testConnection, fetchSchema, DBCredentials, DatabaseSchema } from '@/actions/db'
import type { DatabaseType } from '@/lib/db-drivers'

interface SettingsFormProps {
  onSchemaFetched?: (schema: DatabaseSchema) => void
  onConnectionSuccess?: (credentials: DBCredentials, schema: DatabaseSchema) => void
  onClose?: () => void
}

export default function SettingsForm({ onSchemaFetched, onConnectionSuccess, onClose }: SettingsFormProps) {
  const [dbType, setDbType] = useState<DatabaseType>('postgresql')
  const [credentials, setCredentials] = useState<DBCredentials>({
    host: 'localhost',
    port: 5432,
    database: '',
    user: '',
    password: '',
    dbType: 'postgresql',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isFetchingSchema, setIsFetchingSchema] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)

  const handleInputChange = (field: keyof DBCredentials, value: string | number) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    setConnectionStatus('idle')
    setStatusMessage('')
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

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm max-w-lg w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Database Settings</h2>
          <p className="text-sm text-muted-foreground">Connect to your database</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Database Type Selector */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Database Type</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'postgresql' as const, label: 'PostgreSQL', port: 5432 },
              { type: 'mysql' as const, label: 'MySQL', port: 3306 },
              { type: 'sqlite' as const, label: 'SQLite', port: 0 },
            ]).map(({ type, label, port }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setDbType(type)
                  setCredentials((prev) => ({
                    ...prev,
                    dbType: type,
                    port: port || prev.port,
                    host: type === 'sqlite' ? '' : prev.host || 'localhost',
                  }))
                  setConnectionStatus('idle')
                  setStatusMessage('')
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  dbType === type
                    ? 'bg-primary/10 border-primary/50 text-primary'
                    : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {dbType === 'sqlite' ? (
          <div>
            <label className="block text-sm font-medium mb-1.5">Database File Path</label>
            <input
              type="text"
              value={credentials.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              placeholder="/path/to/database.db"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Host</label>
            <input
              type="text"
              value={credentials.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              placeholder="localhost"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Port</label>
            <input
              type="number"
              value={credentials.port}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
              placeholder="5432"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Database</label>
          <input
            type="text"
            value={credentials.database}
            onChange={(e) => handleInputChange('database', e.target.value)}
            placeholder="my_database"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Username</label>
          <input
            type="text"
            value={credentials.user}
            onChange={(e) => handleInputChange('user', e.target.value)}
            placeholder="postgres"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 pr-10 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        </>
        )}

        {statusMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              connectionStatus === 'success'
                ? 'bg-green-500/10 text-green-600'
                : 'bg-red-500/10 text-red-600'
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

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleTestConnection}
            disabled={!isFormValid || isTestingConnection}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Test Connection'
            )}
          </button>
          <button
            onClick={handleFetchSchema}
            disabled={!isFormValid || isFetchingSchema}
            className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingSchema ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Fetch Schema'
            )}
          </button>
        </div>
      </div>

      {schema && schema.tables.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Schema Preview</h3>
            <span className="text-xs text-muted-foreground">{schema.tables.length} tables</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-3">
            {schema.tables.map((table) => (
              <div key={table.tableName} className="bg-secondary/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">{table.tableName}</h4>
                <div className="space-y-1">
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className={col.isPrimaryKey ? 'text-primary font-medium' : ''}>
                        {col.name}
                      </span>
                      <span className="text-muted-foreground/60">{col.type}</span>
                      {col.isPrimaryKey && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">
                          PK
                        </span>
                      )}
                      {!col.nullable && !col.isPrimaryKey && (
                        <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 rounded text-[10px]">
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
              className="w-full mt-4 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Connection
            </button>
          )}
        </div>
      )}

      {onClose && (
        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
