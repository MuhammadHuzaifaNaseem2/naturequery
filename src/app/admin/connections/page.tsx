'use client'

import { useState, useEffect } from 'react'
import { getAdminAllConnections, adminTestConnectionById, adminTestAllConnections, deleteConnectionAdmin } from '@/actions/admin'
import { saveConnection } from '@/actions/connections'
import type { AdminConnectionInfo } from '@/actions/admin'
import type { DBCredentials, DatabaseSchema } from '@/actions/db'
import SettingsForm from '@/components/SettingsForm'
import {
  Database, CheckCircle2, XCircle, Search, RefreshCw, User,
  Play, Loader2, Trash2, ShieldCheck, ServerCrash, Plus, X,
} from 'lucide-react'
import { useAdminClasses, useAdminTheme } from '../AdminThemeProvider'

// ─── DB Logos ─────────────────────────────────────────────────────────────

const DB_LOGOS: Record<string, React.ReactNode> = {
  postgresql: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#336791"/>
      <ellipse cx="16" cy="15" rx="7" ry="8" fill="white" opacity="0.9"/>
      <ellipse cx="16" cy="10" rx="5" ry="4" fill="#336791"/>
      <circle cx="13.5" cy="13" r="1.2" fill="#336791"/>
      <circle cx="18.5" cy="13" r="1.2" fill="#336791"/>
    </svg>
  ),
  mysql: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#00758F"/>
      <path d="M6 20 Q10 10 16 12 Q22 14 26 10 Q24 18 18 18 Q14 18 12 22 Q9 26 6 20z" fill="white" opacity="0.9"/>
      <circle cx="22" cy="11" r="1.5" fill="#F29111"/>
    </svg>
  ),
  mariadb: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#C0765A"/>
      <path d="M8 22 Q8 14 14 12 Q20 10 22 14 Q24 18 20 20 Q16 22 14 20 Q12 18 14 16" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="13" r="1.5" fill="white"/>
    </svg>
  ),
  sqlserver: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#CC2927"/>
      <path d="M11 11 Q11 9 16 9 Q21 9 21 12 Q21 15 16 15.5 Q11 16 11 19.5 Q11 23 16 23 Q21 23 21 21" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  sqlite: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="16" rx="7" ry="11" fill="#003B57"/>
      <ellipse cx="14" cy="7" rx="7" ry="3.5" fill="#0F80CC"/>
      <path d="M21 9 L27 4" stroke="#0F80CC" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="27" cy="4" r="2" fill="#0F80CC"/>
    </svg>
  ),
  oracle: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#F80000"/>
      <path d="M16 8 A8 8 0 1 1 15.99 8Z" fill="none" stroke="white" strokeWidth="5"/>
    </svg>
  ),
  mongodb: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3 C14 9 9 12 9 18 A7 7 0 0 0 23 18 C23 12 18 9 16 3Z" fill="#10AA50"/>
      <rect x="15" y="22" width="2" height="7" rx="1" fill="#10AA50"/>
    </svg>
  ),
  clickhouse: (
    <svg viewBox="0 0 32 32" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1C1C1C"/>
      <rect x="4" y="8" width="4" height="16" rx="1" fill="#FAFF69"/>
      <rect x="10" y="8" width="4" height="16" rx="1" fill="#FAFF69"/>
      <rect x="16" y="8" width="4" height="16" rx="1" fill="#FAFF69"/>
      <rect x="22" y="8" width="4" height="8" rx="1" fill="#FAFF69"/>
    </svg>
  ),
}

function DbLogo({ dbType }: { dbType: string }) {
  const logo = DB_LOGOS[dbType.toLowerCase()]
  if (logo) return <>{logo}</>
  return <Database className="w-5 h-5 text-slate-400" />
}

