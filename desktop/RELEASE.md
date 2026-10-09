# NatureQuery Desktop release checklist

The 0.2.3 Windows x64 build is a local release candidate. Nothing in this guide's
build commands publishes a release. Public distribution requires a separate,
explicit release decision after the checks below.

## Build without publishing

Run from `desktop/`:

```powershell
npm ci
npm test
npm run build:win
```

`build:win` runs `electron-builder --win --x64 --publish never`. Expected output
in `desktop/dist/`:

- `NatureQuery-0.2.3-win-x64-Setup.exe`: per-user NSIS installer.
- The corresponding `.blockmap` and `latest.yml`: update support files.
- `win-unpacked/`: packaged application for local smoke testing.

The installer is configured to create Desktop and Start-menu shortcuts and run
the app after installation. Test installation and uninstallation in a disposable
Windows account or VM; running the unpacked app is not an installation test.
The build uses `build/icon.png` for the application and `build/icon.ico` for the
installer and uninstaller.

## Checks before public launch

- Run unit tests and the opt-in disposable PostgreSQL integration test described
  in [README.md](README.md). Record the results and the exact commit being built.
- Smoke-test the packaged app on Windows: sample presets, connection validation,
  save/reopen/edit/remove, schema loading, read query, blocked write query,
  truncation, CSV export/cancel, offline recovery, keyboard navigation, and restart.
- Qualify MySQL, MariaDB, and SQL Server against real disposable databases.
  PostgreSQL coverage does not establish support quality for those engines.
- Review and deploy the required hosted-web desktop integration separately,
  then verify email/password sign-in, local-connection discovery, SQL generation,
  execution, and explicit AI Insights use from the packaged app. Local source
  changes alone do not update the hosted workspace.
- Keep OAuth unavailable in the desktop UI until a secure external-browser
  callback/session handoff is implemented and tested. Do not advertise it as
  working in this candidate.
- Configure Windows code signing and verify the signer and installer integrity.
  This candidate is not signed. Signing identifies the publisher; it does not
  guarantee that Windows SmartScreen reputation warnings disappear. Resolve
  distribution trust before broad release rather than asking users to bypass warnings.
- Prepare a public release, matching installer/update metadata, release notes,
  checksum, supported-platform notice, privacy explanation, and support path.
  Verify upgrade and rollback/recovery behavior using a controlled test release.
- Obtain the product owner's approval before publishing or adding a public download.

macOS DMG and Linux AppImage build scripts exist, both with `--publish never`.
They are untested release targets here. macOS signing/notarization and Linux
secure-storage behavior require separate qualification; do not list them as shipped.

## How updates work in this candidate

- Checks run only when the user chooses **Check for updates** in a packaged app.
  Development builds explain that updates are unavailable. There is no launch-time
  update check.
- The configured source is GitHub Releases for
  `MuhammadHuzaifaNaseem2/naturequery`. Configuration is not evidence that a
  public release or working update channel exists.
- A newer version prompts the user before download. Declining leaves the current
  version running. Automatic downloads and installation on quit are disabled.
- After a download, choosing **Check for updates** again offers **Restart and
  install** or **Later**. The user should finish running queries before restarting.
- An unavailable release service leaves the app usable and reports an actionable
  retry message. Test this flow with signed, published artifacts before claiming
  verified update support.

`release:win` is a publishing script, unlike `build:win`. Do not run it during
local QA. Publishing credentials must not be placed in source files, documentation,
or committed configuration.
