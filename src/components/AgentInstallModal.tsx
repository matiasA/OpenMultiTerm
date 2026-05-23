import { X, ExternalLink, Terminal } from 'lucide-react'
import type { AgentDef } from '../agents'

interface Props {
  agent: AgentDef
  onClose: () => void
  onInstall: (command: string) => void
}

export default function AgentInstallModal({ agent, onClose, onInstall }: Props) {
  const platform: 'win' | 'mac' | 'linux' = navigator.userAgent.includes('Win') ? 'win'
    : navigator.userAgent.includes('Mac') ? 'mac' : 'linux'

  const platformLabel = { win: 'Windows', mac: 'macOS', linux: 'Linux' }

  const otherPlatforms = (['win', 'mac', 'linux'] as const).filter(p => p !== platform)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[400px] rounded-xl border border-app-border/10 bg-app-bg shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: agent.color }}
            >
              {agent.name[0]}
            </div>
            <div>
              <div className="text-sm font-semibold text-app-text">{agent.name}</div>
              <div className="text-[11px] text-app-text/50">{agent.description}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/40 hover:text-app-text/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Current platform — install block */}
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text/50">
              {platformLabel[platform]}
              <span className="text-accent/70 normal-case tracking-normal font-normal ml-1">· your system</span>
            </span>
          </div>
          <pre className="text-[11px] text-app-text/75 font-mono whitespace-pre-wrap break-all leading-5 mb-3">
            {agent.install[platform]}
          </pre>
          <button
            onClick={() => { onInstall(agent.install[platform]); onClose() }}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
          >
            <Terminal size={12} />
            Install in terminal
          </button>
        </div>

        {/* Other platforms — reference only */}
        <div className="space-y-1.5">
          {otherPlatforms.map((p) => (
            <div key={p} className="rounded-lg border border-app-border/10 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-app-text/30 mb-1">
                {platformLabel[p]}
              </div>
              <pre className="text-[10px] text-app-text/35 font-mono whitespace-pre-wrap break-all leading-4">
                {agent.install[p]}
              </pre>
            </div>
          ))}
        </div>

        <button
          onClick={() => window.electronAPI.agents.openUrl(agent.install.url)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] text-app-text/40 hover:text-app-text/70 hover:bg-app-hover-overlay/5 transition-colors border border-app-border/10"
        >
          <ExternalLink size={11} />
          Official documentation
        </button>
      </div>
    </div>
  )
}
