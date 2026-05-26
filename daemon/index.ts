import { app } from 'electron'
import { WebSocketServer, WebSocket } from 'ws'
import { ShellManager } from './shell-manager'
import { initLogger, log } from './logger'
import { initState, generateToken, writeState, clearState, releaseSpawnLock } from './state'
import { METHODS, EVENTS, Request, Response, DaemonEvent } from './protocol'

// Daemon mode — no BrowserWindow created, Electron stays invisible.
// GPU flags are passed via CLI args by the launcher; nothing extra needed here.

const clients = new Set<WebSocket>()
let shellManager: ShellManager
let authToken: string

function send(ws: WebSocket, msg: Response | DaemonEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcast(msg: DaemonEvent) {
  for (const client of clients) {
    send(client, msg)
  }
}

function respond(ws: WebSocket, id: string, result?: any, error?: { code: number; message: string }) {
  send(ws, { id, type: 'response', result, error })
}

async function handleRequest(ws: WebSocket, req: Request) {
  const { id, method, params } = req
  try {
    switch (method) {
      case METHODS.TERMINAL_CREATE: {
        const { profileId, cols, rows, cwd } = params
        const result = shellManager.createSession(profileId, cols, rows, cwd)
        respond(ws, id, result)
        break
      }
      case METHODS.TERMINAL_WRITE: {
        shellManager.write(params.sessionId, params.data)
        respond(ws, id, null)
        break
      }
      case METHODS.TERMINAL_RESIZE: {
        shellManager.resize(params.sessionId, params.cols, params.rows)
        respond(ws, id, null)
        break
      }
      case METHODS.TERMINAL_DESTROY: {
        shellManager.destroy(params.sessionId)
        respond(ws, id, null)
        break
      }
      case METHODS.TERMINAL_GET_CWD: {
        const cwd = shellManager.getSessionCwd(params.sessionId)
        respond(ws, id, { cwd })
        break
      }
      case METHODS.TERMINAL_LIST: {
        respond(ws, id, { sessions: shellManager.listSessions() })
        break
      }
      case METHODS.TERMINAL_ATTACH: {
        const payload = shellManager.attachSession(params.sessionId)
        respond(ws, id, payload)
        break
      }
      case METHODS.PROFILES_GET: {
        respond(ws, id, shellManager.getProfiles())
        break
      }
      case METHODS.PROFILES_SAVE: {
        const profiles = shellManager.saveProfile(params)
        respond(ws, id, profiles)
        break
      }
      case METHODS.PROFILES_DELETE: {
        const profiles = shellManager.deleteProfile(params.id)
        respond(ws, id, profiles)
        break
      }
      case METHODS.PROFILES_DETECT: {
        respond(ws, id, shellManager.detectInstalledProfiles())
        break
      }
      case METHODS.SNAPSHOT_SAVE: {
        shellManager.saveSnapshot(params)
        respond(ws, id, null)
        break
      }
      case METHODS.SNAPSHOT_LOAD: {
        respond(ws, id, shellManager.loadSnapshot())
        break
      }
      case METHODS.SNAPSHOT_CLEAR: {
        shellManager.clearSnapshot()
        respond(ws, id, null)
        break
      }
      case METHODS.LAYOUTS_SAVE: {
        shellManager.saveLayouts(params)
        respond(ws, id, null)
        break
      }
      case METHODS.LAYOUTS_LOAD: {
        respond(ws, id, shellManager.loadLayouts())
        break
      }
      case METHODS.DAEMON_SHUTDOWN: {
        log.info('Shutdown requested, reason:', params?.reason)
        // Save snapshot before dying so the UI can restore layout on next launch
        const sessions = shellManager.listSessions()
        if (sessions.length > 0) {
          shellManager.saveSnapshot({ terminals: sessions, shutdownAt: new Date().toISOString() })
        }
        respond(ws, id, { ok: true })
        setTimeout(() => {
          shellManager.destroyAll()
          clearState()
          releaseSpawnLock()
          app.quit()
        }, 200)
        break
      }
      default:
        respond(ws, id, undefined, { code: -32601, message: `Method not found: ${method}` })
    }
  } catch (err: any) {
    log.error(`Error handling ${method}:`, err.message)
    respond(ws, id, undefined, { code: -1, message: err.message })
  }
}

function startDaemonServer(userDataPath: string) {
  shellManager = new ShellManager(userDataPath)

  shellManager.onData((sessionId, data) => {
    broadcast({ type: 'event', event: EVENTS.TERMINAL_DATA, params: { sessionId, data } })
  })

  shellManager.onExit((sessionId, code) => {
    broadcast({ type: 'event', event: EVENTS.TERMINAL_EXIT, params: { sessionId, code } })
  })

  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })

  wss.on('listening', () => {
    const addr = wss.address() as { port: number }
    authToken = generateToken()

    const state = {
      port: addr.port,
      pid: process.pid,
      token: authToken,
      version: app.getVersion(),
      startedAt: new Date().toISOString(),
    }
    writeState(state)
    releaseSpawnLock()

    log.info(`Daemon listening on 127.0.0.1:${addr.port} (pid ${process.pid})`)
  })

  wss.on('connection', (ws) => {
    let authenticated = false

    // First message must be auth
    ws.once('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'auth' && msg.token === authToken) {
          authenticated = true
          clients.add(ws)
          log.info(`Client connected (total: ${clients.size})`)
          ws.send(JSON.stringify({ type: 'auth', ok: true }))
        } else {
          log.warn('Client failed auth, closing')
          ws.close(4001, 'Unauthorized')
        }
      } catch {
        ws.close(4000, 'Bad message')
      }
    })

    ws.on('message', (raw) => {
      if (!authenticated) return
      let req: Request
      try {
        req = JSON.parse(raw.toString())
      } catch {
        return
      }
      // Check backpressure — skip terminal writes if buffer is too full
      if ((ws as any).bufferedAmount > 4 * 1024 * 1024) {
        log.warn('Client buffer full, dropping non-write request:', req.method)
        if (req.method !== METHODS.TERMINAL_WRITE) return
      }
      handleRequest(ws, req)
    })

    ws.on('close', () => {
      clients.delete(ws)
      log.info(`Client disconnected (total: ${clients.size})`)
    })

    ws.on('error', (err) => {
      log.error('WS client error:', err.message)
      clients.delete(ws)
    })
  })

  // Save snapshot periodically so it's fresh if daemon is killed hard
  setInterval(() => {
    const sessions = shellManager.listSessions()
    if (sessions.length > 0) {
      shellManager.saveSnapshot({ terminals: sessions, savedAt: new Date().toISOString() })
    }
  }, 30_000)
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  initLogger(userDataPath)
  initState(userDataPath)
  log.info('Daemon starting...')
  startDaemonServer(userDataPath)
})

app.on('window-all-closed', () => {
  // Daemon has no windows — prevent Electron default quit behavior
})
