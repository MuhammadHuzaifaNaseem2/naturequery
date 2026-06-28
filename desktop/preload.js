// Secure bridge between the UI and the local database engine.
//
// The renderer (web page) cannot use Node or talk to a database on its own.
// We expose ONLY these specific, safe functions on window.naturequery. This
// is the recommended Electron security model (context isolation).

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('naturequery', {
  isDesktop: true,
  platform: process.platform,
  db: {
    // Check a database is reachable. creds = { host, port, database, user, password }
    test: (creds) => ipcRenderer.invoke('db:test', creds),
    // Run a query against a local/internal database.
    query: (creds, sql) => ipcRenderer.invoke('db:query', creds, sql),
  },
})
