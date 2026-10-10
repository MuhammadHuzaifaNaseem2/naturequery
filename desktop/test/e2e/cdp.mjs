// Minimal CDP driver for the NatureQuery Electron app (Windows, no Playwright).
// Launches electron.exe with an isolated profile and remote debugging, then
// exposes evaluate / click / screenshot / key helpers over the page target.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 1
    const pending = new Map()
    const listeners = new Map()
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const id = nextId++
          ws.send(JSON.stringify({ id, method, params }))
          return new Promise((res, rej) => pending.set(id, { res, rej, method }))
        },
        on(method, fn) {
          if (!listeners.has(method)) listeners.set(method, [])
          listeners.get(method).push(fn)
        },
        close: () => ws.close(),
      })
    ws.onerror = (e) => reject(e)
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.id && pending.has(data.id)) {
        const { res, rej, method } = pending.get(data.id)
        pending.delete(data.id)
        if (data.error) rej(new Error(method + ': ' + data.error.message))
        else res(data.result)
      } else if (data.method && listeners.has(data.method)) {
        for (const fn of listeners.get(data.method)) fn(data.params)
      }
    }
  })
}

export async function launch({ appDir, exe: packagedExe, userData, port = 9339, env = {}, args = [], quiet = false }) {
  // A packaged app ignores NATUREQUERY_USER_DATA; --user-data-dir keeps it off the real profile.
  const exe = packagedExe ?? path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe')
  const childEnv = { ...process.env, NATUREQUERY_USER_DATA: userData, ...env }
  delete childEnv.ELECTRON_RUN_AS_NODE
  fs.mkdirSync(userData, { recursive: true })
  // exe + appDir: run an app folder or app.asar with that Electron; exe alone: a packaged app.
  const appArgs = packagedExe && !appDir ? [`--user-data-dir=${userData}`] : [appDir]
  const child = spawn(exe, [...appArgs, `--remote-debugging-port=${port}`, ...args], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  const capture = (tag) => (d) => {
    const text = String(d)
    logs.push(tag + text)
    if (!quiet) process.stdout.write(tag + text)
  }
  child.stdout.on('data', capture('[app] '))
  child.stderr.on('data', capture('[app:err] '))
  const deadline = Date.now() + 40000
  let target
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
      if (target) break
    } catch {}
    await sleep(300)
  }
  if (!target) {
    child.kill()
    throw new Error('No page target appeared. Logs:\n' + logs.join(''))
  }
  const session = await connect(target.webSocketDebuggerUrl)
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  const consoleMessages = []
  session.on('Runtime.consoleAPICalled', (p) =>
    consoleMessages.push(p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' '))
  )
  session.on('Runtime.exceptionThrown', (p) =>
    consoleMessages.push('EXCEPTION: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text))
  )

  const api = {
    child,
    session,
    logs,
    consoleMessages,
    async evaluate(expression) {
      const r = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      })
      if (r.exceptionDetails)
        throw new Error('evaluate: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
      return r.result.value
    },
    async waitFor(expression, timeout = 15000) {
      const end = Date.now() + timeout
      let last
      while (Date.now() < end) {
        try {
          last = await api.evaluate(expression)
          if (last) return last
        } catch (e) {
          last = e.message
        }
        await sleep(200)
      }
      throw new Error('waitFor timed out: ' + expression + ' (last: ' + last + ')')
    },
    async click(selector) {
      return api.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'NOT_FOUND'; el.click(); return 'OK' })()`)
    },
    /** Clicks a point on screen like a person: only what is visible there gets the click. */
    async mouseClick(x, y) {
      await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
      for (const type of ['mousePressed', 'mouseReleased']) {
        await session.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
      }
    },
    async screenshot(file) {
      const { data } = await session.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(file, Buffer.from(data, 'base64'))
      return file
    },
    async key(key, { code, modifiers = 0, text } = {}) {
      const vk = { Enter: 13, Escape: 27, Tab: 9 }[key]
      const base = { key, code: code || key, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }
      await session.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, text })
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    },
    async type(text) {
      await session.send('Input.insertText', { text })
    },
    async url() {
      return api.evaluate('location.href')
    },
    async close() {
      try {
        session.close()
      } catch {}
      child.kill()
      await sleep(500)
    },
  }
  return api
}
