'use client'

import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Loader2, Copy, Check, AlertTriangle } from 'lucide-react'
import { createApiKey, listApiKeys, revokeApiKey } from '@/actions/api-keys'
import { useTranslation } from '@/contexts/LocaleContext'

interface ApiKeyDisplay {
  id: string
  name: string
  prefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export function ApiKeySettings() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [expiryDays, setExpiryDays] = useState<string>('90')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Custom confirm modal state
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null)

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

  function handleRevoke(keyId: string) {
    setKeyToRevoke(keyId)
  }

  async function confirmRevoke() {
    if (!keyToRevoke) return
    const keyId = keyToRevoke
    setKeyToRevoke(null)

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
    if (!date) return t('settings.apiKeys.never')
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
            <span className="text-sm font-medium">{t('settings.apiKeys.copyKeyNow')}</span>
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
            {t('settings.apiKeys.copiedDismiss')}
          </button>
        </div>
      )}

      {/* Create API Key */}
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          {t('settings.apiKeys.createKey')}
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium text-sm">{t('settings.apiKeys.createNewKey')}</h4>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('settings.apiKeys.keyNamePlaceholder')}
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('settings.apiKeys.expiration')}</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
            >
              <option value="30">{t('settings.apiKeys.30days')}</option>
              <option value="90">{t('settings.apiKeys.90days')}</option>
              <option value="180">{t('settings.apiKeys.180days')}</option>
              <option value="365">{t('settings.apiKeys.1year')}</option>
              <option value="never">{t('settings.apiKeys.noExpiration')}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="btn-primary text-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {t('settings.apiKeys.create')}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-8">
          <Key className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('settings.apiKeys.noKeys')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t('settings.apiKeys.noKeysDesc')}
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
                          {t('settings.apiKeys.expired')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <code className="font-mono">{key.prefix}...</code>
                      <span>{t('settings.apiKeys.created')} {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && <span>{t('settings.apiKeys.lastUsedLabel')} {formatDate(key.lastUsedAt)}</span>}
                      {key.expiresAt && <span>{t('settings.apiKeys.expires')} {formatDate(key.expiresAt)}</span>}
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
        <h4 className="text-sm font-medium mb-2">{t('settings.apiKeys.usageTitle')}</h4>
        <p className="text-xs text-muted-foreground mb-2">
          {t('settings.apiKeys.usageDesc')}
        </p>
        <code className="block px-3 py-2 bg-secondary rounded-lg text-xs font-mono">
          Authorization: Bearer rp_your_api_key_here
        </code>
      </div>

      {/* Revoke Confirm Modal */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold">{t('settings.apiKeys.revoke')}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t('settings.apiKeys.revokeConfirm')}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmRevoke}
                className="btn-primary flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              >
                {t('settings.apiKeys.revoke')}
              </button>
              <button
                onClick={() => setKeyToRevoke(null)}
                className="btn-secondary flex-1"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