// ─── Toast ───────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg shadow-xl text-white text-sm font-medium z-50 animate-slideUp ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {message}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function AdminConnectionsPage() {
  const [connections, setConnections] = useState<AdminConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string }>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const t = useAdminClasses()
  const { isDark } = useAdminTheme()

  useEffect(() => { loadConnections() }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  async function loadConnections() {
    setLoading(true)
    const res = await getAdminAllConnections()
    if (res.success && res.connections) {
      setConnections(res.connections)
    } else {
      showToast(res.error || 'Failed to load connections', 'error')
    }
    setLoading(false)
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  async function handleTestConnection(id: string) {
    setTestingId(id)
    setTestResults(prev => ({ ...prev, [id]: { success: false, message: undefined } }))

    const res = await adminTestConnectionById(id)

    setTestResults(prev => ({
      ...prev,
      [id]: {
        success: res.success,
        message: res.success ? 'Connected' : (res.error || 'Failed'),
      },
    }))

    showToast(res.success ? 'Connection successful' : (res.error || 'Connection failed'), res.success ? 'success' : 'error')
    setTestingId(null)
  }

  async function handleTestAll() {
    setIsTestingAll(true)
    setTestResults({})

    const res = await adminTestAllConnections()

    if (res.success && res.results) {
      const newResults: Record<string, { success: boolean; message?: string }> = {}
      let successCount = 0

      res.results.forEach(r => {
        newResults[r.connectionId] = {
          success: r.success,
          message: r.success ? 'Connected' : (r.error || 'Failed'),
        }
        if (r.success) successCount++
      })

      setTestResults(newResults)
      showToast(`${successCount}/${res.results.length} connections healthy`, 'success')
    } else {
      showToast(res.error || 'Failed to test', 'error')
    }

    setIsTestingAll(false)
  }

  async function handleAddConnection(credentials: DBCredentials, schema: DatabaseSchema) {
    setIsSaving(true)
    const res = await saveConnection({
      name: `${credentials.database}@${credentials.host}`,
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      dbType: (credentials as any).dbType || 'postgresql',
    })
    setIsSaving(false)

    if (res.success) {
      showToast('Connection added successfully', 'success')
      setShowAddModal(false)
      loadConnections()
    } else {
      showToast(res.error || 'Failed to add connection', 'error')
    }
  }

  function handleDeleteConnection(id: string, name: string) {
    setConnectionToDelete({ id, name })
  }

  async function confirmDeleteConnection() {
    if (!connectionToDelete) return
    const { id, name } = connectionToDelete
    setConnectionToDelete(null)
    setDeletingId(id)
    const res = await deleteConnectionAdmin(id)
    if (res.success) {
      setConnections(prev => prev.filter(c => c.id !== id))
      showToast('Connection deleted', 'success')
    } else {
      showToast(res.error || 'Failed to delete', 'error')
    }
    setDeletingId(null)
  }

  const filteredConnections = connections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.host.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${t.text}`}>All Connections</h2>
          <p className={`text-sm mt-0.5 ${t.textMuted}`}>{connections.length} database connections</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadConnections}
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-colors ${t.btnSecondary}`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handleTestAll}
            disabled={isTestingAll || connections.length === 0}
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${t.btnSecondary}`}
          >
            {isTestingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Test All
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Connection
          </button>
        </div>
      </div>

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowAddModal(false)}>
          <div className={`relative w-full max-w-lg mx-4 rounded-2xl border shadow-2xl max-h-[85vh] overflow-y-auto animate-scaleIn ${t.cardSolid}`} onClick={e => e.stopPropagation()}>
            <div className={`sticky top-0 z-10 flex items-center justify-between p-5 pb-3 border-b rounded-t-2xl ${t.cardSolid} ${isDark ? 'border-neutral-800/50' : 'border-slate-200'}`}>
              <div>
                <h2 className={`text-base font-semibold ${t.text}`}>Add Database Connection</h2>
                <p className={`text-xs mt-0.5 ${t.textMuted}`}>Connect to any database as admin</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 pt-3">
              <SettingsForm
                onSchemaFetched={() => {}}
                onConnectionSuccess={handleAddConnection}
                onClose={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Metric Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <span className={`text-xs font-medium ${t.textMuted}`}>Total</span>
          </div>
          <div className={`text-2xl font-bold stat-number ${t.text}`}>{connections.length}</div>
        </div>

        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span className={`text-xs font-medium ${t.textMuted}`}>Active</span>
          </div>
          <div className={`text-2xl font-bold stat-number ${t.text}`}>
            {connections.filter(c => c.isActive).length}
          </div>
        </div>

        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <span className={`text-xs font-medium ${t.textMuted}`}>Unique Owners</span>
          </div>
          <div className={`text-2xl font-bold stat-number ${t.text}`}>
            {new Set(connections.map(c => c.ownerEmail)).size}
          </div>
        </div>
      </div>

      {/* ─── Search ──────────────────────────────────────────── */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textSubtle}`} />
        <input
          type="text"
          placeholder="Search connection, owner, host..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${t.input}`}
        />
      </div>

      {/* ─── Table ───────────────────────────────────────────── */}
      <div className={`rounded-xl border ${t.card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${t.tableHead}`}>
                {['Status', 'Connection', 'Type', 'Host', 'Owner', 'Created', 'Actions'].map((h, i) => (
                  <th key={h} className={`p-4 text-[10px] font-semibold uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${t.tableRow.split(' ')[1]}`}>
              {filteredConnections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <ServerCrash className={`w-10 h-10 mx-auto mb-3 ${t.textTiny}`} />
                    <p className={`text-sm ${t.textMuted}`}>No connections found</p>
                  </td>
                </tr>
              ) : (
                filteredConnections.map(conn => {
                  const result = testResults[conn.id]
                  return (
                    <tr key={conn.id} className={`transition-colors group ${t.tableRow.split(' ')[0]}`}>
                      {/* Status */}
                      <td className="p-4">
                        {result ? (
                          result.success ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          )
                        ) : (
                          <div className={`w-2.5 h-2.5 rounded-full ${conn.isActive ? (isDark ? 'bg-neutral-400' : 'bg-slate-300') : (isDark ? 'bg-neutral-700' : 'bg-slate-200')}`} />
                        )}
                      </td>

                      {/* Connection */}
                      <td className="p-4">
                        <p className={`text-sm font-medium ${t.text}`}>{conn.name}</p>
                        {result && !result.success && (
                          <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[200px]">{result.message}</p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <DbLogo dbType={conn.dbType} />
                          <span className={`text-sm capitalize ${t.textMuted}`}>{conn.dbType}</span>
                          {conn.ssl && (
                            <span title="SSL"><ShieldCheck className="w-3 h-3 text-emerald-500" /></span>
                          )}
                        </div>
                      </td>

                      {/* Host */}
                      <td className="p-4">
                        <code className={`text-xs font-mono ${t.textSubtle}`}>{conn.host}:{conn.port}</code>
                      </td>

                      {/* Owner */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-md border flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-neutral-800 border-neutral-700/50 text-neutral-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                            {conn.ownerName?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className={`text-xs ${t.text}`}>{conn.ownerName || 'Unknown'}</p>
                            <p className={`text-[10px] ${t.textSubtle}`}>{conn.ownerEmail}</p>
                          </div>
                        </div>
                      </td>

                      {/* Created */}
                      <td className={`p-4 text-xs ${t.textMuted}`}>
                        {new Date(conn.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleTestConnection(conn.id)}
                            disabled={testingId === conn.id || isTestingAll}
                            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/50' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                          >
                            {testingId === conn.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Test'
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteConnection(conn.id, conn.name)}
                            disabled={deletingId === conn.id}
                            className={`p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${isDark ? 'text-neutral-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                          >
                            {deletingId === conn.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {connectionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setConnectionToDelete(null)}>
          <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl p-6 animate-scaleIn ${t.cardSolid}`} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className={`text-lg font-semibold ${t.text}`}>Delete connection?</h3>
            <p className={`text-sm mt-2 ${t.textMuted}`}>
              Are you sure you want to delete <span className="font-semibold">&quot;{connectionToDelete.name}&quot;</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmDeleteConnection}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConnectionToDelete(null)}
                className={`flex-1 px-4 py-2 border text-sm font-medium rounded-xl transition-colors ${
                  isDark 
                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
