import { app } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { WebSocket } from 'ws'

export interface DaemonInfo {
  port: number
  token: string
}

function statePath() {
  return path.join(app.getPath('userData'), 'daemon.json')
}

function lockPath() {
  return path.join(app.getPath('userData'), 'daemon.lock')
}

function readState(): DaemonInfo | null {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    const s = JSON.parse(raw)
    if (s.port && s.token) return { port: s.port, token: s.token }
  } catch {}
  return null
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function pingDaemon(port: number, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { ws.terminate(); resolve(false) }, 2000)
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })))
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'auth' && msg.ok) {
          clearTimeout(timer)
          ws.close()
          resolve(true)
        }
      } catch { resolve(false) }
    })
    ws.on('error', () => { clearTimeout(timer); resolve(false) })
  })
}

function spawnDaemon(): Promise<DaemonInfo> {
  return new Promise((resolve, reject) => {
    // Try to acquire spawn lock (O_EXCL — atomic)
    let lockAcquired = false
    try {
      const fd = fs.openSync(lockPath(), 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      lockAcquired = true
    } catch {
      // Another process holds the lock — wait for it to write daemon.json
    }

    if (lockAcquired) {
      // In dev (unpackaged), Electron needs the path to main.js explicitly.
      // In production the packaged exe loads main.js automatically.
      const baseArgs = app.isPackaged
        ? []
        : [path.join(__dirname, 'main.js')]

      const args = [
        ...baseArgs,
        '--daemon',
        // Force daemon to use the same userData path as the UI process.
        // Without this, in dev mode the raw electron binary defaults to
        // app.getName()="Electron" and writes daemon.json to %APPDATA%\Electron\.
        `--user-data-dir=${app.getPath('userData')}`,
        '--no-sandbox',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
      ]

      // Capture daemon output to a log file so crash messages are visible
      const spawnLog = path.join(app.getPath('userData'), 'daemon-spawn.log')
      let stdio: any = 'ignore'
      try {
        const fd = fs.openSync(spawnLog, 'a')
        stdio = ['ignore', fd, fd]
      } catch {}

      const child = spawn(process.execPath, args, {
        detached: true,
        stdio,
        windowsHide: true,
      })
      child.unref()
    }

    // Wait up to 12s for daemon.json to appear
    const deadline = Date.now() + 12000
    const poll = setInterval(() => {
      const state = readState()
      if (state) {
        clearInterval(poll)
        resolve(state)
      } else if (Date.now() > deadline) {
        clearInterval(poll)
        reject(new Error('Daemon did not start in time'))
      }
    }, 200)
  })
}

function isLockStale(): boolean {
  try {
    const stat = fs.statSync(lockPath())
    return (Date.now() - stat.mtimeMs) > 10_000 && !readState()
  } catch {
    return false
  }
}

export async function ensureDaemon(): Promise<DaemonInfo> {
  // Always clean stale lock first — previous crashed daemon may have left it
  if (isLockStale()) {
    try { fs.unlinkSync(lockPath()) } catch {}
  }

  // Check if a live daemon is already running
  const state = readState()
  if (state) {
    try {
      const raw = JSON.parse(fs.readFileSync(statePath(), 'utf-8'))
      if (isPidAlive(raw.pid) && await pingDaemon(state.port, state.token)) {
        return state
      }
    } catch {}
    // Stale state file — clean it
    try { fs.unlinkSync(statePath()) } catch {}
  }

  return spawnDaemon()
}
