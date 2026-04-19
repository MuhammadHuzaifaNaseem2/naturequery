import { cookies } from 'next/headers'
import type { Locale } from '@/types/locale'

/**
 * Get the current locale from cookie or default to 'en'
 */
export async function getLocale(): Promise<Locale> {
    const cookieStore = await cookies()
    const localeCookie = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined
    return localeCookie || 'en'
}

/**
 * Load translation messages for a specific locale
 */
export async function getTranslations(locale?: Locale) {
    const currentLocale = locale || await getLocale()
    try {
        const messages = await import(`@/messages/${currentLocale}.json`)
        return messages.default
    } catch (error) {
        console.error(`Failed to load translations for locale: ${currentLocale}`, error)
        // Fallback to English
        const fallbackMessages = await import(`@/messages/en.json`)
        return fallbackMessages.default
    }
}

/**
 * Create a translator function for server components
 */
export function createTranslator(messages: Record<string, any>) {
    return (key: string, params?: Record<string, string | number>): string => {
        const keys = key.split('.')
        let value: any = messages

        for (const k of keys) {
            value = value?.[k]
            if (value === undefined) break
        }

        // Fallback to key if translation missing
        if (typeof value !== 'string') {
            console.warn(`Translation missing for key: ${key}`)
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
}

/**
 * Format date according to locale
 */
export function formatDate(date: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date)
}

/**
 * Format number according to locale
 */
export function formatNumber(num: number, locale: Locale): string {
    return new Intl.NumberFormat(locale).format(num)
}

/**
 * Format currency according to locale
 */
export function formatCurrency(amount: number, locale: Locale, currency: string = 'USD'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
    }).format(amount)
}
