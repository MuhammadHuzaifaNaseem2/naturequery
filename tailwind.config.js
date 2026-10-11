/** @type {import('tailwindcss').Config} */
module.exports = {
  // Treat dim and forest as dark-family themes so every `dark:` utility
  // (e.g. GlowCard's dark:bg-black/40) applies under .dim and .forest too,
  // not just .dark. Without this they fall back to light styles (white film).
  darkMode: ['class', ':is(.dark, .dim, .forest)'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Marigold: marks answers, like a highlighter. Use sparingly.
        signal: {
          DEFAULT: 'hsl(var(--signal) / <alpha-value>)',
          soft: 'hsl(var(--signal-soft) / <alpha-value>)',
          ink: 'hsl(var(--signal-ink) / <alpha-value>)',
        },
        // Public site identity (see .mk in globals.css).
        mk: {
          paper: 'hsl(var(--mk-paper) / <alpha-value>)',
          surface: 'hsl(var(--mk-surface) / <alpha-value>)',
          sunken: 'hsl(var(--mk-sunken) / <alpha-value>)',
          ink: 'hsl(var(--mk-ink) / <alpha-value>)',
          'ink-2': 'hsl(var(--mk-ink-2) / <alpha-value>)',
          'ink-3': 'hsl(var(--mk-ink-3) / <alpha-value>)',
          rule: 'hsl(var(--mk-rule) / <alpha-value>)',
          violet: 'hsl(var(--mk-violet) / <alpha-value>)',
          'violet-soft': 'hsl(var(--mk-violet-soft) / <alpha-value>)',
          signal: 'hsl(var(--mk-signal) / <alpha-value>)',
          'signal-soft': 'hsl(var(--mk-signal-soft) / <alpha-value>)',
          'signal-ink': 'hsl(var(--mk-signal-ink) / <alpha-value>)',
          band: 'hsl(var(--mk-band) / <alpha-value>)',
          'band-ink': 'hsl(var(--mk-band-ink) / <alpha-value>)',
          'band-ink-2': 'hsl(var(--mk-band-ink-2) / <alpha-value>)',
          'band-rule': 'hsl(var(--mk-band-rule) / <alpha-value>)',
        },
      },
      fontFamily: {
        // The brand fonts (src/app/fonts.ts) are set on <body> in the root layout.
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Cascadia Code', 'Consolas', 'monospace'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        // Public site: what people ask, what the database speaks, and the interface.
        'nq-serif': ['var(--font-serif)', 'Georgia', 'serif'],
        'nq-mono': ['var(--font-mono)', 'ui-monospace', 'Cascadia Code', 'monospace'],
        'nq-sans': ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
