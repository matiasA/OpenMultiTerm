import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface DaemonState {
  port: number
  pid: number
  token: string
  version: string
  startedAt: string
}

let userDataPath: string

export function initState(udPath: string) {
  userDataPath = udPath
}

function statePath() {
  return path.join(userDataPath, 'daemon.json')
}

function lockPath() {
  return path.join(userDataPath, 'daemon.lock')
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function writeState(state: DaemonState) {
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf-8')
}

export function readState(): DaemonState | null {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    return JSON.parse(raw) as DaemonState
  } catch {
    return null
  }
}

export function clearState() {
  try { fs.unlinkSync(statePath()) } catch {}
}

/** Tries to atomically claim the spawn lock. Returns true if acquired. */
export function acquireSpawnLock(): boolean {
  try {
    const fd = fs.openSync(lockPath(), 'wx')
    fs.writeSync(fd, String(process.pid))
    fs.closeSync(fd)
    return true
  } catch {
    return false
  }
}

export function releaseSpawnLock() {
  try { fs.unlinkSync(lockPath()) } catch {}
}

/** Returns true if the lock is stale (>10s old and no daemon.json) */
export function isSpawnLockStale(): boolean {
  try {
    const stat = fs.statSync(lockPath())
    const age = Date.now() - stat.mtimeMs
    if (age > 10_000 && !readState()) return true
  } catch {}
  return false
}

export function forceReleaseStaleLock() {
  if (isSpawnLockStale()) releaseSpawnLock()
}
