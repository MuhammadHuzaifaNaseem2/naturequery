# NatureQuery Desktop

Version 0.2.3 is a **Windows release candidate**, not a published release.
It opens a local workspace for databases on your computer or private network,
with an optional connection to the hosted NatureQuery AI workspace.

## What works locally

- Start in a dim graphite theme, with a saved light/dim switch in the toolbar.
- Explore three preset sample datasets without an account or database.
- Test, save, edit, and remove local database connections.
- Inspect tables, run read queries, and export the displayed results to CSV.
- Open the AI workspace when you want natural-language queries and online features.

The local workspace does not require sign-in or internet access. A remote
database still requires its network or VPN connection. The AI workspace requires
internet access and a NatureQuery account; use email/password sign-in for this
candidate. Browser OAuth handoff is not implemented yet.
The desktop hides the older hosted page's unsupported OAuth buttons and recovers
external OAuth attempts back to email sign-in. Its compact hosted sign-in styling
is bundled with the app; the new web auth layout and request timeout also need a
web deployment before they appear in the production AI workspace.

The connection form supports PostgreSQL, MySQL, MariaDB, and SQL Server. Only
PostgreSQL has a real-database integration test in this candidate; the other
drivers need their own end-to-end qualification before production claims.
macOS and Linux packaging configurations exist but have not been qualified or
shipped as part of this release.

## Data and query boundaries

- Saved passwords use Electron's operating-system-backed encryption. Saving
  fails if secure storage is unavailable; passwords are not returned to the UI.
  Connection names, hosts, database names, and usernames are local metadata,
  not encrypted fields. A copied connection file is not a portable credential backup.
- Local SQL execution connects directly from this computer to the database.
  In the AI workspace, your question and schema are sent to NatureQuery for SQL
  generation. AI Insights sends displayed results when you choose that feature.
- Use a dedicated **read-only database account** with access only to the data
  you need. The SQL filter is a guardrail, not a security sandbox. PostgreSQL
  and MySQL/MariaDB queries also use read-only transactions; database permissions
  remain essential, particularly for functions and SQL Server.
- Results and CSV exports contain at most 1,000 rows, with a truncation notice
  when additional rows are detected. This does not limit the database's work
  needed to compute a query. Query/request timeouts are configured at 30 seconds
  (PostgreSQL also has a 35-second client timeout); timeout behavior varies by driver.
- Remote hosts require verified TLS. Automatic mode permits an unencrypted
  connection only for `localhost`, `127.0.0.1`, or `::1`. Custom CA configuration
  and SSH tunneling are not included.
- Database access is exposed through a narrow IPC bridge to trusted top-level
  NatureQuery pages. Entering and saving credentials is restricted to bundled
  local screens. The renderer has no Node.js access.

## Run and test

From `desktop/`:

```powershell
npm ci
npm test
npm start
```

The window starts at Desktop home. Use the sidebar or the NatureQuery menu to
open the AI workspace or return home. `Ctrl+Enter` runs a query in the local editor.
Use `Ctrl+=`, `Ctrl+Shift+=`, or numpad `Ctrl+Plus` to zoom in, `Ctrl+-` to
zoom out, and `Ctrl+0` / View > Actual Size to reset. On macOS use Command.

Development can use a separate profile and a locally running web app:

```powershell
$env:NATUREQUERY_USER_DATA = 'D:\reportflow\reportflow\.local-artifacts\desktop-dev-profile'
$env:NATUREQUERY_URL = 'http://127.0.0.1:3000'
npm start
```

These overrides are ignored by packaged builds. Remove them from the shell when
finished if you want the normal development profile and hosted AI workspace.
Use the same hostname as the web server's auth redirect URL. For example, if
local auth redirects to `http://localhost:3000`, use that URL rather than
`http://127.0.0.1:3000` so the desktop's origin check permits the redirect.

The PostgreSQL integration test is skipped unless `NQ_TEST_PG_PORT` is set.
Use **only an isolated, disposable PostgreSQL instance**: the test creates and
truncates `nq_fixture` and replaces `nq_write_test()`. It connects to
`127.0.0.1`, database `postgres`, user `nq_test`, with an empty password. Never
point it at an existing personal, shared, or production database.

```powershell
# First start a disposable PostgreSQL instance with the test credentials above.
$env:NQ_TEST_PG_PORT = '55432'
npm test
Remove-Item Env:NQ_TEST_PG_PORT
```

## Build locally

```powershell
npm run build:win
```

This script explicitly uses `--publish never`. The Windows x64 installer is
`dist/NatureQuery-0.2.1-win-x64-Setup.exe`. Building does not deploy the web app
or publish a desktop release. See [RELEASE.md](RELEASE.md) for launch gates and
the manual, user-consented update flow.

## Source map

| File                                                   | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `main.js`                                              | Windows, navigation, IPC, export dialogs, and update checks |
| `preload.js`                                           | Narrow `window.naturequery` bridge                          |
| `policy.cjs`                                           | Trusted origins and input validation                        |
| `store.cjs`                                            | OS-encrypted passwords and atomic connection-file writes    |
| `renderer/local.html`, `workspace.js`, `workspace.css` | Local desktop workspace                                     |
| `renderer/offline.html`                                | Hosted workspace failure recovery                           |
| `engine/`                                              | Local database drivers and SQL guardrails                   |
| `test/`                                                | Policy, storage, and opt-in PostgreSQL integration tests    |
