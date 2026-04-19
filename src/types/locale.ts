export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja'

export const locales: Locale[] = ['en', 'es', 'fr', 'de', 'ja']

export const localeNames: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ja: '日本語'
}

export const localeFlags: Record<Locale, string> = {
    en: '🇺🇸',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    ja: '🇯🇵'
}
