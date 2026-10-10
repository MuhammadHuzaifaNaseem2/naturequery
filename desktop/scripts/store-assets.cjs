// Makes the Microsoft Store tile images in build/appx/ from build/icon.png.
// Runs inside Electron for its image resizing: npm run store-assets
const { app, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const out = path.join(root, 'build', 'appx')
const source = nativeImage.createFromPath(path.join(root, 'build', 'icon.png'))

// Windows picks the file that matches the screen's scaling.
const SCALES = [100, 125, 150, 200, 400]
// Name, size at 100% scaling, and how much of the shorter side the icon fills.
const TILES = [
  ['StoreLogo', 50, 50, 1],
  ['Square44x44Logo', 44, 44, 1],
  ['Square150x150Logo', 150, 150, 0.56],
  ['Wide310x150Logo', 310, 150, 0.56],
  ['LargeTile', 310, 310, 0.5],
  ['SmallTile', 71, 71, 0.66],
]
// Exact sizes for the taskbar, Start and File Explorer.
const TARGET_SIZES = [16, 24, 32, 48, 256]

/** The icon centered on a transparent image of the given size. */
function render(width, height, share) {
  const side = Math.round(Math.min(width, height) * share)
  const icon = source.resize({ width: side, height: side, quality: 'best' })
  if (side === width && side === height) return icon.toPNG()
  const pixels = Buffer.alloc(width * height * 4)
  const iconPixels = icon.toBitmap()
  const left = Math.floor((width - side) / 2)
  const top = Math.floor((height - side) / 2)
  for (let y = 0; y < side; y++) {
    iconPixels.copy(pixels, ((top + y) * width + left) * 4, y * side * 4, (y + 1) * side * 4)
  }
  return nativeImage.createFromBitmap(pixels, { width, height }).toPNG()
}

app.whenReady().then(() => {
  if (source.isEmpty()) throw new Error('build/icon.png could not be read')
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  for (const [name, width, height, share] of TILES) {
    for (const scale of SCALES) {
      const w = Math.round((width * scale) / 100)
      const h = Math.round((height * scale) / 100)
      fs.writeFileSync(path.join(out, `${name}.scale-${scale}.png`), render(w, h, share))
    }
  }
  for (const size of TARGET_SIZES) {
    const png = render(size, size, 1)
    fs.writeFileSync(path.join(out, `Square44x44Logo.targetsize-${size}.png`), png)
    // The same icon without a colored plate behind it on the taskbar.
    fs.writeFileSync(path.join(out, `Square44x44Logo.targetsize-${size}_altform-unplated.png`), png)
  }
  console.log(`Wrote ${fs.readdirSync(out).length} images to build/appx`)
  app.quit()
})
