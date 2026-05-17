'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only show theme after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('warm')
    else if (theme === 'warm') setTheme('system')
    else setTheme('light')
  }

  // Show a neutral placeholder during SSR
  if (!mounted) {
    return (
      <button
        suppressHydrationWarning
        className="relative p-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-all duration-200 focus-ring group"
        title="Loading theme..."
      >
        <svg
          className="w-5 h-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>
    )
  }

  return (
    <button
      suppressHydrationWarning
      onClick={cycleTheme}
      className="relative p-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-all duration-200 focus-ring group flex-shrink-0"
      title={`Current: ${theme} (${resolvedTheme})`}
    >
      {/* Sun icon — light theme */}
      <svg
        className={`w-5 h-5 transition-all duration-300 ${
          resolvedTheme === 'light' && theme !== 'warm'
            ? 'text-warning scale-100 rotate-0'
            : 'text-muted-foreground scale-0 -rotate-90 absolute'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>

      {/* Moon icon */}
      <svg
        className={`w-5 h-5 transition-all duration-300 ${
          resolvedTheme === 'dark'
            ? 'text-primary scale-100 rotate-0'
            : 'text-muted-foreground scale-0 rotate-90 absolute'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>

      {/* Flame icon — warm theme */}
      {theme === 'warm' && (
        <svg
          className="w-5 h-5 text-orange-500 scale-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      )}

      {/* System indicator dot */}
      {theme === 'system' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
      )}
    </button>
  )
}
