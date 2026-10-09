// Shared esbuild settings for the Electron main, preload and engine bundles.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: true,
  outExtension: { '.js': '.cjs' },
  logLevel: 'warning',
  alias: { '@shared': path.join(desktopRoot, 'src/shared') },
}

export function electronTargets({ production }) {
  const define = {
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
  }
  return [
    {
      ...common,
      define,
      // Runtime dependencies ship in node_modules inside the app archive.
      packages: 'external',
      entryPoints: {
        'main/index': path.join(desktopRoot, 'src/main/index.ts'),
        'engine/index': path.join(desktopRoot, 'src/engine/index.ts'),
      },
      outdir: path.join(desktopRoot, 'dist'),
    },
    {
      ...common,
      define,
      // A sandboxed preload may only require Electron, so bundle everything else.
      external: ['electron'],
      entryPoints: { 'preload/index': path.join(desktopRoot, 'src/preload/index.ts') },
      outdir: path.join(desktopRoot, 'dist'),
    },
  ]
}
