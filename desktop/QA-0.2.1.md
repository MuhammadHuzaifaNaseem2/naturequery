# NatureQuery Desktop 0.2.1 local launch check

This is a local Windows x64 candidate. No code was pushed and no desktop or web release was published.

The user's 0.2.0 installer was present at the registered per-user installation path. A packaged preview process left running from local testing had no visible main window and held the single-instance lock. New launches were forwarded to that invisible process. After stopping only that test process, the installed app opened a visible, responding `NatureQuery Desktop` window and became the foreground window.

This coding environment also sets `ELECTRON_RUN_AS_NODE=1` for child processes. A launch from its terminal exits as Node unless that process-scoped flag is cleared. The flag is absent from the Windows user and machine environment. It was cleared for the successful installed-app launch and for packaging checks.

Version 0.2.1 explicitly calls `show()` when a second launch finds an existing hidden window, then focuses it. An isolated development profile reproduced a hidden first instance (`MainWindowHandle` zero); a second launch made the original window visible. The desktop test suite passed 20 tests; the opt-in isolated PostgreSQL integration test was skipped. `node --check desktop/main.js` and `git diff --check` passed.

The new installer is `dist/NatureQuery-0.2.1-win-x64-Setup.exe` (116,586,782 bytes, SHA-256 `076BFB1828BAB65134B5EEFE812349B3CA0D97E4B86CE5E27CAEAEDFA78A8BE4`, Authenticode `NotSigned`). The packaged main process and seven other bundled UI/security files matched the tested source byte-for-byte. The installed 0.2.0 app was left open; upgrading it should wait until the user has finished any work in that window. The public-release gates in `RELEASE.md` remain open.
