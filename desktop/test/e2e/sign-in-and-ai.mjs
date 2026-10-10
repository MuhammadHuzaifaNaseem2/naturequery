// End-to-end test: the desktop app, the website running locally and a
// throwaway database. Signs in through the browser flow, then asks real
// questions on the sample database. See README.md in this folder.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
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
const work = path.join(os.tmpdir(), 'nq-desktop-e2e')
const profile = path.join(work, 'profile')
const shots = path.join(work, 'shots')
const openedLog = path.join(work, 'opened.log')
const linkFile = path.join(work, 'link.txt')
const results = []

function step(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const childEnv = () => {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

// Runs a helper process without blocking this one, which serves the redirect below.
function run(command, args, { env, timeout }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    const timer = setTimeout(() => child.kill(), timeout)
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stdout, stderr })
    })
  })
}

const browserProfile = path.join(work, 'browser-profile')
const secondBrowserProfile = path.join(work, 'browser-profile-2')
for (const dir of [profile, browserProfile, secondBrowserProfile]) fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(shots, { recursive: true })
for (const file of [openedLog, linkFile]) fs.rmSync(file, { force: true })

// 1. Two test users in the throwaway database.
const seed = (...args) =>
  execFileSync('node', [path.join(here, 'seed-user.cjs'), ...args], {
    cwd: webRoot,
    env: { ...process.env, DATABASE_URL: testDb },
    encoding: 'utf8',
  }).trim()
const userId = seed()
const secondUserId = seed('desktop.e2e.second@example.com', 'Second Tester')
step('seed test users', !!userId && !!secondUserId)

// 2. Website ready.
let ready = false
for (let i = 0; i < 120 && !ready; i++) {
  try {
    ready = (await fetch(`${site}/login`)).ok
  } catch {}
  if (!ready) await sleep(1500)
}
step('local website responds', ready)
if (!ready) process.exit(1)

// The live site answers on naturequery.app with a redirect to www.naturequery.app.
// The app talks to a local stand-in for that redirect, so every request it makes
// crosses to another host the same way, sign-in token included.
const hop = { requests: 0, withToken: 0 }
const redirect = http.createServer((req, res) => {
  hop.requests++
  if (req.headers.authorization) hop.withToken++
  res.writeHead(307, { Location: `${site}${req.url}` })
  res.end()
})
await new Promise((resolve) => redirect.listen(0, '127.0.0.1', resolve))
const appSite = `http://127.0.0.1:${redirect.address().port}`

