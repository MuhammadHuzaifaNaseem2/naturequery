import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { readJsonFile, writeJsonFile } from './json-file'
import { settingsPatchSchema } from './validation'

export function createSettingsStore(file: string) {
  let cache: Settings | null = null

  function get(): Settings {
    if (cache) return cache
    const raw = readJsonFile<Record<string, unknown>>(file, {}, 'settings')
    // Keep only known, valid values so an old or edited file cannot break the app.
    const settings: Settings = { ...DEFAULT_SETTINGS }
    for (const [key, value] of Object.entries(raw ?? {})) {
      const parsed = settingsPatchSchema.safeParse({ [key]: value })
      if (parsed.success) Object.assign(settings, parsed.data)
    }
    cache = settings
    return settings
  }

  function update(patch: Partial<Settings>): Settings {
    const next = { ...get(), ...patch }
    writeJsonFile(file, next)
    cache = next
    return next
  }

  return { get, update }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
