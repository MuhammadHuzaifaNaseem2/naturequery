// Exposes a narrow, typed API to the interface as window.nq. The interface
// has no Node.js access and can only make these specific requests.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENTS, IPC, type NqBridge } from '@shared/ipc'

function invoke(channel: string) {
  return (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
}

function listen<T>(channel: string) {
  return (listener: (payload: T) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: T) => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

const bridge: NqBridge = {
  platform: process.platform,
  app: {
    info: invoke(IPC.appInfo),
    openExternal: invoke(IPC.appOpenExternal),
    openLogs: invoke(IPC.appOpenLogs),
    setTheme: invoke(IPC.appSetTheme),
    sampleConnection: invoke(IPC.appSampleConnection),
    onMenuCommand: listen(EVENTS.menuCommand),
  },
  settings: {
    get: invoke(IPC.settingsGet),
    update: invoke(IPC.settingsUpdate),
  },
  connections: {
    list: invoke(IPC.connectionsList),
    save: invoke(IPC.connectionsSave),
    remove: invoke(IPC.connectionsRemove),
    duplicate: invoke(IPC.connectionsDuplicate),
    test: invoke(IPC.connectionsTest),
    pickFile: invoke(IPC.connectionsPickFile),
    onChanged: listen(EVENTS.connectionsChanged),
  },
  db: {
    schema: invoke(IPC.dbSchema),
    query: invoke(IPC.dbQuery),
    cancel: invoke(IPC.dbCancel),
  },
  history: {
    list: invoke(IPC.historyList),
    remove: invoke(IPC.historyRemove),
    clear: invoke(IPC.historyClear),
  },
  saved: {
    list: invoke(IPC.savedList),
    save: invoke(IPC.savedSave),
    remove: invoke(IPC.savedRemove),
  },
  files: {
    exportResult: invoke(IPC.filesExport),
  },
  clipboard: {
    write: invoke(IPC.clipboardWrite),
  },
  auth: {
    state: invoke(IPC.authState),
    signIn: invoke(IPC.authSignIn),
    submitCode: invoke(IPC.authSubmitCode),
    cancel: invoke(IPC.authCancel),
    signOut: invoke(IPC.authSignOut),
    openAccount: invoke(IPC.authOpenAccount),
    onChanged: listen(EVENTS.authChanged),
  },
  ai: {
    generate: invoke(IPC.aiGenerate),
    fix: invoke(IPC.aiFix),
    explain: invoke(IPC.aiExplain),
    insights: invoke(IPC.aiInsights),
  },
  updates: {
    status: invoke(IPC.updatesStatus),
    check: invoke(IPC.updatesCheck),
    download: invoke(IPC.updatesDownload),
    install: invoke(IPC.updatesInstall),
    onStatus: listen(EVENTS.updateStatus),
  },
} as NqBridge

contextBridge.exposeInMainWorld('nq', bridge)