// 3. Desktop app with an isolated profile; sign-in pages are recorded, not opened.
const app = await launch({
  appDir: desktopDir,
  userData: profile,
  port: 9347,
  quiet: true,
  env: { NATUREQUERY_API_URL: appSite, NQ_OPEN_EXTERNAL_LOG: openedLog },
})
const $ = (js) => app.evaluate(js)
const clickButton = (text, scope = 'document') =>
  $(`(() => { const b = [...${scope}.querySelectorAll('button,[role=radio],[role=menuitem]')].find((el) => el.textContent.trim().startsWith(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
const clickContaining = (text) =>
  $(`(() => { const b = [...document.querySelectorAll('button')].find((el) => el.textContent.includes(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
const bodyText = () => $('document.body.innerText')
const until = (js, timeout) => app.waitFor(`!!(${js})`, timeout)
const workspaceHidden = () =>
  $(`!document.querySelector('[role=tablist]') && !document.querySelector('aside[aria-label=Navigation]')`)

/** Signs in the way a person does: browser page, Allow, then the app link. */
async function signInThroughBrowser(email, browserDir) {
  for (const file of [openedLog, linkFile]) fs.rmSync(file, { force: true })
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Sign in with your browser'))`, 15_000)
  await clickButton('Sign in with your browser')
  await until(`document.body.innerText.includes('Waiting for your browser')`)
  for (let i = 0; i < 50 && !fs.existsSync(openedLog); i++) await sleep(200)
  const authorizeUrl = fs.existsSync(openedLog) ? fs.readFileSync(openedLog, 'utf8').trim().split('\n').at(-1) : ''
  const browser = await run(electronExe, [path.join(here, 'browser.cjs'), linkFile, shots, authorizeUrl], {
    env: { ...childEnv(), NQ_E2E_EMAIL: email, NQ_E2E_BROWSER_PROFILE: browserDir },
    timeout: 180_000,
  })
  const link = fs.existsSync(linkFile) ? fs.readFileSync(linkFile, 'utf8').trim() : ''
  // The browser opens the link: Windows starts a second copy, which hands it over.
  const second = link
    ? await run(electronExe, [desktopDir, link], {
        env: { ...childEnv(), NATUREQUERY_USER_DATA: profile, NATUREQUERY_API_URL: appSite },
        timeout: 30_000,
      })
    : { status: null }
  return { authorizeUrl, browser, link, second }
}

try {
  // 4. The app opens on the sign-in screen, with nothing of the workspace.
  await until(`document.body.innerText.includes('Welcome to NatureQuery')`, 20_000)
  step('app opens on the sign-in screen', await workspaceHidden())
  await app.screenshot(path.join(shots, '01-sign-in-screen.png'))

  // 5. Sign in.
  const first = await signInThroughBrowser('desktop.e2e@example.com', browserProfile)
  step('desktop opens the approval page', first.authorizeUrl.startsWith(`${appSite}/desktop/authorize?challenge=`))
  console.log(first.browser.stdout.trim())
  step('browser login, approval and app link', first.link.startsWith('naturequery://auth?code=nqd_code_'), first.browser.stderr?.trim().slice(0, 300))
  step('second instance hands the link over and exits', first.second.status === 0, `exit ${first.second.status}`)
  await until(`document.body.innerText.includes('E2E Tester')`, 30_000)
  step('desktop shows the signed-in account', true)
  // The first sign-in on a computer shows how to get started.
  await until(`document.querySelector('dialog[open]')`)
  await app.screenshot(path.join(shots, '02-signed-in.png'))
  await $(`document.querySelector('dialog[open] [aria-label=Close]')?.click()`)
  await sleep(400)

  // 6. Ask a question on the sample database.
  await clickContaining('Acme Store')
  await until(`[...document.querySelectorAll('[role=radio]')].some((b) => b.textContent.trim() === 'Ask')`)
  await clickButton('Ask')
  await until(`document.querySelector('textarea[aria-label=Question]')`)
  await $(`document.querySelector('textarea[aria-label=Question]').focus()`)
  await app.type('Which 5 customers spent the most? Show their name and total spent.')
  await app.key('Enter')
  await until(`document.body.innerText.match(/\\d+ rows? ·/) || document.querySelector('[role=alert]')`, 90_000)
  const sql1 = await $(`document.querySelector('.cm-content')?.innerText`)
  const text1 = await bodyText()
  step('ask: generates SQL and runs it', /select/i.test(sql1) && /5 rows ·/.test(text1), sql1.replace(/\s+/g, ' ').slice(0, 160))
  const hiddenPx = await $(`(() => { const s = document.querySelector('.cm-scroller'); return s ? s.scrollHeight - s.clientHeight : -1 })()`)
  step('the whole generated query is visible', hiddenPx >= 0 && hiddenPx <= 2, `${hiddenPx}px hidden`)
  await app.screenshot(path.join(shots, '03-ask-result.png'))

  // Full-screen chart: the close button is clear of other controls and the title bar.
  await clickButton('Chart')
  await until(`document.querySelector('button[aria-label="Full screen"]')`)
  await $(`document.querySelector('button[aria-label="Full screen"]').click()`)
  await until(`document.querySelector('button[aria-label="Close full screen"]')`)
  await sleep(500)
  const closeButton = await $(`(() => {
    const close = document.querySelector('button[aria-label="Close full screen"]')
    const r = close.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { top: Math.round(r.top), onTop: hit?.closest('button') === close }
  })()`)
  step('full-screen chart has a clear close button', closeButton.onTop && closeButton.top >= 40, JSON.stringify(closeButton))
  await app.screenshot(path.join(shots, '03b-chart-full-screen.png'))
  await app.key('Escape')
  await until(`!document.querySelector('button[aria-label="Close full screen"]')`)
  step('Escape closes the full-screen chart', true)
  await clickButton('Table')

  // 7. Follow-up question.
  await $(`document.querySelector('textarea[aria-label=Question]').focus()`)
  await $(`(() => { const t = document.querySelector('textarea[aria-label=Question]'); t.select() })()`)
  await app.type('Only the top 3')
  await app.key('Enter')
  await until(`document.body.innerText.match(/3 rows ·/) || document.querySelector('[role=alert]')`, 90_000)
  step('follow-up refines the previous query', /3 rows ·/.test(await bodyText()), (await $(`document.querySelector('.cm-content')?.innerText`)).replace(/\s+/g, ' ').slice(0, 160))
  await app.screenshot(path.join(shots, '04-follow-up.png'))

  // 8. Explain and summarize.
  await clickButton('Explain')
  await until(`document.body.innerText.includes('What this query does') && !document.body.innerText.includes('Reading the query')`, 90_000)
  step('explain shows a plain-English explanation', (await bodyText()).includes('What this query does'))
  await clickButton('Summarize')
  await until(`document.body.innerText.includes('Summary') && !document.body.innerText.includes('Summarizing the result')`, 90_000)
  step('summarize shows a summary', /Based on the question and column names only/.test(await bodyText()))
  step('the summary is plain text, not raw JSON', !/\{\s*"summary"|"highlights"\s*:/.test(await bodyText()))
  await app.screenshot(path.join(shots, '05-explain-summary.png'))

  // 9. Fix a broken query with AI.
  await clickButton('SQL')
  await $(`(() => { const view = document.querySelector('.cm-content'); view.focus(); document.execCommand('selectAll'); })()`)
  await app.type('SELECT nme, emial FROM customers LIMIT 5')
  await clickButton('Run')
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Fix with AI'))`, 30_000)
  await app.screenshot(path.join(shots, '06-error.png'))
  await clickButton('Fix with AI')
  await until(`document.body.innerText.match(/\\d+ rows? ·/) || document.body.innerText.includes('could not')`, 90_000)
  const fixed = await $(`document.querySelector('.cm-content')?.innerText`)
  step('fix with AI corrects and reruns the query', /5 rows ·/.test(await bodyText()) && !/nme|emial/.test(fixed), fixed.replace(/\s+/g, ' ').slice(0, 160))
  step('undo is offered after an AI fix', (await bodyText()).includes('Undo AI fix'))
  await app.screenshot(path.join(shots, '07-fixed.png'))

  // 10. Requests to change data are declined.
  await clickButton('Ask')
  await $(`(() => { const t = document.querySelector('textarea[aria-label=Question]'); t.focus(); t.select() })()`)
  await clickButton('New question')
  await $(`document.querySelector('textarea[aria-label=Question]').focus()`)
  await app.type('Delete all customers who never ordered')
  await app.key('Enter')
  await until(`!document.body.innerText.includes('Thinking…')`, 90_000)
  await sleep(300)
  const declined = await bodyText()
  step('requests to change data are declined', /read|cannot|not allowed|only|declin/i.test(declined) && !/rows ·.*deleted/i.test(declined))
  await app.screenshot(path.join(shots, '08-declined.png'))

  // 11. Session visible on the server, then sign out revokes it.
  const before = execFileSync('docker', ['exec', 'nq-web-db', 'psql', '-U', 'postgres', '-d', 'naturequery_test', '-tAc',
    `select count(*) from "DesktopSession" where "userId"='${userId}' and "revokedAt" is null`], { encoding: 'utf8' }).trim()
  step('server has one active desktop session', before === '1', before)
  const usage = execFileSync('docker', ['exec', 'nq-web-db', 'psql', '-U', 'postgres', '-d', 'naturequery_test', '-tAc',
    `select count(*) from "UsageRecord" where "userId"='${userId}' and action='QUERY'`], { encoding: 'utf8' }).trim()
  step('only generated queries count toward the plan', usage === '2', `${usage} recorded`)

  // Sign out with a real mouse click, so a menu cut off by the window edge fails.
  await $(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('E2E Tester')).click()`)
  await sleep(300)
  const signOutItem = await $(`(() => {
    const item = [...document.querySelectorAll('[role=menuitem]')].find((el) => el.textContent.includes('Sign out'))
    if (!item) return null
    const r = item.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const inside = r.top >= 0 && r.bottom <= innerHeight
    return { x, y, inside, onTop: document.elementFromPoint(x, y)?.closest('[role=menuitem]') === item }
  })()`)
  step('account menu shows "Sign out" inside the window', !!signOutItem?.inside && !!signOutItem?.onTop, JSON.stringify(signOutItem))
  await app.screenshot(path.join(shots, '09-account-menu.png'))
  if (!signOutItem) throw new Error('The account menu has no "Sign out" item')
  await app.mouseClick(signOutItem.x, signOutItem.y)
  await until(`document.body.innerText.includes('Welcome to NatureQuery')`, 15_000)
  step(
    'sign-out closes the workspace and shows the sign-in screen',
    (await workspaceHidden()) && !(await bodyText()).includes('E2E Tester')
  )
  await app.screenshot(path.join(shots, '10-signed-out.png'))
  // The dev server compiles each route on first use, so allow a few seconds.
  let after = ''
  for (let i = 0; i < 30 && after !== '0'; i++) {
    await sleep(500)
    after = execFileSync('docker', ['exec', 'nq-web-db', 'psql', '-U', 'postgres', '-d', 'naturequery_test', '-tAc',
      `select count(*) from "DesktopSession" where "userId"='${userId}' and "revokedAt" is null`], { encoding: 'utf8' }).trim()
  }
  step('sign out revokes the server session', after === '0', after)
  step('account file removed on sign out', !fs.existsSync(path.join(profile, 'account.json')))
  step(
    'signed-in requests work through a redirect to another host',
    hop.withToken >= 6,
    `${hop.withToken} of ${hop.requests} redirected requests carried the sign-in token`
  )

  // 12. A second account on the same computer sees only its own workspace.
  const other = await signInThroughBrowser('desktop.e2e.second@example.com', secondBrowserProfile)
  await until(`document.body.innerText.includes('Second Tester')`, 30_000)
  await sleep(800)
  const secondView = await bodyText()
  // No open tabs, and none of the first account's queries in the recent history.
  step(
    "a second account does not see the first account's work",
    other.link.startsWith('naturequery://') &&
      !(await $(`!!document.querySelector('[role=tablist]')`)) &&
      !secondView.includes('total_spent'),
    other.browser.stderr?.trim().slice(0, 200)
  )
  await app.screenshot(path.join(shots, '11-second-account.png'))
  await $(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Second Tester')).click()`)
  await sleep(300)
  await clickButton('Sign out')
  await until(`document.body.innerText.includes('Welcome to NatureQuery')`, 15_000)

  // 13. Signing in again brings back the first account's tabs.
  const again = await signInThroughBrowser('desktop.e2e@example.com', browserProfile)
  await until(`document.body.innerText.includes('E2E Tester')`, 30_000)
  await sleep(800)
  step(
    "signing in again brings back the account's tabs",
    again.link.startsWith('naturequery://') &&
      (await $(`[...document.querySelectorAll('[role=tab]')].some((tab) => tab.textContent.includes('Acme Store'))`)),
    again.browser.stdout.trim().split('\n').at(-1)
  )
  await app.screenshot(path.join(shots, '12-signed-in-again.png'))

  const problems = app.consoleMessages.filter((m) => /^(error|EXCEPTION)/.test(m))
  step('no console errors in the app', problems.length === 0, problems.slice(0, 3).join(' | '))
} catch (error) {
  step('unexpected failure', false, error.message)
  await app.screenshot(path.join(shots, 'zz-failure.png')).catch(() => {})
} finally {
  await app.close()
  redirect.closeAllConnections()
  redirect.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
