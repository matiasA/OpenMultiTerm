import { useState } from 'react'
import { useStore } from '../store'
import TerminalPanel from './TerminalPanel'
import { Plus } from 'lucide-react'

export default function TerminalGrid() {
  const { terminals, gridLayout, profiles, addTerminal, moveTerminal } = useStore()
  const { cols, rows } = gridLayout
  const totalCells = cols * rows
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      moveTerminal(fromIndex, toIndex)
    }
  }

  return (
    <div className="asimov-terminal-stage flex-1 p-2 flex flex-col min-h-0">
      <div className="flex-1 overflow-hidden bg-app-grid-bg/30 rounded-sm border border-app-border/10">
        <div
          className="grid h-full gap-px bg-app-border/5"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: totalCells }).map((_, index) => {
            const terminal = terminals[index]

            if (terminal && terminal.status === 'running') {
              const profile = profiles.find((p) => p.id === terminal.profileId)
              return (
                <TerminalPanel
                  key={terminal.id}
                  session={terminal}
                  profile={profile}
                  cellIndex={index}
                />
              )
            }

            if (terminal && terminal.status === 'exited') {
              return (
                <div
                  key={terminal.id}
                  className="bg-app-bg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-app-bg-secondary transition-colors"
                  onClick={() => {
                    window.electronAPI.terminal.destroy(terminal.id)
                    useStore.getState().removeTerminal(terminal.id)
                  }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <span className="text-app-text/20 text-xs">Process exited (code: {terminal.exitCode})</span>
                  <span className="text-app-text/10 text-[10px]">Click to dismiss</span>
                </div>
              )
            }

            return (
              <div
                key={`empty-${index}`}
                className={`bg-app-bg flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-app-bg-secondary transition-all ${
                  dragOverIndex === index ? 'bg-accent/10 ring-1 ring-accent/30' : ''
                }`}
                onClick={() => {
                  const defaultProfile = profiles[0]
                  if (defaultProfile) {
                    window.electronAPI.terminal.create(defaultProfile.id, 120, 40).then(
                      ({ sessionId }) => {
                        addTerminal({
                          id: sessionId,
                          profileId: defaultProfile.id,
                          title: defaultProfile.name,
                          status: 'running',
                          lastActivityTime: Date.now(),
                        })
                      }
                    )
                  }
                }}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className={`w-10 h-10 rounded-full bg-app-hover-overlay/5 flex items-center justify-center transition-all ${
                  dragOverIndex === index ? 'bg-accent/20 scale-110' : 'group-hover:bg-app-hover-overlay/10 group-hover:scale-110'
                }`}>
                  <Plus size={20} className={`transition-colors ${
                    dragOverIndex === index ? 'text-accent' : 'text-app-text/20 group-hover:text-app-text/40'
                  }`} />
                </div>
                <span className={`text-xs transition-colors ${
                  dragOverIndex === index ? 'text-accent/60' : 'text-app-text/15 group-hover:text-app-text/30'
                }`}>
                  {dragOverIndex === index ? 'Drop here' : 'New Terminal'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
