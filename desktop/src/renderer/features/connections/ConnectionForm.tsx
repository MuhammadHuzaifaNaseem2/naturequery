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

function TlsFields({
  draft,
  update,
  modes,
}: {
  draft: ConnectionDraft
  update: Update
  /** Limits the choices, for example to encrypted modes only. */
  modes?: TlsMode[]
}) {
  const options = modes ? TLS_OPTIONS.filter((option) => modes.includes(option.value)) : TLS_OPTIONS
  const selected = options.find((option) => option.value === draft.tlsMode) ?? options[0]
  return (
    <>
      <Field label="Connection security" htmlFor="tls" hint={selected.hint}>
        <Select
          id="tls"
          value={selected.value}
          onChange={(e) => update({ tlsMode: e.target.value as TlsMode })}
        >
          {options.map((option) => (
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

function SecretInput({
  id,
  value,
  onChange,
  saved,
  secret,
  placeholder,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  saved: SecretKey[]
  secret: SecretKey
  placeholder?: string
}) {
  return (
    <Input
      id={id}
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={secretPlaceholder(saved, secret, placeholder)}
      autoComplete="new-password"
    />
  )
}

function MongoFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  return (
    <>
      <Field label="Connect with">
        <Select
          value={draft.mongoUseUri ? 'uri' : 'host'}
          onChange={(e) => update({ mongoUseUri: e.target.value === 'uri' })}
        >
          <option value="host">Host and port</option>
          <option value="uri">Connection string (MongoDB Atlas and replica sets)</option>
        </Select>
      </Field>
      {draft.mongoUseUri ? (
        <>
          <Field
            label="Connection string"
            htmlFor="mongo-uri"
            hint='In MongoDB Atlas, choose "Connect", then "Drivers", and copy the string. Include the password.'
          >
            <SecretInput
              id="mongo-uri"
              value={draft.mongoUri}
              onChange={(mongoUri) => update({ mongoUri })}
              saved={draft.savedSecrets}
              secret="connectionString"
              placeholder="mongodb+srv://user:password@cluster0.example.mongodb.net/"
            />
          </Field>
          <Field
            label="Database"
            htmlFor="database"
            optional
            hint="Defaults to the database named in the connection string."
          >
            <Input
              id="database"
              value={draft.database}
              onChange={(e) => update({ database: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <>
          <NetworkFields
            draft={draft}
            update={update}
            databaseHint="The database whose collections you want to query."
          />
          <Field
            label="Authentication database"
            optional
            hint="Where the user is defined. Usually admin."
          >
            <Input
              value={draft.mongoAuthSource}
              onChange={(e) => update({ mongoAuthSource: e.target.value })}
              placeholder="admin"
            />
          </Field>
          <TlsFields
            draft={draft}
            update={update}
            modes={['disable', 'require', 'verify-ca', 'verify-full']}
          />
        </>
      )}
    </>
  )
}

function ClickHouseFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const https = draft.clickhouseProtocol === 'https'
  return (
    <>
      <Field
        label="Protocol"
        hint={
          https
            ? 'Encrypted. ClickHouse Cloud uses HTTPS on port 8443.'
            : 'Unencrypted HTTP, usually port 8123. Use HTTPS for servers on the internet.'
        }
      >
        <Select
          value={draft.clickhouseProtocol}
          onChange={(e) => {
            const protocol = e.target.value as 'http' | 'https'
            update({
              clickhouseProtocol: protocol,
              port: protocol === 'https' ? '8443' : '8123',
              tlsMode: protocol === 'https' ? 'verify-full' : draft.tlsMode,
            })
          }}
        >
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
        </Select>
      </Field>
      <NetworkFields draft={draft} update={update} />
      {https && (
        <TlsFields draft={draft} update={update} modes={['require', 'verify-ca', 'verify-full']} />
      )}
    </>
  )
}

function SnowflakeFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const keyPair = draft.snowflakeAuth === 'keypair'
  return (
    <>
      <Field
        label="Account identifier"
        htmlFor="sf-account"
        hint="In Snowsight, open your profile menu, then Account, and copy the account identifier. You can also paste the account URL."
      >
        <Input
          id="sf-account"
          value={draft.snowflakeAccount}
          onChange={(e) => update({ snowflakeAccount: e.target.value })}
          placeholder="myorg-myaccount"
          autoFocus
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
        <Field label="Sign in with">
          <Select
            value={draft.snowflakeAuth}
            onChange={(e) => update({ snowflakeAuth: e.target.value as 'password' | 'keypair' })}
          >
            <option value="password">Password or access token</option>
            <option value="keypair">Key pair</option>
          </Select>
        </Field>
      </div>
      {keyPair ? (
        <>
          <Field
            label="Private key file"
            hint="The .p8 file whose public key is set on this Snowflake user."
          >
            <FilePicker
              value={draft.privateKeyPath}
              onChange={(privateKeyPath) => update({ privateKeyPath })}
              kind="private-key"
              placeholder="C:\Keys\rsa_key.p8"
            />
          </Field>
          <Field label="Key passphrase" optional>
            <SecretInput
              value={draft.privateKeyPassphrase}
              onChange={(privateKeyPassphrase) => update({ privateKeyPassphrase })}
              saved={draft.savedSecrets}
              secret="privateKeyPassphrase"
            />
          </Field>
        </>
      ) : (
        <Field
          label="Password or access token"
          htmlFor="password"
          hint="If your account uses multi-factor sign-in, create a programmatic access token in Snowsight and paste it here, or use key pair sign-in."
        >
          <SecretInput
            id="password"
            value={draft.password}
            onChange={(password) => update({ password })}
            saved={draft.savedSecrets}
            secret="password"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Warehouse" hint="Runs your queries, for example COMPUTE_WH.">
          <Input
            value={draft.snowflakeWarehouse}
            onChange={(e) => update({ snowflakeWarehouse: e.target.value })}
            placeholder="COMPUTE_WH"
          />
        </Field>
        <Field label="Role" optional hint="Leave empty to use your default role.">
          <Input
            value={draft.snowflakeRole}
            onChange={(e) => update({ snowflakeRole: e.target.value })}
            placeholder="ANALYST"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Database" htmlFor="database">
          <Input
            id="database"
            value={draft.database}
            onChange={(e) => update({ database: e.target.value })}
            placeholder="SALES"
          />
        </Field>
        <Field label="Schema" optional>
          <Input
            value={draft.snowflakeSchema}
            onChange={(e) => update({ snowflakeSchema: e.target.value })}
            placeholder="PUBLIC"
          />
        </Field>
      </div>
    </>
  )
}

function GoogleCloudFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  const bigquery = draft.type === 'bigquery'
  return (
    <>
      <Field
        label="Service account key file"
        hint={
          bigquery
            ? 'A JSON key for a service account with the "BigQuery Data Viewer" and "BigQuery Job User" roles.'
            : 'A JSON key for a service account with the "Cloud Datastore Viewer" role.'
        }
      >
        <FilePicker
          value={draft.keyFilePath}
          onChange={(keyFilePath) => update({ keyFilePath })}
          kind="service-account"
          placeholder="C:\Keys\service-account.json"
        />
      </Field>
      <Field
        label="Project ID"
        htmlFor="project"
        optional
        hint="Taken from the key file when left empty."
      >
        <Input
          id="project"
          value={draft.projectId}
          onChange={(e) => update({ projectId: e.target.value })}
          placeholder="my-company-analytics"
        />
      </Field>
      {bigquery ? (
        <Field
          label="Location"
          optional
          hint="Where your datasets live, for example US, EU or europe-west2. Usually detected automatically."
        >
          <Input
            value={draft.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="US"
          />
        </Field>
      ) : (
        <Field label="Database ID" optional hint="Leave empty for the default database.">
          <Input
            value={draft.database}
            onChange={(e) => update({ database: e.target.value })}
            placeholder="(default)"
          />
        </Field>
      )}
    </>
  )
}

const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'eu-south-1',
  'me-south-1',
  'me-central-1',
  'af-south-1',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-east-1',
]

function DynamoFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  return (
    <>
      <Field label="Region" htmlFor="region" hint="Where your tables are, for example us-east-1.">
        <Input
          id="region"
          list="aws-regions"
          value={draft.region}
          onChange={(e) => update({ region: e.target.value.trim() })}
          placeholder="us-east-1"
          autoFocus
        />
        <datalist id="aws-regions">
          {AWS_REGIONS.map((region) => (
            <option key={region} value={region} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Access key ID" htmlFor="user">
          <Input
            id="user"
            value={draft.user}
            onChange={(e) => update({ user: e.target.value.trim() })}
            placeholder="AKIA..."
            autoComplete="off"
            className="font-mono text-[12px]"
          />
        </Field>
        <Field label="Secret access key" htmlFor="secret">
          <SecretInput
            id="secret"
            value={draft.secretAccessKey}
            onChange={(secretAccessKey) => update({ secretAccessKey })}
            saved={draft.savedSecrets}
            secret="secretAccessKey"
          />
        </Field>
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Use an IAM user with read-only DynamoDB access (dynamodb:ListTables, DescribeTable, Scan and
        PartiQLSelect).
      </p>
      <Section title="Advanced">
        <Field
          label="Endpoint URL"
          optional
          hint="Only for DynamoDB Local or a private VPC endpoint, for example http://localhost:8000."
        >
          <Input
            value={draft.endpoint}
            onChange={(e) => update({ endpoint: e.target.value })}
            placeholder="https://dynamodb.us-east-1.amazonaws.com"
          />
        </Field>
      </Section>
    </>
  )
}

function CassandraFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field
          label="Contact points"
          htmlFor="host"
          hint="One or more node addresses, separated by commas."
        >
          <Input
            id="host"
            value={draft.host}
            onChange={(e) => update({ host: e.target.value })}
            placeholder="10.0.0.5, 10.0.0.6"
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
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Local data center"
          hint='Shown by "nodetool status", for example datacenter1.'
        >
          <Input
            value={draft.datacenter}
            onChange={(e) => update({ datacenter: e.target.value })}
            placeholder="datacenter1"
          />
        </Field>
        <Field label="Keyspace" optional hint="Leave empty to browse every keyspace.">
          <Input value={draft.keyspace} onChange={(e) => update({ keyspace: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="User" htmlFor="user" optional>
          <Input
            id="user"
            value={draft.user}
            onChange={(e) => update({ user: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Password" htmlFor="password" optional>
          <SecretInput
            id="password"
            value={draft.password}
            onChange={(password) => update({ password })}
            saved={draft.savedSecrets}
            secret="password"
          />
        </Field>
      </div>
      <TlsFields
        draft={draft}
        update={update}
        modes={['disable', 'require', 'verify-ca', 'verify-full']}
      />
    </>
  )
}

function TursoFields({ draft, update }: { draft: ConnectionDraft; update: Update }) {
  return (
    <>
      <Field
        label="Database URL"
        htmlFor="turso-url"
        hint='Shown in the Turso dashboard, or by "turso db show <name> --url".'
      >
        <Input
          id="turso-url"
          value={draft.tursoUrl}
          onChange={(e) => update({ tursoUrl: e.target.value.trim() })}
          placeholder="libsql://my-db-myorg.turso.io"
          autoFocus
        />
      </Field>
      <Field
        label="Auth token"
        htmlFor="turso-token"
        optional
        hint='Create one with "turso db tokens create <name> --read-only". Not needed for a local server without authentication.'
      >
        <SecretInput
          id="turso-token"
          value={draft.authToken}
          onChange={(authToken) => update({ authToken })}
          saved={draft.savedSecrets}
          secret="authToken"
        />
      </Field>
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

      {info.family === 'mongodb' && <MongoFields draft={draft} update={update} />}
      {info.family === 'clickhouse' && <ClickHouseFields draft={draft} update={update} />}
      {info.family === 'snowflake' && <SnowflakeFields draft={draft} update={update} />}
      {(info.family === 'bigquery' || info.family === 'firestore') && (
        <GoogleCloudFields draft={draft} update={update} />
      )}
      {info.family === 'dynamodb' && <DynamoFields draft={draft} update={update} />}
      {info.family === 'cassandra' && <CassandraFields draft={draft} update={update} />}
      {info.family === 'libsql' && <TursoFields draft={draft} update={update} />}

      {info.network && !(info.family === 'mongodb' && draft.mongoUseUri) && (
        <SshFields draft={draft} update={update} />
      )}
    </div>
  )
}
