'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, MoonStar, Leaf, Flame, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
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
        return { Icon: Moon, className: 'text-muted-foreground' }
      case 'dim':
        return { Icon: MoonStar, className: 'text-muted-foreground' }
      case 'forest':
        return { Icon: Leaf, className: 'text-muted-foreground' }
      case 'warm':
        return { Icon: Flame, className: 'text-muted-foreground' }
      case 'system':
        return { Icon: Monitor, className: 'text-muted-foreground' }
      default:
        return { Icon: Sun, className: 'text-muted-foreground' }
    }
  })()
  const { Icon, className: iconClassName } = iconConfig

  // Show a neutral placeholder during SSR
  if (!mounted) {
    return (
      <button
        suppressHydrationWarning
        className="relative p-1.5 rounded-md hover:bg-secondary transition-colors focus-ring"
        title="Loading theme..."
      >
        <svg
          className="w-4 h-4 text-muted-foreground"
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
      className="relative p-1.5 rounded-md hover:bg-secondary hover:[&_svg]:text-foreground transition-colors focus-ring flex-shrink-0"
      title={`Theme: ${theme}. Click to change.`}
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      <Icon className={`w-4 h-4 transition-colors ${iconClassName}`} strokeWidth={2} />

      {/* System indicator dot */}
      {theme === 'system' && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
      )}
    </button>
  )
}
