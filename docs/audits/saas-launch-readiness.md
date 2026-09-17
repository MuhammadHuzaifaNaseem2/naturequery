# NatureQuery — SaaS Launch Readiness Report

**Prepared by**: Fractional CTO Review
**Date**: April 2026
**Stack**: Next.js 15 / NextAuth v5 (JWT) / Prisma + PostgreSQL / Stripe / Groq AI / Upstash Redis

---

## Executive Summary

NatureQuery is a well-architected B2B AI-powered Text-to-SQL platform with a solid foundation: AES-256-GCM encrypted credentials, bcrypt password hashing, 2FA with TOTP + backup codes, immutable audit logging with hash chains, AST-based SQL validation, multi-tier rate limiting, Stripe billing integration, and RBAC-based team permissions.

**Verdict**: The platform is **80% launch-ready**. There are **7 launch blockers** (P0) that must be fixed before accepting the first paying customer, **12 high-priority improvements** (P1) for the first 30 days, and a clear path to competitive differentiation through AI-native features.

**Estimated time to first paying customer**: 3-4 weeks (fixing P0 blockers + minimal marketing site polish).

---

## PILLAR 1 — LAUNCH BLOCKERS

> Critical issues that will cause security breaches, data loss, or immediate churn if not fixed before the first paying customer.

### P0-1: SQL Validation Only Works for PostgreSQL

**Risk**: Security breach / data destruction
**Effort**: M

The SQL safety validator (`src/lib/sql-validator.ts`) uses `pgsql-ast-parser` — a PostgreSQL-only AST parser. MySQL, SQLite, SQL Server, and Redshift queries are parsed as PostgreSQL, which means:

- Valid MySQL syntax (`SHOW TABLES`, backtick-quoted identifiers) may be rejected as unsafe
- Dangerous MySQL-specific statements (`LOAD DATA INFILE`, `INTO OUTFILE`) may pass validation since they're not valid PostgreSQL and the parser won't parse them as DDL

```typescript
// src/lib/sql-validator.ts — Current implementation
import { parse } from 'pgsql-ast-parser'

// FIX: Add per-dialect validation
export function validateSQLSafety(sql: string, dialect: DatabaseType = 'postgresql') {
  // Universal blocklist regex (defense in depth)
  const dangerousPatterns =
    /\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|LOAD\s+DATA|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i
  if (dangerousPatterns.test(sql)) {
    return { valid: false, error: 'Only SELECT queries are allowed.' }
  }

  // PostgreSQL: full AST validation
  if (dialect === 'postgresql' || dialect === 'redshift') {
    return validateWithPgParser(sql)
  }

  // Other dialects: regex-based validation + statement count check
  const statements = sql.split(';').filter((s) => s.trim())
  if (statements.length > 1) {
    return { valid: false, error: 'Only single statements are allowed.' }
  }

  const trimmed = sql.trim().toUpperCase()
  if (
    !trimmed.startsWith('SELECT') &&
    !trimmed.startsWith('WITH') &&
    !trimmed.startsWith('EXPLAIN')
  ) {
    return { valid: false, error: 'Only SELECT/WITH/EXPLAIN statements are allowed.' }
  }

  return { valid: true }
}
```

### P0-2: In-Memory Rate Limiting Fails in Multi-Instance Deployments

**Risk**: Rate limit bypass under load
**Effort**: S

The in-memory rate limiter (`src/lib/rate-limit.ts`) works for a single process but **resets on every deployment** and provides **zero protection** when running multiple instances (Vercel functions, Docker replicas, etc.). An attacker can bypass all rate limits by hitting different instances.

**Fix**: Make Redis mandatory for production. Add a startup check:

```typescript
// src/lib/rate-limit.ts
if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn(
    '[SECURITY] Rate limiting running in-memory mode in production. Configure UPSTASH_REDIS_REST_URL for distributed rate limiting.'
  )
}
```

### P0-3: No Input Length Limits on User Queries

