# NatureQuery

NatureQuery turns plain-language questions into reviewable database queries and useful results. It combines a Next.js web application with an optional Electron desktop companion for databases that are only reachable from a user's computer or private network.

## What is in this repository

- **Web application** - authentication, workspaces, query generation, result visualization, exports, billing, and account administration.
- **Desktop companion** - secure local database connectivity exposed to the web interface through a narrow Electron bridge.
- **Database layer** - Prisma schema and migrations for NatureQuery application data.
- **Operational tooling** - scripts for maintenance, diagnostics, sample databases, and release verification.

## Repository map

```text
.
|-- desktop/              # Electron desktop companion
|-- docs/                 # Maintained, internal, audit, and archived documentation
|-- migrations/           # Legacy/manual migrations kept for compatibility
|-- prisma/               # Prisma schema and managed migrations
|-- public/               # Static web assets
|-- scripts/              # Administration, diagnostics, and SQL utilities
`-- src/
    |-- actions/          # Server actions
    |-- app/              # Next.js App Router pages and API routes
    |-- components/       # Shared product UI
    |-- contexts/         # React context providers
    |-- hooks/            # Reusable React hooks
    |-- inngest/          # Background jobs and event functions
    |-- lib/              # Domain services, integrations, and infrastructure
    |-- messages/         # Localized product copy
    |-- types/            # Shared TypeScript declarations
    `-- __tests__/        # Cross-cutting tests
```

See [docs/README.md](docs/README.md) for the documentation index and [CONTRIBUTING.md](CONTRIBUTING.md) for repository conventions.

## Local development

### Requirements

- Node.js 20 or newer
- npm
- PostgreSQL for application data
- Provider credentials for the integrations you plan to exercise

### Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The web app is available at `http://localhost:3000` by default. Environment files containing real credentials are ignored by Git.

### Quality checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run validate` runs Prisma validation, TypeScript, ESLint, and the test suite together.

## Desktop development

The desktop companion has its own package manifest and release process:

```bash
cd desktop
npm install
npm test
npm start
```

Read [desktop/README.md](desktop/README.md) before changing Electron IPC, credential storage, navigation rules, or database execution.

## Security

Do not commit environment files, customer datasets, database credentials, API tokens, or generated query results. Report security issues privately using the process in [SECURITY.md](SECURITY.md).

## Authorship and third-party software

NatureQuery's product code and design are maintained in this repository. External packages, fonts, icons, services, and generated artifacts remain subject to their own licenses and terms. See [docs/provenance.md](docs/provenance.md) for the project's provenance policy.

## License

This is a private repository and does not currently include an open-source license. No permission to copy, redistribute, or publish the source code is granted by default.
