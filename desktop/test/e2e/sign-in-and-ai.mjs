// End-to-end test: the desktop app, the website running locally and a
// throwaway database. Signs in through the browser flow, then asks real
// questions on the sample database. See README.md in this folder.
import { execFileSync, spawnSync } from 'node:child_process'
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

for (const dir of [profile, path.join(work, 'browser-profile')]) fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(shots, { recursive: true })
for (const file of [openedLog, linkFile]) fs.rmSync(file, { force: true })

// 1. Test user in the throwaway database.
const userId = execFileSync('node', [path.join(here, 'seed-user.cjs')], {
  cwd: webRoot,
  env: { ...process.env, DATABASE_URL: testDb },
  encoding: 'utf8',
}).trim()
step('seed test user', !!userId)

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

// 3. Desktop app with an isolated profile; sign-in pages are recorded, not opened.
const app = await launch({
  appDir: desktopDir,
  userData: profile,
  port: 9347,
  quiet: true,
  env: { NATUREQUERY_API_URL: site, NQ_OPEN_EXTERNAL_LOG: openedLog },
})
const $ = (js) => app.evaluate(js)
const clickButton = (text, scope = 'document') =>
  $(`(() => { const b = [...${scope}.querySelectorAll('button,[role=radio],[role=menuitem]')].find((el) => el.textContent.trim().startsWith(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
const clickContaining = (text) =>
  $(`(() => { const b = [...document.querySelectorAll('button')].find((el) => el.textContent.includes(${JSON.stringify(text)}) && !el.disabled); if (!b) return false; b.click(); return true })()`)
const bodyText = () => $('document.body.innerText')
const until = (js, timeout) => app.waitFor(`!!(${js})`, timeout)

try {
  await until(`document.querySelector('dialog[open]')`)
  await $(`document.querySelector('dialog[open] [aria-label=Close]')?.click()`)
  await sleep(400)

  // 4. Sign in.
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Sign in for AI'))`)
  await clickButton('Sign in for AI')
  await until(`document.querySelector('dialog[open]')?.innerText.includes('Waiting for your browser')`)
  await app.screenshot(path.join(shots, '01-sign-in-dialog.png'))
  for (let i = 0; i < 50 && !fs.existsSync(openedLog); i++) await sleep(200)
  const authorizeUrl = fs.readFileSync(openedLog, 'utf8').trim().split('\n').at(-1)
  step('desktop opens the approval page', authorizeUrl.startsWith(`${site}/desktop/authorize?challenge=`))

  const browser = spawnSync(electronExe, [path.join(here, 'browser.cjs'), linkFile, shots, authorizeUrl], {
    env: childEnv(),
    encoding: 'utf8',
    timeout: 180_000,
  })
  console.log(browser.stdout.trim())
  const link = fs.existsSync(linkFile) ? fs.readFileSync(linkFile, 'utf8').trim() : ''
  step('browser login, approval and app link', link.startsWith('naturequery://auth?code=nqd_code_'), browser.stderr?.trim().slice(0, 300))

  // 5. The browser opens the link: Windows starts a second copy, which hands it over.
  const second = spawnSync(electronExe, [desktopDir, link], {
    env: { ...childEnv(), NATUREQUERY_USER_DATA: profile, NATUREQUERY_API_URL: site },
    timeout: 30_000,
  })
  step('second instance hands the link over and exits', second.status === 0, `exit ${second.status}`)
  await until(`document.body.innerText.includes('E2E Tester')`, 30_000)
  await sleep(600)
  step('desktop shows the signed-in account', true)
  await app.screenshot(path.join(shots, '02-signed-in.png'))

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
  await app.screenshot(path.join(shots, '03-ask-result.png'))

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

  await $(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('E2E Tester')).click()`)
  await sleep(300)
  await clickButton('Sign out')
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Sign in for AI'))`, 15_000)
  // The dev server compiles each route on first use, so allow a few seconds.
  let after = ''
  for (let i = 0; i < 30 && after !== '0'; i++) {
    await sleep(500)
    after = execFileSync('docker', ['exec', 'nq-web-db', 'psql', '-U', 'postgres', '-d', 'naturequery_test', '-tAc',
      `select count(*) from "DesktopSession" where "userId"='${userId}' and "revokedAt" is null`], { encoding: 'utf8' }).trim()
  }
  step('sign out revokes the server session', after === '0', after)
  step('account file removed on sign out', !fs.existsSync(path.join(profile, 'account.json')))

  const problems = app.consoleMessages.filter((m) => /^(error|EXCEPTION)/.test(m))
  step('no console errors in the app', problems.length === 0, problems.slice(0, 3).join(' | '))
} catch (error) {
  step('unexpected failure', false, error.message)
  await app.screenshot(path.join(shots, 'zz-failure.png')).catch(() => {})
} finally {
  await app.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
