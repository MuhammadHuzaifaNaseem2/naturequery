import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookmarkPlus, Code2, Database, History, Play, Search } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'

export const metadata: Metadata = {
  title: 'API Documentation',
  description:
    'NatureQuery REST API v1: authenticate with API keys, execute SQL queries, generate SQL from natural language, and manage saved queries programmatically.',
  openGraph: {
    title: 'NatureQuery API Documentation',
    description:
      'REST API v1 for programmatic access to NatureQuery: execute queries, generate SQL, and manage saved queries.',
  },
}

const BASE_URL = 'https://naturequery.app'

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-mk-rule">
      {title && (
        <div className="border-b border-mk-band-rule bg-mk-band px-4 py-2 font-nq-mono text-[0.7rem] uppercase tracking-[0.08em] text-mk-band-ink-2">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto bg-mk-band p-4 text-[0.8rem] leading-relaxed [font-variant-ligatures:none]">
        <code className="whitespace-pre font-nq-mono text-mk-band-ink">{children}</code>
      </pre>
    </div>
  )
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-nq-mono text-[0.72rem] font-medium tracking-[0.06em] ${
        method === 'GET'
          ? 'bg-mk-violet-soft text-mk-violet'
          : 'bg-mk-signal-soft text-mk-signal-ink'
      }`}
    >
      {method}
    </span>
  )
}

function Param({
  name,
  type,
  required,
  children,
}: {
  name: string
  type: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 border-b border-mk-rule py-3 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <div>
        <code className="font-nq-mono text-[0.85rem] text-mk-violet">{name}</code>
        {required && (
          <span className="ml-2 font-nq-mono text-[0.68rem] uppercase tracking-[0.06em] text-mk-signal-ink">
            required
          </span>
        )}
        <div className="mt-0.5 font-nq-mono text-[0.72rem] text-mk-ink-3">{type}</div>
      </div>
      <div className="text-[0.9375rem] leading-relaxed text-mk-ink-2">{children}</div>
    </div>
  )
}

function EndpointSection({
  id,
  method,
  path,
  title,
  description,
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
  icon?: React.ElementType
  params?: React.ReactNode
  bodyParams?: React.ReactNode
  queryParams?: React.ReactNode
  curl: string
  response: string
}) {
  const groups = [
    ['Query parameters', queryParams],
    ['Request body', bodyParams],
    ['Parameters', params],
  ] as const
  return (
    <section id={id} className="scroll-mt-24 border-t border-mk-rule pt-10">
      <h2 className="font-nq-serif text-[2rem] leading-tight tracking-[-0.015em] text-mk-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-[40rem] leading-relaxed text-mk-ink-2">{description}</p>
      <div className="mt-5 flex items-center gap-3 rounded-md border border-mk-rule bg-mk-surface px-3 py-2.5">
        <MethodBadge method={method} />
        <code className="font-nq-mono text-[0.85rem] text-mk-ink">{path}</code>
      </div>
      {groups.map(([label, content]) =>
        content ? (
          <div key={label} className="mt-6">
            <h3 className="mk-label">{label}</h3>
            <div className="mt-2 border-t border-mk-ink/80">{content}</div>
          </div>
        ) : null
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CodeBlock title="Example request">{curl}</CodeBlock>
        <CodeBlock title="Example response">{response}</CodeBlock>
      </div>
    </section>
  )
}

const INDEX = [
  { href: '#auth', label: 'Authentication' },
  { href: '#rate-limits', label: 'Rate limits' },
  { href: '#response-format', label: 'Response format' },
  { href: '#connections', label: 'Connections' },
  { href: '#queries', label: 'Saved queries' },
  { href: '#query-by-id', label: 'Query by ID' },
  { href: '#execute', label: 'Execute SQL' },
  { href: '#generate', label: 'Generate SQL' },
  { href: '#history', label: 'Query history' },
  { href: '#errors', label: 'Error codes' },
]

export default function ApiDocsPage() {
  return (
    <MarketingShell current="/docs/api">
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">
          API <span className="text-mk-violet">v1</span>
        </p>
        <h1 className="mt-5 max-w-4xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.6rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          The NatureQuery REST API.
        </h1>
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[40rem] text-lg leading-relaxed text-mk-ink-2">
            Programmatic access to NatureQuery. Execute SQL queries, generate SQL from natural
            language, and manage your saved queries and connections.
          </p>
          <Link href="/settings" className="mk-btn mk-btn-primary self-start md:self-end">
            Get an API key
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mx-auto mt-14 grid max-w-[1200px] gap-12 px-5 pb-24 sm:mt-20 sm:px-8 sm:pb-32 lg:grid-cols-[13rem_1fr] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-28 space-y-2.5 border-l border-mk-rule pl-5">
            {INDEX.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-sm text-mk-ink-2 hover:text-mk-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-16">
          {/* Authentication */}
          <section id="auth" className="scroll-mt-20">
            <h2 className="mb-4 font-nq-serif text-[2rem] leading-tight tracking-[-0.015em] text-mk-ink">
              Authentication
            </h2>
            <p className="text-mk-ink-2 mb-4">
              All API requests require a Bearer token in the{' '}
              <code className="text-sm bg-mk-sunken px-1.5 py-0.5 rounded">Authorization</code>{' '}
              header. Generate an API key from the{' '}
              <Link href="/settings" className="mk-link">
                Settings &rarr; API Keys
              </Link>{' '}
              tab.
            </p>
            <CodeBlock title="Authorization Header">{`Authorization: Bearer nq_your_api_key_here`}</CodeBlock>
            <div className="mt-4 p-4 rounded-lg border border-mk-rule bg-mk-sunken">
              <p className="text-sm text-mk-ink-2">
                <strong className="text-mk-ink">Security:</strong> API keys are hashed with SHA-256
                before storage. The plaintext key is only shown once at creation. Treat it like a
                password.
              </p>
            </div>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="scroll-mt-20">
            <h2 className="mb-4 font-nq-serif text-[2rem] leading-tight tracking-[-0.015em] text-mk-ink">
              Rate Limits
            </h2>
            <p className="text-mk-ink-2 mb-4">
              API requests are limited to{' '}
              <strong className="text-mk-ink">60 requests per minute</strong> per API key. When
              exceeded, the API returns{' '}
              <code className="text-sm bg-mk-sunken px-1.5 py-0.5 rounded">
                429 Too Many Requests
              </code>{' '}
              with a <code className="text-sm bg-mk-sunken px-1.5 py-0.5 rounded">Retry-After</code>{' '}
              header.
            </p>
            <CodeBlock title="429 Response">{`{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds."
}`}</CodeBlock>
          </section>

          {/* Response Format */}
          <section id="response-format" className="scroll-mt-20">
            <h2 className="mb-4 font-nq-serif text-[2rem] leading-tight tracking-[-0.015em] text-mk-ink">
              Response Format
            </h2>
            <p className="text-mk-ink-2 mb-4">All responses use a consistent JSON envelope:</p>
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

          <hr className="border-mk-rule" />

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
  -H "Authorization: Bearer nq_your_key"`}
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
                <Param name="page" type="number">
                  Page number (default: 1)
                </Param>
                <Param name="pageSize" type="number">
                  Items per page, max 100 (default: 50)
                </Param>
                <Param name="search" type="string">
                  Filter by name or question text
                </Param>
                <Param name="connectionId" type="string">
                  Filter by connection ID
                </Param>
              </>
            }
            curl={`curl "${BASE_URL}/api/v1/queries?page=1&pageSize=10" \\
  -H "Authorization: Bearer nq_your_key"`}
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
                <Param name="name" type="string" required>
                  Display name for the query
                </Param>
                <Param name="question" type="string" required>
                  The natural language question
                </Param>
                <Param name="sql" type="string" required>
                  The SQL query
                </Param>
                <Param name="description" type="string">
                  Optional description
                </Param>
                <Param name="connectionId" type="string">
                  ID of the associated connection
                </Param>
                <Param name="connectionName" type="string">
                  Display name of the connection
                </Param>
                <Param name="tags" type="string[]">
                  Array of tag strings
                </Param>
                <Param name="isPublic" type="boolean">
                  Whether the query is publicly visible (default: false)
                </Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/queries \\
  -H "Authorization: Bearer nq_your_key" \\
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
              <Param name="id" type="string" required>
                The query ID (path parameter)
              </Param>
            }
            curl={`curl ${BASE_URL}/api/v1/queries/cm_query_id \\
  -H "Authorization: Bearer nq_your_key"`}
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
                <Param name="connectionId" type="string" required>
                  ID of the connection to query
                </Param>
                <Param name="sql" type="string" required>
                  SQL statement to execute
                </Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/query/execute \\
  -H "Authorization: Bearer nq_your_key" \\
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
                <Param name="question" type="string" required>
                  Natural language question
                </Param>
                <Param name="connectionId" type="string" required>
                  ID of the connection (for schema context)
                </Param>
              </>
            }
            curl={`curl -X POST ${BASE_URL}/api/v1/query/generate \\
  -H "Authorization: Bearer nq_your_key" \\
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
                <Param name="page" type="number">
                  Page number (default: 1)
                </Param>
                <Param name="pageSize" type="number">
                  Items per page, max 100 (default: 50)
                </Param>
                <Param name="connectionId" type="string">
                  Filter by connection ID
                </Param>
                <Param name="status" type="string">
                  Filter by status: success, error
                </Param>
                <Param name="search" type="string">
                  Search in question or SQL text
                </Param>
              </>
            }
            curl={`curl "${BASE_URL}/api/v1/history?page=1&pageSize=10&status=success" \\
  -H "Authorization: Bearer nq_your_key"`}
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

          <hr className="border-mk-rule" />

          {/* Error Codes */}
          <section id="errors" className="scroll-mt-20">
            <h2 className="mb-4 font-nq-serif text-[2rem] leading-tight tracking-[-0.015em] text-mk-ink">
              Error codes
            </h2>
            <div className="rounded-lg border border-mk-rule overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-mk-sunken border-b border-mk-rule">
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mk-rule">
                  <tr>
                    <td className="px-4 py-2">
                      <code>400</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">
                      Bad request: invalid JSON or failed validation
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code>401</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">
                      Unauthorized: missing, invalid, or expired API key
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code>403</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">
                      Forbidden: plan limit reached (upgrade to continue)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code>404</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">
                      Not found: resource doesn&apos;t exist or you don&apos;t have access
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code>429</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">
                      Too many requests: rate limit exceeded, check Retry-After header
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      <code>500</code>
                    </td>
                    <td className="px-4 py-2 text-mk-ink-2">Internal server error</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <section className="border-t border-mk-rule">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
          <h2 className="font-nq-serif text-[clamp(2rem,4vw,3rem)] font-normal italic leading-[1.05] tracking-[-0.02em] text-mk-ink">
            Questions about the API?
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/settings" className="mk-btn mk-btn-primary">
              Manage API keys
            </Link>
            <Link href="/contact" className="mk-btn mk-btn-quiet">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
