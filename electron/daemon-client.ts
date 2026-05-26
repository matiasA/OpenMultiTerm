import { WebSocket } from 'ws'
import { EVENTS, Request, Response, DaemonEvent } from '../daemon/protocol'

type EventCallback = (params: any) => void

export class DaemonClient {
  private ws: WebSocket | null = null
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>()
  private eventListeners = new Map<string, Set<EventCallback>>()
  private reqCounter = 0
  private reconnectDelay = 1000
  private destroyed = false
  private batchTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private batchedData = new Map<string, string>()

  constructor(private port: number, private token: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`)
      this.ws = ws

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token: this.token }))
      })

      ws.on('message', (raw) => {
        let msg: any
        try { msg = JSON.parse(raw.toString()) } catch { return }

        if (msg.type === 'auth') {
          if (msg.ok) {
            this.reconnectDelay = 1000
            resolve()
          } else {
            reject(new Error('Daemon auth failed'))
          }
          return
        }

        if (msg.type === 'response') {
          const pending = this.pendingRequests.get(msg.id)
          if (pending) {
            this.pendingRequests.delete(msg.id)
            if (msg.error) pending.reject(new Error(msg.error.message))
            else pending.resolve(msg.result)
          }
          return
        }

        if (msg.type === 'event') {
          this.dispatchEvent(msg as DaemonEvent)
        }
      })

      ws.on('close', () => {
        if (!this.destroyed) this.scheduleReconnect()
      })

      ws.on('error', (err) => {
        if (!this.destroyed) reject(err)
      })
    })
  }

  private dispatchEvent(msg: DaemonEvent) {
    // Batch terminal.data per sessionId to reduce IPC overhead
    if (msg.event === EVENTS.TERMINAL_DATA) {
      const { sessionId, data } = msg.params
      const existing = this.batchedData.get(sessionId) || ''
      this.batchedData.set(sessionId, existing + data)

      if (!this.batchTimers.has(sessionId)) {
        const timer = setTimeout(() => {
          this.batchTimers.delete(sessionId)
          const buffered = this.batchedData.get(sessionId) || ''
          this.batchedData.delete(sessionId)
          const listeners = this.eventListeners.get(EVENTS.TERMINAL_DATA)
          if (listeners) {
            for (const cb of listeners) cb({ sessionId, data: buffered })
          }
        }, 8) // coalesce within one animation frame (~8ms)
        this.batchTimers.set(sessionId, timer)
      }
      return
    }

    const listeners = this.eventListeners.get(msg.event)
    if (listeners) {
      for (const cb of listeners) cb(msg.params)
    }
  }

  private scheduleReconnect() {
    setTimeout(async () => {
      if (this.destroyed) return
      try {
        await this.connect()
      } catch {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000)
        this.scheduleReconnect()
      }
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000)
  }

  request<T = any>(method: string, params?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Daemon not connected'))
      }
      const id = `r${++this.reqCounter}`
      this.pendingRequests.set(id, { resolve, reject })
      const req: Request = { id, type: 'request', method, params }
      this.ws.send(JSON.stringify(req))
    })
  }

  on(event: string, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
    return () => this.eventListeners.get(event)?.delete(callback)
  }

  disconnect() {
    this.destroyed = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
