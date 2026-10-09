import { app } from 'electron'
import path from 'node:path'

const distDir = path.resolve(__dirname, '..')

export const paths = {
  userData: () => app.getPath('userData'),
  connections: () => path.join(app.getPath('userData'), 'connections.json'),
  /** Connection file written by desktop releases before 0.9. */
  legacyConnections: () => path.join(app.getPath('userData'), 'local-connections.json'),
  settings: () => path.join(app.getPath('userData'), 'settings.json'),
  windowState: () => path.join(app.getPath('userData'), 'window-state.json'),
  account: () => path.join(app.getPath('userData'), 'account.json'),
  workspaceDb: () => path.join(app.getPath('userData'), 'workspace.db'),
  resources: () =>
    app.isPackaged ? process.resourcesPath : path.resolve(distDir, '..', 'resources'),
  sampleDatabase: () => path.join(paths.resources(), 'sample', 'acme-store.db'),
  renderer: () => path.join(distDir, 'renderer'),
  preload: () => path.join(distDir, 'preload', 'index.cjs'),
  engine: () => path.join(distDir, 'engine', 'index.cjs'),
}
