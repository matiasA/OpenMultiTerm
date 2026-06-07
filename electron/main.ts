// Type-only imports — erased at runtime
import type { BrowserWindow as BrowserWindowType } from 'electron'

// Static imports — vite processes these correctly into the bundle / externals
import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { ensureDaemon } from './daemon-launcher'
import { DaemonClient } from './daemon-client'
import { METHODS, EVENTS } from '../daemon/protocol'

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

// Electron/Chromium can emit noisy GPU/VSync warnings on Linux compositors.
// The app is terminal-focused, so software rendering is the more predictable path.
app.disableHardwareAcceleration()

// Daemon dispatch — runs before any Electron UI initialisation
if (process.argv.includes('--daemon')) {
  require('./daemon')
} else {
  startUI()
}

function startUI() {
  let mainWindow: BrowserWindowType | null = null
  let daemonClient: DaemonClient | null = null

  function createWindow() {
    const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 500,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#0a0a14',
      show: false,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    if (isDev) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
  }

  function registerIpcHandlers() {
    const dc = daemonClient
    // Helper — rejects with a clear error if daemon unavailable
    const req = (method: string, params?: any): Promise<any> =>
      dc ? dc.request(method, params) : Promise.reject(new Error('Daemon not available'))

    // Window controls — local, no daemon
    ipcMain.handle('window:minimize', () => mainWindow?.minimize())
    ipcMain.handle('window:maximize', () => {
      if (mainWindow?.isMaximized()) mainWindow.unmaximize()
      else mainWindow?.maximize()
      return mainWindow?.isMaximized()
    })
    ipcMain.handle('window:close', () => mainWindow?.close())
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())
    ipcMain.on('window:flash', () => mainWindow?.flashFrame(true))

    // Terminal — proxied to daemon
    ipcMain.handle('terminal:create', (_e, profileId: string, cols: number, rows: number, cwd?: string | null) =>
      req(METHODS.TERMINAL_CREATE, { profileId, cols, rows, cwd }))

    ipcMain.handle('terminal:getCwd', (_e, sessionId: string) =>
      req(METHODS.TERMINAL_GET_CWD, { sessionId }).then((r: any) => r?.cwd ?? null))

    ipcMain.on('terminal:write', (_e, sessionId: string, data: string) =>
      req(METHODS.TERMINAL_WRITE, { sessionId, data }).catch(() => {}))

    ipcMain.on('terminal:resize', (_e, sessionId: string, cols: number, rows: number) =>
      req(METHODS.TERMINAL_RESIZE, { sessionId, cols, rows }).catch(() => {}))

    ipcMain.on('terminal:destroy', (_e, sessionId: string) =>
      req(METHODS.TERMINAL_DESTROY, { sessionId }).catch(() => {}))

    ipcMain.handle('terminal:attach', (_e, sessionId: string) =>
      req(METHODS.TERMINAL_ATTACH, { sessionId }))

    ipcMain.handle('terminal:list', () =>
      req(METHODS.TERMINAL_LIST).then((r: any) => r?.sessions ?? []))

    // Forward daemon events to renderer
    if (dc) {
      dc.on(EVENTS.TERMINAL_DATA, ({ sessionId, data }: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', sessionId, data)
        }
      })

      dc.on(EVENTS.TERMINAL_EXIT, ({ sessionId, code }: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit', sessionId, code)
        }
      })
    }

    // Profiles
    ipcMain.handle('profiles:get', () => req(METHODS.PROFILES_GET))
    ipcMain.handle('profiles:save', (_e, profile: any) => {
      if (!profile || typeof profile !== 'object') throw new Error('Invalid profile')
      if (typeof profile.id !== 'string' || !profile.id.trim()) throw new Error('Invalid profile id')
      if (typeof profile.name !== 'string' || !profile.name.trim()) throw new Error('Invalid profile name')
      if (typeof profile.command !== 'string' || !profile.command.trim()) throw new Error('Invalid profile command')
      if (!Array.isArray(profile.args)) throw new Error('Invalid profile args')
      return req(METHODS.PROFILES_SAVE, profile)
    })
    ipcMain.handle('profiles:delete', (_e, id: string) => {
      if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid profile id')
      return req(METHODS.PROFILES_DELETE, { id })
    })
    ipcMain.handle('profiles:detectInstalled', () => req(METHODS.PROFILES_DETECT))

    // Snapshot
    ipcMain.handle('snapshot:save', (_e, snapshot: any) => req(METHODS.SNAPSHOT_SAVE, snapshot))
    ipcMain.handle('snapshot:load', () => req(METHODS.SNAPSHOT_LOAD))
    ipcMain.handle('snapshot:clear', () => req(METHODS.SNAPSHOT_CLEAR))

    // Layouts
    ipcMain.handle('layouts:save', (_e, layouts: any[]) => req(METHODS.LAYOUTS_SAVE, layouts))
    ipcMain.handle('layouts:load', () => req(METHODS.LAYOUTS_LOAD))

    // Folder picker dialog — stays local
    ipcMain.handle('dialog:selectFolder', async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
      })
      return result.canceled ? null : result.filePaths[0]
    })

    // Export — Electron dialog, stays local
    ipcMain.handle('export:save', async (_e, content: string, defaultName: string) => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: defaultName,
        filters: [
          { name: 'Log Files', extensions: ['log', 'txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8')
        return true
      }
      return false
    })

    // Notifications
    ipcMain.on('notification:show', (_e, title: string, body: string) => {
      if (Notification.isSupported()) new Notification({ title, body }).show()
    })

    // Agents — stateless execSync, stays local (no WS round-trip needed)
    ipcMain.handle('agents:detect', () => {
      const commands = ['claude', 'opencode', 'gh', 'gemini', 'hermes', 'clawbot', 'codex', 'agy', 'warp']
      const installed: string[] = []
      for (const cmd of commands) {
        try {
          const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
          execSync(check, { stdio: 'pipe', timeout: 2000 })
          installed.push(cmd)
        } catch {}
      }
      return installed
    })
    ipcMain.on('agents:openUrl', (_e, url: string) => shell.openExternal(url))

    // App
    ipcMain.handle('app:getVersion', () => app.getVersion())
    ipcMain.handle('app:getHomedir', () => os.homedir())

    // Auto-updater
    ipcMain.handle('updater:checkForUpdates', async () => {
      try { await autoUpdater.checkForUpdates() } catch {
        mainWindow?.webContents.send('updater:error')
      }
    })

    ipcMain.handle('updater:install', async () => {
      // Shut down daemon first so the installer can replace the binary
      try {
        await req(METHODS.DAEMON_SHUTDOWN, { reason: 'update' })
        await new Promise(r => setTimeout(r, 500))
      } catch {}
      autoUpdater.quitAndInstall()
    })
  }

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.openmultiterm.app')
    }

    try {
      const info = await ensureDaemon()
      daemonClient = new DaemonClient(info.port, info.token)
      await daemonClient.connect()
    } catch (err: any) {
      console.error('Failed to start daemon:', err.message)
      // UI will load but terminal features won't work
    }

    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    autoUpdater.on('checking-for-update', () => mainWindow?.webContents.send('updater:checking'))
    autoUpdater.on('update-available', () => mainWindow?.webContents.send('updater:available'))
    autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('updater:not-available'))
    autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('updater:downloaded'))
    // Background check errors are silent — user can't act on them; logged to console only.
    // Manual checks (updater:checkForUpdates IPC) send the error event themselves.
    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message)
    })

    if (!isDev) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10_000)
  })

  // Close window only — daemon keeps running with all sessions alive
  app.on('window-all-closed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:will-quit')
    }
    daemonClient?.disconnect()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    // Do NOT send daemon.shutdown — sessions must survive window close
    daemonClient?.disconnect()
  })
}
