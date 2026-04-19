type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

interface AppLogoProps {
  size?: LogoSize
  /** Show "NatureQuery" text next to the icon (default: true) */
  showText?: boolean
  className?: string
  textClassName?: string
}

const CFG: Record<LogoSize, { img: string; text: string }> = {
  xs:    { img: 'w-6 h-6',   text: 'text-sm'  },
  sm:    { img: 'w-7 h-7',   text: 'text-base' },
  md:    { img: 'w-8 h-8',   text: 'text-lg'  },
  lg:    { img: 'w-10 h-10', text: 'text-xl'  },
  xl:    { img: 'w-14 h-14', text: 'text-2xl' },
  '2xl': { img: 'w-20 h-20', text: 'text-3xl' },
}

export function AppLogo({ size = 'md', showText = true, className = '', textClassName = '' }: AppLogoProps) {
  const c = CFG[size]
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/naturequery-icon.svg" alt="NatureQuery" className={`${c.img} flex-shrink-0`} />
      {showText && (
        <span className={`font-bold ${c.text} ${textClassName}`}>NatureQuery</span>
      )}
    </div>
  )
}
