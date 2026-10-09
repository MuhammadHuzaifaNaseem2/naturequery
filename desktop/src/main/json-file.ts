import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { NqError } from '@shared/errors'

/**
 * Reads a JSON file. A missing file returns the fallback; a damaged file is
 * left untouched and reported, so a bad write never silently erases data.
 */
export function readJsonFile<T>(file: string, fallback: T, label: string): T {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new NqError('UNKNOWN', `Your ${label} could not be read.`, {
      hint: 'Check that the NatureQuery data folder is accessible, then restart the app.',
      detail: (error as Error).message,
    })
  }
  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new NqError('UNKNOWN', `Your ${label} file is damaged and was left unchanged.`, {
      hint: 'Contact support before making changes, so nothing is overwritten.',
      detail: `${file}: ${(error as Error).message}`,
    })
  }
}

/** Writes JSON through a temporary file and an atomic rename. */
export function writeJsonFile(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true })
  }
}