**Risk**: Prompt injection / cost explosion / DoS
**Effort**: S

The natural language query input has no character limit. A user could submit a 100KB prompt that:

- Costs significantly more in Groq API tokens
- Could contain prompt injection payloads
- Could cause OOM in the SSE stream buffer

**Fix**: Add validation in the streaming endpoint and UI:

```typescript
// src/app/api/generate-sql/stream/route.ts
const MAX_QUESTION_LENGTH = 2000 // ~500 words, more than enough

if (question.length > MAX_QUESTION_LENGTH) {
  return new Response(JSON.stringify({ error: 'Question too long (max 2000 characters)' }), {
    status: 400,
  })
}
```

```typescript
// src/app/dashboard/SmartQueryInput.tsx
<textarea maxLength={2000} ... />
```

### P0-4: Stripe Webhook Signature Verification Fails Silently

**Risk**: Payment bypass / subscription manipulation
**Effort**: S

If `STRIPE_WEBHOOK_SECRET` is not set, the webhook endpoint (`src/app/api/webhooks/stripe/route.ts`) returns a 500 error but **doesn't log the misconfiguration**. In production, this means:

- Subscription changes from Stripe are silently dropped
- Users can cancel payment but keep PRO access indefinitely
- Invoice failures never trigger plan downgrades

**Fix**: Fail loudly at build time and add monitoring:

```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error(
      '[CRITICAL] STRIPE_WEBHOOK_SECRET is not configured. Billing events are not being processed.'
    )
    return new Response('Webhook secret not configured', { status: 503 })
  }
  // ... existing verification logic
}
```

### P0-5: No Subscription Enforcement on Past-Due Accounts

**Risk**: Revenue leakage
**Effort**: M

When `invoice.payment_failed` fires, the subscription status is set to `PAST_DUE` in the database, but **nothing prevents the user from continuing to use the platform**. The `checkPlanLimits()` function (`src/lib/plan-limits.ts`) only checks the plan type (FREE/PRO/ENTERPRISE), not the subscription status.

**Fix**: Add status check to plan limits:

```typescript
// src/lib/plan-limits.ts — checkPlanLimits()
const sub = await prisma.subscription.findUnique({ where: { userId } })

if (sub?.status === 'PAST_DUE' || sub?.status === 'CANCELED') {
  // Gracefully downgrade to FREE limits
  return checkAgainstPlan('FREE', action, currentUsage)
}

if (sub?.status === 'INCOMPLETE') {
  return { allowed: false, current: 0, limit: 0, planName: 'INCOMPLETE' }
}
```

### P0-6: Database Credentials Recoverable if Encryption Key Leaks

**Risk**: Mass credential exposure
**Effort**: M

Database credentials are encrypted with AES-256-GCM using a single `ENCRYPTION_KEY` from the environment. If this key is compromised (env leak, log exposure, backup theft), **every customer's database credentials are immediately recoverable**.

**Fix (immediate)**: Add key rotation support:

```typescript
// Support multiple keys: ENCRYPTION_KEY (current), ENCRYPTION_KEY_PREVIOUS (for decryption only)
function decrypt(encryptedData: string): string {
  try {
    return decryptWithKey(encryptedData, process.env.ENCRYPTION_KEY!)
  } catch {
    if (process.env.ENCRYPTION_KEY_PREVIOUS) {
      return decryptWithKey(encryptedData, process.env.ENCRYPTION_KEY_PREVIOUS!)
    }
    throw new Error('Decryption failed')
  }
}
```

**Fix (post-launch)**: Migrate to a managed KMS (AWS KMS, GCP Cloud KMS, or Vault) where the platform never holds the master key in memory.

### P0-7: No Error Boundary on Critical Billing Flows

**Risk**: User loses access after payment
**Effort**: S

If the Stripe checkout succeeds but the redirect back to NatureQuery fails (network issue, browser closes), the user has paid but their subscription record may not be updated until the webhook fires. If the webhook is delayed or fails, the user sees a FREE plan after paying.

