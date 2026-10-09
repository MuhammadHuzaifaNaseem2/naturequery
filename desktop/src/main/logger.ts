import log from 'electron-log/main'
import { app } from 'electron'
import { redact } from '@shared/redact'

// Logs live in the user's app data folder (logs/main.log) so support can ask
// for them. Every message is scrubbed of passwords, tokens and keys first.
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.console.level = app.isPackaged ? false : 'debug'
log.hooks.push((message) => {
  message.data = message.data.map((item) => {
    if (typeof item === 'string') return redact(item)
    if (item instanceof Error) return redact(item.stack || item.message)
    try {
      return JSON.parse(redact(JSON.stringify(item)))
    } catch {
      return '[unserializable]'
    }
  })
  return message
})

export const logger = log.scope('main')
export const engineLogger = log.scope('engine')

export function logFilePath(): string {
  return log.transports.file.getFile().path
}
