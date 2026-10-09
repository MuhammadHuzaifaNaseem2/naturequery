'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8')

function run(origin, { argument, theme, failCSS = false } = {}) {
  const events = []
  let savedTheme = theme
  const css = 'body:has(.auth) { background: #1b1c22; }'
  const payload = Buffer.from(JSON.stringify({ origins: ['https://naturequery.app', 'https://www.naturequery.app'], css })).toString('base64')
  vm.runInNewContext(source, {
    require: (name) => {
      assert.equal(name, 'electron')
      return {
        webFrame: { insertCSS(value) { events.push(['css', value]); if (failCSS) throw new Error('test failure') } },
        contextBridge: { exposeInMainWorld(name, value) { events.push(['bridge', name, value.isDesktop]) } },
        ipcRenderer: { invoke() {} },
      }
    },
    Buffer,
    process: { argv: [argument ?? `--naturequery-auth-presentation=${payload}`], platform: 'win32' },
    location: { origin },
    localStorage: { getItem: () => savedTheme, setItem: (_key, value) => { savedTheme = value } },
  })
  return { events, savedTheme, css }
}

test('auth CSS is installed synchronously before exposing the bridge', () => {
  for (const origin of ['https://naturequery.app', 'https://www.naturequery.app']) {
    const result = run(origin)
    assert.deepEqual(result.events, [['css', result.css], ['bridge', 'naturequery', true]])
    assert.equal(result.savedTheme, 'dim')
  }
})

test('local and untrusted documents do not receive hosted CSS or theme', () => {
  for (const origin of ['null', 'https://naturequery.app.evil.example', 'http://naturequery.app']) {
    const result = run(origin)
    assert.deepEqual(result.events, [['bridge', 'naturequery', true]])
    assert.equal(result.savedTheme, undefined)
  }
})

test('preload preserves the saved theme and survives missing or broken styling', () => {
  assert.equal(run('https://naturequery.app', { theme: 'light' }).savedTheme, 'light')
  for (const options of [{ argument: '--unrelated' }, { argument: '--naturequery-auth-presentation=invalid' }, { failCSS: true }]) {
    assert.deepEqual(run('https://naturequery.app', options).events.at(-1), ['bridge', 'naturequery', true])
  }
})
