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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <AlertTriangle
            className={`w-5 h-5 mb-3 ${isDanger ? 'text-destructive' : 'text-warning'}`}
            aria-hidden
          />

          <h2 id="confirm-title" className="text-lg font-semibold mb-1.5">
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
                isDanger ? 'bg-destructive hover:bg-destructive' : 'bg-primary hover:bg-primary/90'
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
