import { app } from 'electron'
import path from 'node:path'

const distDir = path.resolve(__dirname, '..')

export const paths = {
  userData: () => app.getPath('userData'),
  settings: () => path.join(app.getPath('userData'), 'settings.json'),
  windowState: () => path.join(app.getPath('userData'), 'window-state.json'),
  account: () => path.join(app.getPath('userData'), 'account.json'),
  /** Each account's connections and history live in their own folder under here. */
  accounts: () => path.join(app.getPath('userData'), 'accounts'),
  resources: () =>
    app.isPackaged ? process.resourcesPath : path.resolve(distDir, '..', 'resources'),
  sampleDatabase: () => path.join(paths.resources(), 'sample', 'acme-store.db'),
  renderer: () => path.join(distDir, 'renderer'),
  preload: () => path.join(distDir, 'preload', 'index.cjs'),
  engine: () => path.join(distDir, 'engine', 'index.cjs'),
}
