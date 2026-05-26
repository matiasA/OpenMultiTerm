export interface AuthMessage {
  type: 'auth'
  token: string
}

export interface Request {
  id: string
  type: 'request'
  method: string
  params?: any
}

export interface Response {
  id: string
  type: 'response'
  result?: any
  error?: { code: number; message: string }
}

export interface DaemonEvent {
  type: 'event'
  event: string
  params: any
}

export type ClientMessage = AuthMessage | Request
export type ServerMessage = Response | DaemonEvent

export const METHODS = {
  TERMINAL_CREATE: 'terminal.create',
  TERMINAL_WRITE: 'terminal.write',
  TERMINAL_RESIZE: 'terminal.resize',
  TERMINAL_DESTROY: 'terminal.destroy',
  TERMINAL_GET_CWD: 'terminal.getCwd',
  TERMINAL_LIST: 'terminal.list',
  TERMINAL_ATTACH: 'terminal.attach',
  PROFILES_GET: 'profiles.get',
  PROFILES_SAVE: 'profiles.save',
  PROFILES_DELETE: 'profiles.delete',
  PROFILES_DETECT: 'profiles.detectInstalled',
  SNAPSHOT_SAVE: 'snapshot.save',
  SNAPSHOT_LOAD: 'snapshot.load',
  SNAPSHOT_CLEAR: 'snapshot.clear',
  LAYOUTS_SAVE: 'layouts.save',
  LAYOUTS_LOAD: 'layouts.load',
  DAEMON_SHUTDOWN: 'daemon.shutdown',
} as const

export const EVENTS = {
  TERMINAL_DATA: 'terminal.data',
  TERMINAL_EXIT: 'terminal.exit',
} as const
