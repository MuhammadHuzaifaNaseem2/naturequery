'use client'

import { Suspense, useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { AppLogo } from '@/components/AppLogo'
import Link from 'next/link'
import { Mail, Lock, Loader2, AlertCircle, Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from '@/contexts/LocaleContext'
import { AuthLayout } from '@/components/AuthLayout'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { preFlightCheck } from '@/actions/auth'

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const oauthProviders = useOAuthProviders()
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    // 2FA challenge state
    const [show2FA, setShow2FA] = useState(false)
    const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', ''])
    const [savedCredentials, setSavedCredentials] = useState<LoginFormData | null>(null)
    const [useBackupCode, setUseBackupCode] = useState(false)
    const [backupCode, setBackupCode] = useState('')
    const codeInputsRef = useRef<(HTMLInputElement | null)[]>([])

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true)
        setError(null)

        try {
            // Step 1: Pre-flight check — validate credentials & detect 2FA before calling NextAuth
            // NextAuth v5 (Auth.js) swallows error strings so we can't rely on result.error for 2FA detection
            const preflight = await preFlightCheck(data.email, data.password)

            if (preflight.error) {
                setError(preflight.error)
                return
            }

            if (preflight.requires2FA) {
                // Don't call signIn yet — just show the 2FA input form
                setSavedCredentials(data)
                setShow2FA(true)
                setError(null)
                return
            }

            // Step 2: No 2FA, proceed with full NextAuth sign-in
            const result = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false,
                callbackUrl,
            })

            if (result?.error) {
                setError('Invalid email or password')
            } else if (result?.url) {
                window.location.href = result.url
            } else {
                window.location.href = callbackUrl
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handle2FASubmit = async () => {
        if (!savedCredentials) return

        const code = useBackupCode ? backupCode.trim() : twoFactorCode.join('')
        if (!useBackupCode && code.length !== 6) {
            setError('Please enter all 6 digits')
            return
        }
        if (useBackupCode && !code) {
            setError('Please enter a backup code')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const result = await signIn('credentials', {
                email: savedCredentials.email,
                password: savedCredentials.password,
                twoFactorCode: code,
                redirect: false,
                callbackUrl,
            })

            if (result?.error) {
                setError('Invalid 2FA code. Please try again.')
                setTwoFactorCode(['', '', '', '', '', ''])
                codeInputsRef.current[0]?.focus()
            } else if (result?.url) {
                window.location.href = result.url
            } else {
                window.location.href = callbackUrl
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCodeChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return
        const newCode = [...twoFactorCode]
        newCode[index] = value.slice(-1)
        setTwoFactorCode(newCode)

        if (value && index < 5) {
            codeInputsRef.current[index + 1]?.focus()
        }
    }

    const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
            codeInputsRef.current[index - 1]?.focus()
        }
        if (e.key === 'Enter') {
            handle2FASubmit()
        }
    }

    const handleOAuthSignIn = async (provider: 'google' | 'github') => {
        setIsLoading(true)
        await signIn(provider, { callbackUrl })
    }

    // 2FA Challenge Screen
    if (show2FA) {
        return (
            <div className="glass-card rounded-2xl p-8 shadow-xl animate-fadeIn border border-border">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('auth.login.twoFactorCode')}</h1>
                    <p className="text-sm text-muted-foreground mt-1 text-center">
                        {useBackupCode
                            ? 'Enter one of your backup codes'
                            : t('auth.login.twoFactorPlaceholder')}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-2 animate-slideUp">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                <div className="space-y-5">
                    {useBackupCode ? (
                        <div>
                            <label className="block text-sm font-medium mb-2">Backup Code</label>
                            <input
                                type="text"
                                value={backupCode}
                                onChange={(e) => setBackupCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handle2FASubmit()}
                                placeholder="XXXX-XXXX-XXXX"
                                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all"
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>
                    ) : (
                        <div className="flex gap-2 justify-center">
                            {twoFactorCode.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => { codeInputsRef.current[index] = el }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleCodeChange(index, e.target.value)}
                                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                    className="w-12 h-14 text-center text-2xl font-bold bg-secondary/30 border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                    autoFocus={index === 0}
                                    disabled={isLoading}
                                />
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handle2FASubmit}
                        disabled={isLoading}
                        className="btn-gradient w-full py-3"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            t('common.confirm')
                        )}
                    </button>

                    <div className="flex items-center justify-between text-sm">
                        <button
                            onClick={() => {
                                setShow2FA(false)
                                setSavedCredentials(null)
                                setError(null)
                                setTwoFactorCode(['', '', '', '', '', ''])
                                setBackupCode('')
                                setUseBackupCode(false)
                            }}
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {t('common.back')}
                        </button>

                        <button
                            onClick={() => {
                                setUseBackupCode(!useBackupCode)
                                setError(null)
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            {useBackupCode ? 'Use authenticator app' : 'Use backup code'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Normal Login Screen
    return (
        <div className="glass-card rounded-2xl p-8 shadow-xl animate-fadeIn border border-border">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
                <AppLogo size="xl" showText={false} className="mb-4" />
                <h1 className="text-2xl font-bold">{t('auth.login.title')}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t('auth.login.subtitle')}
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-2 animate-slideUp">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium mb-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {t('auth.login.email')}
                    </label>
                    <input
                        {...register('email')}
                        id="email"
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        placeholder={t('auth.login.emailPlaceholder')}
                        className="input rounded-xl py-3"
                        disabled={isLoading}
                        suppressHydrationWarning
                    />
                    {errors.email && (
                        <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium mb-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        {t('auth.login.password')}
                    </label>
                    <div className="relative">
                        <input
                            {...register('password')}
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder={t('auth.login.passwordPlaceholder')}
                            className="input rounded-xl py-3 pr-10"
                            disabled={isLoading}
                            suppressHydrationWarning
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            suppressHydrationWarning
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-gradient w-full py-3"
                    suppressHydrationWarning
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('common.loading')}
                        </>
                    ) : (
                        t('auth.login.submit')
                    )}
                </button>
            </form>

            {/* OAuth Buttons — only shown when providers are configured */}
            {(oauthProviders.google || oauthProviders.github) && (
                <>
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">{t('auth.register.orContinueWith')}</span>
                        </div>
                    </div>

                    <div className={`grid gap-3 ${oauthProviders.google && oauthProviders.github ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {oauthProviders.google && (
                            <button
                                onClick={() => handleOAuthSignIn('google')}
                                disabled={isLoading}
                                className="btn-secondary text-sm py-2"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {t('auth.register.google')}
                            </button>
                        )}
                        {oauthProviders.github && (
                            <button
                                onClick={() => handleOAuthSignIn('github')}
                                disabled={isLoading}
                                className="btn-secondary text-sm py-2"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                {t('auth.register.github')}
                            </button>
                        )}
                    </div>
                </>
            )}


            {/* Forgot Password & Sign Up Links */}
            <div className="text-center text-sm text-muted-foreground mt-6 space-y-2">
                <p>
                    <Link href="/forgot-password" className="text-primary hover:underline font-medium">
                        {t('auth.login.forgotPassword')}
                    </Link>
                </p>
                <p>
                    {t('auth.login.noAccount')}{' '}
                    <Link href="/register" className="text-primary hover:underline font-medium">
                        {t('auth.login.signUp')}
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <AuthLayout>
            <Suspense fallback={<div className="glass-card rounded-2xl p-8 animate-fadeIn"><div className="text-center text-muted-foreground">Loading...</div></div>}>
                <LoginForm />
            </Suspense>
        </AuthLayout>
    )
}
