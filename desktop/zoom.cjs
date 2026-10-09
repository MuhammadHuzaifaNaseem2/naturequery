'use strict'

function zoomAction(input, platform = process.platform) {
  if (input.type !== 'keyDown' || input.alt || input.isComposing) return null
  if (platform === 'darwin' ? !input.meta || input.control : !input.control || input.meta) return null
  if (['+', '='].includes(input.key) || input.code === 'NumpadAdd') return 'in'
  if (['-', '_'].includes(input.key) || input.code === 'NumpadSubtract') return 'out'
  if (input.key === '0' && !input.shift) return 'reset'
  return null
}

function applyZoom(contents, action) {
  const level = action === 'reset' ? 0 : contents.getZoomLevel() + (action === 'in' ? 1 : -1)
  contents.setZoomLevel(Math.max(-4, Math.min(4, level)))
}

module.exports = { zoomAction, applyZoom }
