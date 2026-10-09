# NatureQuery Desktop 0.2.3 — scrolling and zoom

Local Windows x64 candidate, not a public release. No push or hosted deployment.

## Fixed

- The hosted Results toolbar used `overflow-x-auto`. CSS consequently computed
  vertical overflow as auto as well, clipping the absolute export dropdown and
  making a tiny nested scrollbar. The web source now wraps controls without
  that scroll container. Export has an accessible label and expanded state.
- Results of ten rows or fewer use the workspace scroll, rather than an
  unnecessary capped table viewport. Larger pages retain a 500px table cap;
  the web footer cannot shrink out of view.
- Bundled, narrowly scoped hosted compatibility CSS applies the toolbar and
  short-table fixes to the current production markup without a web deployment.
- Main-process input handling supports Ctrl+=, Ctrl+Shift+=, numpad Ctrl+Plus,
  Ctrl+- and Ctrl+0. View menu uses the same bounded zoom operations. Mac uses
  Command. Editors retain unrelated keyboard shortcuts and AltGr input.

## Evidence

- Desktop suite: 26 passed, 1 opt-in PostgreSQL integration test skipped.
- ResultsTable suite: 2 passed, including filtering a larger result to one row.
- TypeScript check and targeted ESLint passed. `git diff --check` passed.
- A localhost-only synthetic fixture renders the actual QueryPanel and
  ResultsTable; unrelated AI/server/provider boundaries are stubbed. No user
  account, database, credentials or query quota was used.
- Browser fixture loaded without console errors. Fixed export dropdown shows
  Excel and CSV; clicking CSV calls the fixture callback. This checks the menu,
  not actual disk export or the hosted export API.
- Desktop compatibility fixture at 860x700 reports toolbar overflow visible,
  wrapping enabled, short-table max-height none, and both export options inside
  the viewport and hit-testable. Wider browser screenshot also checked.
- Native Electron `sendInputEvent` verified zoom levels: reset 0, Ctrl-minus -1,
  Ctrl-equals 0, Ctrl-Shift-plus 1, numpad-plus 2, final reset 0. CDP key injection
  alone did not exercise native shortcuts, so it was not treated as proof.
- Sandbox, context isolation and top-level IPC restrictions remain enabled.

## Artifact and limits

`dist/NatureQuery-0.2.3-win-x64-Setup.exe`, 116,587,586 bytes. SHA-256:
`BDF527EEFBEDFADFBE16F88AC058268BF68613FA4D152FA71FE9D01D215B666E`.
Main process, preload, zoom helper and both hosted CSS files match packaged
ASAR contents byte-for-byte. Build completed with publishing disabled.

Installer remains unsigned. Avast review of 0.2.2 is not clearance of this new
binary. Do not bypass antivirus protection. Full hosted auth/export, clean
Windows installation/upgrade, database qualification, signing and release gates
in `RELEASE.md` remain open. User's installed application and profile were not
changed by these tests.
