'use client'

import { useState, useEffect } from 'react'
import { X, Shield, Copy, Download, Check } from 'lucide-react'
import Image from 'next/image'

interface TwoFactorSetupProps {
    onClose: () => void
    onSuccess: () => void
}

interface SetupData {
    secret: string
    formattedSecret: string
    qrCode: string
    backupCodes: string[]
    hashedBackupCodes: string[]
}

export default function TwoFactorSetup({ onClose, onSuccess }: TwoFactorSetupProps) {
    const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup')
    const [setupData, setSetupData] = useState<SetupData | null>(null)
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [copiedSecret, setCopiedSecret] = useState(false)
    const [copiedBackupCodes, setCopiedBackupCodes] = useState(false)

    // Fetch 2FA setup data
    const handleSetup = async () => {
        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('/api/auth/2fa/setup', {
                method: 'POST',
            })

            const data = await response.json()

            if (data.success) {
                setSetupData(data.data)
            } else {
                setError(data.error || 'Failed to setup 2FA')
            }
        } catch (err) {
            setError('Network error. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    // Handle code input
    const handleCodeChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return // Only allow digits

        const newCode = [...verificationCode]
        newCode[index] = value.slice(-1) // Only take last digit
        setVerificationCode(newCode)

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`)
            nextInput?.focus()
        }
    }

    // Handle backspace
    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`)
            prevInput?.focus()
        }
    }

    // Verify code
    const handleVerify = async () => {
        const code = verificationCode.join('')
        if (code.length !== 6) {
            setError('Please enter all 6 digits')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, secret: setupData?.secret, hashedBackupCodes: setupData?.hashedBackupCodes }),
            })

            const data = await response.json()

            if (data.success) {
                setStep('backup')
            } else {
                setError('Invalid code. Please try again.')
                setVerificationCode(['', '', '', '', '', ''])
                document.getElementById('code-0')?.focus()
            }
        } catch (err) {
            setError('Verification failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    // Copy secret
    const copySecret = () => {
        if (setupData) {
            navigator.clipboard.writeText(setupData.secret)
            setCopiedSecret(true)
            setTimeout(() => setCopiedSecret(false), 2000)
        }
    }

    // Copy backup codes
    const copyBackupCodes = () => {
        if (setupData) {
            const codes = setupData.backupCodes.join('\n')
            navigator.clipboard.writeText(codes)
            setCopiedBackupCodes(true)
            setTimeout(() => setCopiedBackupCodes(false), 2000)
        }
    }

    // Download backup codes
    const downloadBackupCodes = () => {
        if (setupData) {
            const codes = setupData.backupCodes.join('\n')
            const blob = new Blob([`NatureQuery 2FA Backup Codes\n\n${codes}\n\nKeep these codes safe. Each can only be used once.`], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'naturequery-backup-codes.txt'
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    // Start setup on mount
    useEffect(() => {
        handleSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Two-Factor Authentication</h2>
                            <p className="text-xs text-muted-foreground">
                                {step === 'setup' && 'Scan QR code'}
                                {step === 'verify' && 'Enter verification code'}
                                {step === 'backup' && 'Save backup codes'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                        {error}
                    </div>
                )}

                {/* Step 1: Setup */}
                {step === 'setup' && setupData && (
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            <p className="mb-3">Scan this QR code with your authenticator app:</p>
                        </div>

                        <div className="flex justify-center p-6 bg-white rounded-xl border border-border">
                            <Image 
                                src={setupData.qrCode} 
                                alt="2FA QR Code" 
                                width={180} 
                                height={180}
                            />
                        </div>

                        {/* Manual Entry */}
                        <div className="p-3 bg-secondary rounded-lg border border-border">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Secret Key</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono bg-background px-2 py-1.5 rounded border border-border">
                                    {setupData.formattedSecret}
                                </code>
                                <button
                                    onClick={copySecret}
                                    className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                    title="Copy secret"
                                >
                                    {copiedSecret ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('verify')}
                            className="w-full btn-gradient py-2.5 text-sm"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Step 2: Verify */}
                {step === 'verify' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                                Enter the 6-digit code from your app
                            </p>
                        </div>

                        <div className="flex gap-2 justify-center">
                            {verificationCode.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`code-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleCodeChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-10 h-12 text-center text-xl font-bold bg-secondary border border-border rounded-lg focus:ring-1 focus:ring-primary"
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={handleVerify}
                                disabled={isLoading || verificationCode.join('').length !== 6}
                                className="w-full btn-gradient py-2.5 text-sm"
                            >
                                {isLoading ? 'Verifying...' : 'Enable 2FA'}
                            </button>
                            <button 
                                onClick={() => setStep('setup')}
                                className="w-full text-xs text-muted-foreground hover:text-primary text-center"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Backup Codes */}
                {step === 'backup' && setupData && (
                    <div className="space-y-5">
                        <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
                            <Check className="w-4 h-4 text-success" />
                            <p className="text-sm font-semibold text-success">2FA Activated</p>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            Save these backup codes safely. They are required if you lose access to your device.
                        </p>

                        <div className="p-3 bg-secondary rounded-lg border border-border">
                            <div className="grid grid-cols-2 gap-2">
                                {setupData.backupCodes.map((code, index) => (
                                    <code key={index} className="text-[11px] font-mono bg-background px-2 py-1 rounded border border-border">
                                        {code}
                                    </code>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={copyBackupCodes} className="flex-1 btn-secondary text-xs py-2">
                                {copiedBackupCodes ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                Copy
                            </button>
                            <button onClick={downloadBackupCodes} className="flex-1 btn-secondary text-xs py-2">
                                <Download className="w-3 h-3 mr-1" />
                                Download
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                onSuccess()
                                onClose()
                            }}
                            className="w-full btn-gradient py-2.5 text-sm font-bold"
                        >
                            All Set, Thanks!
                        </button>
                    </div>
                )}

                {isLoading && !setupData && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                )}
            </div>
        </div>
    )
}
