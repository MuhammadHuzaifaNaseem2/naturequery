# NatureQuery — Technical Overview

**Prepared for:** Family / mentor review
**Author:** Muhammad Huzaifa Naseem
**Date:** May 2026
**Status:** Live in production at https://naturequery.app
**Note:** This document contains internal architectural and vendor details. It is intended for private review, not for public sharing.

---

## 1. Product Summary

NatureQuery is an AI-powered SaaS application that lets non-technical users query their databases using plain English instead of SQL. The user connects their database, types a question like _"show me the top 10 customers from last month,"_ and the application returns both the generated SQL query and the actual result rows.

The application supports 14+ database engines including PostgreSQL, MySQL, MariaDB, MongoDB, SQLite, Microsoft SQL Server, BigQuery, Snowflake, Redshift, Oracle, Cassandra, ClickHouse, DynamoDB, and Supabase.

The target users are founders, product managers, business analysts, and operations teams at small-to-mid-sized companies who need data answers without waiting for an engineer to write SQL.

---

## 2. Architectural Overview

NatureQuery is a single Next.js application that combines frontend, backend, and AI orchestration into one deployable unit. There is no separate backend service. The architecture follows a server-first model using Next.js Server Actions, which means most logic runs on the server and the frontend acts as a thin presentation layer.

High-level flow:

```
User (browser)
    │
    ▼
Next.js Frontend (React Server Components + Client Components)
    │
    ▼
Next.js Server Actions (TypeScript, runs on Vercel Edge / Node)
    │
    ├──▶ PostgreSQL (application data: users, queries, connections)
    ├──▶ Upstash Redis (rate limiting, cache, sessions)
    ├──▶ LLM API (Groq primary, Cerebras fallback)
    ├──▶ User's connected database (PostgreSQL, MySQL, etc.)
    └──▶ External services (Lemon Squeezy, Resend, Sentry)
```

---

## 3. Frontend Stack

| Technology              | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| Next.js 15 (App Router) | React framework with server components                  |
| React 19                | UI library                                              |
| TypeScript              | Static typing across the codebase                       |
| Tailwind CSS            | Utility-first styling                                   |
| shadcn/ui               | Component library built on Radix UI primitives          |
| Lucide React            | Icon library                                            |
| next-themes             | Light/dark mode handling                                |
| next-intl               | Internationalization framework (multi-language support) |

The frontend uses React Server Components for initial page rendering (faster page loads, better SEO) and Client Components only where interactivity is needed (forms, modals, real-time updates). This is the modern Next.js App Router pattern.

---

## 4. Backend Stack

| Technology             | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| Next.js Server Actions | Type-safe server-side logic invoked directly from React |
| Prisma ORM             | Database access layer with type-safe queries            |
| PostgreSQL             | Primary application database                            |
| Upstash Redis          | Rate limiting, distributed cache, session-related state |
| NextAuth v5 (Auth.js)  | Authentication system, JWT-based sessions               |
| Zod                    | Runtime schema validation for inputs                    |

Server Actions are a Next.js 13+ pattern that lets the frontend call backend functions as if they were local functions, while in reality they execute on the server. This eliminates the need for a separate REST or GraphQL API in most cases.

---

## 5. AI Layer (the most important section)

### 5.1 We do NOT train a custom model

NatureQuery does not train its own language model. Training a model from scratch would require millions of dollars in compute and a dataset of natural-language-to-SQL pairs that we do not have. Even fine-tuning would require significant infrastructure investment.

Instead, NatureQuery uses **pre-trained large language models (LLMs) accessed via API**, combined with sophisticated **prompt engineering** and **runtime context injection** to produce accurate SQL. This is the same approach used by most production AI applications today, including Cursor, Perplexity, GitHub Copilot Chat, and many enterprise tools.

The intellectual property and moat of NatureQuery is in:

1. The **schema-aware prompting system** that injects the user's database structure into each LLM call
2. The **SQL validation and safety layer** that prevents destructive queries
3. The **database integration layer** that supports 14+ different SQL dialects
4. The **UX and product workflow** built around the AI interaction
5. The **multi-provider failover** for reliability

### 5.2 LLM Providers Used

**Primary provider: Groq**

- Hosts open-source models (Llama 3.x family from Meta)
- Provides extremely fast inference (significantly faster than OpenAI for similar quality)
- Used for all primary query generation
- Communication via REST API over HTTPS

**Fallback provider: Cerebras**

- Also hosts open-source LLMs
- Activated automatically when Groq returns a rate-limit error or 5xx
- Implemented as a try-catch fallback in `src/lib/ai-client.ts`
- Ensures users never see "AI provider unavailable" during traffic spikes

Both providers are accessed via standard API calls. No model weights are downloaded, hosted, or modified locally.

### 5.3 How NatureQuery Actually Generates SQL

The end-to-end flow when a user submits a question:

1. **User input** — natural language question typed into the UI
2. **Schema discovery** — application queries the user's database catalog (table names, column names, data types, foreign keys) and caches the schema in browser localStorage for the session
3. **Prompt assembly** — server builds a structured prompt containing:
   - System instructions (role, safety rules, output format)
   - The database schema
   - Few-shot examples appropriate to the SQL dialect
   - The user's actual question
4. **LLM inference** — prompt is sent to Groq (or Cerebras if Groq fails)
5. **SQL extraction** — response is parsed to extract the SQL query
6. **Safety validation** — generated SQL is checked against a blocklist:
   - No `DROP`, `TRUNCATE`, `ALTER`
   - No `DELETE` or `UPDATE` without a `WHERE` clause
   - Read-only mode is enforced by default
7. **Execution** — validated SQL is run against the user's database using their stored credentials
8. **Response** — both the SQL and the result rows are returned to the user

### 5.4 What does _not_ happen

- The user's data is **never sent to the LLM** — only the schema structure goes in the prompt
- The application does not store the user's database query results long-term beyond the session
- The LLM does not have direct access to the user's database

This is critical for enterprise and compliance reasons.

---

## 6. Authentication and Security

| Feature                         | Implementation                                                              |
| ------------------------------- | --------------------------------------------------------------------------- |
| Auth framework                  | NextAuth v5 (JWT-based sessions, no server-side session table)              |
| Login methods                   | Email + password (bcrypt hashed)                                            |
| Two-factor authentication       | TOTP (Google Authenticator, Authy compatible), with backup codes            |
| Email verification              | Required on signup, token-based with expiry                                 |
| Rate limiting                   | Upstash Redis sliding-window rate limiter on auth endpoints                 |
| CSRF protection                 | Built-in via NextAuth                                                       |
| Audit logging                   | All authentication and sensitive actions logged to `AuditLog` table         |
| Security headers                | CSP, HSTS, X-Frame-Options, X-Content-Type-Options configured in middleware |
| Database credentials encryption | User's connection strings encrypted at rest in PostgreSQL                   |
| GDPR compliance                 | Full user data export and account deletion endpoints                        |

Password storage uses bcrypt with a salt round of 12. Session tokens are JWT signed with a secret stored in environment variables (separate per environment).

---

## 7. Database Architecture

### 7.1 Application database (NatureQuery's own data)

A single PostgreSQL database (hosted on Vercel Postgres) stores:

- Users
- Database connections (encrypted credentials, schema cache metadata)
- Query history (saved queries, pinned queries)
- Subscriptions and usage records (for plan limit enforcement)
- Audit logs
- Verification tokens
- Team and organization data (for the Enterprise plan)

Schema is managed via Prisma migrations.

### 7.2 User's connected databases

NatureQuery does not host user data. The user provides a connection string (host, port, database name, username, password). The application:

- Encrypts the credentials at rest
- Establishes a connection only when the user runs a query
- Uses connection pooling (PgBouncer for PostgreSQL) for performance
- Closes connections promptly after use

Supported database engines (14+):

PostgreSQL, MySQL, MariaDB, MongoDB, SQLite, Microsoft SQL Server, BigQuery, Snowflake, Redshift, Oracle, Cassandra, ClickHouse, DynamoDB, Supabase, and a few others.

---

## 8. Billing and Subscriptions

NatureQuery uses **Lemon Squeezy** as the merchant of record. Lemon Squeezy handles:

- Payment processing
- VAT/tax collection in different jurisdictions
- Invoicing
- Subscription lifecycle (trials, renewals, cancellations)

We chose Lemon Squeezy over Stripe because as a solo founder operating internationally, the merchant-of-record model offloads global tax compliance to Lemon Squeezy. Stripe would have required us to handle EU VAT, US sales tax, etc. ourselves.

Plan structure:

- **Free** — limited queries per month, 1 connection
- **Pro** — higher limits, multiple connections, team features
- **Enterprise** — custom limits, dedicated support, SSO (planned)

Plan limit enforcement is server-side via the `checkPlanLimits()` function in `src/lib/plan-limits.ts`. Usage is tracked in the `UsageRecord` table.

---

## 9. Email Infrastructure

- **Transactional email**: Resend (welcome emails, password resets, verification, alerts)
- **Domain email forwarding**: ImprovMX (hello@naturequery.app forwards to a Gmail inbox)
- **Outbound sending from Gmail**: Gmail's "Send mail as" feature configured to relay through Resend SMTP, so emails sent from Gmail appear as coming from hello@naturequery.app

This setup gives professional email delivery without the cost of a full email suite like Google Workspace ($7/user/month).

---

## 10. Infrastructure and Deployment

| Service             | Use                                                                           |
| ------------------- | ----------------------------------------------------------------------------- |
| **Vercel**          | Hosting (Hobby tier currently) — automatic deploys from GitHub `main` branch  |
| **Vercel Postgres** | Application database                                                          |
| **Upstash Redis**   | Distributed cache and rate limiting                                           |
| **Cloudflare**      | (Indirect via domain — DNS through Name.com / Cloudflare for naturequery.app) |
| **GitHub**          | Source control, CI/CD via Vercel integration                                  |
| **Sentry**          | Error monitoring and performance tracing                                      |
| **Resend**          | Transactional email                                                           |
| **Groq, Cerebras**  | LLM inference                                                                 |
| **Lemon Squeezy**   | Payments and subscription management                                          |

