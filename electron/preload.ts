import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  agents: {
    detect: () => Promise<string[]>
    openUrl: (url: string) => void
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<boolean>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    flash: () => void
  }
  terminal: {
    create: (profileId: string, cols: number, rows: number, cwd?: string | null) => Promise<{ sessionId: string }>
    getCwd: (sessionId: string) => Promise<string | null>
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    destroy: (sessionId: string) => void
    attach: (sessionId: string) => Promise<{ serialized: string; ring: string } | null>
    list: () => Promise<Array<{ sessionId: string; profileId: string }>>
    onData: (callback: (sessionId: string, data: string) => void) => () => void
    onExit: (callback: (sessionId: string, code: number) => void) => () => void
  }
  profiles: {
    get: () => Promise<any[]>
    save: (profile: any) => Promise<any[]>
    delete: (id: string) => Promise<any[]>
    detectInstalled: () => Promise<string[]>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
  }
  export: {
    save: (content: string, defaultName: string) => Promise<boolean>
  }
  notification: {
    show: (title: string, body: string) => void
  }
  snapshot: {
    save: (snapshot: any) => Promise<void>
    load: () => Promise<any | null>
    clear: () => Promise<void>
  }
  layouts: {
    save: (layouts: any[]) => Promise<void>
    load: () => Promise<any[]>
  }
  app: {
    onWillQuit: (callback: () => void) => () => void
    getVersion: () => Promise<string>
  }
  updater: {
    onChecking: (callback: () => void) => () => void
    onAvailable: (callback: () => void) => () => void
    onNotAvailable: (callback: () => void) => () => void
    onDownloaded: (callback: () => void) => () => void
    onError: (callback: () => void) => () => void
    checkForUpdates: () => Promise<void>
    install: () => Promise<void>
  }
}

const api: ElectronAPI = {
  agents: {
    detect: () => ipcRenderer.invoke('agents:detect'),
    openUrl: (url) => ipcRenderer.send('agents:openUrl', url),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    flash: () => ipcRenderer.send('window:flash'),
  },
  terminal: {
    create: (profileId, cols, rows, cwd) => ipcRenderer.invoke('terminal:create', profileId, cols, rows, cwd),
    getCwd: (sessionId) => ipcRenderer.invoke('terminal:getCwd', sessionId),
    write: (sessionId, data) => ipcRenderer.send('terminal:write', sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    destroy: (sessionId) => ipcRenderer.send('terminal:destroy', sessionId),
    attach: (sessionId) => ipcRenderer.invoke('terminal:attach', sessionId),
    list: () => ipcRenderer.invoke('terminal:list'),
    onData: (callback) => {
      const handler = (_event: any, sessionId: string, data: string) => callback(sessionId, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback) => {
      const handler = (_event: any, sessionId: string, code: number) => callback(sessionId, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
  profiles: {
    get: () => ipcRenderer.invoke('profiles:get'),
    save: (profile) => ipcRenderer.invoke('profiles:save', profile),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    detectInstalled: () => ipcRenderer.invoke('profiles:detectInstalled'),
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  export: {
    save: (content, defaultName) => ipcRenderer.invoke('export:save', content, defaultName),
  },
  notification: {
    show: (title, body) => ipcRenderer.send('notification:show', title, body),
  },
  snapshot: {
    save: (snapshot) => ipcRenderer.invoke('snapshot:save', snapshot),
    load: () => ipcRenderer.invoke('snapshot:load'),
    clear: () => ipcRenderer.invoke('snapshot:clear'),
  },
  layouts: {
    save: (layouts) => ipcRenderer.invoke('layouts:save', layouts),
    load: () => ipcRenderer.invoke('layouts:load'),
  },
  app: {
    onWillQuit: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('app:will-quit', handler)
      return () => ipcRenderer.removeListener('app:will-quit', handler)
    },
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  updater: {
    onChecking: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('updater:checking', handler)
      return () => ipcRenderer.removeListener('updater:checking', handler)
    },
    onAvailable: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('updater:available', handler)
      return () => ipcRenderer.removeListener('updater:available', handler)
    },
    onNotAvailable: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('updater:not-available', handler)
      return () => ipcRenderer.removeListener('updater:not-available', handler)
    },
    onDownloaded: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('updater:downloaded', handler)
      return () => ipcRenderer.removeListener('updater:downloaded', handler)
    },
    onError: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('updater:error', handler)
      return () => ipcRenderer.removeListener('updater:error', handler)
    },
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    install: () => ipcRenderer.invoke('updater:install'),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
