import fs from 'node:fs'
import path from 'node:path'
import { NqError } from '@shared/errors'
import { createConnectionStore, type ConnectionStore } from './connections'
import type { SecretBox } from './secure-store'
import { openWorkspaceDb, type WorkspaceDb } from './workspace-db'

/**
 * Connections, query history and saved queries belong to the NatureQuery
 * account that is signed in. Each account has its own folder, opened when it
 * signs in and closed when it signs out, so people who share a computer only
 * see their own work.
 */

/** Files that versions before sign-in was required kept directly in the app folder. */
const EARLIER_FILES = [
  'connections.json',
  'local-connections.json',
  'workspace.db',
  'workspace.db-wal',
  'workspace.db-shm',
]

export interface AccountData {
  userId: string
  connections: ConnectionStore
  workspace: WorkspaceDb
  close(): void
}

interface Log {
  info(message: string): void
  warn(message: string, error?: unknown): void
  error(message: string, error?: unknown): void
}

export interface AccountDataOptions {
  /** The app's data folder. */
  root: string
  userId: string
  box: SecretBox
  log?: Log
}

/** A folder name for an account id: letters, digits, dashes and underscores only. */
export function accountFolderName(userId: string): string {
  const safe = userId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)
  if (!/[A-Za-z0-9]/.test(safe)) {
    throw new NqError('VALIDATION', 'This account cannot be used on this computer.', {
      hint: 'Sign in again. If it keeps happening, contact support.',
    })
  }
  return safe
}

export function openAccountData(options: AccountDataOptions): AccountData {
  const dir = path.join(options.root, 'accounts', accountFolderName(options.userId))
  const firstTime = !fs.existsSync(dir)
  fs.mkdirSync(dir, { recursive: true })
  if (firstTime) adoptEarlierFiles(options.root, dir, options.log)

  const connections = createConnectionStore({
    file: path.join(dir, 'connections.json'),
    legacyFile: path.join(dir, 'local-connections.json'),
    box: options.box,
  })
  try {
    const migrated = connections.migrateLegacy()
    if (migrated) {
      options.log?.info(`Imported ${migrated} connection(s) from an earlier desktop version`)
    }
  } catch (error) {
    options.log?.error('Could not import connections from an earlier version', error)
  }
  const workspace = openWorkspaceDbSafely(path.join(dir, 'workspace.db'), options.log)

  return {
    userId: options.userId,
    connections,
    workspace,
    close() {
      try {
        workspace.close()
      } catch {
        // Already closed.
      }
    },
  }
}

/**
 * Versions before sign-in was required kept one set of connections and
 * history for the whole computer. The first account that signs in takes them
 * over, so nothing is lost when updating.
 */
function adoptEarlierFiles(root: string, dir: string, log?: Log) {
  for (const name of EARLIER_FILES) {
    const from = path.join(root, name)
    if (!fs.existsSync(from)) continue
    try {
      fs.renameSync(from, path.join(dir, name))
      log?.info(`Moved ${name} from an earlier version into the signed-in account`)
    } catch (error) {
      log?.warn(`Could not move ${name} from an earlier version`, error)
    }
  }
}

function openWorkspaceDbSafely(file: string, log?: Log): WorkspaceDb {
  try {
    return openWorkspaceDb(file)
  } catch (error) {
    // A damaged history file must not stop the app from working.
    log?.error('Workspace database could not be opened; starting a fresh one', error)
    const backup = `${file}.damaged-${Date.now()}`
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(file + suffix)) fs.renameSync(file + suffix, backup + suffix)
    }
    return openWorkspaceDb(file)
  }
}
