import type { Input, WebContents } from 'electron'

export type ZoomAction = 'in' | 'out' | 'reset'

/**
 * Recognizes zoom shortcuts before the page sees them, including numpad keys
 * and keyboard layouts where "+" needs Shift. AltGr input is left alone.
 */
export function zoomAction(
  input: Pick<Input, 'type' | 'key' | 'code' | 'control' | 'meta' | 'alt' | 'shift'> & {
    isComposing?: boolean
  },
  platform: NodeJS.Platform = process.platform
): ZoomAction | null {
  if (input.type !== 'keyDown' || input.alt || input.isComposing) return null
  const modifier =
    platform === 'darwin' ? input.meta && !input.control : input.control && !input.meta
  if (!modifier) return null
  if (input.key === '+' || input.key === '=' || input.code === 'NumpadAdd') return 'in'
  if (input.key === '-' || input.key === '_' || input.code === 'NumpadSubtract') return 'out'
  if (input.key === '0' && !input.shift) return 'reset'
  return null
}

export function applyZoom(
  contents: Pick<WebContents, 'getZoomLevel' | 'setZoomLevel'>,
  action: ZoomAction
): void {
  const level = action === 'reset' ? 0 : contents.getZoomLevel() + (action === 'in' ? 0.5 : -0.5)
  contents.setZoomLevel(Math.max(-3, Math.min(3, level)))
}
