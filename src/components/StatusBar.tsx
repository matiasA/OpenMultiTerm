import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { BroadcastIcon, TerminalWindowIcon } from '../icons/agent-aleph-icons'

export default function StatusBar() {
  const { terminals, activeTerminalId, profiles, broadcastMode, terminalTheme } = useStore()
  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
  const activeProfile = activeTerminal
    ? profiles.find((p) => p.id === activeTerminal.profileId)
    : null

  const [cwd, setCwd] = useState<string | null>(null)
  const runningCount = terminals.filter((t) => t.status === 'running').length

  useEffect(() => {
    if (!activeTerminalId) { setCwd(null); return }
    let cancelled = false
    window.electronAPI.terminal.getCwd(activeTerminalId)
      .then((p) => { if (!cancelled) setCwd(p) })
      .catch(() => { if (!cancelled) setCwd(null) })
    const interval = setInterval(() => {
      window.electronAPI.terminal.getCwd(activeTerminalId)
        .then((p) => { if (!cancelled) setCwd(p) })
        .catch(() => {})
    }, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [activeTerminalId])

  const shortCwd = cwd
    ? cwd.replace(/^[A-Z]:\\Users\\[^\\]+/, '~').replace(/\\/g, '/')
    : null

  const Sep = () => <span className="text-app-text/15 select-none">·</span>

  return (
    <div className="h-[30px] flex items-center gap-2 px-3 bg-app-bg border-t border-app-border/10 shrink-0 text-[10px] font-mono">

      {/* Left: terminal count */}
      <div className="flex items-center gap-1.5 text-app-text/40">
        <TerminalWindowIcon size={10} />
        <span>{runningCount} terminal{runningCount !== 1 ? 's' : ''}</span>
      </div>

      {broadcastMode && (
        <>
          <Sep />
          <div className="flex items-center gap-1 text-yellow-400/70 animate-pulse">
            <BroadcastIcon size={10} />
            <span>Broadcast</span>
          </div>
        </>
      )}

      {activeProfile && (
        <>
          <Sep />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeProfile.color }} />
            <span className="text-app-text/55">{activeProfile.name}</span>
          </div>
        </>
      )}

      {shortCwd && (
        <>
          <Sep />
          <span className="text-app-text/35 truncate max-w-xs font-mono">{shortCwd}</span>
        </>
      )}

      <div className="flex-1" />

      {/* Right: theme name */}
      <span className="text-app-text/25">{terminalTheme.name}</span>
    </div>
  )
}
