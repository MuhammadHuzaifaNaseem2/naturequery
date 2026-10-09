// Environment for launching Electron from scripts. Some shells (for example
// editor-integrated terminals) export ELECTRON_RUN_AS_NODE, which would make
// Electron behave like plain Node.js instead of opening the app.
export function electronEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}