Deployment is fully automated: any push to `main` on GitHub triggers a Vercel build and deploy. Preview deploys are created automatically for pull requests.

---

## 11. Observability and Monitoring

| Layer          | Tool                                                   |
| -------------- | ------------------------------------------------------ |
| Error tracking | Sentry (with custom filters for known false positives) |
| Web analytics  | Vercel Analytics                                       |
| Audit trail    | Internal PostgreSQL `AuditLog` table                   |
| Logs           | Vercel function logs (retained 1 day on Hobby tier)    |
| Uptime         | Vercel's built-in monitoring                           |

Sentry is configured with filters to suppress noise from browser extensions (Outlook SafeLink scanner) and bot scanners hitting random endpoints, so the alert feed reflects actual bugs.

---

## 12. Codebase Organization

```
naturequery/
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets
├── src/
│   ├── actions/             # Server Actions (billing, auth, queries, team)
│   ├── app/                 # Next.js App Router pages and layouts
│   ├── components/          # React components (UI library + features)
│   ├── lib/                 # Utilities (ai-client, prisma, rate-limit, auth)
│   ├── messages/            # i18n translations
│   └── middleware.ts        # Auth, rate-limit, and security headers
├── sentry.client.config.ts
├── sentry.server.config.ts
└── sentry.edge.config.ts
```

The codebase is fully TypeScript with strict mode enabled.

---

## 13. Honest Self-Assessment — Known Limitations

I want to be straightforward about what is not perfect, because honest mentorship requires honest reporting.

1. **External AI dependency** — NatureQuery cannot function without Groq or Cerebras being available. The fallback mitigates short outages, but both being down would break the core feature. Mitigation: I am evaluating a third fallback (likely Together AI or Anthropic).

2. **No fine-tuned model** — All accuracy comes from prompt engineering. For very complex queries on unusual schemas, accuracy could be improved by fine-tuning a smaller model on synthetic SQL data. This is a future investment, not currently feasible cost-wise.

3. **Test coverage is light** — Unit tests cover critical billing and auth paths. Integration tests are minimal. As the user base grows, this needs to expand.

4. **No staging environment** — Currently, changes go from local development directly to production via Vercel preview deploys. A dedicated staging environment with real-data tests would reduce risk.

5. **Single founder bottleneck** — All architecture, code, support, and marketing are done by one person. Burnout risk is real. Documentation and process need to mature so a future hire can ramp quickly.

6. **Vercel Hobby tier limits** — Currently on Hobby. Function timeouts (10 sec on Hobby, 60 sec on Pro), bandwidth limits, and concurrency limits will become problems as traffic grows.

7. **Cold start latency** — Vercel serverless functions cold-start. First request after idle period can be 1-2 seconds slower. Solvable by moving to Pro tier or Edge runtime where possible.

---

## 14. Areas Where I Would Value Your Guidance

Specific questions on which your industry experience would be invaluable:

1. **Scaling strategy** — At what scale should NatureQuery migrate off Vercel Hobby? Vercel Pro vs. self-hosted on AWS/GCP vs. a hybrid?

2. **AI architecture maturity** — Is prompt engineering + multi-provider fallback enough long-term, or should I be investing now in a custom fine-tuned model for higher accuracy on domain-specific schemas?

3. **Sales motion for B2B SaaS** — Should I focus on bottom-up (individual users converting their teams) or top-down (sales-led to mid-market companies)?

4. **Pricing optimization** — Current pricing was based on competitor benchmarks. Are there better strategies for an early-stage SaaS — usage-based, seat-based, or value-based pricing?

5. **Hiring sequence** — When and what to hire first as the founder. Engineering, sales, or marketing?

6. **Investment readiness** — At what point should I think about raising? Or should I stay bootstrapped until specific revenue milestones?

7. **Compliance roadmap** — SOC 2, ISO 27001, HIPAA — which to prioritize first for enterprise deals?

8. **Technical debt prioritization** — Among the known limitations above, which would you tackle first?

---

## 15. Summary

NatureQuery is a Next.js SaaS application that uses pre-trained LLMs (Groq with Cerebras fallback) and schema-aware prompt engineering to convert plain-English questions into SQL across 14+ database engines. The technical moat is in the integration breadth, safety validation, and product UX, not in custom model training.

The application is live in production, has paying customers, and is built by a single founder with limited resources. The architecture is intentionally simple (Next.js + PostgreSQL + Redis + external APIs) to keep operational complexity low at this stage.

Thank you for taking the time to review and for your willingness to mentor. I am grateful for any specific guidance you can share, especially on the open questions in section 14.

---

_End of document._
