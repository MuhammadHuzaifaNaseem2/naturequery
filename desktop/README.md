# NatureQuery Desktop

A native desktop app for asking databases questions in plain English or SQL.
It connects directly from the user's computer, so it reaches databases on the
same machine or a private office network that the web app cannot reach.

Supported databases (18): PostgreSQL, MySQL, MariaDB, SQL Server, Oracle,
SQLite, MongoDB, ClickHouse, Snowflake, BigQuery, Redshift, CockroachDB, Neon,
PlanetScale, Turso/libSQL, DynamoDB, Firestore and Cassandra.

For people using the app, see [docs/USER-GUIDE.md](docs/USER-GUIDE.md).

## Architecture

| Process         | Code           | Role                                                                                                          |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Main            | `src/main`     | Windows, the `app://` protocol, IPC, encrypted connection store, history, exports, sign-in and updates        |
| Database engine | `src/engine`   | Every database driver, in an Electron utility process. A slow or crashing client never freezes the window.    |
| Preload         | `src/preload`  | The narrow, typed `window.nq` API. The interface has no Node.js access.                                       |
| Interface       | `src/renderer` | React app built with Vite. Reuses the web app's results table, chart and SQL editor from `../src/components`. |
| Shared          | `src/shared`   | Types, IPC channels, database metadata and error helpers used by every process                                |

Security model:

- Only the bundled interface loads in the window, served from `app://naturequery`
  with a strict Content Security Policy. External links open in the browser.
- IPC handlers accept requests only from the app's own window and top frame,
  and validate every input with a schema.
- Passwords, SSH keys and service account keys are sealed with the operating
  system (DPAPI on Windows) and are only decrypted in the main process, which
  passes them to the engine for each operation. They never reach the interface.
- Every query passes a dialect-aware read-only guard (`src/engine/safety/sql.ts`).
  Drivers also use read-only transactions or sessions where the database
  supports them. The guard is defense in depth; customers should still use
  read-only database accounts.
- Logs (`%APPDATA%\NatureQuery\logs`) are scrubbed of passwords and tokens.

Sign-in and AI:

- "Sign in" opens `naturequery.app/desktop/authorize` in the browser (OAuth 2.0
  authorization code flow with PKCE). After the user approves, the page opens
  `naturequery://auth?code=...&state=...`; Windows starts a second copy of the
  app, which hands the link to the running one and exits. The code can also be
  pasted by hand.
- Tokens are sealed like passwords (`account.json`). Access tokens last an hour
  and refresh tokens rotate on every use. Requests use Chromium's network stack,
  so system proxies and company certificates work.
- AI requests (`/api/desktop/ai/*`) send the question and table and column
  names, never result rows unless the user allows it for summaries.

Data stored on the user's computer, in `%APPDATA%\NatureQuery`:
`connections.json` (secrets sealed), `account.json` (sign-in, sealed), `settings.json`, `window-state.json`,
`workspace.db` (query history and saved queries, SQLite) and `logs/`.
Connections saved by desktop 0.1 to 0.2 are imported on first start.

## Develop

From `desktop/`:

```powershell
npm ci
npm run sample-db   # once: generates resources/sample/acme-store.db
npm run dev         # Vite dev server + Electron, restarts on main/engine changes
```

Useful environment variables for development builds (ignored when packaged):

- `NATUREQUERY_USER_DATA`: use a separate profile folder.
- `NATUREQUERY_API_URL`: point AI and sign-in at a local web app, for example `http://localhost:3000`.
- `NQ_OPEN_EXTERNAL_LOG`: write sign-in pages to this file instead of opening a browser (automated tests).
- `NQ_REGISTER_PROTOCOL=1`: register `naturequery://` for the development build (otherwise only installed builds do).

## Test

```powershell
npm run typecheck
npm test                    # unit tests
npm run test:integration    # real databases, see test/integration/README.md
```

## Build

```powershell
npm run build               # compiles into dist/
npm start                   # runs the compiled build without packaging
npm run dist:win            # Windows installer in release/ (never publishes)
```

See [RELEASE.md](RELEASE.md) before publishing a release.
