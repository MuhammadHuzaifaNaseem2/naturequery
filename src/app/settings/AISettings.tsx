'use client'

import { useState, useEffect } from 'react'
import { Bot, Key, Check, Trash2, Loader2, ExternalLink, AlertCircle, Shield } from 'lucide-react'
import { toast } from 'sonner'
import {
  saveUserGroqApiKey,
  removeUserGroqApiKey,
  hasUserGroqApiKey,
} from '@/actions/ai-settings'

export function AISettings() {
  const [hasKey, setHasKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)

  useEffect(() => {
    hasUserGroqApiKey()
      .then((r) => setHasKey(r.hasKey))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    const result = await saveUserGroqApiKey(apiKey)
    setSaving(false)
    if (result.success) {
      toast.success('API key saved! AI requests will now use your own key.')
      setHasKey(true)
      setApiKey('')
      setShowInput(false)
    } else {
      toast.error(result.error || 'Failed to save')
    }
  }

  const handleRemove = () => {
    setShowRemoveModal(true)
  }

  const confirmRemove = async () => {
    setShowRemoveModal(false)
    setRemoving(true)
    const result = await removeUserGroqApiKey()
    setRemoving(false)
    if (result.success) {
      toast.success('API key removed. Using shared key now.')
      setHasKey(false)
    } else {
      toast.error(result.error || 'Failed to remove')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your own AI API key to avoid shared rate limits.
        </p>
      </div>

      {/* Status card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasKey ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
            <Bot className={`w-5 h-5 ${hasKey ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">Groq API Key</h3>
              {hasKey ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                  YOUR KEY ACTIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                  USING SHARED KEY
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {hasKey
                ? 'You have your own API key configured. AI requests use your personal rate limit — no interference from other users.'
                : 'You are using the shared API key. When any user hits the rate limit, all users are affected. Add your own key to get your own rate limit.'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-border">
          {hasKey && !showInput ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span className="font-medium">API key configured</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowInput(true)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Replace Key
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
              >
                {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="btn-primary text-sm px-5 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                {hasKey && (
                  <button
                    onClick={() => { setShowInput(false); setApiKey('') }}
                    className="btn-secondary text-sm px-3"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How to get a key */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          How to get your own Groq API key
        </h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">console.groq.com/keys <ExternalLink className="w-3 h-3" /></a></li>
          <li>Sign up or log in (free)</li>
          <li>Create an API key</li>
          <li>Paste it above</li>
        </ol>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your API key is encrypted with AES-256-GCM before storage. It is never exposed to the browser — only used server-side for AI requests.
          </p>
        </div>
      </div>

      {/* Why this matters */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Why do I see &quot;AI rate limit reached&quot;?
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The AI features use Groq&apos;s API for fast SQL generation. The free tier has rate limits per API key.
          When multiple users share one key, one user&apos;s heavy usage can temporarily block everyone else.
          Adding your own key gives you a separate rate limit that no one else can affect.
        </p>
      </div>

      {/* Remove Confirm Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold">Remove API Key</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Remove your API key? AI operations will fall back to the shared community key, which is subject to shared rate limits.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmRemove}
                className="btn-primary flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              >
                Yes, Remove Key
              </button>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="btn-secondary flex-1"
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
