import { Component, useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button, Spinner } from './components/ui'
import { isDarkTheme } from './lib/theme'
import { api } from './lib/nq'
import { CommandPalette } from './features/command/CommandPalette'
import { DialogHost } from './features/dialogs/Dialogs'
import { HistoryView } from './features/history/HistoryView'
import { HomeView } from './features/home/HomeView'
import { SavedView } from './features/saved/SavedView'
import { SettingsView } from './features/settings/SettingsView'
import { WorkspaceView } from './features/workspace/WorkspaceView'
import { Sidebar } from './layout/Sidebar'
import { StatusBar } from './layout/StatusBar'
import { TitleBar } from './layout/TitleBar'
import {
  cancelTab,
  closeTab,
  findConnection,
  openDialog,
  openTab,
  runTab,
  setView,
  togglePalette,
  useApp,
} from './store/app-store'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error) {
    console.error('Interface error', error)
  }
  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-[15px] font-semibold">Something went wrong in this view.</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Your connections, history and saved queries are safe. Reload the view to continue.
        </p>
        <Button
          variant="primary"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={() => this.setState({ error: null })}
        >
          Reload view
        </Button>
        <pre className="selectable mt-2 max-w-xl overflow-auto rounded bg-secondary/60 p-2 text-left font-mono text-[11px] text-muted-foreground">
          {this.state.error.message}
        </pre>
      </div>
    )
  }
}

function MainView() {
  const view = useApp((state) => state.view)
  switch (view) {
    case 'workspace':
      return <WorkspaceView />
    case 'history':
      return <HistoryView />
    case 'saved':
      return <SavedView />
    case 'settings':
      return <SettingsView />
    default:
      return <HomeView />
  }
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = api.platform === 'darwin' ? event.metaKey : event.ctrlKey
      if (!mod || event.altKey) return
      const state = useApp.getState()
      const active = state.tabs.find((tab) => tab.id === state.activeTabId)
      const key = event.key.toLowerCase()
      const inEditor = event.target instanceof Element && !!event.target.closest('.cm-editor')

      if (key === 'k') {
        event.preventDefault()
        togglePalette()
      } else if (key === 't') {
        event.preventDefault()
        const connectionId = active?.connectionId ?? state.connections[0]?.id ?? 'sample'
        if (findConnection(connectionId)) openTab(connectionId)
      } else if (key === 'w' && state.view === 'workspace' && active) {
        event.preventDefault()
        closeTab(active.id)
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
        openDialog({ kind: 'connection' })
      } else if (key === ',') {
        event.preventDefault()
        setView('settings')
      } else if (key === 'h' && event.shiftKey) {
        event.preventDefault()
        setView('history')
      } else if (key === '/') {
        event.preventDefault()
        openDialog({ kind: 'shortcuts' })
      } else if (key === '.' && active?.status === 'running') {
        event.preventDefault()
        void cancelTab(active.id)
      } else if (
        key === 'enter' &&
        !inEditor &&
        state.view === 'workspace' &&
        active &&
        !state.dialog
      ) {
        event.preventDefault()
        void runTab(active.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export function App() {
  const ready = useApp((state) => state.ready)
  const theme = useApp((state) => state.resolvedTheme)
  useGlobalShortcuts()

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-background">
          <ErrorBoundary>
            <MainView />
          </ErrorBoundary>
        </main>
      </div>
      <StatusBar />
      <DialogHost />
      <CommandPalette />
      <Toaster
        position="bottom-right"
        theme={isDarkTheme(theme) ? 'dark' : 'light'}
        richColors
        closeButton
        duration={4500}
      />
    </div>
  )
}
