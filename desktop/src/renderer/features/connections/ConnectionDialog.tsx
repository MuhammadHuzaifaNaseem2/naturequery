import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Search, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { DB_TYPES, DB_TYPE_INFO, isAvailable, type DbCategory, type DbType } from '@shared/db-types'
import type { AppError, ConnectionInfo, TestResult } from '@shared/types'
import { DbIcon } from '../../components/brand'
import { Button, Dialog, ErrorNotice, Input } from '../../components/ui'
import { api, asAppError } from '../../lib/nq'
import {
  closeDialog,
  forgetSchema,
  openConnection,
  refreshConnections,
} from '../../store/app-store'
import { ConnectionForm } from './ConnectionForm'
import { draftFromConnection, draftToInput, emptyDraft, type ConnectionDraft } from './draft'

const CATEGORIES: { id: DbCategory; title: string }[] = [
  { id: 'relational', title: 'Databases' },
  { id: 'warehouse', title: 'Data warehouses' },
  { id: 'serverless', title: 'Serverless and cloud' },
  { id: 'document', title: 'Document and key-value' },
  { id: 'file', title: 'Files on this computer' },
]

function TypePicker({ onPick }: { onPick: (type: DbType) => void }) {
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const matches = (type: DbType) => {
    const info = DB_TYPE_INFO[type]
    return (
      !term ||
      info.label.toLowerCase().includes(term) ||
      info.description.toLowerCase().includes(term)
    )
  }
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search database types"
          className="pl-8"
        />
      </div>
      {CATEGORIES.map((category) => {
        const types = DB_TYPES.filter(
          (type) => DB_TYPE_INFO[type].category === category.id && matches(type)
        )
        if (!types.length) return null
        return (
          <section key={category.id}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {category.title}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {types.map((type) => {
                const info = DB_TYPE_INFO[type]
                const available = isAvailable(type)
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!available}
                    onClick={() => onPick(type)}
                    title={
                      available
                        ? info.description
                        : `${info.label} support is coming in the next update.`
                    }
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border disabled:hover:bg-transparent"
                  >
                    <DbIcon type={type} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{info.label}</span>
                      {!available && (
                        <span className="block text-[11px] text-muted-foreground">Coming soon</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function ConnectionDialog({
  editing,
  presetType,
}: {
  editing?: ConnectionInfo
  presetType?: DbType
}) {
  const [draft, setDraft] = useState<ConnectionDraft | null>(() =>
    editing ? draftFromConnection(editing) : presetType ? emptyDraft(presetType) : null
  )
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [offerSaveAnyway, setOfferSaveAnyway] = useState(false)
  const testedInput = useRef<string | null>(null)

  const input = useMemo(() => (draft ? draftToInput(draft) : null), [draft])
  const inputKey = input ? JSON.stringify(input) : ''

  useEffect(() => {
    if (testedInput.current && testedInput.current !== inputKey) {
      setTestResult(null)
      setOfferSaveAnyway(false)
    }
  }, [inputKey])

  const update = (patch: Partial<ConnectionDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setError(null)
  }

  async function runTest(): Promise<TestResult | null> {
    if (!draft || !input) return null
    setTesting(true)
    setError(null)
    setTestResult(null)
    try {
      const result = await api.connections.test(input)
      testedInput.current = JSON.stringify(input)
      setTestResult(result)
      if (result.sshHostKey && draft.ssh.enabled && !draft.ssh.hostKeyFingerprint) {
        update({ ssh: { ...draft.ssh, hostKeyFingerprint: result.sshHostKey } })
        testedInput.current = JSON.stringify(
          draftToInput({ ...draft, ssh: { ...draft.ssh, hostKeyFingerprint: result.sshHostKey } })
        )
      }
      return result
    } catch (caught) {
      setError(asAppError(caught))
      return null
    } finally {
      setTesting(false)
    }
  }

  async function save(skipTest = false) {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      let result = testResult
      if (!skipTest && (!result || testedInput.current !== inputKey)) {
        result = await runTest()
        if (!result) {
          setOfferSaveAnyway(true)
          return
        }
      }
      const finalInput = draftToInput(
        result?.sshHostKey && draft.ssh.enabled && !draft.ssh.hostKeyFingerprint
          ? { ...draft, ssh: { ...draft.ssh, hostKeyFingerprint: result.sshHostKey } }
          : draft
      )
      const saved = await api.connections.save(finalInput)
      await refreshConnections()
      forgetSchema(saved.id)
      closeDialog()
      openConnection(saved.id)
      toast.success(editing ? 'Connection updated' : `Connected to ${saved.name}`, {
        description: 'Your password is encrypted on this computer.',
      })
    } catch (caught) {
      setError(asAppError(caught))
    } finally {
      setSaving(false)
    }
  }

  const info = draft ? DB_TYPE_INFO[draft.type] : null

  return (
    <Dialog
      open
      onClose={closeDialog}
      width={draft ? 'md' : 'lg'}
      dismissible={!saving}
      title={
        draft && info ? (
          <span className="flex items-center gap-2.5">
            {!editing && (
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Choose another database type"
                className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DbIcon type={draft.type} size="sm" />
            {editing ? `Edit ${editing.name}` : `Connect to ${info.label}`}
          </span>
        ) : (
          'Add a connection'
        )
      }
      description={
        draft
          ? 'Connects directly from this computer. Use an account with read-only access where you can.'
          : 'Choose the type of database you want to query.'
      }
      footer={
        draft ? (
          <>
            <span className="mr-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Passwords are encrypted with your Windows
              account
            </span>
            <Button onClick={() => void runTest()} loading={testing && !saving} disabled={saving}>
              Test connection
            </Button>
            {offerSaveAnyway ? (
              <Button variant="danger" onClick={() => void save(true)} loading={saving}>
                Save anyway
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void save()} loading={saving}>
                {editing ? 'Save changes' : 'Save and connect'}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {draft ? (
        <div className="space-y-4">
          <ConnectionForm draft={draft} update={update} />
          {testResult && !error && (
            <div
              role="status"
              className={clsx(
                'flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-[13px]'
              )}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span>
                Connected{testResult.serverVersion ? ` to ${testResult.serverVersion}` : ''} in{' '}
                {testResult.latencyMs} ms.
              </span>
            </div>
          )}
          {error && <ErrorNotice error={error} />}
          {offerSaveAnyway && (
            <p className="text-[12px] text-muted-foreground">
              The connection test failed. You can still save it, for example if the server is
              offline right now.
            </p>
          )}
        </div>
      ) : (
        <TypePicker onPick={(type) => setDraft(emptyDraft(type))} />
      )}
    </Dialog>
  )
}
