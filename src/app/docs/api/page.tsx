import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Key, Zap, Shield, Code2, Database, Search, Play, History, BookmarkPlus, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'NatureQuery REST API v1 — authenticate with API keys, execute SQL queries, generate SQL from natural language, and manage saved queries programmatically.',
  openGraph: {
    title: 'NatureQuery API Documentation',
    description: 'REST API v1 for programmatic access to NatureQuery — execute queries, generate SQL, and manage saved queries.',
  },
}

const BASE_URL = 'https://naturequery.com'

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground font-mono">
          {title}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm bg-card">
        <code className="text-foreground/90 font-mono whitespace-pre">{children}</code>
      </pre>
    </div>
  )
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold tracking-wide ${
        method === 'GET'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      }`}
    >
      {method}
    </span>
  )
}

function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="shrink-0 w-40">
        <code className="text-sm font-mono text-primary">{name}</code>
        {required && <span className="ml-1 text-[10px] text-destructive font-medium">required</span>}
        <div className="text-[11px] text-muted-foreground mt-0.5">{type}</div>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function EndpointSection({
  id,
  method,
  path,
  title,
  description,
  icon: Icon,
  params,
  bodyParams,
  queryParams,
  curl,
  response,
}: {
  id: string
  method: 'GET' | 'POST'
  path: string
  title: string
  description: string
  icon: React.ElementType
  params?: React.ReactNode
  bodyParams?: React.ReactNode
  queryParams?: React.ReactNode
  curl: string
  response: string
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border">
        <MethodBadge method={method} />
        <code className="text-sm font-mono">{path}</code>
      </div>

      {queryParams && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Query Parameters</h4>
          <div className="rounded-lg border border-border p-3">{queryParams}</div>
        </div>
      )}

      {bodyParams && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Request Body</h4>
          <div className="rounded-lg border border-border p-3">{bodyParams}</div>
        </div>
      )}

      {params && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="rounded-lg border border-border p-3">{params}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <CodeBlock title="Example Request">{curl}</CodeBlock>
        <CodeBlock title="Example Response">{response}</CodeBlock>
      </div>
    </section>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
            <span className="text-border">/</span>
            <h1 className="text-lg font-semibold">API Documentation</h1>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">v1</span>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            Get API Key
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Intro */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-3">NatureQuery REST API</h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Programmatic access to NatureQuery. Execute SQL queries, generate SQL from natural language,
            and manage your saved queries and connections.
          </p>
        </div>

        {/* Quick nav */}
        <nav className="mb-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { href: '#auth', label: 'Authentication', icon: Shield },
            { href: '#rate-limits', label: 'Rate Limits', icon: Zap },
            { href: '#connections', label: 'Connections', icon: Database },
            { href: '#queries', label: 'Saved Queries', icon: BookmarkPlus },
            { href: '#query-by-id', label: 'Query by ID', icon: Search },
            { href: '#execute', label: 'Execute SQL', icon: Play },
            { href: '#generate', label: 'Generate SQL', icon: Code2 },
            { href: '#history', label: 'Query History', icon: History },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/30 transition-all text-sm"
            >
              <item.icon className="w-4 h-4 text-primary shrink-0" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="space-y-16">
          {/* Authentication */}
          <section id="auth" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Authentication</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              All API requests require a Bearer token in the <code className="text-sm bg-muted px-1.5 py-0.5 rounded">Authorization</code> header.
              Generate an API key from the{' '}
              <Link href="/settings" className="text-primary hover:underline">Settings &rarr; API Keys</Link> tab.
            </p>
            <CodeBlock title="Authorization Header">{`Authorization: Bearer rp_your_api_key_here`}</CodeBlock>
            <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Security:</strong> API keys are hashed with SHA-256 before storage.
                The plaintext key is only shown once at creation. Treat it like a password.
              </p>
            </div>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Rate Limits</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              API requests are limited to <strong className="text-foreground">60 requests per minute</strong> per API key.
              When exceeded, the API returns <code className="text-sm bg-muted px-1.5 py-0.5 rounded">429 Too Many Requests</code> with
              a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">Retry-After</code> header.
            </p>
            <CodeBlock title="429 Response">{`{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds."
}`}</CodeBlock>
          </section>

          {/* Response Format */}
          <section id="response-format" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Response Format</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              All responses use a consistent JSON envelope:
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <CodeBlock title="Success">{`{
  "success": true,
  "data": { ... }
}`}</CodeBlock>
              <CodeBlock title="Paginated">{`{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 142,
    "totalPages": 3
  }
}`}</CodeBlock>
            </div>
            <div className="mt-4">
              <CodeBlock title="Error">{`{
  "success": false,
  "error": "Description of what went wrong"
}`}</CodeBlock>
            </div>
          </section>

          <hr className="border-border" />

          {/* ─── Endpoints ─── */}

          {/* GET /connections */}
          <EndpointSection
            id="connections"
            method="GET"
            path="/api/v1/connections"
            title="List Connections"
            description="Returns all database connections for your account. Passwords are never included."
            icon={Database}
            curl={`curl ${BASE_URL}/api/v1/connections \\
  -H "Authorization: Bearer rp_your_key"`}
            response={`{
  "success": true,
  "data": [
    {
      "id": "cm...",
      "name": "Production DB",
      "host": "db.example.com",
      "port": 5432,
      "database": "myapp",
      "user": "readonly",
      "dbType": "postgresql",
      "ssl": true,
      "isActive": true,
      "createdAt": "2026-02-10T12:00:00.000Z"
    }
  ]
}`}
          />

          {/* GET /queries */}
          <EndpointSection
            id="queries"
            method="GET"
            path="/api/v1/queries"
            title="List Saved Queries"
            description="Paginated list of saved queries. Includes team-shared queries."
            icon={BookmarkPlus}
            queryParams={
              <>
                <Param name="page" type="number">Page number (default: 1)</Param>
                <Param name="pageSize" type="number">Items per page, max 100 (default: 50)</Param>
                <Param name="search" type="string">Filter by name or question text</Param>
                <Param name="connectionId" type="string">Filter by connection ID</Param>
              </>
            }
            curl={`curl "${BASE_URL}/api/v1/queries?page=1&pageSize=10" \\
  -H "Authorization: Bearer rp_your_key"`}
            response={`{
  "success": true,
  "data": [
    {
      "id": "cm...",
      "name": "Monthly Revenue",
      "question": "total revenue by month",
      "sql": "SELECT ... FROM orders ...",
      "connectionId": "cm...",
      "connectionName": "Production DB",
      "isPublic": false,
      "isFavorite": true,
      "tags": ["finance", "monthly"],
      "shareToken": null,
      "createdAt": "2026-02-10T12:00:00.000Z",
      "updatedAt": "2026-02-12T08:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 24,
    "totalPages": 3
  }
}`}
          />

          {/* POST /queries */}
          <EndpointSection
            id="create-query"
            method="POST"
            path="/api/v1/queries"
            title="Save a Query"
            description="Create a new saved query."
            icon={BookmarkPlus}
            bodyParams={
              <>
                <Param name="name" type="string" required>Display name for the query</Param>
                <Param name="question" type="string" required>The natural language question</Param>
                <Param name="sql" type="string" required>The SQL query</Param>
                <Param name="description" type="string">Optional description</Param>
                <Param name="connectionId" type="string">ID of the associated connection</Param>
                <Param name="connectionName" type="string">Display name of the connection</Param>
                <Param name="tags" type="string[]">Array of tag strings</Param>
                <Param name="isPublic" type="boolean">Whether the query is publicly visible (default: false)</Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/queries \\
  -H "Authorization: Bearer rp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Monthly Revenue",
    "question": "total revenue by month",
    "sql": "SELECT DATE_TRUNC('"'"'month'"'"', created_at) AS month, SUM(amount) FROM orders GROUP BY 1",
    "tags": ["finance"]
  }'`}
            response={`{
  "success": true,
  "data": {
    "id": "cm...",
    "name": "Monthly Revenue",
    "question": "total revenue by month",
    "sql": "SELECT ...",
    "connectionId": null,
    "connectionName": null,
    "isPublic": false,
    "isFavorite": false,
    "tags": ["finance"],
    "shareToken": null,
    "createdAt": "2026-02-13T10:00:00.000Z",
    "updatedAt": "2026-02-13T10:00:00.000Z"
  }
}`}
          />

          {/* GET /queries/:id */}
          <EndpointSection
            id="query-by-id"
            method="GET"
            path="/api/v1/queries/:id"
            title="Get Query by ID"
            description="Fetch a single saved query. Must be owned by you or shared via a team."
            icon={Search}
            params={
              <Param name="id" type="string" required>The query ID (path parameter)</Param>
            }
            curl={`curl ${BASE_URL}/api/v1/queries/cm_query_id \\
  -H "Authorization: Bearer rp_your_key"`}
            response={`{
  "success": true,
  "data": {
    "id": "cm_query_id",
    "name": "Monthly Revenue",
    "question": "total revenue by month",
    "sql": "SELECT ...",
    "connectionId": "cm...",
    "connectionName": "Production DB",
    "isPublic": false,
    "isFavorite": true,
    "tags": ["finance"],
    "shareToken": null,
    "createdAt": "2026-02-10T12:00:00.000Z",
    "updatedAt": "2026-02-12T08:30:00.000Z"
  }
}`}
          />

          {/* POST /query/execute */}
          <EndpointSection
            id="execute"
            method="POST"
            path="/api/v1/query/execute"
            title="Execute SQL"
            description="Run a SQL query against one of your saved connections. Subject to plan limits."
            icon={Play}
            bodyParams={
              <>
                <Param name="connectionId" type="string" required>ID of the connection to query</Param>
                <Param name="sql" type="string" required>SQL statement to execute</Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/query/execute \\
  -H "Authorization: Bearer rp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connectionId": "cm_connection_id",
    "sql": "SELECT id, name, email FROM users LIMIT 5"
  }'`}
            response={`{
  "success": true,
  "data": {
    "rows": [
      { "id": 1, "name": "Alice", "email": "alice@example.com" },
      { "id": 2, "name": "Bob", "email": "bob@example.com" }
    ],
    "fields": [
      { "name": "id", "dataType": "int4" },
      { "name": "name", "dataType": "varchar" },
      { "name": "email", "dataType": "varchar" }
    ],
    "rowCount": 2,
    "executionTime": 45
  }
}`}
          />

          {/* POST /query/generate */}
          <EndpointSection
            id="generate"
            method="POST"
            path="/api/v1/query/generate"
            title="Generate SQL"
            description="Convert a natural language question into SQL using AI, based on your connection's schema."
            icon={Code2}
            bodyParams={
              <>
                <Param name="question" type="string" required>Natural language question</Param>
                <Param name="connectionId" type="string" required>ID of the connection (for schema context)</Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/query/generate \\
  -H "Authorization: Bearer rp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "top 10 customers by total revenue",
    "connectionId": "cm_connection_id"
  }'`}
            response={`{
  "success": true,
  "data": {
    "question": "top 10 customers by total revenue",
    "sql": "SELECT c.name, SUM(o.amount) AS total_revenue FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name ORDER BY total_revenue DESC LIMIT 10",
    "connectionId": "cm_connection_id"
  }
}`}
          />

          {/* GET /history */}
          <EndpointSection
            id="history"
            method="GET"
            path="/api/v1/history"
            title="Query History"
            description="Paginated list of previously executed queries with status and timing info."
            icon={History}
            queryParams={
              <>
                <Param name="page" type="number">Page number (default: 1)</Param>
                <Param name="pageSize" type="number">Items per page, max 100 (default: 50)</Param>
                <Param name="connectionId" type="string">Filter by connection ID</Param>
                <Param name="status" type="string">Filter by status: success, error</Param>
                <Param name="search" type="string">Search in question or SQL text</Param>
              </>
            }
            curl={`curl "${BASE_URL}/api/v1/history?page=1&pageSize=10&status=success" \\
  -H "Authorization: Bearer rp_your_key"`}
            response={`{
  "success": true,
  "data": [
    {
      "id": "cm...",
      "question": "total revenue by month",
      "sql": "SELECT ...",
      "connectionId": "cm...",
      "connectionName": "Production DB",
      "status": "success",
      "rowCount": 12,
      "executionTimeMs": 45,
      "errorMessage": null,
      "executedAt": "2026-02-13T09:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 87,
    "totalPages": 9
  }
}`}
          />

          <hr className="border-border" />

          {/* Error Codes */}
          <section id="errors" className="scroll-mt-20">
            <h3 className="text-xl font-semibold mb-4">Error Codes</h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="px-4 py-2"><code>400</code></td><td className="px-4 py-2 text-muted-foreground">Bad request — invalid JSON or failed validation</td></tr>
                  <tr><td className="px-4 py-2"><code>401</code></td><td className="px-4 py-2 text-muted-foreground">Unauthorized — missing, invalid, or expired API key</td></tr>
                  <tr><td className="px-4 py-2"><code>403</code></td><td className="px-4 py-2 text-muted-foreground">Forbidden — plan limit reached (upgrade to continue)</td></tr>
                  <tr><td className="px-4 py-2"><code>404</code></td><td className="px-4 py-2 text-muted-foreground">Not found — resource doesn&apos;t exist or you don&apos;t have access</td></tr>
                  <tr><td className="px-4 py-2"><code>429</code></td><td className="px-4 py-2 text-muted-foreground">Too many requests — rate limit exceeded, check Retry-After header</td></tr>
                  <tr><td className="px-4 py-2"><code>500</code></td><td className="px-4 py-2 text-muted-foreground">Internal server error</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 mb-8 text-center">
          <p className="text-muted-foreground mb-3">Need help or have questions?</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/settings"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Manage API Keys
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
