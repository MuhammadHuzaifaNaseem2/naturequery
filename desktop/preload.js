// Secure bridge between the UI and the local database engine.
//
// The renderer (web page) cannot use Node or talk to a database on its own.
// We expose ONLY these specific, safe functions on window.naturequery. This
// is the recommended Electron security model (context isolation).

const { contextBridge, ipcRenderer, webFrame } = require('electron')

// Run before page scripts/first paint, not did-finish-load. The hosted server
// still renders the browser auth layout; waiting for load flashes that layout.
try {
  const prefix = '--naturequery-auth-presentation='
  const argument = process.argv.find((value) => value.startsWith(prefix))
  if (argument) {
    const presentation = JSON.parse(Buffer.from(argument.slice(prefix.length), 'base64').toString('utf8'))
    if (presentation.origins.includes(location.origin)) {
      // All rules target auth markup so client-side auth navigation is covered
      // too, without recoloring the dashboard or overriding its saved theme.
      webFrame.insertCSS(presentation.css)
    }
  }
} catch {
  // A missing compatibility style must not prevent sign-in or the IPC bridge.
}

// The hosted workspace has its own theme preference. Only supply a default;
// the user's later choice in Settings must always win.
try {
  if (
    ['https://naturequery.app', 'https://www.naturequery.app'].includes(location.origin) &&
    !localStorage.getItem('theme')
  ) {
    localStorage.setItem('theme', 'dim')
  }
} catch {
  // Local file pages and restricted storage do not need the hosted preference.
}

contextBridge.exposeInMainWorld('naturequery', {
  isDesktop: true,
  platform: process.platform,
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openWorkspace: () => ipcRenderer.invoke('app:open-workspace'),
    home: () => ipcRenderer.invoke('app:home'),
    checkUpdates: () => ipcRenderer.invoke('app:updates'),
    help: () => ipcRenderer.invoke('app:help'),
    exportCsv: (csv) => ipcRenderer.invoke('app:export-csv', csv),
  },
  db: {
    // Ad-hoc connection. creds = { host, port, database, user, password, dbType }
    // dbType is one of: postgresql, mysql, mariadb, sqlserver
    test: (creds) => ipcRenderer.invoke('db:test', creds),
  },

  // Saved local connections. Passwords stay in the main process — the UI only
  // ever works with a connection id and metadata.
  localdb: {
    openManager: () => ipcRenderer.invoke('localdb:open-manager'),
    list: () => ipcRenderer.invoke('localdb:list'),
    save: (conn) => ipcRenderer.invoke('localdb:save', conn),
    remove: (id) => ipcRenderer.invoke('localdb:remove', id),
    test: (id) => ipcRenderer.invoke('localdb:test', id),
    schema: (id) => ipcRenderer.invoke('localdb:schema', id),
    query: (id, sql) => ipcRenderer.invoke('localdb:query', id, sql),
  },
})
