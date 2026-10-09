# Releasing NatureQuery Desktop

Nothing in this guide publishes anything unless you run the commands marked
**publishes**. Building, testing and signing all happen on your computer.

## 1. Before you build

The desktop app needs these parts of the website to be live at
`https://naturequery.app`:

- The desktop sign-in page (`/desktop/authorize`) and the `/api/desktop/*` routes.
- The database tables from the migration `20261009120000_desktop_sign_in`.

Deploy the website first (preview, then production), and apply the migration to
the production database with `npx prisma migrate deploy` before you send an
installer to anyone. Without them, everything works except sign-in and AI.

## 2. Test

Run from `desktop/`:

```powershell
npm ci
npm run typecheck
npm test
```

Then run both integration batches against disposable databases, as described in
[test/integration/README.md](test/integration/README.md). Snowflake, BigQuery and
Firestore have no local test server: check each against a real account before a
release.

## 3. Build the installer

```powershell
npm run dist:win
```

Output in `desktop/release/`:

| File                                               | Purpose                                                |
| -------------------------------------------------- | ------------------------------------------------------ |
| `NatureQuery-<version>-win-x64-Setup.exe`          | Per-user installer. No administrator rights needed.    |
| `NatureQuery-<version>-win-x64-Setup.exe.blockmap` | Lets updates download only what changed.               |
| `latest.yml`                                       | Tells installed copies that this version exists.       |
| `win-unpacked/`                                    | The packaged app, for a quick look without installing. |

The package is hardened with Electron fuses (see `build.electronFuses` in
`package.json`): it ignores `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and inspector
flags, and loads code only from its integrity-checked `app.asar`.

To test without touching your own NatureQuery profile, start the packaged app
with a separate profile folder:

```powershell
.\release\win-unpacked\NatureQuery.exe --user-data-dir="$env:TEMP\nq-qa-profile"
```

Test installing, upgrading and uninstalling on a clean Windows machine (Windows
Sandbox or a virtual machine), not on your everyday PC.

## 4. Sign the installer

Unsigned apps show "Windows protected your PC" with "Unknown publisher", and
antivirus programs are much more likely to quarantine them. Sign every release
with the same certificate so its reputation builds up over time.

Recommended for an individual developer outside the USA and Canada: an
individual (natural person) code signing certificate with cloud signing, for
example **Certum Standard Code Signing in the Cloud** (SimplySign) or
**SSL.com Individual Validation** with eSigner. Microsoft's own Artifact
Signing service is limited to individuals in the USA and Canada, and EV
certificates no longer skip SmartScreen (since 2024) and require a registered
company.

With Certum SimplySign, the certificate appears in Windows as a virtual smart
card while SimplySign Desktop is connected. Find its thumbprint, then build:

```powershell
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject, Thumbprint
npx electron-builder --win --x64 --publish never `
  -c.win.signtoolOptions.certificateSha1=<THUMBPRINT> `
  -c.win.signtoolOptions.rfc3161TimeStampServer=http://time.certum.pl
```

Check the result:

```powershell
Get-AuthenticodeSignature .\release\NatureQuery-*-Setup.exe | Format-List Status, SignerCertificate
```

`Status` must be `Valid`. After the first signed release, add the certificate's
publisher name as `build.win.signtoolOptions.publisherName` in `package.json`, so
the updater only installs updates signed by you.

## 5. Antivirus false positives

New installers, signed or not, are sometimes flagged by antivirus programs.
Before sharing a release, submit the installer for analysis so it is cleared:

- Microsoft Defender: https://www.microsoft.com/wdsi/filesubmission
- Avast and AVG: https://www.avast.com/false-positive-file-form.php

If a customer's antivirus blocks the app, ask their IT team to allow
`%LOCALAPPDATA%\Programs\NatureQuery` and send you the detection name.

## 6. Publish a release (publishes)

1. Raise `version` in `desktop/package.json` (installed copies only update to a
   higher version).
2. Commit, then sign in to GitHub as the repository owner:
   `gh auth switch --user MuhammadHuzaifaNaseem2`.
3. Build and upload to a **draft** GitHub release:
   `$env:GH_TOKEN = gh auth token; npm run release:win`
4. Open the draft on GitHub, add release notes (they appear in the app), and
   publish it. Installed copies see it within a few hours, or right away from
   **Settings, Updates, Check now**.

The updater checks GitHub releases of `MuhammadHuzaifaNaseem2/naturequery`
(`build.publish` in `package.json`). It never downloads without the user's
agreement, and installs when the user restarts the app.

## 7. Platforms

Windows x64 is the supported platform. `npm run dist:mac` and
`npm run dist:linux` exist but are untested: macOS needs Apple signing and
notarization, and Linux secure storage needs its own testing before either can
be offered.
