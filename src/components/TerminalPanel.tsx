import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import type { TerminalSession, Profile } from '../types'
import { useStore } from '../store'
import { X, Search as SearchIcon, Download, Copy, Check } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface Props {
  session: TerminalSession
  profile?: Profile
  cellIndex: number
}

export default function TerminalPanel({ session, profile, cellIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const commandBufferRef = useRef('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [copied, setCopied] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const {
    activeTerminalId, setActiveTerminal, removeTerminal,
    broadcastMode, terminalTheme, addCommand, renameSession,
  } = useStore()
  const isActive = activeTerminalId === session.id
  const displayTitle = session.customTitle || profile?.name || 'Terminal'

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", monospace',
      theme: terminalTheme,
      allowProposedApi: true,
      allowTransparency: true,
      letterSpacing: 0.5,
      lineHeight: 1.4,
      scrollback: 5000,
      tabStopWidth: 4,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    const disposeOnData = terminal.onData((data) => {
      if (data === '\r') {
        const cmd = commandBufferRef.current.trim()
        if (cmd) {
          addCommand(session.id, displayTitle, cmd)
        }
        commandBufferRef.current = ''
      } else if (data === '\x7f') {
        commandBufferRef.current = commandBufferRef.current.slice(0, -1)
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        commandBufferRef.current += data
      }

      if (useStore.getState().broadcastMode) {
        const allSessions = useStore.getState().terminals
        for (const s of allSessions) {
          if (s.id !== session.id && s.status === 'running') {
            window.electronAPI.terminal.write(s.id, data)
          }
        }
      }
      window.electronAPI.terminal.write(session.id, data)
    })

    const disposeOnTerminalData = window.electronAPI.terminal.onData((id, data) => {
      if (id === session.id) {
        terminal.write(data)
      }
      useStore.getState().updateTerminalActivity(id)
    })

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitAddonRef.current && terminalRef.current) {
          try {
            fitAddonRef.current.fit()
            const { cols, rows } = terminalRef.current
            if (cols > 0 && rows > 0) {
              window.electronAPI.terminal.resize(session.id, cols, rows)
            }
          } catch {}
        }
      })
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      disposeOnData.dispose()
      disposeOnTerminalData()
      resizeObserver.disconnect()
      terminal.dispose()
    }
  }, [session.id])

  useEffect(() => {
    const term = terminalRef.current
    if (term) {
      term.options.theme = terminalTheme
      const rows = term.rows
      if (rows > 0) {
        term.refresh(0, rows - 1)
      }
    }
  }, [terminalTheme])

  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isActive])

  const handleSearch = useCallback(() => {
    if (!searchAddonRef.current || !searchTerm) return
    searchAddonRef.current.findNext(searchTerm, {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    })
  }, [searchTerm])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape') { setShowSearch(false); setSearchTerm('') }
  }, [handleSearch])

  const handleClose = () => {
    window.electronAPI.terminal.destroy(session.id)
    removeTerminal(session.id)
  }

  const handleExport = async () => {
    if (!terminalRef.current) return
    const buffer = terminalRef.current.buffer.active
    const lines: string[] = []
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) lines.push(line.translateToString())
    }
    const content = lines.join('\n')
    const defaultName = `openmultiterm-${displayTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.log`
    await window.electronAPI.export.save(content, defaultName)
  }

  const handleCopyBuffer = async () => {
    if (!terminalRef.current) return
    const buffer = terminalRef.current.buffer.active
    const lines: string[] = []
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) lines.push(line.translateToString())
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startRename = () => {
    setRenameValue(displayTitle)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  const commitRename = () => {
    const val = renameValue.trim()
    if (val) renameSession(session.id, val)
    else renameSession(session.id, '')
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  return (
    <div
      className={`flex flex-col bg-app-bg overflow-hidden relative group transition-all ${
        isActive ? 'ring-1 ring-accent/30 z-10' : 'ring-1 ring-app-border/5'
      }`}
      onClick={() => setActiveTerminal(session.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(cellIndex))
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="h-7 flex items-center gap-2 px-2 bg-app-bg-secondary border-b border-app-border/5 shrink-0">
        <span
          className="w-2 h-2 rounded-full shrink-0 status-dot"
          style={{ backgroundColor: profile?.color || '#7c5cfc' }}
        />

        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 bg-app-hover-overlay/5 border border-app-border/10 rounded px-1.5 py-0.5 text-[10px] text-app-text/80 outline-none focus:border-accent/50"
            autoFocus
          />
        ) : (
          <span
            className="text-[10px] text-app-text/50 font-medium truncate flex-1 cursor-text"
            onDoubleClick={startRename}
            title="Double-click to rename"
          >
            {displayTitle}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopyBuffer() }}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/30 hover:text-app-text/60"
            title={copied ? 'Copied!' : 'Copy buffer'}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleExport() }}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/30 hover:text-app-text/60"
            title="Export to file"
          >
            <Download size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch) }}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/30 hover:text-app-text/60"
            title="Search"
          >
            <SearchIcon size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose() }}
            className="p-1 rounded hover:bg-red-500/30 text-app-text/30 hover:text-red-400"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="h-7 flex items-center gap-1 px-2 bg-app-bg-tertiary border-b border-app-border/5 animate-slide-up">
          <SearchIcon size={11} className="text-app-text/30 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="flex-1 bg-transparent text-xs text-app-text/70 outline-none placeholder:text-app-text/20"
            autoFocus
          />
          <button
            onClick={() => { setShowSearch(false); setSearchTerm('') }}
            className="text-app-text/20 hover:text-app-text/50"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 terminal-container" />
    </div>
  )
}
