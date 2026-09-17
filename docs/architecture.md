# Architecture

NatureQuery is a Next.js App Router application with an optional Electron companion. This document describes the repository boundaries; implementation-specific decisions belong close to the relevant code.

## Web application

The web application owns identity, workspaces, application data, AI-assisted query generation, billing, exports, and browser-facing UI.

```text
Browser
  -> Next.js route or server action
  -> authentication and input validation
  -> domain/integration code in src/lib
  -> application database, AI provider, or connected database
  -> normalized result
  -> table, chart, export, or saved query
```

Route-specific UI stays in `src/app`. Reusable product UI belongs in `src/components`. Server-side integrations and domain services belong in `src/lib`; they should not depend on page components.

## Application database

Prisma defines the application data model in `prisma/schema.prisma`. Managed schema history lives in `prisma/migrations`. The root `migrations/` directory contains manual legacy SQL and is retained for compatibility; new Prisma-backed schema changes should use the Prisma migration workflow.

## Connected databases

NatureQuery treats a customer database as an external system. Connections must pass validation, credentials must remain encrypted or in operating-system-backed storage, and generated statements must pass the query safety layer before execution.

## Desktop companion

The Electron application is a separate runtime under `desktop/`. It exists for local or private-network databases that a hosted web application cannot reach. Renderer access is restricted to the API exposed by the preload bridge, and navigation and IPC handlers form a security boundary.

The browser checks for the desktop bridge and uses it only when a connection is explicitly local. Hosted connections continue through server-side paths.

## Background work

Event-driven and deferred work lives in `src/inngest`. Functions should accept validated event data, be safe to retry, and keep provider-specific behavior behind `src/lib` modules.

## Dependency direction

Prefer these directions when adding code:

```text
app/actions/inngest -> lib -> external services
app/components      -> hooks/contexts -> actions or API routes
desktop renderer    -> preload bridge -> main process -> database drivers
```

Avoid importing page components into shared services or exposing Node.js and Electron primitives directly to browser code.
