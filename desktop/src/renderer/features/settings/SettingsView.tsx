import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Check, ExternalLink, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  ROW_LIMIT_CHOICES,
  TIMEOUT_CHOICES,
  type Settings,
  type ThemeName,
  type UpdateStatus,
} from '@shared/types'
import { Button, Field, Select, Switch } from '../../components/ui'
import { formatCount } from '../../lib/format'
import { api } from '../../lib/nq'
import { updateSettings, useApp } from '../../store/app-store'

const THEMES: { value: ThemeName; label: string; swatch: [string, string, string] }[] = [
  { value: 'system', label: 'System', swatch: ['#f6f7f9', '#182029', '#3b82f6'] },
  { value: 'light', label: 'Light', swatch: ['#f6f7f9', '#ffffff', '#3b82f6'] },
  { value: 'dim', label: 'Dim', swatch: ['#182029', '#1f2731', '#60a5fa'] },
  { value: 'dark', label: 'Dark', swatch: ['#030712', '#0b1222', '#3b82f6'] },
  { value: 'forest', label: 'Forest', swatch: ['#0c1714', '#121f1b', '#2cc38b'] },
]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-[220px_1fr] gap-8 border-b border-border/70 py-7 last:border-0">
      <div>
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="max-w-xl space-y-5">{children}</div>
    </section>
  )
}

function describeUpdate(status: UpdateStatus | null): string {
  if (!status) return ''
  switch (status.state) {
    case 'checking':
      return 'Checking for updates…'
    case 'unavailable':
      return 'NatureQuery is up to date.'
    case 'available':
      return `Version ${status.version} is available.`
    case 'downloading':
      return `Downloading version ${status.version}… ${Math.round(status.percent)}%`
    case 'ready':
      return `Version ${status.version} is ready to install.`
    case 'error':
      return status.message
    case 'disabled':
      return status.reason
    default:
      return ''
  }
}

