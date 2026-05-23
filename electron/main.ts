import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { ShellManager } from './shell-manager'

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

let mainWindow: BrowserWindow | null = null
const shellManager = new ShellManager()

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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
    return mainWindow?.isMaximized()
  })
  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  ipcMain.handle('terminal:create', (_event, profileId: string, cols: number, rows: number) => {
    return shellManager.createSession(profileId, cols, rows)
  })

  ipcMain.on('terminal:write', (_event, sessionId: string, data: string) => {
    shellManager.write(sessionId, data)
  })

  ipcMain.on('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
    shellManager.resize(sessionId, cols, rows)
  })

  ipcMain.on('terminal:destroy', (_event, sessionId: string) => {
    shellManager.destroy(sessionId)
  })

  shellManager.onData((sessionId, data) => {
    mainWindow?.webContents.send('terminal:data', sessionId, data)
  })

  shellManager.onExit((sessionId, code) => {
    mainWindow?.webContents.send('terminal:exit', sessionId, code)
  })

  ipcMain.handle('profiles:get', () => shellManager.getProfiles())
  ipcMain.handle('profiles:save', (_event, profile: any) => {
    if (!profile || typeof profile !== 'object') throw new Error('Invalid profile')
    if (typeof profile.id !== 'string' || !profile.id.trim()) throw new Error('Invalid profile id')
    if (typeof profile.name !== 'string' || !profile.name.trim()) throw new Error('Invalid profile name')
    if (typeof profile.command !== 'string' || !profile.command.trim()) throw new Error('Invalid profile command')
    if (!Array.isArray(profile.args)) throw new Error('Invalid profile args')
    return shellManager.saveProfile(profile)
  })
  ipcMain.handle('profiles:delete', (_event, id: string) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid profile id')
    return shellManager.deleteProfile(id)
  })

  ipcMain.handle('export:save', async (_event, content: string, defaultName: string) => {
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

  ipcMain.on('notification:show', (_event, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })

  ipcMain.handle('snapshot:save', (_event, snapshot: any) => {
    shellManager.saveSnapshot(snapshot)
  })

  ipcMain.handle('snapshot:load', () => {
    return shellManager.loadSnapshot()
  })

  ipcMain.handle('snapshot:clear', () => {
    shellManager.clearSnapshot()
  })

  ipcMain.handle('layouts:save', (_event, layouts: any[]) => {
    shellManager.saveLayouts(layouts)
  })

  ipcMain.handle('layouts:load', () => {
    return shellManager.loadLayouts()
  })

  ipcMain.on('window:flash', () => {
    mainWindow?.flashFrame(true)
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('agents:detect', () => {
    const commands = ['claude', 'opencode', 'gh', 'gemini', 'hermes', 'clawbot', 'codex']
    const installed: string[] = []
    for (const cmd of commands) {
      try {
        const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
        execSync(check, { stdio: 'pipe', timeout: 2000 })
        installed.push(cmd)
      } catch { /* not found */ }
    }
    return installed
  })

  ipcMain.on('agents:openUrl', (_event, url: string) => {
    shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.openmultiterm.app')
  }
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!isDev) {
    autoUpdater.checkForUpdates()

    autoUpdater.on('update-available', () => {
      mainWindow?.webContents.send('updater:available')
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('updater:downloaded')
    })

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message)
    })
  }
})

app.on('window-all-closed', () => {
  shellManager.destroyAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:will-quit')
    try {
      const snapshot = shellManager.loadSnapshot()
      if (!snapshot || !snapshot.terminals) {
        shellManager.clearSnapshot()
      }
    } catch {}
  }
  shellManager.destroyAll()
})
