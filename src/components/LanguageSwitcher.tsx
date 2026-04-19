'use client'

import { useTranslation } from '@/contexts/LocaleContext'
import { locales, localeNames, localeFlags, type Locale } from '@/types/locale'
import { Globe, Check } from 'lucide-react'
import { useState } from 'react'

export function LanguageSwitcher() {
    const { locale, setLocale } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)
    const [isChanging, setIsChanging] = useState(false)

    const handleLocaleChange = async (newLocale: Locale) => {
        if (newLocale === locale || isChanging) return

        setIsChanging(true)
        setIsOpen(false)
        await setLocale(newLocale)
        // Page will reload automatically
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                disabled={isChanging}
            >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{localeFlags[locale]} {localeNames[locale]}</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                        {locales.map((loc) => (
                            <button
                                key={loc}
                                onClick={() => handleLocaleChange(loc)}
                                className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-accent transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <span>{localeFlags[loc]}</span>
                                    <span>{localeNames[loc]}</span>
                                </span>
                                {locale === loc && <Check className="w-4 h-4 text-primary" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
