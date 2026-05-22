import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { Search, Terminal, Clock, CornerDownLeft } from 'lucide-react'

export default function CommandPalette() {
  const { commandHistory, showCommandPalette, setShowCommandPalette, activeTerminalId } = useStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) {
      const seen = new Set<string>()
      return commandHistory.filter((c) => {
        const key = c.command.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    const q = query.toLowerCase()
    return commandHistory.filter((c) => c.command.toLowerCase().includes(q))
  }, [commandHistory, query])

  useEffect(() => {
    if (showCommandPalette) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showCommandPalette])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const executeCommand = (command: string) => {
    if (activeTerminalId) {
      window.electronAPI.terminal.write(activeTerminalId, command + '\r')
    }
    setShowCommandPalette(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        executeCommand(filtered[selectedIndex].command)
      }
    } else if (e.key === 'Escape') {
      setShowCommandPalette(false)
    }
  }

  if (!showCommandPalette) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setShowCommandPalette(false)}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-[560px] max-h-[400px] flex flex-col glass-elevated rounded-xl shadow-2xl border border-app-border/10 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border/5">
          <Search size={16} className="text-app-text/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search command history across all sessions..."
            className="flex-1 bg-transparent text-sm text-app-text/80 outline-none placeholder:text-app-text/20"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-app-hover-overlay/5 text-app-text/20 font-mono">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-app-text/20 text-xs">
              {commandHistory.length === 0 ? 'No commands recorded yet' : 'No matching commands'}
            </div>
          )}

          {filtered.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => executeCommand(entry.command)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === selectedIndex
                  ? 'bg-accent/15 text-app-text'
                  : 'text-app-text/50 hover:bg-app-hover-overlay/5 hover:text-app-text/70'
              }`}
            >
              <CornerDownLeft size={13} className={`shrink-0 ${i === selectedIndex ? 'text-accent' : 'text-app-text/20'}`} />
              <span className="flex-1 text-xs font-mono truncate">{entry.command}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1 text-[10px] text-app-text/20">
                  <Terminal size={10} />
                  {entry.sessionTitle}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-app-text/15">
                  <Clock size={10} />
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-app-border/5 flex items-center justify-between text-[10px] text-app-text/15">
          <span>{filtered.length} command{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Execute</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}
