import { useState } from 'react'
import { DatabaseZap, Lock, MessagesSquare, Store, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '../../components/brand'
import { Button, Dialog, Field, Input, Kbd, modKey, Textarea } from '../../components/ui'
import { api } from '../../lib/nq'
import { startSignIn } from '../../layout/AccountBadge'
import {
  closeDialog,
  closeTab,
  forgetSchema,
  openDialog,
  openTab,
  refreshConnections,
  renameTab,
  updateSettings,
  useApp,
} from '../../store/app-store'
import type { ConnectionInfo } from '@shared/types'
import { ConnectionDialog } from '../connections/ConnectionDialog'

function WelcomeDialog() {
  const [step, setStep] = useState<1 | 2>(1)
  const finish = (next?: () => void) => {
    void updateSettings({ onboardingCompleted: true })
    closeDialog()
    next?.()
  }

  return (
    <Dialog
      open
      onClose={() => finish()}
      width="lg"
      title={
        <span className="flex items-center gap-2.5">
          <Logo className="h-6 w-6" /> Welcome to NatureQuery Desktop
        </span>
      }
      footer={
        step === 1 ? (
          <Button variant="primary" onClick={() => setStep(2)}>
            Get started
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => finish()}>
            I will explore on my own
          </Button>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-5 py-1">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Get answers from your business data without waiting for a report. NatureQuery connects
            to your databases from this computer, including ones on your office network that cloud
            tools cannot reach.
          </p>
          {[
            {
              icon: <DatabaseZap className="h-5 w-5" />,
              title: 'Connect to the databases you already use',
              text: 'PostgreSQL, MySQL, SQL Server, SQLite and more, on this computer, your network or the cloud.',
            },
            {
              icon: <MessagesSquare className="h-5 w-5" />,
              title: 'Ask in plain English or write SQL',
              text: 'Describe what you want to know, review the SQL, and see tables and charts.',
            },
            {
              icon: <Lock className="h-5 w-5" />,
              title: 'Your data stays with you',
              text: 'Queries run directly from this computer and are read-only. Passwords are encrypted with your Windows account.',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {item.icon}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 py-1">
          <p className="text-[13.5px] text-muted-foreground">How would you like to start?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => finish(() => openTab('sample', { title: 'Acme Store', run: true }))}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Store className="mb-3 h-6 w-6 text-success" />
              <p className="text-[13.5px] font-semibold">Explore the sample store</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Try queries and charts on realistic sales data. Nothing to set up.
              </p>
            </button>
            <button
              type="button"
              onClick={() => finish(() => openDialog({ kind: 'connection' }))}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <DatabaseZap className="mb-3 h-6 w-6 text-primary" />
              <p className="text-[13.5px] font-semibold">Connect my database</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Use a read-only account if you can. It takes about a minute.
              </p>
            </button>
          </div>
          <button
            type="button"
            onClick={() => finish(() => void startSignIn())}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-accent/60"
          >
            <Sparkles className="h-5 w-5 text-accent" />
            <span className="text-[12.5px]">
              <span className="font-semibold">Sign in to use AI.</span>{' '}
              <span className="text-muted-foreground">
                Sign-in happens in your browser, with your NatureQuery account, Google or GitHub.
              </span>
            </span>
          </button>
        </div>
      )}
    </Dialog>
  )
}

const SHORTCUTS: [string, string[]][] = [
  ['Run the query', [modKey(), 'Enter']],
  ['Cancel a running query', [modKey(), '.']],
  ['Suggestions in the editor', [modKey(), 'Space']],
  ['New query tab', [modKey(), 'T']],
  ['Close tab', [modKey(), 'W']],
  ['Search and commands', [modKey(), 'K']],
  ['Add a connection', [modKey(), 'N']],
  ['History', [modKey(), 'Shift', 'H']],
  ['Settings', [modKey(), ',']],
  ['Zoom in or out', [modKey(), '+ / -']],
  ['Reset zoom', [modKey(), '0']],
  ['Keyboard shortcuts', [modKey(), '/']],
]

function ShortcutsDialog() {
  return (
    <Dialog open onClose={closeDialog} width="sm" title="Keyboard shortcuts">
      <ul className="divide-y divide-border/70">
        {SHORTCUTS.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2 text-[13px]">
            {label}
            <span className="flex gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

function SaveQueryDialog({ tabId }: { tabId: string }) {
  const tab = useApp((state) => state.tabs.find((candidate) => candidate.id === tabId))
  const [name, setName] = useState(tab?.title ?? '')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  if (!tab) return null

  const save = async () => {
    setSaving(true)
    try {
      const saved = await api.saved.save({
        id: tab.savedQueryId,
        name: name.trim() || 'Untitled query',
        connectionId: tab.connectionId,
        text: tab.sql,
        question: tab.question || undefined,
        description: description.trim() || undefined,
      })
      useApp.setState((state) => ({
        tabs: state.tabs.map((candidate) =>
          candidate.id === tab.id ? { ...candidate, savedQueryId: saved.id } : candidate
        ),
      }))
      renameTab(tab.id, saved.name)
      closeDialog()
      toast.success(tab.savedQueryId ? 'Saved query updated' : 'Query saved')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={closeDialog}
      width="sm"
      title={tab.savedQueryId ? 'Update saved query' : 'Save query'}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Monthly revenue by region"
          />
        </Field>
        <Field label="Description" optional>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What this query answers"
          />
        </Field>
      </form>
    </Dialog>
  )
}

function ConfirmRemoveConnection({ connection }: { connection: ConnectionInfo }) {
  const [removing, setRemoving] = useState(false)
  const tabs = useApp((state) => state.tabs)
  const remove = async () => {
    setRemoving(true)
    try {
      await api.connections.remove(connection.id)
      for (const tab of tabs.filter((candidate) => candidate.connectionId === connection.id))
        closeTab(tab.id)
      forgetSchema(connection.id)
      await refreshConnections()
      closeDialog()
      toast.success(`Removed ${connection.name}`, { description: 'Your database was not changed.' })
    } catch (error) {
      toast.error((error as Error).message)
      setRemoving(false)
    }
  }
  return (
    <Dialog
      open
      onClose={closeDialog}
      width="sm"
      title={`Remove ${connection.name}?`}
      description="This removes the saved connection and its encrypted password from this computer. Your database and its data are not changed."
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="danger" loading={removing} onClick={() => void remove()}>
            Remove connection
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] text-muted-foreground">
        Open tabs for this connection will close. Query history is kept.
      </p>
    </Dialog>
  )
}

export function DialogHost() {
  const dialog = useApp((state) => state.dialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'connection':
      return <ConnectionDialog editing={dialog.editing} presetType={dialog.presetType} />
    case 'welcome':
      return <WelcomeDialog />
    case 'shortcuts':
      return <ShortcutsDialog />
    case 'save-query':
      return <SaveQueryDialog tabId={dialog.tabId} />
    case 'confirm-remove-connection':
      return <ConfirmRemoveConnection connection={dialog.connection} />
  }
}
