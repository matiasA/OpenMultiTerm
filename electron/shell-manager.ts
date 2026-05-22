import * as pty from 'node-pty'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface Profile {
  id: string
  name: string
  icon: string
  color: string
  command: string
  args: string[]
  cwd: string | null
  env: Record<string, string>
}

interface Session {
  id: string
  ptyProcess: pty.IPty
  profileId: string
}

const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'powershell',
    name: 'PowerShell',
    icon: 'Terminal',
    color: '#0078d4',
    command: 'powershell.exe',
    args: [],
    cwd: null,
    env: {},
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    icon: 'RectangleHorizontal',
    color: '#ffb900',
    command: 'cmd.exe',
    args: [],
    cwd: null,
    env: {},
  },
  {
    id: 'claude',
    name: 'Claude Code',
    icon: 'Sparkles',
    color: '#7c5cfc',
    command: 'cmd.exe',
    args: ['/k', 'claude'],
    cwd: null,
    env: {},
  },
  {
    id: 'wsl',
    name: 'WSL',
    icon: 'Monitor',
    color: '#18ffff',
    command: 'wsl.exe',
    args: [],
    cwd: null,
    env: {},
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    icon: 'GitBranch',
    color: '#f05033',
    command: 'C:\\Program Files\\Git\\bin\\bash.exe',
    args: ['--login'],
    cwd: null,
    env: {},
  },
]

export class ShellManager {
  private sessions: Map<string, Session> = new Map()
  private profiles: Profile[] = []
  private sessionCounter = 0
  private dataCallbacks: Array<(sessionId: string, data: string) => void> = []
  private exitCallbacks: Array<(sessionId: string, code: number) => void> = []
  private profilesPath: string
  private snapshotPath: string
  private layoutsPath: string

  constructor() {
    const userDataPath = app?.getPath('userData') || path.join(process.cwd(), '.nexus-data')
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    this.profilesPath = path.join(userDataPath, 'profiles.json')
    this.snapshotPath = path.join(userDataPath, 'snapshot.json')
    this.layoutsPath = path.join(userDataPath, 'layouts.json')
    this.loadProfiles()
  }

  private loadProfiles() {
    try {
      if (fs.existsSync(this.profilesPath)) {
        const data = fs.readFileSync(this.profilesPath, 'utf-8')
        this.profiles = JSON.parse(data)
      } else {
        this.profiles = [...DEFAULT_PROFILES]
        this.saveProfilesToDisk()
      }
    } catch {
      this.profiles = [...DEFAULT_PROFILES]
    }
  }

  private saveProfilesToDisk() {
    try {
      fs.writeFileSync(this.profilesPath, JSON.stringify(this.profiles, null, 2))
    } catch {}
  }

  getProfiles(): Profile[] {
    return this.profiles
  }

  saveProfile(profile: Profile) {
    const idx = this.profiles.findIndex((p) => p.id === profile.id)
    if (idx >= 0) {
      this.profiles[idx] = profile
    } else {
      this.profiles.push(profile)
    }
    this.saveProfilesToDisk()
    return this.profiles
  }

  deleteProfile(id: string) {
    this.profiles = this.profiles.filter((p) => p.id !== id)
    this.saveProfilesToDisk()
    return this.profiles
  }

  createSession(profileId: string, cols: number, rows: number): { sessionId: string } {
    const profile = this.profiles.find((p) => p.id === profileId)
    if (!profile) throw new Error(`Profile not found: ${profileId}`)

    const sessionId = `term_${++this.sessionCounter}_${Date.now()}`

    try {
      const shell = process.platform === 'win32' ? profile.command : (profile.command || process.env.SHELL || '/bin/bash')
      const args = profile.args || []

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: cols || 120,
        rows: rows || 40,
        cwd: profile.cwd || process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: { ...process.env, ...profile.env } as { [key: string]: string },
      })

      ptyProcess.onData((data: string) => {
        for (const cb of this.dataCallbacks) {
          cb(sessionId, data)
        }
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        for (const cb of this.exitCallbacks) {
          cb(sessionId, exitCode)
        }
        this.sessions.delete(sessionId)
      })

      this.sessions.set(sessionId, {
        id: sessionId,
        ptyProcess,
        profileId,
      })

      return { sessionId }
    } catch (err: any) {
      throw new Error(`Failed to spawn terminal: ${err.message}`)
    }
  }

  write(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId)
    if (session) session.ptyProcess.write(data)
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId)
    if (session) session.ptyProcess.resize(cols, rows)
  }

  destroy(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.ptyProcess.kill()
      this.sessions.delete(sessionId)
    }
  }

  destroyAll() {
    for (const [id] of this.sessions) {
      this.destroy(id)
    }
  }

  onData(callback: (sessionId: string, data: string) => void) {
    this.dataCallbacks.push(callback)
  }

  onExit(callback: (sessionId: string, code: number) => void) {
    this.exitCallbacks.push(callback)
  }

  getActiveCount(): number {
    return this.sessions.size
  }

  saveSnapshot(snapshot: any) {
    try {
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2))
    } catch {}
  }

  loadSnapshot(): any | null {
    try {
      if (fs.existsSync(this.snapshotPath)) {
        return JSON.parse(fs.readFileSync(this.snapshotPath, 'utf-8'))
      }
    } catch {}
    return null
  }

  clearSnapshot() {
    try { fs.unlinkSync(this.snapshotPath) } catch {}
  }

  saveLayouts(layouts: any[]) {
    try {
      fs.writeFileSync(this.layoutsPath, JSON.stringify(layouts, null, 2))
    } catch {}
  }

  loadLayouts(): any[] {
    try {
      if (fs.existsSync(this.layoutsPath)) {
        return JSON.parse(fs.readFileSync(this.layoutsPath, 'utf-8'))
      }
    } catch {}
    return []
  }
}