**Fix**: Add a subscription sync on dashboard load:

```typescript
// src/app/dashboard/page.tsx (server component)
import { syncSubscriptionFromStripe } from '@/actions/billing'

// On page load, verify subscription matches Stripe
if (searchParams?.status === 'success') {
  await syncSubscriptionFromStripe(userId)
}
```

---

## PILLAR 2 — MONETIZATION & RETENTION ARCHITECTURE

### Current State

| Feature         | Status  | Notes                                                                       |
| --------------- | ------- | --------------------------------------------------------------------------- |
| Stripe Checkout | Working | Creates checkout session, redirects                                         |
| Stripe Webhooks | Working | Handles subscription lifecycle events                                       |
| Plan Limits     | Working | FREE: 50 queries/mo, 1 conn. PRO: unlimited, 10 conn. ENTERPRISE: unlimited |
| Usage Tracking  | Partial | Only tracks QUERY count, not connections or API calls                       |
| Billing Portal  | Working | Self-service plan management via Stripe                                     |
| Dunning         | Missing | No emails for failed payments                                               |
| Trial           | Missing | No free trial period for PRO                                                |
| Annual Plans    | Missing | Only monthly pricing                                                        |
| Usage Analytics | Missing | No internal dashboard for revenue metrics                                   |

### Missing Monetization Levers

#### P1-1: Free Trial for PRO Plan — Effort: S

No trial period means users must commit $29/month sight-unseen. This dramatically reduces conversion from FREE to PRO.

**Recommendation**: 14-day free trial with no credit card required. After trial:

- Show a countdown banner: "Your PRO trial ends in 3 days"
- Send email at day 1, day 10, day 13
- Auto-downgrade to FREE on day 14

```typescript
// prisma/schema.prisma — add to Subscription model
trialEndsAt    DateTime?

// Create trial subscription on registration
await prisma.subscription.create({
  data: {
    userId,
    plan: 'PRO',
    status: 'TRIALING',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }
})
```

#### P1-2: Annual Pricing (20% Discount) — Effort: S

Annual plans reduce churn by 3-5x (industry data). Currently only monthly pricing exists.

**Recommendation**: Add annual pricing at $23/mo billed annually ($276/year vs $348/year monthly).

#### P1-3: Dunning Emails for Failed Payments — Effort: M

When `invoice.payment_failed` fires, no email is sent. The user silently loses access, churns, and never returns.

**Recommendation**: 3-stage dunning sequence:

1. Day 0: "Payment failed — update your card" (include direct link to Stripe billing portal)
2. Day 3: "Your PRO features will be paused in 4 days"
3. Day 7: Downgrade to FREE, send "We've paused your PRO plan" email

#### P1-4: Upgrade Prompts at Limit Points — Effort: S

When a FREE user hits their 50-query limit or tries to add a 2nd connection, the error message is technical: `"Query limit reached (50/50 this month)"`. This should be a polished upgrade modal.

**Recommendation**: Create an `<UpgradeModal>` component that shows:

- What they've used vs their limit
- What PRO unlocks (unlimited queries, 10 connections, team features)
- One-click upgrade button → Stripe checkout

#### P1-5: Usage Analytics Events — Effort: M

Currently no product analytics. You cannot answer: "What's our activation rate? How many queries does the average PRO user run? Where do users drop off?"

**Recommendation**: Add lightweight event tracking (PostHog, Mixpanel, or custom):

- `user.registered` — with source (organic, referral, etc.)
- `user.activated` — first successful query
- `query.generated` — with connection type, table count
- `query.executed` — with execution time, row count
- `subscription.upgraded` / `subscription.canceled` — with plan, tenure
- `feature.used` — chart, export, template, scheduled query

### Retention Hooks (Post-Launch Priority)

#### P1-6: Weekly Email Digest — Effort: M

Send a weekly summary email to active users:

