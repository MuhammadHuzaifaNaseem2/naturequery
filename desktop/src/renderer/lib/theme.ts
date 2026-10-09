import type { WindowChrome } from '@shared/ipc'
import type { ThemeName } from '@shared/types'

export type ResolvedTheme = 'light' | 'dark' | 'dim' | 'forest'

const DARK_THEMES: ResolvedTheme[] = ['dark', 'dim', 'forest']

export function resolveTheme(theme: ThemeName, systemDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemDark ? 'dim' : 'light'
  return theme
}

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return DARK_THEMES.includes(theme)
}

export function applyThemeClass(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'dim', 'forest')
  root.classList.add(theme)
}

function hslTokenToHex(token: string): string {
  const [h, s, l] = token
    .trim()
    .split(/\s+/)
    .map((part) => parseFloat(part))
  const saturation = s / 100
  const lightness = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = saturation * Math.min(lightness, 1 - lightness)
  const f = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** Title bar colors derived from the active theme's sidebar and text tokens. */
export function currentChrome(theme: ResolvedTheme): WindowChrome {
  const styles = getComputedStyle(document.documentElement)
  return {
    background: hslTokenToHex(styles.getPropertyValue('--sidebar')),
    symbol: hslTokenToHex(styles.getPropertyValue('--foreground')),
    dark: isDarkTheme(theme),
  }
}
