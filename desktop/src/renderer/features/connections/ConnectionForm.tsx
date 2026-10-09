import { useState } from 'react'
import { ChevronRight, FolderOpen, Link2, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import { DB_TYPE_INFO } from '@shared/db-types'
import type { FileKind } from '@shared/ipc'
import type { SecretKey, TlsMode } from '@shared/types'
import { Button, Field, Input, Select, Switch } from '../../components/ui'
import { api } from '../../lib/nq'
import { applyConnectionUrl, suggestName, type ConnectionDraft } from './draft'

type Update = (patch: Partial<ConnectionDraft>) => void

const TLS_OPTIONS: { value: TlsMode; label: string; hint: string }[] = [
  {
    value: 'prefer',
    label: 'Prefer encryption',
    hint: 'Encrypts when the server supports it, and connects without encryption otherwise. Works with most servers on a company network.',
  },
  {
    value: 'require',
    label: 'Require encryption, trust server certificate',
    hint: 'Always encrypts, and accepts self-signed certificates. Common for servers on a private network.',
  },
  {
    value: 'verify-ca',
    label: 'Require encryption, verify certificate',
    hint: "Checks the certificate against Windows' trusted authorities, including your company's.",
  },
  {
    value: 'verify-full',
    label: 'Require encryption, verify certificate and host name',
    hint: 'The most secure option. Use it for databases on the internet and cloud services.',
  },
  {
    value: 'disable',
    label: 'No encryption',
    hint: 'Sends data unencrypted. Only use this on a network you trust.',
  },
]

function secretPlaceholder(saved: SecretKey[], key: SecretKey, fallback = ''): string {
  return saved.includes(key) ? 'Saved. Leave blank to keep it.' : fallback
}

function FilePicker({
  value,
  onChange,
  kind,
  placeholder,
  id,
}: {
  value: string
  onChange: (path: string) => void
  kind: FileKind
  placeholder: string
  id?: string
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="flex-1 font-mono text-[12px]"
      />
      <Button
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        onClick={async () => {
          const path = await api.connections.pickFile(kind)
          if (path) onChange(path)
        }}
      >
        Browse
      </Button>
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = false,
  icon,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium"
      >
        <ChevronRight
          className={clsx(
            'h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
        />
        {icon}
        {title}
      </button>
      {open && <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">{children}</div>}
    </div>
  )
}

function NetworkFields({
  draft,
  update,
  databaseLabel = 'Database',
  databaseHint,
}: {
  draft: ConnectionDraft
  update: Update
  databaseLabel?: string
  databaseHint?: string
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field
          label="Host"
          htmlFor="host"
          hint="Server name or IP address, for example db.company.local or 192.168.1.20."
        >
          <Input
            id="host"
            value={draft.host}
            onChange={(e) => update({ host: e.target.value })}
            placeholder="localhost"
            autoFocus
          />
        </Field>
        <Field label="Port" htmlFor="port">
          <Input
            id="port"
            inputMode="numeric"
            value={draft.port}
            onChange={(e) => update({ port: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
      </div>
      <Field label={databaseLabel} htmlFor="database" hint={databaseHint} optional={!databaseHint}>
        <Input
          id="database"
          value={draft.database}
          onChange={(e) => update({ database: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="User" htmlFor="user">
          <Input
            id="user"
            value={draft.user}
            onChange={(e) => update({ user: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={draft.password}
            onChange={(e) => update({ password: e.target.value })}
            placeholder={secretPlaceholder(draft.savedSecrets, 'password')}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </>
  )
}

function TlsFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const selected = TLS_OPTIONS.find((option) => option.value === draft.tlsMode) ?? TLS_OPTIONS[0]
  return (
    <>
      <Field label="Connection security" htmlFor="tls" hint={selected.hint}>
        <Select
          id="tls"
          value={draft.tlsMode}
          onChange={(e) => update({ tlsMode: e.target.value as TlsMode })}
        >
          {TLS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {draft.tlsMode.startsWith('verify') && (
        <Field
          label="Certificate authority file"
          optional
          hint="Only needed if your server's certificate comes from an authority that is not installed on this computer."
        >
          <FilePicker
            value={draft.caPath}
            onChange={(caPath) => update({ caPath })}
            kind="ca-certificate"
            placeholder="ca.pem"
          />
        </Field>
      )}
    </>
  )
}

function SshFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const ssh = draft.ssh
  const setSsh = (patch: Partial<ConnectionDraft['ssh']>) => update({ ssh: { ...ssh, ...patch } })
  return (
    <Section
      title="SSH tunnel"
      icon={<Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      defaultOpen={ssh.enabled}
    >
      <Switch
        checked={ssh.enabled}
        onChange={(enabled) => setSsh({ enabled })}
        label="Connect through an SSH server"
        description="For databases that are only reachable through a jump host or bastion server. The database host above is resolved from the SSH server."
      />
      {ssh.enabled && (
        <>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="SSH host">
              <Input
                value={ssh.host}
                onChange={(e) => setSsh({ host: e.target.value, hostKeyFingerprint: undefined })}
                placeholder="bastion.company.com"
              />
            </Field>
            <Field label="SSH port">
              <Input
                inputMode="numeric"
                value={String(ssh.port)}
                onChange={(e) => setSsh({ port: Number(e.target.value.replace(/\D/g, '')) || 22 })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SSH user">
              <Input value={ssh.user} onChange={(e) => setSsh({ user: e.target.value })} />
            </Field>
            <Field label="Sign in with">
              <Select
                value={ssh.auth}
                onChange={(e) => setSsh({ auth: e.target.value as 'password' | 'key' })}
              >
                <option value="password">Password</option>
                <option value="key">Private key file</option>
              </Select>
            </Field>
          </div>
          {ssh.auth === 'password' ? (
            <Field label="SSH password">
              <Input
                type="password"
                value={draft.sshPassword}
                onChange={(e) => update({ sshPassword: e.target.value })}
                placeholder={secretPlaceholder(draft.savedSecrets, 'sshPassword')}
              />
            </Field>
          ) : (
            <>
              <Field
                label="Private key file"
                hint="OpenSSH or PEM format. Convert PuTTY .ppk keys with PuTTYgen first."
              >
                <FilePicker
                  value={draft.sshKeyPath}
                  onChange={(sshKeyPath) => update({ sshKeyPath })}
                  kind="ssh-key"
                  placeholder="C:\Users\you\.ssh\id_ed25519"
                />
              </Field>
              <Field label="Key passphrase" optional>
                <Input
                  type="password"
                  value={draft.sshPassphrase}
                  onChange={(e) => update({ sshPassphrase: e.target.value })}
                  placeholder={secretPlaceholder(draft.savedSecrets, 'sshPassphrase')}
                />
              </Field>
            </>
          )}
          {ssh.hostKeyFingerprint && (
            <p className="selectable rounded-md bg-secondary/60 px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
              Trusted server key: {ssh.hostKeyFingerprint}
            </p>
          )}
        </>
      )}
    </Section>
  )
}

function SqlServerFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const settings = draft.sqlserver
  const set = (patch: Partial<ConnectionDraft['sqlserver']>) =>
    update({ sqlserver: { ...settings, ...patch } })
  const hasInstance = !!settings.instance?.trim() || draft.host.includes('\\')
  return (
    <>
      <div className="grid grid-cols-[1fr_150px_100px] gap-3">
        <Field label="Server" htmlFor="host">
          <Input
            id="host"
            value={draft.host}
            onChange={(e) => update({ host: e.target.value })}
            placeholder="SERVER or SERVER\SQLEXPRESS"
            autoFocus
          />
        </Field>
        <Field label="Instance name" optional>
          <Input
            value={settings.instance ?? ''}
            onChange={(e) => set({ instance: e.target.value })}
            placeholder="SQLEXPRESS"
          />
        </Field>
        <Field label="Port">
          <Input
            inputMode="numeric"
            value={hasInstance ? '' : draft.port}
            disabled={hasInstance}
            placeholder={hasInstance ? 'Auto' : '1433'}
            onChange={(e) => update({ port: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
      </div>
      {hasInstance && (
        <p className="-mt-2 text-[11.5px] text-muted-foreground">
          Named instances are found through the SQL Server Browser service, which must be running on
          the server.
        </p>
      )}
      <Field label="Database" optional>
        <Input
          value={draft.database}
          onChange={(e) => update({ database: e.target.value })}
          placeholder="Default database for this login"
        />
      </Field>
      <Field label="Authentication">
        <Select
          value={settings.auth}
          onChange={(e) => set({ auth: e.target.value as 'sql' | 'windows' })}
        >
          <option value="sql">SQL Server login</option>
          <option value="windows">Windows account (domain user and password)</option>
        </Select>
      </Field>
      {settings.auth === 'windows' && (
        <Field label="Domain" optional hint="You can also type the user name as DOMAIN\user.">
          <Input
            value={settings.domain ?? ''}
            onChange={(e) => set({ domain: e.target.value })}
            placeholder="COMPANY"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="User">
          <Input
            value={draft.user}
            onChange={(e) => update({ user: e.target.value })}
            placeholder={settings.auth === 'windows' ? 'COMPANY\\jane' : 'reporting_reader'}
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={draft.password}
            onChange={(e) => update({ password: e.target.value })}
            placeholder={secretPlaceholder(draft.savedSecrets, 'password')}
          />
        </Field>
      </div>
      <div className="space-y-3 rounded-lg border border-border px-3 py-3">
        <Switch
          checked={settings.encrypt}
          onChange={(encrypt) => set({ encrypt })}
          label="Encrypt the connection"
          description="Required by Azure SQL and SQL Server 2022 by default."
        />
        <Switch
          checked={settings.trustServerCertificate}
          onChange={(trustServerCertificate) => set({ trustServerCertificate })}
          label="Trust the server certificate"
          description="Turn on for servers with a self-signed certificate, which most company servers use. Turn off for Azure SQL."
          disabled={!settings.encrypt}
        />
      </div>
    </>
  )
}

export function ConnectionForm({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const info = DB_TYPE_INFO[draft.type]
  const [pasting, setPasting] = useState(false)
  const [urlError, setUrlError] = useState(false)
  const canPasteUrl = ['postgres', 'mysql'].includes(info.family)

  return (
    <div className="space-y-4">
      <Field label="Connection name" htmlFor="name">
        <Input
          id="name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={suggestName(draft)}
          maxLength={120}
        />
      </Field>

      {canPasteUrl && (
        <div>
          {pasting ? (
            <div className="space-y-1.5">
              <Input
                autoFocus
                placeholder={
                  info.family === 'postgres'
                    ? 'postgres://user:password@host:5432/database'
                    : 'mysql://user:password@host:3306/database'
                }
                onChange={(event) => {
                  const next = applyConnectionUrl(draft, event.target.value)
                  setUrlError(!next && event.target.value.trim().length > 8)
                  if (next) {
                    update(next)
                    setPasting(false)
                  }
                }}
                className="font-mono text-[12px]"
              />
              {urlError && (
                <p className="text-[11.5px] text-destructive">
                  That does not look like a connection URL.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPasting(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" /> Paste a connection URL instead
            </button>
          )}
        </div>
      )}

      {(info.family === 'postgres' || info.family === 'mysql') && (
        <>
          <NetworkFields draft={draft} update={update} />
          <TlsFields draft={draft} update={update} />
        </>
      )}

      {info.family === 'sqlserver' && <SqlServerFields draft={draft} update={update} />}

      {info.family === 'oracle' && (
        <>
          <NetworkFields
            draft={draft}
            update={update}
            databaseLabel={draft.oracleConnectAs === 'sid' ? 'SID' : 'Service name'}
            databaseHint="For example ORCLPDB1 or XEPDB1."
          />
          <Field label="Connect using">
            <Select
              value={draft.oracleConnectAs}
              onChange={(e) => update({ oracleConnectAs: e.target.value as 'service' | 'sid' })}
            >
              <option value="service">Service name</option>
              <option value="sid">SID</option>
            </Select>
          </Field>
        </>
      )}

      {info.family === 'sqlite' && (
        <Field
          label="Database file"
          hint="The file is opened read-only. Files on shared network drives work too."
        >
          <FilePicker
            value={draft.sqlitePath}
            onChange={(sqlitePath) => update({ sqlitePath })}
            kind="sqlite"
            placeholder="C:\Data\sales.db"
          />
        </Field>
      )}

      {info.network && <SshFields draft={draft} update={update} />}
    </div>
  )
}
