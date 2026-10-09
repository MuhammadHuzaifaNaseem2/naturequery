import { HelpCircle, Keyboard, LifeBuoy, FileText, Search, ScrollText } from 'lucide-react'
import { api } from '../lib/nq'
import { Logo } from '../components/brand'
import { IconButton, Kbd, Menu, modKey } from '../components/ui'
import { openDialog, togglePalette, useApp } from '../store/app-store'

export function TitleBar() {
  const info = useApp((state) => state.info)
  const isMac = api.platform === 'darwin'
  const site = info?.apiBaseUrl ?? 'https://naturequery.app'

  return (
    <header
      className="drag relative flex h-10 shrink-0 items-center gap-3 border-b border-border/70 bg-sidebar"
      style={{
        paddingLeft: isMac ? 80 : 12,
        // Leave room for the native window buttons drawn over the title bar.
        paddingRight: isMac
          ? 12
          : 'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <Logo className="h-[18px] w-[18px]" />
        <span className="text-[13px] font-semibold tracking-tight">NatureQuery</span>
      </div>

      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => togglePalette(true)}
          className="no-drag flex h-7 w-full max-w-[440px] items-center gap-2 rounded-md border border-border/80 bg-background/50 px-2.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-border hover:bg-background"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Search connections, tables and commands</span>
          <Kbd>{modKey()}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="no-drag flex items-center gap-0.5">
        <Menu
          label="Help"
          trigger={(props) => (
            <IconButton label="Help" {...props}>
              <HelpCircle className="h-4 w-4" />
            </IconButton>
          )}
          items={[
            {
              label: 'Keyboard shortcuts',
              icon: <Keyboard className="h-4 w-4" />,
              onSelect: () => openDialog({ kind: 'shortcuts' }),
            },
            {
              label: 'Help center',
              icon: <FileText className="h-4 w-4" />,
              onSelect: () => void api.app.openExternal(`${site}/faq`),
            },
            {
              label: 'Contact support',
              icon: <LifeBuoy className="h-4 w-4" />,
              onSelect: () => void api.app.openExternal(`${site}/contact`),
            },
            'separator',
            {
              label: 'Show log files',
              icon: <ScrollText className="h-4 w-4" />,
              onSelect: () => void api.app.openLogs(),
            },
          ]}
        />
      </div>
    </header>
  )
}
