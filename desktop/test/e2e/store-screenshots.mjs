// Makes the Microsoft Store screenshots in desktop/store/screenshots/ (1920 x 1080).
// Needs the same setup as the end-to-end test: the website on port 3100 and the
// throwaway database (see README.md in this folder). Signs in a demo account,
// adds example connections that are never connected to, and asks real questions
// on the built-in sample database.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, sleep } from './cdp.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(here, '../..')
const webRoot = path.resolve(desktopDir, '..')
const electronExe = path.join(desktopDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const site = process.env.NQ_E2E_SITE ?? 'http://localhost:3100'
const testDb = 'postgresql://postgres:webtest_pw@127.0.0.1:55442/naturequery_test'
const work = path.join(os.tmpdir(), 'nq-store-shots')
const profile = path.join(work, 'profile')
const openedLog = path.join(work, 'opened.log')
const linkFile = path.join(work, 'link.txt')
const out = path.join(desktopDir, 'store', 'screenshots')
const email = 'jordan.lee@example.com'

const childEnv = () => {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

function run(command, args, { env, timeout }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: 'ignore' })
    const timer = setTimeout(() => child.kill(), timeout)
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve(status)
    })
  })
}

// Example connections shown in the sidebar and on the home screen.
const EXAMPLES = [
  {
    name: 'Sales',
    type: 'postgresql',
    host: 'sales-db.acme.local',
    port: 5432,
    database: 'sales',
    user: 'reporting',
    tls: { mode: 'require' },
    secrets: { password: 'example-only' },
  },
  {
    name: 'Finance',
    type: 'sqlserver',
    host: 'finance-sql.acme.local',
    port: 1433,
    database: 'finance',
    user: 'report_reader',
    sqlserver: { auth: 'sql', encrypt: true, trustServerCertificate: false },
    secrets: { password: 'example-only' },
  },
  {
    name: 'Online store',
    type: 'mysql',
    host: 'shop-db.acme.local',
    port: 3306,
    database: 'shop',
    user: 'reader',
    tls: { mode: 'prefer' },
    secrets: { password: 'example-only' },
  },
]

fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(work, { recursive: true })
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
execFileSync('node', [path.join(here, 'seed-user.cjs'), email, 'Jordan Lee'], {
  cwd: webRoot,
  env: { ...process.env, DATABASE_URL: testDb },
  encoding: 'utf8',
})

const app = await launch({
  appDir: desktopDir,
  userData: profile,
  port: 9349,
  quiet: true,
  env: { NATUREQUERY_API_URL: site, NQ_OPEN_EXTERNAL_LOG: openedLog },
})
const $ = (js) => app.evaluate(js)
const until = (js, timeout) => app.waitFor(`!!(${js})`, timeout)
const click = (text, selector = 'button,[role=radio],[role=menuitem]') =>
  $(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.textContent.trim().startsWith(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
// Sidebar items start with the database icon's letters, so match anywhere in the text.
const clickContaining = (text) =>
  $(`(() => { const b = [...document.querySelectorAll('button')].find((el) => el.textContent.includes(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
const shoot = async (name) => {
  await sleep(900)
  await app.screenshot(path.join(out, name))
  console.log(`saved ${name}`)
}
const setEditor = async (text) => {
  await $(`(() => { const view = document.querySelector('.cm-content'); view.focus(); document.execCommand('selectAll') })()`)
  await app.type(text)
}

try {
  await app.session.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // Sign in through the browser flow.
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Sign in with your browser'))`, 20_000)
  await click('Sign in with your browser')
  for (let i = 0; i < 50 && !fs.existsSync(openedLog); i++) await sleep(200)
  const authorizeUrl = fs.readFileSync(openedLog, 'utf8').trim().split('\n').at(-1)
  await run(electronExe, [path.join(here, 'browser.cjs'), linkFile, work, authorizeUrl], {
    env: { ...childEnv(), NQ_E2E_EMAIL: email, NQ_E2E_BROWSER_PROFILE: path.join(work, 'browser') },
    timeout: 180_000,
  })
  const link = fs.readFileSync(linkFile, 'utf8').trim()
  await run(electronExe, [desktopDir, link], {
    env: { ...childEnv(), NATUREQUERY_USER_DATA: profile, NATUREQUERY_API_URL: site },
    timeout: 30_000,
  })
  await until(`document.body.innerText.includes('Jordan Lee')`, 30_000)
  await until(`document.querySelector('dialog[open]')`)
  await $(`document.querySelector('dialog[open] [aria-label=Close]')?.click()`)
  for (const example of EXAMPLES) {
    const saved = await $(`window.nq.connections.save(${JSON.stringify(example)})`)
    if (!saved?.ok) throw new Error(`Example connection ${example.name}: ${JSON.stringify(saved)}`)
  }
  // Summaries may use result rows, so they mention real values (Settings switch).
  await click('Settings')
  await until(`[...document.querySelectorAll('label')].some((l) => l.textContent.includes('Let AI summaries use result rows'))`)
  await $(`(() => { const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Let AI summaries use result rows')); document.getElementById(label.htmlFor).click() })()`)
  await sleep(500)

  // 1. A question in plain English, answered.
  await clickContaining('Acme Store')
  await until(`[...document.querySelectorAll('[role=radio]')].some((b) => b.textContent.trim() === 'Ask')`)
  await click('Ask')
  await until(`document.querySelector('textarea[aria-label=Question]')`)
  await $(`document.querySelector('textarea[aria-label=Question]').focus()`)
  await app.type('Which 5 customers spent the most?')
  await app.key('Enter')
  await until(`document.body.innerText.match(/5 rows ·/)`, 90_000)
  await shoot('1-ask-in-plain-english.png')

  // 3. What the query does.
  await click('Explain')
  await until(`document.body.innerText.includes('What this query does') && !document.body.innerText.includes('Reading the query')`, 90_000)
  await shoot('3-explain.png')
  await $(`[...document.querySelectorAll('button[aria-label=Close]')].forEach((b) => b.click())`)

  // 4. A summary of the result, with real values.
  await click('Summarize')
  await until(`document.body.innerText.includes('Summary') && !document.body.innerText.includes('Summarizing the result')`, 90_000)
  await shoot('4-summarize.png')
  await $(`[...document.querySelectorAll('button[aria-label=Close]')].forEach((b) => b.click())`)

  // 2. A chart of revenue over the last 12 months of the sample data.
  await click('SQL')
  await setEditor("SELECT month, revenue FROM monthly_revenue WHERE month >= '2025-10' ORDER BY month;")
  await click('Run')
  await until(`document.body.innerText.match(/12 rows ·/)`, 30_000)
  await click('Chart')
  await until(`document.querySelector('.recharts-wrapper')`)
  await click('Area')
  // The chart draws itself from left to right; wait for the whole line.
  await sleep(2500)
  await shoot('2-charts.png')
  await click('Table')

  // 5. The databases NatureQuery connects to.
  await $(`document.querySelector('button[aria-label="Add a connection"]').click()`)
  await until(`document.querySelector('dialog[open]')`)
  await shoot('5-connect-your-databases.png')
  await $(`document.querySelector('dialog[open] [aria-label=Close]')?.click()`)

  // 6. Home: connections and recent questions.
  await click('Home')
  await until(`document.body.innerText.includes('Your connections')`)
  await shoot('6-home.png')
} catch (error) {
  console.log(`FAILED: ${error.message}`)
  await app.screenshot(path.join(work, 'failure.png')).catch(() => {})
  process.exitCode = 1
} finally {
  await app.close()
}
