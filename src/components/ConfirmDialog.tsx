'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div
          className={`h-1 w-full ${isDanger ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-primary to-accent'}`}
        />

        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDanger ? 'bg-red-500/10' : 'bg-primary/10'}`}
          >
            <AlertTriangle className={`w-7 h-7 ${isDanger ? 'text-red-500' : 'text-primary'}`} />
          </div>

          <h2 id="confirm-title" className="text-xl font-bold mb-2">
            {title}
          </h2>
          {description && (
            <p id="confirm-desc" className="text-sm text-muted-foreground mb-6">
              {description}
            </p>
          )}

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
