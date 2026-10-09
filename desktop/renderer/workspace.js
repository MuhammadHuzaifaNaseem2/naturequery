'use strict'
const $ = (id) => document.getElementById(id)
const bridge = window.naturequery
const api = bridge?.localdb
const ports = { postgresql: 5432, mysql: 3306, mariadb: 3306, sqlserver: 1433 }
const themeKey = 'naturequery.desktop.theme'

function syncThemeButton() {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dim' : 'light'
  $('themeBtn').textContent = nextTheme === 'dim' ? 'Dim theme' : 'Light theme'
  $('themeBtn').setAttribute('aria-label', 'Switch to ' + nextTheme + ' theme')
}
let connections = [],
  selectedId = null,
  editingId = null,
  sampleIndex = 0,
  lastResult = null
let running = false,
  saving = false,
  generation = 0,
  toastTimer
const samples = [
  {
    name: 'Revenue over time',
    table: 'monthly_revenue',
    sql: 'SELECT month, revenue\nFROM monthly_revenue\nORDER BY month_number;',
    fields: ['month', 'revenue'],
    values: [
      ['January', 12450],
      ['February', 16200],
      ['March', 19800],
      ['April', 22300],
      ['May', 26400],
      ['June', 31280],
    ],
  },
  {
    name: 'Top customers',
    table: 'customers',
    sql: 'SELECT name, total_revenue\nFROM customers\nORDER BY total_revenue DESC\nLIMIT 6;',
    fields: ['name', 'total_revenue'],
    values: [
      ['Acme Studio', 24500],
      ['Orbit Goods', 18750],
      ['North & Co.', 15200],
      ['Layers', 11300],
      ['Clover', 9400],
      ['Forma', 7600],
    ],
  },
  {
    name: 'Best-selling products',
    table: 'products',
    sql: 'SELECT name, units_sold\nFROM products\nORDER BY units_sold DESC\nLIMIT 6;',
    fields: ['name', 'units_sold'],
    values: [
      ['Everyday Tote', 820],
      ['Steel Bottle', 640],
      ['Field Journal', 480],
      ['Studio Mug', 390],
      ['Travel Pouch', 286],
      ['Cotton Cap', 230],
    ],
  },
].map((sample) => ({
  ...sample,
  rows: sample.values.map((row) =>
    Object.fromEntries(sample.fields.map((field, i) => [field, row[i]]))
  ),
}))
function status(id, text, kind = '') {
  $(id).className = 'status ' + kind
  $(id).textContent = text
}
function toast(text) {
  clearTimeout(toastTimer)
  $('toast').textContent = text
  toastTimer = setTimeout(() => {
    $('toast').textContent = ''
  }, 6000)
}
function message(error) {
  return (
    error?.message?.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') ||
    'Something went wrong. Please try again.'
  )
}
function bind(id, action) {
  $(id).onclick = async () => {
    try {
      await action()
    } catch (error) {
      toast(message(error))
    }
  }
}
function show(view) {
  generation++
  $('welcomeView').hidden = view !== 'welcome'
  $('workView').hidden = view !== 'work'
  $('homeBtn').classList.toggle('selected', view === 'welcome')
  $('sampleBtn').classList.toggle('selected', view === 'work' && selectedId === 'sample')
  $('breadcrumb').textContent =
    view === 'welcome'
      ? 'Overview'
      : selectedId === 'sample'
        ? 'Sample workspace'
        : 'Local database'
}
function clearResults() {
  lastResult = null
  $('exportBtn').disabled = true
  $('resultTitle').textContent = 'Results'
  $('resultsArea').className = 'result-empty'
  $('resultsArea').textContent = 'Run a query to see your results here.'
  status('runStatus', '')
}
function renderList() {
  $('connList').replaceChildren()
  if (!connections.length) {
    const p = document.createElement('p')
    p.className = 'empty-list'
    p.textContent = 'Your saved databases will appear here.'
    $('connList').append(p)
  }
  for (const conn of connections) {
    const button = document.createElement('button')
    button.className = 'connection-item' + (conn.id === selectedId ? ' active' : '')
    button.setAttribute('aria-pressed', String(conn.id === selectedId))
    const icon = document.createElement('span')
    icon.className = 'db-icon'
    icon.textContent =
      conn.dbType === 'postgresql' ? 'PG' : conn.dbType === 'sqlserver' ? 'MS' : 'MY'
    const text = document.createElement('span'),
      name = document.createElement('strong'),
      sub = document.createElement('small')
    name.textContent = conn.name
    sub.textContent = conn.database
    text.append(name, sub)
    button.append(icon, text)
    button.onclick = () => selectConnection(conn.id)
    $('connList').append(button)
  }
}
async function refreshList() {
  connections = await api.list()
  if (!Array.isArray(connections)) throw new Error('Could not read saved connections.')
  renderList()
}
function renderSchema(tables) {
  $('schemaArea').replaceChildren()
  if (!tables.length) {
    $('schemaArea').textContent = 'No visible tables. Check this database account’s permissions.'
    return
  }
  for (const table of tables) {
    const detail = document.createElement('details'),
      name = document.createElement('summary')
    name.textContent = table.name
    detail.append(name)
    for (const col of table.columns || []) {
      const line = document.createElement('div')
      line.className = 'column'
      line.textContent = col.name + ' · ' + col.type
      detail.append(line)
    }
    $('schemaArea').append(detail)
  }
}
async function loadSchema() {
  const id = selectedId,
    request = generation
  if (!id || id === 'sample') return
  $('schemaArea').textContent = 'Loading tables…'
  $('loadSchemaBtn').disabled = true
  try {
    const result = await api.schema(id)
    if (request !== generation) return
    if (!result.ok) throw new Error(result.error)
    renderSchema(result.schema || [])
  } catch (error) {
    if (request === generation) $('schemaArea').textContent = message(error)
  } finally {
    $('loadSchemaBtn').disabled = false
  }
}
function selectConnection(id) {
  const conn = connections.find((c) => c.id === id)
  if (!conn) return
  selectedId = id
  show('work')
  $('workTitle').textContent = conn.name
  $('workSubtitle').textContent =
    conn.dbType + ' / ' + conn.host + ':' + conn.port + ' / ' + conn.database
  $('workEyebrow').textContent = 'ON THIS COMPUTER'
  $('connectionActions').hidden = false
  $('sampleTag').hidden = true
  $('sampleQuestions').hidden = true
  $('sql').readOnly = false
  $('sql').value = 'SELECT 1 AS connected;'
  $('loadSchemaBtn').hidden = false
  $('localHint').hidden = false
  $('queryHint').textContent =
    'Use a read-only database account. Results are limited to 1,000 rows.'
  clearResults()
  renderList()
  loadSchema()
}
function openSample(index = 0) {
  if (running) {
    toast('Wait for the current query to finish.')
    return
  }
  selectedId = 'sample'
  sampleIndex = index
  show('work')
  $('workTitle').textContent = 'The sample store'
  $('workSubtitle').textContent =
    'A guided look around. These example results are built into the app.'
  $('workEyebrow').textContent = 'ROOM TO EXPLORE'
  $('connectionActions').hidden = true
  $('sampleTag').hidden = false
  $('sampleQuestions').hidden = false
  $('sql').readOnly = true
  $('sql').value = samples[index].sql
  $('loadSchemaBtn').hidden = true
  $('localHint').hidden = true
  $('queryHint').textContent =
    'Sample preview: choose a preset above. Connect your database to write your own queries.'
  document
    .querySelectorAll('[data-sample]')
    .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sample) === index)))
  renderSchema(
    samples.map((s) => ({
      name: s.table,
      columns: s.fields.map((name, i) => ({ name, type: i ? 'numeric' : 'text' })),
    }))
  )
  clearResults()
  renderList()
  runQuery()
}
function openForm(conn) {
  editingId = conn?.id || null
  $('connectionForm').reset()
  for (const key of ['name', 'dbType', 'host', 'port', 'database', 'user', 'tls'])
    if (conn?.[key] !== undefined) $('f_' + key).value = conn[key]
  $('f_password').value = ''
  $('passwordHint').textContent = editingId
    ? 'Leave blank to keep the saved password.'
    : 'Encrypted using your operating system.'
  $('dialogTitle').textContent = editingId ? 'Edit your connection.' : 'Connect your database.'
  status('formStatus', '')
  $('connectionDialog').showModal()
  $('f_name').focus()
}
function closeForm() {
  if (saving) return
  $('f_password').value = ''
  $('connectionDialog').close()
}
$('connectionDialog').addEventListener('cancel', (e) => {
  if (saving) e.preventDefault()
})
$('connectionDialog').addEventListener('close', () => {
  $('f_password').value = ''
})
$('connectionForm').onsubmit = async (event) => {
  event.preventDefault()
  if (saving) return
  const conn = { id: editingId || undefined }
  for (const key of ['name', 'dbType', 'host', 'port', 'database', 'user', 'tls'])
    conn[key] = $('f_' + key).value.trim()
  conn.password = editingId && !$('f_password').value ? undefined : $('f_password').value
  saving = true
  for (const el of $('connectionForm').elements) el.disabled = true
  $('closeDialog').disabled = true
  status('formStatus', 'Testing the connection…')
  try {
    const test = await bridge.db.test(conn)
    if (!test.ok) throw new Error(test.error)
    status('formStatus', 'Connected. Saving encrypted credentials…', 'success')
    const saved = await api.save(conn)
    if (!saved.id) throw new Error(saved.error || 'Could not save the connection.')
    await refreshList()
    saving = false
    closeForm()
    selectConnection(saved.id)
    toast('Connection saved. Your workspace is ready.')
  } catch (error) {
    status('formStatus', message(error), 'error')
  } finally {
    saving = false
    for (const el of $('connectionForm').elements) el.disabled = false
    $('closeDialog').disabled = false
  }
}
$('f_dbType').onchange = () => {
  $('f_port').value = ports[$('f_dbType').value]
}
function renderResults(result) {
  lastResult = result
  $('exportBtn').disabled = !result.rows.length
  $('resultTitle').textContent = 'Results · ' + result.rows.length + ' rows'
  const container = $('resultsArea')
  container.replaceChildren()
  container.className = result.rows.length ? 'table-wrap' : 'result-empty'
  if (!result.rows.length) {
    container.textContent = 'The query completed successfully and returned no rows.'
    return
  }
  const table = document.createElement('table')
  table.className = 'results'
  table.setAttribute('aria-label', 'Query results')
  const head = document.createElement('thead'),
    headRow = document.createElement('tr'),
    body = document.createElement('tbody')
  for (const field of result.fields) {
    const cell = document.createElement('th')
    cell.scope = 'col'
    cell.textContent = field
    headRow.append(cell)
  }
  head.append(headRow)
  for (const row of result.rows) {
    const line = document.createElement('tr')
    for (const field of result.fields) {
      const cell = document.createElement('td')
      cell.textContent =
        row[field] == null
          ? 'NULL'
          : typeof row[field] === 'object'
            ? JSON.stringify(row[field])
            : String(row[field])
      if (row[field] == null) cell.className = 'null'
      line.append(cell)
    }
    body.append(line)
  }
  table.append(head, body)
  container.append(table)
}
async function runQuery() {
  if (running || !selectedId) return
  const id = selectedId,
    request = generation,
    started = performance.now()
  running = true
  $('runBtn').disabled = true
  $('workView').setAttribute('aria-busy', 'true')
  $('exportBtn').disabled = true
  status(
    'runStatus',
    id === 'sample' ? 'Loading sample results…' : 'Running query on your computer…'
  )
  try {
    const result =
      id === 'sample' ? { ok: true, ...samples[sampleIndex] } : await api.query(id, $('sql').value)
    if (request !== generation) return
    if (!result.ok) throw new Error(result.error)
    renderResults(result)
    status(
      'runStatus',
      (id === 'sample' ? 'Sample results' : 'Query complete') +
        ' · ' +
        result.rows.length +
        ' rows · ' +
        Math.round(performance.now() - started) +
        ' ms' +
        (result.truncated ? ' · Limited to 1,000 rows' : ''),
      'success'
    )
  } catch (error) {
    if (request === generation) {
      clearResults()
      status('runStatus', message(error), 'error')
    }
  } finally {
    running = false
    $('runBtn').disabled = false
    $('workView').removeAttribute('aria-busy')
  }
}
function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (typeof value !== 'number' && /^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
async function openAI() {
  toast('Opening the AI workspace. Internet access and sign-in are required.')
  await bridge.app.openWorkspace()
}
for (const id of ['addBtn', 'welcomeConnect', 'pathConnect']) bind(id, () => openForm())
for (const id of ['sampleBtn', 'welcomeSample']) bind(id, () => openSample())
for (const id of ['cloudBtn', 'pathCloud']) bind(id, openAI)
bind('themeBtn', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dim' : 'light'
  document.documentElement.dataset.theme = nextTheme
  try {
    localStorage.setItem(themeKey, nextTheme)
  } catch {
    // The current window still changes theme if storage is unavailable.
  }
  syncThemeButton()
})
bind('homeBtn', () => {
  selectedId = null
  show('welcome')
  renderList()
})
bind('helpBtn', () => bridge.app.help())
bind('updatesBtn', async () => {
  $('updatesBtn').disabled = true
  try {
    toast((await bridge.app.checkUpdates()).message)
  } finally {
    $('updatesBtn').disabled = false
  }
})
bind('editBtn', () => openForm(connections.find((c) => c.id === selectedId)))
bind('closeDialog', closeForm)
bind('cancelBtn', closeForm)
bind('loadSchemaBtn', loadSchema)
bind('runBtn', runQuery)
bind('testBtn', async () => {
  const request = generation
  $('testBtn').disabled = true
  try {
    const result = await api.test(selectedId)
    if (request !== generation) return
    if (!result.ok) throw new Error(result.error)
    toast('Connected successfully.')
  } finally {
    $('testBtn').disabled = false
  }
})
bind('removeBtn', async () => {
  const result = await api.remove(selectedId)
  if (!result.ok) throw new Error(result.error)
  if (result.canceled) return
  selectedId = null
  await refreshList()
  show('welcome')
  toast('Saved connection removed. Your database was not changed.')
})
bind('exportBtn', async () => {
  if (!lastResult) return
  const csv = [
    lastResult.fields.map(csvCell).join(','),
    ...lastResult.rows.map((row) =>
      lastResult.fields.map((field) => csvCell(row[field])).join(',')
    ),
  ].join('\r\n')
  const result = await bridge.app.exportCsv(csv)
  if (!result.ok) throw new Error(result.error)
  if (!result.canceled) toast('Results exported.')
})
document
  .querySelectorAll('[data-sample]')
  .forEach((b) => (b.onclick = () => openSample(Number(b.dataset.sample))))
document.addEventListener('keydown', (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === 'Enter' &&
    !$('workView').hidden &&
    !$('connectionDialog').open
  ) {
    e.preventDefault()
    runQuery()
  }
})
async function initialize() {
  syncThemeButton()
  if (!api) {
    status(
      'globalStatus',
      'Open this workspace in the NatureQuery desktop app to use local connections.',
      'error'
    )
    return
  }
  try {
    const info = await bridge.app.info()
    $('version').textContent = 'v' + info.version + (info.packaged ? '' : ' · Development')
    $('version').nextElementSibling.textContent =
      { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[info.platform] || info.platform
    await refreshList()
  } catch (error) {
    status('globalStatus', message(error), 'error')
  }
}
initialize()
