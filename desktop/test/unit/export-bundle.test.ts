import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The app's main process is an esbuild bundle that loads packages at run time. Vitest
// loads modules its own way, which once hid an Excel export that failed in every
// installed copy. This builds the exporter the same way and runs it in plain Node.
describe('export from the shipped bundle', () => {
  it('writes an Excel file', async () => {
    // Inside node_modules so the bundle finds the app's packages, as in the app archive.
    const work = path.join(desktopRoot, 'node_modules', '.nq-export-test')
    fs.mkdirSync(work, { recursive: true })
    try {
      const bundle = path.join(work, 'exporter.cjs')
      await build({
        entryPoints: [path.join(desktopRoot, 'src/main/exporter.ts')],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node24',
        packages: 'external',
        alias: { '@shared': path.join(desktopRoot, 'src/shared') },
        outfile: bundle,
        logLevel: 'silent',
      })

      const out = path.join(work, 'out.xlsx')
      execFileSync(process.execPath, [
        '-e',
        `require(${JSON.stringify(bundle)})
          .writeXlsx(${JSON.stringify(out)}, ['product', 'price'], [['Tent', 139]])
          .catch((error) => { console.error(error); process.exit(1) })`,
      ])

      const bytes = fs.readFileSync(out)
      expect(bytes.subarray(0, 2).toString()).toBe('PK')
      expect(bytes.length).toBeGreaterThan(3000)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  }, 60_000)
})
