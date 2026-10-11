'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import {
  getAdminAllConnections,
  adminTestConnectionById,
  adminTestAllConnections,
  deleteConnectionAdmin,
} from '@/actions/admin'
import { saveConnection } from '@/actions/connections'
import type { AdminConnectionInfo } from '@/actions/admin'
import type { DBCredentials, DatabaseSchema } from '@/actions/db'
import SettingsForm from '@/components/SettingsForm'
import { Search, RefreshCw, Play, Loader2, Trash2, Plus, X } from 'lucide-react'
import { AdminTitle, Figures, formatDay } from '../admin-ui'

type TestResult = { success: boolean; message?: string }

export default function AdminConnectionsPage() {
  const [connections, setConnections] = useState<AdminConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(
    null
  )
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadConnections()
  }, [])

  async function loadConnections() {
    setLoading(true)
    const res = await getAdminAllConnections()
    if (res.success && res.connections) {
      setConnections(res.connections)
    } else {
      toast.error(res.error || 'Could not load connections. Try Refresh.')
    }
    setLoading(false)
  }

  // Results show in the table, so checks don't toast.
  async function handleTestConnection(id: string) {
    setTestingId(id)
    const res = await adminTestConnectionById(id)
    setTestResults((prev) => ({
      ...prev,
      [id]: { success: res.success, message: res.success ? undefined : res.error || 'Failed' },
    }))
    setTestingId(null)
  }

  async function handleTestAll() {
    setIsTestingAll(true)
    setTestResults({})
    const res = await adminTestAllConnections()
    if (res.success && res.results) {
      const results: Record<string, TestResult> = {}
      for (const r of res.results) {
        results[r.connectionId] = {
          success: r.success,
          message: r.success ? undefined : r.error || 'Failed',
        }
      }
      setTestResults(results)
      const connected = res.results.filter((r) => r.success).length
      setLastCheck(`Checked just now: ${connected} of ${res.results.length} connected.`)
    } else {
      toast.error(res.error || 'Could not check the connections.')
    }
    setIsTestingAll(false)
  }

  async function handleAddConnection(credentials: DBCredentials, _schema: DatabaseSchema) {
    const res = await saveConnection({
      name: `${credentials.database}@${credentials.host}`,
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      dbType: (credentials as DBCredentials & { dbType?: string }).dbType || 'postgresql',
    })
    if (res.success) {
      setShowAddModal(false)
      loadConnections()
    } else {
      toast.error(res.error || 'Could not add the connection.')
    }
  }

  async function confirmDeleteConnection() {
    if (!connectionToDelete) return
    const { id } = connectionToDelete
    setConnectionToDelete(null)
    setDeletingId(id)
    const res = await deleteConnectionAdmin(id)
    if (res.success) {
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } else {
      toast.error(res.error || 'Could not delete the connection.')
    }
    setDeletingId(null)
  }

  const term = searchTerm.toLowerCase()
  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.ownerName?.toLowerCase().includes(term) ||
      c.ownerEmail?.toLowerCase().includes(term) ||
      c.host.toLowerCase().includes(term)
  )

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Connections"
        description={
          <span aria-live="polite">
            {lastCheck ??
              `${connections.length.toLocaleString()} saved ${connections.length === 1 ? 'connection' : 'connections'}`}
          </span>
        }
      >
        <button onClick={loadConnections} disabled={loading} className="btn-ghost h-9 text-xs">
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Refresh
        </button>
        <button
          onClick={handleTestAll}
          disabled={isTestingAll || connections.length === 0}
          className="btn-secondary h-9 text-xs"
        >
          {isTestingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          Check all
        </button>
        <button onClick={() => setShowAddModal(true)} className="btn-primary h-9 text-xs">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add connection
        </button>
      </AdminTitle>

      <Figures
        items={[
          { label: 'Saved', value: connections.length.toLocaleString() },
          { label: 'Active', value: connections.filter((c) => c.isActive).length.toLocaleString() },
          {
            label: 'Owners',
            value: new Set(connections.map((c) => c.ownerEmail)).size.toLocaleString(),
          },
        ]}
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="admin-connections-search"
          type="search"
          placeholder="Search by connection, owner or host"
          aria-label="Search by connection, owner or host"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading && connections.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading connections…
          </div>
        ) : filteredConnections.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {connections.length === 0
              ? 'No one has saved a connection yet.'
              : 'No connection matches.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Connection</th>
                  <th>Type</th>
                  <th>Host</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th className="!text-right">Check</th>
                </tr>
              </thead>
              <tbody>
                {filteredConnections.map((conn) => {
                  const result = testResults[conn.id]
                  return (
                    <tr key={conn.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={clsx(
                              'h-2 w-2 flex-shrink-0 rounded-full',
                              result
                                ? result.success
                                  ? 'bg-success'
                                  : 'bg-destructive'
                                : conn.isActive
                                  ? 'bg-muted-foreground/50'
                                  : 'bg-border'
                            )}
                            title={
                              result
                                ? result.success
                                  ? 'Connected'
                                  : 'Could not connect'
                                : conn.isActive
                                  ? 'Active, not checked'
                                  : 'Inactive'
                            }
                          />
                          <div className="min-w-0">
                            <p className="max-w-[240px] truncate font-medium">{conn.name}</p>
                            {result && !result.success && (
                              <p
                                className="max-w-[240px] truncate text-xs text-destructive"
                                title={result.message}
                              >
                                {result.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{conn.dbType}</span>
                        {conn.ssl && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                            SSL
                          </span>
                        )}
                      </td>
                      <td>
                        <code className="font-mono text-xs text-muted-foreground">
                          {conn.host}:{conn.port}
                        </code>
                      </td>
                      <td>
                        <p className="max-w-[200px] truncate text-xs">
                          {conn.ownerName || 'Unknown'}
                        </p>
                        <p className="max-w-[200px] truncate text-[11px] text-muted-foreground">
                          {conn.ownerEmail}
                        </p>
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDay(conn.createdAt)}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleTestConnection(conn.id)}
                            disabled={testingId === conn.id || isTestingAll}
                            className="btn-secondary h-8 px-2.5 text-xs"
                          >
                            {testingId === conn.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                              'Test'
                            )}
                          </button>
                          <button
                            onClick={() => setConnectionToDelete({ id: conn.id, name: conn.name })}
                            disabled={deletingId === conn.id}
                            className="btn-ghost h-8 w-8 p-0 hover:!bg-destructive/10 hover:!text-destructive"
                            title="Delete connection"
                            aria-label={`Delete ${conn.name}`}
                          >
                            {deletingId === conn.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add connection */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            role="dialog"
            aria-labelledby="admin-add-connection-title"
            className="my-auto w-full max-w-lg rounded-lg border border-border bg-card shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 id="admin-add-connection-title" className="text-base font-semibold">
                  Add a connection
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Saved to your own account.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-ghost h-8 w-8 p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <SettingsForm
                onSchemaFetched={() => {}}
                onConnectionSuccess={handleAddConnection}
                onClose={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {connectionToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConnectionToDelete(null)}
        >
          <div
            role="alertdialog"
            aria-labelledby="admin-delete-connection-title"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-delete-connection-title" className="text-base font-semibold">
              Delete this connection?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{connectionToDelete.name}</span> will be
              removed from its owner&apos;s account. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConnectionToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={confirmDeleteConnection} className="btn-destructive">
                Delete connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
