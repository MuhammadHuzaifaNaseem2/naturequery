'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'warm' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with server-safe defaults so server and client render identically.
  // The blocking <script> in layout.tsx already applied the correct CSS class,
  // so there is no visual flash of wrong theme.
  const [theme, setTheme] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // After mount, read the stored preference from localStorage (client-only).
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'system'
    setTheme(saved)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (mode: 'dark' | 'light' | 'warm') => {
      root.classList.remove('dark', 'warm')
      if (mode === 'dark') {
        root.classList.add('dark')
        setResolvedTheme('dark')
      } else if (mode === 'warm') {
        root.classList.add('warm')
        setResolvedTheme('light')
      } else {
        setResolvedTheme('light')
      }
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mediaQuery.matches ? 'dark' : 'light')

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light')
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    } else if (theme === 'warm') {
      applyTheme('warm')
    } else {
      applyTheme(theme === 'dark' ? 'dark' : 'light')
    }
  }, [theme])

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
