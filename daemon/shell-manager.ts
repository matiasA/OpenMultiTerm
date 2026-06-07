import * as pty from 'node-pty'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { SessionSnapshot } from './session-snapshot'
import { log } from './logger'

export interface Profile {
  id: string
  name: string
  icon: string
  color: string
  command: string
  args: string[]
  cwd: string | null
  env: Record<string, string>
  detectCommand?: string
  launchCommand?: string
}

interface Session {
  id: string
  ptyProcess: pty.IPty
  profileId: string
  snapshot: SessionSnapshot
  cwd: string
}

function findGitBash(): string {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
    `${process.env.USERPROFILE}\\scoop\\apps\\git\\current\\bin\\bash.exe`,
  ]
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  return 'bash'
}

function findPwsh(): string {
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Microsoft\\WindowsApps\\pwsh.exe` : '',
  ]
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p } catch {}
  }
  try {
    execSync('where pwsh', { stdio: 'pipe', timeout: 1500 })
    return 'pwsh'
  } catch {}
  return 'powershell.exe'
}

function findUnixShell(): string {
  const candidates = [
    process.env.SHELL || '',
    '/bin/bash',
    '/usr/bin/bash',
    '/bin/zsh',
    '/usr/bin/zsh',
    '/bin/sh',
  ]
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p } catch {}
  }
  return 'sh'
}

function shellArgs(command: string): string[] {
  return command.includes('bash') || command.includes('zsh') ? ['-l'] : []
}

const defaultShell = process.platform === 'win32' ? findPwsh() : findUnixShell()
const defaultShellArgs = process.platform === 'win32' ? ['-NoLogo'] : shellArgs(defaultShell)
const agentShell = process.platform === 'win32' ? 'powershell.exe' : defaultShell
const agentShellArgs = process.platform === 'win32' ? [] : defaultShellArgs

const DEFAULT_PROFILES: Profile[] = [
  { id: 'nexus', name: 'Nexus Shell', icon: 'Zap', color: '#a78bfa', command: defaultShell, args: defaultShellArgs, cwd: null, env: {} },
  { id: 'powershell', name: 'PowerShell', icon: 'Terminal', color: '#0078d4', command: 'powershell.exe', args: [], cwd: null, env: {} },
  { id: 'cmd', name: 'Command Prompt', icon: 'RectangleHorizontal', color: '#ffb900', command: 'cmd.exe', args: [], cwd: null, env: {} },
  { id: 'wsl', name: 'WSL', icon: 'Monitor', color: '#18ffff', command: 'wsl.exe', args: [], cwd: null, env: {} },
  { id: 'git-bash', name: 'Git Bash', icon: 'GitBranch', color: '#f05033', command: findGitBash(), args: ['--login'], cwd: null, env: {} },
  { id: 'claude',      name: 'Claude Code', icon: 'Bot', color: '#CC785C', command: agentShell, args: agentShellArgs, detectCommand: 'claude',   launchCommand: 'claude',     cwd: null, env: {} },
  { id: 'opencode',    name: 'OpenCode',    icon: 'Bot', color: '#7c5cfc', command: agentShell, args: agentShellArgs, detectCommand: 'opencode', launchCommand: 'opencode',   cwd: null, env: {} },
  { id: 'gh',          name: 'Copilot CLI', icon: 'Bot', color: '#6e40c9', command: agentShell, args: agentShellArgs, detectCommand: 'gh',       launchCommand: 'gh copilot', cwd: null, env: {} },
  { id: 'gemini',      name: 'Gemini CLI',  icon: 'Bot', color: '#4285F4', command: agentShell, args: agentShellArgs, detectCommand: 'gemini',   launchCommand: 'gemini',     cwd: null, env: {} },
  { id: 'hermes',      name: 'Hermes',      icon: 'Bot', color: '#FF6B35', command: agentShell, args: agentShellArgs, detectCommand: 'hermes',   launchCommand: 'hermes',     cwd: null, env: {} },
  { id: 'clawbot',     name: 'OpenClaw',    icon: 'Bot', color: '#E63946', command: agentShell, args: agentShellArgs, detectCommand: 'clawbot',  launchCommand: 'clawbot',    cwd: null, env: {} },
  { id: 'codex',       name: 'Codex CLI',   icon: 'Bot', color: '#10A37F', command: agentShell, args: agentShellArgs, detectCommand: 'codex',    launchCommand: 'codex',      cwd: null, env: {} },
  { id: 'antigravity', name: 'Antigravity', icon: 'Bot', color: '#34A853', command: agentShell, args: agentShellArgs, detectCommand: 'agy',      launchCommand: 'agy',        cwd: null, env: {} },
  { id: 'warp',        name: 'Warp Agent',  icon: 'Bot', color: '#01A4FF', command: agentShell, args: agentShellArgs, detectCommand: 'warp',     launchCommand: 'warp',       cwd: null, env: {} },
]

const PLATFORM_MANAGED_PROFILE_IDS = new Set(['nexus', 'claude', 'opencode', 'gh', 'gemini', 'hermes', 'clawbot', 'codex', 'antigravity', 'warp'])
const WINDOWS_ONLY_PROFILE_IDS = new Set(['powershell', 'cmd', 'wsl', 'git-bash'])

function platformProfiles(profiles: Profile[]): Profile[] {
  if (process.platform === 'win32') return profiles
  return profiles.filter((p) => !WINDOWS_ONLY_PROFILE_IDS.has(p.id))
}

export class ShellManager {
  private sessions: Map<string, Session> = new Map()
  private profiles: Profile[] = []
  private sessionCounter = 0
  private dataCallbacks: Array<(sessionId: string, data: string) => void> = []
  private exitCallbacks: Array<(sessionId: string, code: number) => void> = []
  private profilesPath: string
  private snapshotPath: string
  private layoutsPath: string

  constructor(private userDataPath: string) {
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
        let changed = false
        for (const seeded of DEFAULT_PROFILES) {
          if (!this.profiles.some((p) => p.id === seeded.id)) {
            this.profiles.push({ ...seeded })
            changed = true
          }
        }
        const before = this.profiles.length
        this.profiles = this.profiles.filter((p) => p.id !== 'putty')
        if (this.profiles.length !== before) changed = true
        const beforePlatformFilter = this.profiles.length
        this.profiles = platformProfiles(this.profiles)
        if (this.profiles.length !== beforePlatformFilter) changed = true
        for (const seeded of DEFAULT_PROFILES) {
          if (process.platform !== 'win32' && !PLATFORM_MANAGED_PROFILE_IDS.has(seeded.id)) continue
          const saved = this.profiles.find((p) => p.id === seeded.id)
          if (saved && (saved.command !== seeded.command || saved.args.join(' ') !== seeded.args.join(' ') || saved.launchCommand !== seeded.launchCommand)) {
            saved.command = seeded.command
            saved.args = seeded.args
            saved.detectCommand = seeded.detectCommand
            saved.launchCommand = seeded.launchCommand
            saved.icon = seeded.icon
            changed = true
          }
        }
        if (changed) this.saveProfilesToDisk()
      } else {
        this.profiles = platformProfiles([...DEFAULT_PROFILES])
        this.saveProfilesToDisk()
      }
    } catch {
      this.profiles = platformProfiles([...DEFAULT_PROFILES])
    }
  }

  detectInstalledProfiles(): string[] {
    const installed: string[] = []
    for (const profile of this.profiles) {
      try {
        const cmd = profile.detectCommand || profile.command
        if (path.isAbsolute(cmd) || cmd.includes('\\') || cmd.includes('/')) {
          if (fs.existsSync(cmd)) installed.push(profile.id)
        } else {
          const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
          execSync(check, { stdio: 'pipe', timeout: 1500 })
          installed.push(profile.id)
        }
      } catch {}
    }
    return installed
  }

  private saveProfilesToDisk() {
    try { fs.writeFileSync(this.profilesPath, JSON.stringify(this.profiles, null, 2)) } catch {}
  }

  getProfiles(): Profile[] { return this.profiles }

  saveProfile(profile: Profile) {
    const idx = this.profiles.findIndex((p) => p.id === profile.id)
    if (idx >= 0) this.profiles[idx] = profile
    else this.profiles.push(profile)
    this.saveProfilesToDisk()
    return this.profiles
  }

  deleteProfile(id: string) {
    this.profiles = this.profiles.filter((p) => p.id !== id)
    this.saveProfilesToDisk()
    return this.profiles
  }

  getSessionCwd(sessionId: string): string | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    // On Linux we can get the live CWD cheaply via /proc; everywhere else
    // return the initial cwd (updated via OSC 7 on the renderer side).
    if (process.platform === 'linux') {
      try {
        return fs.readlinkSync(`/proc/${session.ptyProcess.pid}/cwd`)
      } catch {}
    }

    return session.cwd
  }

  listSessions(): Array<{ sessionId: string; profileId: string }> {
    return Array.from(this.sessions.values()).map(s => ({ sessionId: s.id, profileId: s.profileId }))
  }

  createSession(profileId: string, cols: number, rows: number, cwdOverride?: string | null): { sessionId: string } {
    const profile = this.profiles.find((p) => p.id === profileId)
    if (!profile) throw new Error(`Profile not found: ${profileId}`)

    const sessionId = `term_${++this.sessionCounter}_${Date.now()}`

    try {
      const shell = process.platform === 'win32' ? profile.command : (profile.command || process.env.SHELL || '/bin/bash')
      const resolvedCwd = cwdOverride || profile.cwd || os.homedir() || process.cwd()
      const ptyProcess = pty.spawn(shell, profile.args || [], {
        name: 'xterm-256color',
        cols: cols || 120,
        rows: rows || 40,
        cwd: resolvedCwd,
        env: { ...process.env, ...profile.env } as { [key: string]: string },
      })

      const snapshot = new SessionSnapshot(cols || 120, rows || 40)

      ptyProcess.onData((data: string) => {
        snapshot.write(data)
        for (const cb of this.dataCallbacks) cb(sessionId, data)
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        for (const cb of this.exitCallbacks) cb(sessionId, exitCode)
        const s = this.sessions.get(sessionId)
        if (s) s.snapshot.dispose()
        this.sessions.delete(sessionId)
      })

      this.sessions.set(sessionId, { id: sessionId, ptyProcess, profileId, snapshot, cwd: resolvedCwd })
      log.info(`Session created: ${sessionId} (profile: ${profileId})`)
      return { sessionId }
    } catch (err: any) {
      throw new Error(`Failed to spawn terminal: ${err.message}`)
    }
  }

  attachSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return session.snapshot.getAttachPayload()
  }

  write(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId)
    if (session) session.ptyProcess.write(data)
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    try {
      session.ptyProcess.resize(cols, rows)
      session.snapshot.resize(cols, rows)
    } catch {}
  }

  destroy(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.ptyProcess.kill()
      session.snapshot.dispose()
      this.sessions.delete(sessionId)
    }
  }

  destroyAll() {
    for (const [id] of this.sessions) this.destroy(id)
  }

  onData(callback: (sessionId: string, data: string) => void) { this.dataCallbacks.push(callback) }
  onExit(callback: (sessionId: string, code: number) => void) { this.exitCallbacks.push(callback) }

  saveSnapshot(snapshot: any) {
    try { fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2)) } catch {}
  }

  loadSnapshot(): any | null {
    try {
      if (fs.existsSync(this.snapshotPath)) return JSON.parse(fs.readFileSync(this.snapshotPath, 'utf-8'))
    } catch {}
    return null
  }

  clearSnapshot() {
    try { fs.unlinkSync(this.snapshotPath) } catch {}
  }

  saveLayouts(layouts: any[]) {
    try { fs.writeFileSync(this.layoutsPath, JSON.stringify(layouts, null, 2)) } catch {}
  }

  loadLayouts(): any[] {
    try {
      if (fs.existsSync(this.layoutsPath)) return JSON.parse(fs.readFileSync(this.layoutsPath, 'utf-8'))
    } catch {}
    return []
  }
}
