# NatureQuery Desktop 0.2.2 — auth layout flash fix

Local Windows x64 candidate only. No code pushed, web deployment performed, or release published.

## Cause and change

The hosted server still renders the browser's two-column gradient auth layout.
Version 0.2.1 inserted the desktop compatibility CSS in `did-finish-load`, after
that layout could already be painted. This was one form changing presentation,
not a second login or a session failure.

Version 0.2.2 supplies the bundled non-secret CSS through renderer arguments and
installs it synchronously in the sandboxed preload. It no longer waits for page
load. CSS is limited to trusted NatureQuery origins and scoped to auth markup,
including the body background, so it covers client-side auth navigation without
overriding the dashboard's theme. Context isolation and sandboxing remain enabled.

## Verification

- `npm test`: 23 passed, 1 opt-in PostgreSQL integration test skipped, 0 failed.
- Main/preload syntax checks and `git diff --check` passed.
- Isolated Electron development profile tested against the production hosted
  login, including the redirect to `www.naturequery.app`.
- Cache-free reload with 300 ms latency and 128,000 bytes/sec download throughput:
  DOM insertion observations first recorded auth markup at 1,069 ms with
  `document.readyState = loading`, gradient panel `display = none`, and root
  background `rgb(27, 28, 34)`. All 20 recorded mutation samples stayed compact
  and dim, including the later interactive state. Frame-by-frame animation
  measurements were unavailable because the diagnostic window was backgrounded;
  the insertion observations establish that styling preceded document completion.
- Captured final login appearance: centered charcoal form, email/password,
  no unsupported Google/GitHub actions. No account credentials submitted.
- Client-side Sign up navigation retained compact dim styling. Returned the
  isolated preview to local home after inspection.

## Build artifact

`npm run build:win` completed successfully with publishing disabled. The tested
main process, preload, and auth stylesheet match the packaged ASAR byte-for-byte;
the packaged metadata reports version 0.2.2. Installer:
`dist/NatureQuery-0.2.2-win-x64-Setup.exe`, 116,587,071 bytes, SHA-256
`C4486D5237E99739CAE4754A0F8825A4CB6792FFFB012CB1324357FBFE8A55F0`.
This candidate remains unsigned. The isolated diagnostic process was closed;
the user's installed application/profile was not changed.

This checks the presentation bug, not complete authentication or release
qualification. Clean Windows installation/upgrade, signing, database integration,
and end-to-end hosted authentication release gates in `RELEASE.md` remain open.
