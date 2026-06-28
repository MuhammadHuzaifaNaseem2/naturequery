# NatureQuery Desktop

The downloadable desktop version of NatureQuery, for Windows, Mac, and Linux.

## Why this exists

The website (naturequery.app) runs in the cloud, so it can only reach
databases that are open to the public internet. Most business owners keep
their database on their own PC or inside a private office network. The
desktop app runs **on the user's machine**, so it can connect to those
local and internal databases the website can never reach. Credentials and
data stay on the user's computer.

This project is completely separate from the web app. Building or running it
cannot affect the live website.

## How it works (in plain terms)

- The window loads the real NatureQuery product (the same web app).
- When a query needs to run against a local database, the desktop app's
  background process does the connecting, reusing the same database logic the
  web app already uses on the server (`src/lib/db-drivers.ts`).
- The UI never touches a database directly; it asks through a secure bridge.

## Run it (development)

```bash
cd desktop
npm install
npm start
```

This opens a proof-of-concept screen that connects to a local PostgreSQL
database, proving the core capability. To load the full hosted product
instead:

```bash
# Windows PowerShell
$env:NATUREQUERY_LOAD = "web"; npm start
```

## Build an installer

```bash
npm run build:win     # Windows .exe installer (NSIS)
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux AppImage
```

Output appears in `desktop/dist/`.

## Roadmap

1. **POC (done):** Electron shell + local PostgreSQL connection bridge.
2. Port the remaining 13 database drivers from the web app.
3. Port the SQL safety/read-only blocklist into the desktop bridge.
4. Have the web app detect when it runs inside the desktop app and route
   local-database queries through the bridge automatically.
5. Code signing (Windows cert, Apple notarization) + auto-update via GitHub
   Releases (`electron-updater`).
6. Branded installer, app icon, first-run onboarding.

## Files

| File                    | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `main.js`               | Background process: window + local database bridge     |
| `preload.js`            | Secure bridge exposed to the UI (`window.naturequery`) |
| `renderer/welcome.html` | Proof-of-concept local-connection screen               |
| `package.json`          | App config + installer (electron-builder) settings     |
