'use client'

import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Loader2, Copy, Check, AlertTriangle } from 'lucide-react'
import { createApiKey, listApiKeys, revokeApiKey } from '@/actions/api-keys'

interface ApiKeyDisplay {
  id: string
  name: string
  prefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export function ApiKeySettings() {
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [expiryDays, setExpiryDays] = useState<string>('90')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Newly created key (shown once)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    setLoading(true)
    const result = await listApiKeys()
    if (result.success && result.data) {
      setKeys(result.data as ApiKeyDisplay[])
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setError(null)

    const days = expiryDays === 'never' ? undefined : parseInt(expiryDays)
    const result = await createApiKey(newKeyName.trim(), days)
    setCreating(false)

    if (result.success && result.data) {
      setNewKey(result.data.key)
      setNewKeyName('')
      setShowCreate(false)
      await loadKeys()
    } else {
      setError(result.error || 'Failed to create API key')
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this API key? Any applications using it will stop working.')) return

    const result = await revokeApiKey(keyId)
    if (result.success) {
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } else {
      setError(result.error || 'Failed to revoke API key')
    }
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function formatDate(date: Date | string | null) {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function isExpired(date: Date | string | null) {
    if (!date) return false
    return new Date(date) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Newly created key banner */}
      {newKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Copy your API key now. It won't be shown again.</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs font-mono break-all">
              {newKey}
            </code>
            <button onClick={handleCopy} className="btn-secondary text-sm py-2">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-amber-600 hover:underline">
            I've copied it, dismiss
          </button>
        </div>
      )}

      {/* Create API Key */}
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium text-sm">Create a New API Key</h4>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production App)"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Expiration</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="never">No expiration</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="btn-primary text-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-8">
          <Key className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No API keys</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create an API key to access ReportFlow programmatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => {
            const expired = isExpired(key.expiresAt)
            return (
              <div
                key={key.id}
                className="card p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Key className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{key.name}</h4>
                      {expired && (
                        <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded text-[10px] font-medium">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <code className="font-mono">{key.prefix}...</code>
                      <span>Created {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && <span>Last used {formatDate(key.lastUsedAt)}</span>}
                      {key.expiresAt && <span>Expires {formatDate(key.expiresAt)}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Revoke key"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Usage info */}
      <div className="card p-4">
        <h4 className="text-sm font-medium mb-2">Usage</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Include your API key in the Authorization header:
        </p>
        <code className="block px-3 py-2 bg-secondary rounded-lg text-xs font-mono">
          Authorization: Bearer rp_your_api_key_here
        </code>
      </div>
    </div>
  )
}