- "You ran 47 queries this week across 3 databases"
- "Your most popular query: [Show top customers by revenue]"
- "New: Try the SQL Formatter feature"
- This keeps NatureQuery in their inbox and drives weekly re-engagement.

#### P1-7: Team Collaboration Notifications — Effort: M

When a team member shares a query or creates a template, notify other team members. Social features drive retention because users feel obligation to the team, not just the tool.

#### P1-8: Query Failure → AI Fix → Success Loop — Effort: S (already partially built)

The "AI Fix It" button already exists. Make it more prominent and track the success rate. When AI fixes a query successfully, show a celebratory animation. This turns a frustration moment into a delight moment.

---

## PILLAR 3 — SCALABILITY & INFRASTRUCTURE

### Current Architecture Assessment

```
User Browser
    ↓ HTTPS
Next.js App (Vercel / self-hosted)
    ├── NextAuth JWT (stateless auth)
    ├── Prisma → PostgreSQL (main DB)
    ├── Upstash Redis (cache + rate limits)
    ├── Groq API (AI generation)
    ├── Stripe API (billing)
    ├── SMTP/Resend (email)
    └── Customer DBs (PG, MySQL, SQLite, MSSQL, Redshift)
```

### Bottleneck Analysis

#### P1-9: Connection Pool Exhaustion Under Multi-Tenant Load — Effort: L

**Problem**: Each database driver creates a pool of 10 connections (`src/lib/db-drivers.ts`). These pools are created **per-request** in server actions and closed in `finally` blocks. In a serverless environment (Vercel), this means:

- Every request creates a new pool → TCP handshake + SSL negotiation
- Pool is destroyed after the request completes
- Under load, you'll exhaust customer database connection limits

**Current code** (`src/actions/connections.ts:384`):

```typescript
const driver = createDriver(credentials, credentials.dbType)
try {
  const result = await driver.executeQuery(sql, maxRows)
} finally {
  await driver.close().catch(() => {})
}
```

**Fix**: Implement a connection pool cache keyed by connection ID:

```typescript
// src/lib/driver-pool.ts
const driverCache = new Map<string, { driver: DatabaseDriver; lastUsed: number }>()
const POOL_TTL = 60_000 // 1 minute idle

export function getOrCreateDriver(
  connectionId: string,
  credentials: DBCredentials,
  dbType: DatabaseType
): DatabaseDriver {
  const cached = driverCache.get(connectionId)
  if (cached) {
    cached.lastUsed = Date.now()
    return cached.driver
  }
  const driver = createDriver(credentials, dbType)
  driverCache.set(connectionId, { driver, lastUsed: Date.now() })
  return driver
}

// Cleanup idle pools every 30s
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of driverCache) {
    if (now - entry.lastUsed > POOL_TTL) {
      entry.driver.close().catch(() => {})
      driverCache.delete(id)
    }
  }
}, 30_000)
```

> **Note**: This only works for long-lived processes (Docker/VPS). For Vercel serverless, use PgBouncer or a connection proxy like Neon's pooler.

#### P1-10: No Database Query Timeout for SQLite — Effort: S

**Problem**: PostgreSQL and MySQL have server-side timeout enforcement (`SET LOCAL statement_timeout`, `SET max_execution_time`). SQLite and SQL Server have **no timeout enforcement**. A pathological query on SQLite will block the Node.js event loop indefinitely.

**Fix**: Use `AbortController` with a timeout wrapper:

```typescript
async executeQuery(sql: string, maxRows?: number) {
  return withTimeout(30_000, async () => {
    const d = getDb()
    const stmt = d.prepare(sql)
    // ... existing logic
  })
}

function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    fn().then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
```

#### P1-11: Schema Cache Invalidation is Connection-Wide — Effort: S

**Problem**: `invalidateSchemaCache()` (`src/lib/query-cache.ts`) invalidates the schema cache for a connection, but `invalidateConnectionCache()` does a Redis `SCAN` to find all query cache keys matching `qcache:${connectionId}:*`. Redis SCAN is O(N) across all keys and will degrade as the cache grows.

