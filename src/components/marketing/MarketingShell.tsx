import { brandFonts } from '@/app/fonts'
import { MarketingFooter } from './MarketingFooter'
import { MarketingHeader } from './MarketingHeader'

/**
 * Wraps a public page in the site identity: brand fonts and colors, the
 * shared header and footer. `current` is the page's path, for the header.
 */
export function MarketingShell({
  current,
  children,
}: {
  current?: string
  children: React.ReactNode
}) {
  return (
    <div className={`mk ${brandFonts} min-h-screen`}>
      <MarketingHeader current={current} />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
