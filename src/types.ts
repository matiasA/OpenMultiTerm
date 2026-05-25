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

export interface TerminalSession {
  id: string
  profileId: string
  title: string
  customTitle?: string
  status: 'running' | 'exited'
  exitCode?: number
  lastActivityTime: number
}

export interface GridLayout {
  cols: number
  rows: number
}

export interface CommandEntry {
  id: string
  sessionId: string
  sessionTitle: string
  command: string
  timestamp: number
}

export interface SavedLayout {
  id: string
  name: string
  cols: number
  rows: number
  terminals: Array<{
    profileId: string
    title: string
    cwd?: string | null
  }>
  createdAt: number
}

export interface SessionSnapshot {
  gridLayout: GridLayout
  terminals: Array<{
    profileId: string
    customTitle?: string
  }>
  sidebarOpen: boolean
  timestamp: number
}

export interface XtermTheme {
  name: string
  variant: 'dark' | 'light'
  fontFamily?: string
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  brightBlack: string
  red: string
  brightRed: string
  green: string
  brightGreen: string
  yellow: string
  brightYellow: string
  blue: string
  brightBlue: string
  magenta: string
  brightMagenta: string
  cyan: string
  brightCyan: string
  white: string
  brightWhite: string
}

export type AppTheme = 'dark' | 'light'

declare global {
  interface Window {
    electronAPI: import('../electron/preload').ElectronAPI
  }
}