**Fix**: Use a cache generation counter instead of scanning:

```typescript
// Instead of scanning all keys:
const schemaVersion = await redis.incr(`schema-version:${connectionId}`)

// Include version in cache key:
const cacheKey = `qcache:${connectionId}:v${schemaVersion}:${hash}`

// Old keys auto-expire via TTL — no scanning needed
```

#### P2-1: No Horizontal Scaling Strategy for Inngest — Effort: L

**Problem**: Inngest functions (nightly insights, scheduled queries) run inside the Next.js process. Under heavy load, these background jobs compete with user requests for CPU and memory.

**Recommendation**: For the first 100 customers, this is fine. At scale (500+ customers), extract Inngest functions into a separate worker service.

#### P2-2: No Read Replica Support — Effort: L

**Problem**: All Prisma queries hit a single PostgreSQL instance. At 1000+ concurrent users, the main DB becomes a bottleneck.

**Recommendation**: Add read replicas for non-critical reads (query history, audit logs, saved queries). Prisma supports this via `$extends` with read replica routing.

### Infrastructure Upgrade Path

| Users    | Architecture                                                              | Monthly Cost |
| -------- | ------------------------------------------------------------------------- | ------------ |
| 0-100    | Vercel Pro + Supabase/Neon + Upstash Redis                                | $50-100      |
| 100-500  | Vercel Pro + Managed PostgreSQL (RDS/Supabase Pro) + Upstash Pro          | $200-400     |
| 500-2000 | VPS (Hetzner/Railway) + PgBouncer + Redis Cluster + CDN                   | $400-800     |
| 2000+    | Kubernetes + Read Replicas + Dedicated Worker Nodes + Observability Stack | $1500+       |

---

## PILLAR 4 — COMPETITIVE DIFFERENTIATION

### Competitive Landscape

| Feature                    | NatureQuery      | Metabase        | Mode       | Retool   |
| -------------------------- | ---------------- | --------------- | ---------- | -------- |
| Natural Language → SQL     | AI-native        | Addon (limited) | No         | No       |
| Self-service setup         | 2 minutes        | 15 minutes      | 30 minutes | 1 hour   |
| Non-technical users        | Primary audience | Secondary       | No         | No       |
| Pricing                    | $0-99/mo         | $0-500/mo       | $500+/mo   | $500+/mo |
| Chain-of-thought reasoning | Yes (visible)    | No              | No         | No       |

### Proposed "10x Better" Features

#### DIFF-1: AI Query Autopilot (Conversational Follow-ups) — Effort: XL

**What**: After a query returns results, the user can ask follow-up questions in natural language:

- "Now filter this to only New York customers"
- "Break this down by month instead of quarter"
- "Add a column showing the percentage change"

The AI modifies the existing SQL based on the conversation context, not just the latest question. This creates a **conversational analytics experience** that no BI tool offers.

**Why competitors can't clone this easily**: It requires maintaining multi-turn SQL context, understanding query intent evolution, and modifying existing SQL (not just generating from scratch). This is architecturally different from their query builders.

**Implementation sketch**:

```typescript
// New endpoint: POST /api/generate-sql/follow-up
{
  previousSQL: "SELECT city, COUNT(*) FROM customers GROUP BY city",
  previousQuestion: "How many customers per city?",
  followUp: "Now sort by count descending and show top 5",
  connectionId: "..."
}

// System prompt includes previous SQL + question as context
// AI generates modified SQL, not from scratch
```

#### DIFF-2: Smart Alerts — "Tell Me When This Changes" — Effort: L

**What**: User runs a query, clicks "Watch This", and sets a condition:

- "Alert me when daily revenue drops below $10,000"
- "Notify me when new customer signups exceed 100/day"
- "Send a Slack message when inventory for Product X falls below 50"

NatureQuery runs the query on a schedule and triggers alerts based on the condition. This turns NatureQuery from a query tool into a **monitoring platform**.

