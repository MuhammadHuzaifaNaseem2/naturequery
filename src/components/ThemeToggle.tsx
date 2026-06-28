'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, MoonStar, Leaf, Flame, Monitor } from 'lucide-react'
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
    else if (theme === 'dark') setTheme('dim')
    else if (theme === 'dim') setTheme('forest')
    else if (theme === 'forest') setTheme('warm')
    else if (theme === 'warm') setTheme('system')
    else setTheme('light')
  }

  // Pick the icon + color for the current theme.
  const iconConfig = (() => {
    switch (theme) {
      case 'dark':
        return { Icon: Moon, className: 'text-primary' }
      case 'dim':
        return { Icon: MoonStar, className: 'text-blue-400' }
      case 'forest':
        return { Icon: Leaf, className: 'text-emerald-400' }
      case 'warm':
        return { Icon: Flame, className: 'text-orange-500' }
      case 'system':
        return { Icon: Monitor, className: 'text-muted-foreground' }
      default:
        return { Icon: Sun, className: 'text-warning' }
    }
  })()
  const { Icon, className: iconClassName } = iconConfig

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
      <Icon className={`w-5 h-5 transition-all duration-300 ${iconClassName}`} strokeWidth={2} />

      {/* System indicator dot */}
      {theme === 'system' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
      )}
    </button>
  )
}
