import { RingBuffer } from './ring-buffer'

interface SnapshotState {
  serialized: string // output of SerializeAddon.serialize()
  ring: string       // raw ring buffer data captured after last snapshot
}

/**
 * Per-session state tracker that keeps a headless xterm.js terminal in sync
 * with PTY output, so we can serialize a full SGR-correct snapshot on reconnect.
 * Falls back to raw ring buffer only if headless xterm is unavailable.
 */
export class SessionSnapshot {
  private ring = new RingBuffer()
  private headlessTerm: any = null
  private serializeAddon: any = null
  private available = false

  constructor(cols: number, rows: number) {
    this.tryInitHeadless(cols, rows)
  }

  private tryInitHeadless(cols: number, rows: number) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Terminal } = require('@xterm/headless')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SerializeAddon } = require('@xterm/addon-serialize')
      this.headlessTerm = new Terminal({ cols, rows, allowProposedApi: true })
      this.serializeAddon = new SerializeAddon()
      this.headlessTerm.loadAddon(this.serializeAddon)
      this.available = true
    } catch {
      // xterm/headless not available — fall back to ring buffer only
      this.available = false
    }
  }

  write(data: string) {
    this.ring.append(data)
    if (this.available && this.headlessTerm) {
      this.headlessTerm.write(data)
    }
  }

  resize(cols: number, rows: number) {
    if (this.available && this.headlessTerm) {
      try { this.headlessTerm.resize(cols, rows) } catch {}
    }
  }

  getAttachPayload(): SnapshotState {
    if (this.available && this.serializeAddon) {
      try {
        const serialized = this.serializeAddon.serialize()
        return { serialized, ring: '' }
      } catch {}
    }
    // fallback: send raw ring buffer
    return { serialized: '', ring: this.ring.getAll() }
  }

  dispose() {
    if (this.headlessTerm) {
      try { this.headlessTerm.dispose() } catch {}
      this.headlessTerm = null
      this.serializeAddon = null
    }
    this.ring.clear()
  }
}
