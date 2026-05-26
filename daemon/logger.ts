import fs from 'fs'
import path from 'path'

let logPath: string | null = null

export function initLogger(userDataPath: string) {
  logPath = path.join(userDataPath, 'daemon.log')
}

function write(level: string, ...args: any[]) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
  if (logPath) {
    try { fs.appendFileSync(logPath, line) } catch {}
  }
  // also emit to stderr so it shows in dev mode
  process.stderr.write(line)
}

export const log = {
  info: (...args: any[]) => write('INFO', ...args),
  warn: (...args: any[]) => write('WARN', ...args),
  error: (...args: any[]) => write('ERROR', ...args),
}
