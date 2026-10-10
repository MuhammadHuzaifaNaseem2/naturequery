// Stands in for the user's web browser during the E2E test: opens the
// desktop sign-in page, logs in through the real login form (unless this
// browser profile is already logged in), chooses Allow, and records the
// naturequery:// link the page opens. Nothing is shown.
//   electron browser.cjs <outFile> <screenshotDir> <authorizeUrl>
// NQ_E2E_EMAIL, NQ_E2E_PASSWORD and NQ_E2E_BROWSER_PROFILE pick the account
// and the browser profile.
// Electron refuses to start when a URL argument is followed by other arguments.
const { app, BrowserWindow, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const [outFile, shotDir, authorizeUrl] = process.argv.slice(-3)
const logFile = path.join(path.dirname(outFile), 'browser-log.txt')
const log = (message) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}
`)
log(`start ${JSON.stringify(process.argv.slice(-3))}`)
process.on('uncaughtException', (error) => log(`uncaught ${error.stack}`))
console.log = (...args) => log(args.join(' '))
const email = process.env.NQ_E2E_EMAIL || 'desktop.e2e@example.com'
const password = process.env.NQ_E2E_PASSWORD || 'E2e-Test-Password-2026!'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.setPath(
  'userData',
  process.env.NQ_E2E_BROWSER_PROFILE || path.join(path.dirname(outFile), 'browser-profile')
)

app.whenReady().then(async () => {
  const done = (code, message) => {
    if (message) console.log(message)
    setTimeout(() => app.exit(code), 200)
  }
  try {
    // Capture the app link instead of handing it to the operating system.
    let captured = null
    session.defaultSession.protocol.handle('naturequery', (request) => {
      captured = request.url
      fs.writeFileSync(outFile, request.url)
      return new Response('captured')
    })
    const win = new BrowserWindow({ show: false, width: 1100, height: 900 })
    // Like a real browser, hand the app link over and stay on the page.
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('naturequery:')) return
      event.preventDefault()
      captured = url
      fs.writeFileSync(outFile, url)
    })
    const run = (js) => win.webContents.executeJavaScript(js, true)
    const waitFor = async (js, label, timeout = 60000) => {
      const end = Date.now() + timeout
      while (Date.now() < end) {
        try {
          if (await run(js)) return
        } catch {}
        await sleep(300)
      }
      throw new Error(`Timed out waiting for ${label}. URL: ${win.webContents.getURL()}`)
    }
    const shot = async (name) => {
      const image = await win.webContents.capturePage()
      fs.writeFileSync(path.join(shotDir, name), image.toPNG())
    }

    await win.loadURL(authorizeUrl)
    const approvalShown = `location.pathname === '/desktop/authorize' && document.body.innerText.includes('Sign in to NatureQuery Desktop')`
    await waitFor(
      `(location.pathname === '/login' && !!document.querySelector('input[name=email]')) || (${approvalShown})`,
      'login or approval page'
    )
    if (await run(`location.pathname === '/login'`)) {
      const callback = await run(`new URLSearchParams(location.search).get('callbackUrl')`)
      console.log(`login callbackUrl: ${callback}`)
      if (!callback || !callback.includes('challenge=')) throw new Error('The login page lost the sign-in request')

      await run(`(() => {
        const set = (selector, value) => {
          const input = document.querySelector(selector)
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(input, value)
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        set('input[name=email]', ${JSON.stringify(email)})
        set('input[name=password]', ${JSON.stringify(password)})
        document.querySelector('form button[type=submit]').click()
      })()`)
    } else {
      console.log('already logged in on the website')
    }

    await waitFor(`location.pathname === '/desktop/authorize' && document.body.innerText.includes('Sign in to NatureQuery Desktop')`, 'approval page')
    const text = await run('document.body.innerText')
    console.log(`approval page shows account: ${text.includes(email)}`)
    await shot('web-authorize.png')

    await run(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Allow').click()`)
    await waitFor(`document.body.innerText.includes('You are signed in')`, 'confirmation')
    await sleep(500)
    await shot('web-approved.png')
    if (!captured) {
      // Some Chromium versions block automatic app links without a click: use the button.
      await run(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Open NatureQuery Desktop')).click()`)
      const end = Date.now() + 5000
      while (!captured && Date.now() < end) await sleep(200)
    }
    if (!captured) throw new Error('The page did not open a naturequery:// link')
    console.log('captured app link')
    done(0)
  } catch (error) {
    done(1, `BROWSER ERROR: ${error.message}`)
  }
})