**Why it's differentiated**: Metabase has basic alerts but requires SQL knowledge to set up. NatureQuery can let users describe alert conditions in natural language.

#### DIFF-3: AI-Powered Schema Discovery — "What Can I Ask?" — Effort: M

**What**: New users connecting a database for the first time see an AI-generated overview:

- "This database has 15 tables about an e-commerce business"
- "Key entities: Customers (200K), Orders (500K), Products (5K)"
- "Suggested questions you can ask:"
  - "What are the top customers by lifetime value?"
  - "Which products have the highest return rate?"
  - "What's the monthly revenue trend?"

This solves the blank-page problem — users don't know what to ask when they first connect a database.

**Implementation**: Run a schema analysis on first connection, generate 5-10 suggested questions using the AI, cache them, show in the query panel.

#### DIFF-4: One-Click Data Stories — Effort: L

**What**: User clicks "Generate Report" and NatureQuery:

1. Runs 5-10 key queries against the database
2. Generates charts and tables for each
3. Writes a narrative summary connecting the insights
4. Produces a shareable PDF/HTML report

Example output: "Monthly Business Review for Acme Corp — Revenue grew 12% MoM driven by the West Coast region. Customer acquisition cost decreased by 8%. Inventory turnover is healthy at 4.2x, but Product SKU-1234 is at risk of stockout."

**Why it's 10x**: This replaces hours of manual BI work with a single click. No competitor offers end-to-end automated reporting from raw database to narrative.

#### DIFF-5: Natural Language Data Validation Rules — Effort: M

**What**: Users can define data quality rules in plain English:

- "Email column should never be null"
- "Order total should always be positive"
- "No customer should have more than 1000 orders"

NatureQuery converts these to SQL validation queries, runs them on a schedule, and alerts when rules are violated. This positions NatureQuery as a **data quality** tool, not just a query tool.

---

## PILLAR 5 — 90-DAY LAUNCH ROADMAP

### Phase 1: Fix Blockers (Week 1-2)

| Task                                                | Priority | Effort | Owner      |
| --------------------------------------------------- | -------- | ------ | ---------- |
| P0-1: Multi-dialect SQL validation                  | P0       | M      | Backend    |
| P0-2: Enforce Redis rate limiting in production     | P0       | S      | Infra      |
| P0-3: Input length limits on query text             | P0       | S      | Full-stack |
| P0-4: Stripe webhook secret validation              | P0       | S      | Backend    |
| P0-5: Enforce plan limits on PAST_DUE subscriptions | P0       | M      | Backend    |
| P0-6: Encryption key rotation support               | P0       | M      | Backend    |
| P0-7: Subscription sync on post-checkout redirect   | P0       | S      | Full-stack |
| Add test coverage for auth + billing flows          | P0       | L      | QA         |
| Set up Sentry alerts for production errors          | P0       | S      | Infra      |
| Add health check endpoint (/api/health)             | P0       | S      | Backend    |

**Milestone**: All P0 blockers resolved. CI/CD pipeline green. Error monitoring active.

### Phase 2: Differentiation Features (Week 3-6)

| Task                                            | Priority | Effort | Owner      |
| ----------------------------------------------- | -------- | ------ | ---------- |
| DIFF-3: AI Schema Discovery ("What Can I Ask?") | P1       | M      | AI/Backend |
| DIFF-1: Conversational follow-up queries        | P1       | XL     | AI/Backend |
| P1-1: 14-day free trial for PRO                 | P1       | S      | Backend    |
| P1-2: Annual pricing (20% discount)             | P1       | S      | Billing    |
| P1-4: Upgrade modal at limit points             | P1       | S      | Frontend   |
| P1-5: Product analytics events (PostHog)        | P1       | M      | Full-stack |
| P1-3: Dunning emails (3-stage)                  | P1       | M      | Backend    |
| P1-9: Connection pool caching                   | P1       | L      | Backend    |

