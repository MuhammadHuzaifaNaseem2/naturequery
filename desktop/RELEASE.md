# Building and releasing NatureQuery Desktop

This guide covers building the Windows installer and publishing updates.
All commands run from the `desktop/` folder.

## One-time setup

```bash
cd desktop
npm install
```

The app icon is generated from `build/icon.png` (1024x1024, rendered from your
logo). electron-builder creates all the Windows installer icon sizes from it
automatically — no `.ico` needed.

## Build the installer (local, no publishing)

```bash
npm run build:win
```

This produces a Windows installer in `desktop/dist/`:

- `NatureQuery Setup <version>.exe` — the installer you can share or test
- supporting files (`latest.yml`, blockmap) used by auto-update

Double-click the `.exe` to install. It creates desktop and Start-menu
shortcuts named **NatureQuery**.

> Note: the installer is not code-signed yet, so Windows SmartScreen will show
> a "Windows protected your PC" warning on first run (click _More info → Run
> anyway_). Code signing (a paid certificate) removes this and is the next
> polish step.

## Publish a release with auto-update

Auto-update pulls new versions from this repo's GitHub Releases.

1. Bump the version in `desktop/package.json` (e.g. `0.1.0` → `0.1.1`).
2. Create a GitHub token with `repo` scope and set it:
   ```bash
   # Windows PowerShell
   $env:GH_TOKEN = "your_token_here"
   ```
3. Build and publish:
   ```bash
   npm run release:win
   ```

This uploads the installer and `latest.yml` to a GitHub Release. Installed apps
check that release on launch; when a newer version exists, electron-updater
downloads it in the background and prompts the user to restart.

## How auto-update behaves

- Runs only in the installed (packaged) app, never in `npm start` dev mode.
- Checks GitHub Releases on launch; failures (offline, etc.) are ignored.
- The user is notified once the update is downloaded and applies it on restart.

## Next polish steps

- **Code signing** (Windows EV/OV certificate) to remove the SmartScreen
  warning and make the installer trusted.
- **App metadata**: publisher name, version display, license screen in the
  NSIS installer.
- **macOS build + notarization** when you want a Mac version.