export function SettingsView() {
  const settings = useApp((state) => state.settings)
  const info = useApp((state) => state.info)
  const auth = useApp((state) => state.auth)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    api.updates.status().then(setUpdate, () => {})
    return api.updates.onStatus(setUpdate)
  }, [])

  const change = (patch: Partial<Settings>) =>
    void updateSettings(patch).catch((error) => toast.error((error as Error).message))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-10 pb-16 pt-8">
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>

        <Section title="Appearance" description="Choose how NatureQuery looks on this computer.">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-5 gap-2.5">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={settings.theme === theme.value}
                onClick={() => change({ theme: theme.value })}
                className={clsx(
                  'rounded-lg border p-1.5 text-left transition-colors',
                  settings.theme === theme.value
                    ? 'border-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <span
                  className="flex h-12 overflow-hidden rounded-md border border-black/10"
                  style={{ background: theme.swatch[0] }}
                >
                  <span className="m-1.5 w-1/3 rounded" style={{ background: theme.swatch[1] }} />
                  <span
                    className="mb-1.5 mt-auto h-2 w-6 rounded-full"
                    style={{ background: theme.swatch[2] }}
                  />
                </span>
                <span className="mt-1.5 flex items-center justify-between px-0.5 text-[12px] font-medium">
                  {theme.label}
                  {settings.theme === theme.value && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            ))}
          </div>
          <Field label="Editor text size">
            <Select
              value={String(settings.editorFontSize)}
              onChange={(e) => change({ editorFontSize: Number(e.target.value) })}
              className="w-40"
            >
              {[12, 13, 14, 15, 16, 18].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section
          title="Queries"
          description="Limits that keep queries fast and protect your databases."
        >
          <Field
            label="Rows to show"
            hint="Larger results use more memory. Exports include the rows shown."
          >
            <Select
              value={String(settings.rowLimit)}
              onChange={(e) => change({ rowLimit: Number(e.target.value) })}
              className="w-48"
            >
              {ROW_LIMIT_CHOICES.map((limit) => (
                <option key={limit} value={limit}>
                  {formatCount(limit)} rows
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Time limit"
            hint="Queries that run longer are stopped on the database server."
          >
            <Select
              value={String(settings.queryTimeoutSeconds)}
              onChange={(e) => change({ queryTimeoutSeconds: Number(e.target.value) })}
              className="w-48"
            >
              {TIMEOUT_CHOICES.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds < 60
                    ? `${seconds} seconds`
                    : `${seconds / 60} minute${seconds === 60 ? '' : 's'}`}
                </option>
              ))}
            </Select>
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            NatureQuery only runs read-only queries. Statements that change data or settings are
            blocked before they reach your database.
          </p>
        </Section>

        <Section title="AI assistant" description="Controls for plain-English questions.">
          <Switch
            checked={settings.reviewAiSql}
            onChange={(reviewAiSql) => change({ reviewAiSql })}
            label="Review SQL before it runs"
            description="Show the generated query and wait for you to press Run."
          />
          <Switch
            checked={settings.shareSampleRowsForCharts}
            onChange={(shareSampleRowsForCharts) => change({ shareSampleRowsForCharts })}
            label="Let AI summaries use result rows"
            description="When you choose Summarize, up to 50 result rows are sent so the summary can mention real values. Off by default."
          />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            When you ask a question, NatureQuery receives your question and the structure of your
            tables (names, columns, types and approximate sizes), never your data. Database
            passwords and query results stay on this computer unless you turn on the option above.
          </p>
        </Section>

        <Section
          title="Account"
          description="Your connections, history and saved queries belong to this account."
        >
          {auth.status === 'signed-in' && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {auth.user.name || auth.user.email}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {auth.user.email}
                  {auth.plan ? ` · ${auth.plan.planName} plan` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() => void api.auth.openAccount()}
                >
                  Manage
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void api.auth.signOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Updates">
          {info?.store ? (
            <p className="text-[12.5px] text-muted-foreground">
              The Microsoft Store installs NatureQuery updates for you.
            </p>
          ) : (
            <>
              <Switch
                checked={settings.checkForUpdates}
                onChange={(checkForUpdates) => change({ checkForUpdates })}
                label="Check for updates automatically"
                description="Updates are downloaded only after you agree."
              />
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  icon={
                    <RefreshCw
                      className={clsx(
                        'h-3.5 w-3.5',
                        update?.state === 'checking' && 'animate-spin'
                      )}
                    />
                  }
                  onClick={() =>
                    api.updates
                      .check()
                      .then(setUpdate, (error) => toast.error((error as Error).message))
                  }
                  disabled={update?.state === 'checking' || update?.state === 'downloading'}
                >
                  Check now
                </Button>
                {update?.state === 'available' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      api.updates
                        .download()
                        .then(setUpdate, (error) => toast.error((error as Error).message))
                    }
                  >
                    Download update
                  </Button>
                )}
                {update?.state === 'ready' && (
                  <Button size="sm" variant="primary" onClick={() => void api.updates.install()}>
                    Restart and update
                  </Button>
                )}
                <span className="text-[12px] text-muted-foreground">{describeUpdate(update)}</span>
              </div>
            </>
          )}
        </Section>

        <Section
          title="Privacy and data"
          description="Everything below is stored only on this computer."
        >
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>Connection details, with passwords and keys encrypted by Windows.</li>
            <li>Your query history and saved queries.</li>
            <li>Log files for troubleshooting, with passwords and tokens removed.</li>
          </ul>
          <Button
            size="sm"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            onClick={() => void api.app.openLogs()}
          >
            Show log files
          </Button>
        </Section>

        <Section title="About">
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[12.5px]">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="selectable">
              {info?.version}
              {info?.store ? ' (Microsoft Store)' : info && !info.packaged ? ' (development)' : ''}
            </dd>
            <dt className="text-muted-foreground">Platform</dt>
            <dd>
              {info?.platform === 'win32'
                ? 'Windows'
                : info?.platform === 'darwin'
                  ? 'macOS'
                  : 'Linux'}{' '}
              · {info?.arch}
            </dd>
            <dt className="text-muted-foreground">Electron</dt>
            <dd>{info?.electron}</dd>
          </dl>
          <div className="flex gap-4 text-[12.5px]">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => void api.app.openExternal(`${info?.apiBaseUrl}/privacy`)}
            >
              Privacy policy
            </button>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => void api.app.openExternal(`${info?.apiBaseUrl}/terms`)}
            >
              Terms of service
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