**Milestone**: Users can trial PRO for free. AI suggests questions on first connection. Follow-up queries working. Analytics pipeline live.

### Phase 3: Marketing & Onboarding (Week 7-10)

| Task                                             | Priority | Effort | Owner           |
| ------------------------------------------------ | -------- | ------ | --------------- |
| Landing page refresh (social proof, demo video)  | P1       | L      | Design/Frontend |
| Interactive demo (sandbox database, no signup)   | P1       | M      | Full-stack      |
| Onboarding email sequence (day 1, 3, 7, 14)      | P1       | M      | Marketing       |
| P1-6: Weekly email digest for active users       | P1       | M      | Backend         |
| Documentation site (how-to guides, API docs)     | P1       | L      | Docs            |
| SEO content (10 comparison pages vs competitors) | P2       | L      | Marketing       |
| Referral program ("Give $10, Get $10")           | P2       | M      | Full-stack      |
| Customer success playbook (onboarding calls)     | P1       | S      | CS              |

**Milestone**: Marketing site live. Automated onboarding. Retention emails flowing. API docs published.

### Phase 4: Hardening & Monitoring (Week 11-13)

| Task                                                 | Priority | Effort | Owner      |
| ---------------------------------------------------- | -------- | ------ | ---------- |
| Load testing (k6/Artillery, 100 concurrent users)    | P1       | M      | QA         |
| P1-10: SQLite/SQL Server query timeouts              | P1       | S      | Backend    |
| P1-11: Schema cache invalidation optimization        | P1       | S      | Backend    |
| P2-1: Evaluate Inngest worker separation             | P2       | M      | Infra      |
| Database connection monitoring (pool stats, latency) | P1       | M      | Infra      |
| Uptime monitoring (Checkly/Pingdom)                  | P1       | S      | Infra      |
| SOC 2 readiness assessment                           | P2       | L      | Security   |
| DIFF-2: Smart Alerts (v1 — email only)               | P2       | L      | Full-stack |
| Penetration test (external vendor)                   | P2       | M      | Security   |
| Runbook for production incidents                     | P1       | S      | Infra      |

**Milestone**: Platform hardened for 100+ concurrent users. Monitoring and alerting in place. Incident response documented.

---

### 90-Day Success Metrics

| Metric                         | Target                 | How to Measure         |
| ------------------------------ | ---------------------- | ---------------------- |
| Launch blockers fixed          | 7/7                    | GitHub issues closed   |
| Test coverage                  | >60% on critical paths | Vitest coverage report |
| Free-to-paid conversion        | >5%                    | PostHog funnel         |
| Trial activation (first query) | >70% within 24h        | PostHog event          |
| Monthly churn (PRO)            | <8%                    | Stripe dashboard       |
| P95 query generation latency   | <3s                    | Sentry performance     |
| Uptime                         | >99.5%                 | Monitoring dashboard   |
| NPS from beta users            | >40                    | Survey                 |

---

### Key Decisions Required

1. **Hosting**: Vercel (faster launch, higher cost at scale) vs self-hosted (Railway/Hetzner — more control, requires DevOps). **Recommendation**: Start on Vercel, migrate at 500 users.

2. **AI Provider**: Groq (fast, cheap, llama-3.3) vs Anthropic Claude (smarter, more expensive) vs OpenAI (most popular). **Recommendation**: Keep Groq as primary, add Claude as fallback for complex multi-table queries.

3. **Pricing**: $29/mo PRO is competitive but may be too low for Enterprise. **Recommendation**: Add a $199/mo Team plan (shared connections, SSO, audit log exports, priority support) between PRO and ENTERPRISE.

4. **SOC 2**: Required for Enterprise sales. Start the audit process in month 2 — it takes 3-6 months. The immutable audit log with hash chains is a strong foundation.

---

_This report is based on a full code review of the NatureQuery codebase as of April 2026. Recommendations are prioritized by customer impact and ordered by implementation dependency._
