'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { zoomAction, applyZoom } = require('../zoom.cjs')

test('recognizes main keyboard and numpad zoom combinations', () => {
  const base = { type: 'keyDown', control: true }
  for (const input of [{ key: '=' }, { key: '+' }, { key: '+', shift: true }, { code: 'NumpadAdd' }]) {
    assert.equal(zoomAction({ ...base, ...input }, 'win32'), 'in')
  }
  for (const input of [{ key: '-' }, { key: '_' }, { code: 'NumpadSubtract' }]) {
    assert.equal(zoomAction({ ...base, ...input }, 'win32'), 'out')
  }
  assert.equal(zoomAction({ ...base, key: '0' }, 'win32'), 'reset')
  assert.equal(zoomAction({ type: 'keyDown', meta: true, key: '+' }, 'darwin'), 'in')
})

test('leaves typing, editor shortcuts, AltGr and key-up alone', () => {
  for (const input of [
    { key: '+' }, { control: true, key: 's' }, { control: true, alt: true, key: '+' },
    { control: true, key: '+', isComposing: true }, { control: true, key: '0', shift: true },
  ]) assert.equal(zoomAction({ type: 'keyDown', ...input }, 'win32'), null)
  assert.equal(zoomAction({ type: 'keyUp', control: true, key: '+' }, 'win32'), null)
})

test('zoom remains bounded and actual size restores 100 percent', () => {
  let level = 0
  const contents = { getZoomLevel: () => level, setZoomLevel: (next) => { level = next } }
  applyZoom(contents, 'out'); assert.equal(level, -1)
  applyZoom(contents, 'in'); assert.equal(level, 0)
  for (let i = 0; i < 20; i++) applyZoom(contents, 'in')
  assert.equal(level, 4)
  for (let i = 0; i < 20; i++) applyZoom(contents, 'out')
  assert.equal(level, -4)
  applyZoom(contents, 'reset'); assert.equal(level, 0)
})
