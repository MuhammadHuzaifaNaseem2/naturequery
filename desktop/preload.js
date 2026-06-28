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
    // Ad-hoc connection. creds = { host, port, database, user, password, dbType }
    // dbType is one of: postgresql, mysql, mariadb, sqlserver
    test: (creds) => ipcRenderer.invoke('db:test', creds),
    query: (creds, sql) => ipcRenderer.invoke('db:query', creds, sql),
    schema: (creds) => ipcRenderer.invoke('db:schema', creds),
  },

  // Saved local connections. Passwords stay in the main process — the UI only
  // ever works with a connection id and metadata.
  localdb: {
    list: () => ipcRenderer.invoke('localdb:list'),
    save: (conn) => ipcRenderer.invoke('localdb:save', conn),
    remove: (id) => ipcRenderer.invoke('localdb:remove', id),
    test: (id) => ipcRenderer.invoke('localdb:test', id),
    schema: (id) => ipcRenderer.invoke('localdb:schema', id),
    query: (id, sql) => ipcRenderer.invoke('localdb:query', id, sql),
  },
})
