# Getting started

## 1. Install dependencies

From the repository root:

```bash
npm install
```

The install step generates the Prisma client and configures the local Git hooks.

## 2. Configure the environment

Copy the documented template and fill only the services needed for your task:

```bash
cp .env.local.example .env.local
```

Never copy a real environment file into another checkout or commit it to Git. Keep test and production credentials separate.

## 3. Prepare application data

Validate the Prisma schema before applying database changes:

```bash
npm exec prisma validate
npm exec prisma generate
```

Use the migration workflow appropriate to the target environment. Do not edit an already-applied Prisma migration.

## 4. Start the web app

```bash
npm run dev
```

Open `http://localhost:3000`. If that port is occupied, Next.js will offer another local port.

## 5. Verify a change

Run the checks that match the change while developing, then run the complete validation before committing:

```bash
npm run validate
npm run build
```

Desktop changes also require:

```bash
cd desktop
npm test
```

## Common locations

| Work                                | Location          |
| ----------------------------------- | ----------------- |
| Route, page, layout, or API handler | `src/app/`        |
| Reusable UI                         | `src/components/` |
| Server action                       | `src/actions/`    |
| Integration or domain service       | `src/lib/`        |
| Background job                      | `src/inngest/`    |
| Shared type                         | `src/types/`      |
| Prisma model or managed migration   | `prisma/`         |
| Maintenance or diagnostic utility   | `scripts/`        |
| Electron companion                  | `desktop/`        |
