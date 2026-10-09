# Desktop 0.2.0 local QA — 29 September 2026

This is a Windows x64 preview, not an approved public release. No code was pushed,
no website deployment was made, and no GitHub release was published.

## Verified

- Windows x64 installer built successfully with `--publish never`. The packaged
  0.2.0 app opened and displayed sample-query results without renderer errors.
  Nine key bundled source files were byte-identical to the tested local files.
- 20 desktop tests passed with the opt-in isolated PostgreSQL integration enabled.
  Coverage includes cross-schema discovery, quoted names, row caps, read-only
  transactions, dialect-specific SQL guards, trusted origins, and credential storage.
- Eight targeted web tests passed: desktop bridge and desktop/browser auth behavior,
  including hydration and canceled connection removal.
- Full web TypeScript check, targeted integration-file ESLint, and `git diff --check` passed.
- Desktop production dependency audit reported zero known vulnerabilities.
- Development-app UI checks: sample presets, real PostgreSQL test/save, schema,
  SELECT results, blocked DELETE, editing a saved connection, Escape and Ctrl+Enter.
- Hosted workspace reached the live sign-in screen. No account credentials were entered.
- An unavailable local web endpoint showed the offline screen; returning to local
  workspace worked. No renderer errors were reported during the local UI checks.
- Overview and sample workspace inspected at desktop and 860 × 620 viewport sizes.
- Automated WCAG A/AA checks reported zero violations on overview, sample query
  workspace, and connection form after contrast fixes. Some glyph/offscreen contrast
  checks required manual review; this is not a complete accessibility certification.

The disposable PostgreSQL instance was stopped after testing. Existing databases
were not used. Test profiles and screenshots are under `.local-artifacts/desktop-qa/`
at the web project root and are not included in the installer.

## Public-release gates still open

- Windows publisher signing and clean-machine installation/uninstallation tests.
- Native CSV save/cancel and connection-removal dialogs need end-to-end OS-level QA.
- Deploy the hosted desktop sign-in changes, then verify authenticated AI generation
  and local database execution together. The desktop hides unsupported OAuth on the
  older hosted form using a bundled compatibility stylesheet; the web timeout and
  redesigned auth layout are still local. A browser OAuth session handoff is not implemented.
- Real database qualification for MySQL, MariaDB, and SQL Server.
- Published update/upgrade qualification. macOS and Linux remain untested.

See [RELEASE.md](RELEASE.md) for the full release checklist.

## Dim workspace revision

- Replaced the marketing hero with a working overview, sample query preview, and
  connection/account actions. Default is dim; the light choice survives reload.
- Visually checked dim and light overview, dim sample results, and connection
  dialogs at the 860 x 620 minimum viewport. Sample query actions return six rows.
- Fixed a duplicate global declaration between the theme initializer and workspace
  script discovered during click testing. Rechecked actual controls after the fix.
- Hosted AI navigation reaches sign-in. Desktop sign-in removes the large gradient
  panel and unsupported OAuth choices. A tested Google redirect recovered to a
  usable Sign In button instead of retaining the loading state.
- The local web sign-in layout rendered with desktop detection, no browser OAuth,
  and no browser runtime errors. A simulated stalled login POST displayed the
  20-second timeout message and re-enabled submission; no credentials were sent.
- Current checks: 20 desktop tests passed, one PostgreSQL integration skipped
  (the disposable instance is stopped); eight targeted web tests passed. Final
  TypeScript, targeted ESLint, and whitespace checks passed.
- Local web verification found existing Sentry/Turbopack dependency warnings,
  but login and home rendered without a framework error overlay. The development
  auth redirect uses `localhost`, which must match `NATUREQUERY_URL`.

## Artifact

- Installer: `dist/NatureQuery-0.2.0-win-x64-Setup.exe`
- Size: 116,584,178 bytes; Authenticode status: `NotSigned`.
- SHA-256: `02FFFBFDB9B3160A350078A497C3C9945FB989F2CC70CE03D85521D5FBE0EFFA`
- Non-installing preview: `dist/win-unpacked/NatureQuery.exe`. Keep its adjacent files.
