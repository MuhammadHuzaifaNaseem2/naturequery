'use client'

import { useState } from 'react'
import {
  Shield,
  Key,
  Smartphone,
  AlertTriangle,
  Copy,
  Check,
  Download,
  X,
  RefreshCw,
  CheckCircle,
  Trash2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import TwoFactorSetup from '@/components/TwoFactorSetup'
import { signOut } from 'next-auth/react'
import { useTranslation } from '@/contexts/LocaleContext'

interface SecurityClientProps {
  initialTwoFactorEnabled: boolean
}

export default function SecurityClient({ initialTwoFactorEnabled }: SecurityClientProps) {
  const { t } = useTranslation()
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initialTwoFactorEnabled)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [isChangingPw, setIsChangingPw] = useState(false)
  const [pwError, setPwError] = useState('')

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleDisable2FA = async () => {
    setShowDisableConfirm(false)
    setIsDisabling(true)
    try {
      const response = await fetch('/api/auth/2fa/disable', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setTwoFactorEnabled(false)
        showToast('Two-factor authentication has been disabled')
      } else {
        showToast(data.error || 'Failed to disable 2FA', 'error')
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setIsDisabling(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    setShowRegenerateConfirm(false)
    setIsRegenerating(true)
    try {
      const response = await fetch('/api/auth/2fa/regenerate-backup', { method: 'POST' })
      const data = await response.json()
      if (data.success) setNewBackupCodes(data.data.backupCodes)
      else showToast(data.error || 'Failed to regenerate backup codes', 'error')
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setIsRegenerating(false)
    }
  }

  const copyBackupCodes = () => {
    if (newBackupCodes) {
      navigator.clipboard.writeText(newBackupCodes.join('\n'))
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await response.json()
      if (data.success) {
        await signOut({ callbackUrl: '/' })
      } else {
        showToast(data.error || 'Failed to delete account', 'error')
        setShowDeleteConfirm(false)
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadBackupCodes = () => {
    if (newBackupCodes) {
      const content = `NatureQuery 2FA Backup Codes\n\n${newBackupCodes.join('\n')}\n\nKeep these codes safe. Each can only be used once.`
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'naturequery-backup-codes.txt'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    setIsChangingPw(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        showToast('Password changed successfully')
      } else {
        setPwError(data.error || 'Failed to change password')
      }
    } catch {
      setPwError('Network error. Please try again.')
    } finally {
      setIsChangingPw(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-slideUp ${
              toast.type === 'success'
                ? 'bg-success/10 border border-success/30 text-success'
                : 'bg-destructive/10 border border-destructive/30 text-destructive'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('settings.security.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('settings.security.description')}
          </p>
        </div>

        {/* 2FA Section */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <h2 className="text-xl font-bold">Two-Factor Authentication</h2>
                <div
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium w-fit ${
                    twoFactorEnabled
                      ? 'bg-success/10 text-success border border-success/50'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {twoFactorEnabled ? '✓ Enabled' : '○ Disabled'}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Add an extra layer of security to your account by requiring a verification code from
                your authenticator app when signing in.
              </p>
              {!twoFactorEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Smartphone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Works with Google Authenticator, Authy, Microsoft Authenticator, and more
                    </span>
                  </div>
                  <button onClick={() => setShowSetupModal(true)} className="btn-gradient">
                    <Key className="w-4 h-4 mr-2" />
                    Enable 2FA
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-success/10 border border-success/50 rounded-lg">
                    <p className="text-sm text-success font-medium">
                      ✓ Your account is protected with 2FA
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowRegenerateConfirm(true)}
                      disabled={isRegenerating}
                      className="btn-secondary text-sm"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`}
                      />
                      {isRegenerating ? 'Regenerating...' : 'Regenerate Backup Codes'}
                    </button>
                    <button
                      onClick={() => setShowDisableConfirm(true)}
                      disabled={isDisabling}
                      className="btn-secondary text-sm text-destructive hover:bg-destructive/10"
                    >
                      {isDisabling ? 'Disabling...' : 'Disable 2FA'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <h2 className="text-lg sm:text-xl font-bold mb-1">
                {t('settings.security.changePassword')}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t('settings.security.changePasswordDesc')}
              </p>
              <div className="space-y-3 w-full sm:max-w-sm">
                {/* Current password */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value)
                        setPwError('')
                      }}
                      placeholder="Enter current password"
                      className="input w-full pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* New password */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        setPwError('')
                      }}
                      placeholder="Min 8 chars, 3 of 4 types"
                      className="input w-full pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* Confirm password */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setPwError('')
                      }}
                      placeholder="Repeat new password"
                      className="input w-full pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {pwError && (
                  <p className="text-sm text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {pwError}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPw || !currentPassword || !newPassword || !confirmPassword}
                  className="btn-gradient disabled:opacity-50"
                >
                  {isChangingPw ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-destructive/20">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <h2 className="text-lg sm:text-xl font-bold mb-1">
                {t('settings.security.dangerZone')}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t('settings.security.dangerZoneDesc')}
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-secondary text-sm text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('settings.security.deleteAccount')}
              </button>
            </div>
          </div>
        </div>

        {/* Security Tips */}
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <h2 className="text-lg sm:text-xl font-bold mb-2">Security Tips</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Save your backup codes in a secure location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Never share your 2FA codes with anyone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Use a strong, unique password for your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Keep your authenticator app up to date</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Disable 2FA Confirmation */}
      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-lg font-bold">Disable 2FA?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will make your account less secure. You will no longer need a verification code
              to sign in.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDisableConfirm(false)}
                className="flex-1 btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable2FA}
                disabled={isDisabling}
                className="flex-1 btn-secondary text-sm text-destructive hover:bg-destructive/10"
              >
                Yes, Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-warning" />
              </div>
              <h3 className="text-lg font-bold">Regenerate Backup Codes?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              All existing backup codes will be invalidated. Save the new ones in a safe place
              immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateBackupCodes}
                disabled={isRegenerating}
                className="flex-1 btn-gradient text-sm"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {showSetupModal && (
        <TwoFactorSetup
          onClose={() => setShowSetupModal(false)}
          onSuccess={() => {
            setTwoFactorEnabled(true)
            showToast('Two-factor authentication enabled successfully!')
          }}
        />
      )}

      {/* Delete Account Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-lg font-bold">Delete Account?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete your account, connections, queries, and all data.{' '}
              <strong>This cannot be undone.</strong>
            </p>
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Confirm your password
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletePassword('')
                }}
                className="flex-1 btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
                className="flex-1 btn-secondary text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Backup Codes Modal */}
      {newBackupCodes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">New Backup Codes</h3>
              <button
                onClick={() => setNewBackupCodes(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Save these codes somewhere safe. Your old codes are now invalid. Each code can only be
              used once.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-lg bg-secondary/30 font-mono text-sm">
              {newBackupCodes.map((code, index) => (
                <div key={index} className="text-center py-1">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={copyBackupCodes} className="flex-1 btn-secondary text-sm">
                {copiedCodes ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copiedCodes ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={downloadBackupCodes} className="flex-1 btn-secondary text-sm">
                <Download className="w-4 h-4 mr-2" />
                Download
              </button>
            </div>
            <button onClick={() => setNewBackupCodes(null)} className="btn-primary w-full text-sm">
              I&apos;ve saved my codes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
