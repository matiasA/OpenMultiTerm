import { useStore } from '../store'
import { Terminal, Radio, Zap } from 'lucide-react'

export default function StatusBar() {
  const { terminals, activeTerminalId, profiles, broadcastMode, terminalTheme } = useStore()
  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
  const activeProfile = activeTerminal
    ? profiles.find((p) => p.id === activeTerminal.profileId)
    : null

  const runningCount = terminals.filter((t) => t.status === 'running').length

  return (
    <div className="h-7 flex items-center gap-3 px-3 bg-app-bg-secondary border-t border-app-border/5 shrink-0">
      <div className="flex items-center gap-1.5">
        <Terminal size={11} className="text-app-text/55" />
        <span className="text-[10px] text-app-text/55">
          {runningCount} terminal{runningCount !== 1 ? 's' : ''} active
        </span>
      </div>

      {broadcastMode && (
        <>
          <span className="text-app-border/10">|</span>
          <div className="flex items-center gap-1 text-[10px] text-yellow-400/80 animate-pulse">
            <Radio size={10} />
            <span>Broadcasting</span>
          </div>
        </>
      )}

      {activeProfile && (
        <>
          <span className="text-app-border/10">|</span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: activeProfile.color }}
            />
            <span className="text-[10px] text-app-text/55">{activeProfile.name}</span>
          </div>
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 text-[10px] text-app-text/45">
        <Zap size={10} />
        <span>{terminalTheme.name}</span>
      </div>
    </div>
  )
}
