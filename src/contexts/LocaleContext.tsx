'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Locale } from '@/types/locale'

interface LocaleContextType {
    locale: Locale
    setLocale: (locale: Locale) => Promise<void>
    t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

interface LocaleProviderProps {
    children: ReactNode
    initialLocale?: Locale
    messages: Record<string, any>
}

export function LocaleProvider({
    children,
    initialLocale = 'en',
    messages: initialMessages
}: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale)
    const [messages, setMessages] = useState(initialMessages)
    const [isChanging, setIsChanging] = useState(false)

    const setLocale = async (newLocale: Locale) => {
        if (isChanging) return

        try {
            setIsChanging(true)

            // Set cookie
            document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`

            // Update user preference in DB (if authenticated)
            await fetch('/api/user/locale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: newLocale })
            }).catch(() => {
                // Ignore errors for unauthenticated users
            })

            // Load new translations
            const newMessages = await import(`@/messages/${newLocale}.json`)
            setMessages(newMessages.default)
            setLocaleState(newLocale)

            // Reload page to apply locale to server components
            window.location.reload()
        } catch (error) {
            console.error('Failed to change locale:', error)
            setIsChanging(false)
        }
    }

    const t = (key: string, params?: Record<string, string | number>): string => {
        const keys = key.split('.')
        let value: any = messages

        for (const k of keys) {
            value = value?.[k]
            if (value === undefined) break
        }

        // Fallback to key if translation missing
        if (typeof value !== 'string') {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`Translation missing for key: ${key}`)
            }
            return key
        }

        // Handle interpolation: {{param}}
        if (params) {
            return Object.entries(params).reduce(
                (str, [paramKey, paramValue]) =>
                    str.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue)),
                value
            )
        }

        return value
    }

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    )
}

export function useTranslation() {
    const context = useContext(LocaleContext)
    if (!context) {
        throw new Error('useTranslation must be used within LocaleProvider')
    }
    return context
}

// Optional: Export a safe version that doesn't throw
export function useTranslationSafe() {
    const context = useContext(LocaleContext)
    return context || {
        locale: 'en' as Locale,
        setLocale: async () => { },
        t: (key: string) => key
    }
}
