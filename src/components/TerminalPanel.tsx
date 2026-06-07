import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import type { TerminalSession, Profile } from '../types'
import { useStore } from '../store'
import {
  CheckIcon, CloseIcon, CopyIcon, DownloadIcon, SearchIcon,
} from '../icons/agent-aleph-icons'
import '@xterm/xterm/css/xterm.css'

function parseCwdFromOsc7(data: string): string | null {
  const match = /\x1b\]7;([^\x07\x1b]*?)(?:\x07|\x1b\\)/.exec(data)
  if (!match) return null
  const raw = match[1]
  if (raw.startsWith('file://')) {
    try {
      const url = new URL(raw)
      let p = decodeURIComponent(url.pathname)
      if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1)
      return p || null
    } catch { return null }
  }
  return raw || null
}

function abbreviatePath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length === 0) return p
  if (parts.length <= 2) return parts.join('/')
  return `…/${parts.slice(-2).join('/')}`
}

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
  const [cwd, setCwd] = useState<string | null>(profile?.cwd ?? null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const {
    activeTerminalId, setActiveTerminal, removeTerminal,
    broadcastMode, terminalTheme, addCommand, renameSession, profiles,
  } = useStore()
  const isActive = activeTerminalId === session.id
  const displayTitle = session.customTitle || profile?.name || 'Terminal'
  const darkBackgroundIndex = (cellIndex % 5) + 1
  const lightBackgroundIndex = (cellIndex % 6) + 1
  const backgroundStyle = {
    '--terminal-bg-image-dark': `url('/assets/backgrounds/asimov-terminal-bg-${darkBackgroundIndex}.png')`,
    '--terminal-bg-image-light': `url('/assets/backgrounds/agent-aleph-terminal-bg-light-${lightBackgroundIndex}.png')`,
  } as React.CSSProperties

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: terminalTheme.fontFamily ?? '"Consolas", "Noto Sans Mono", "JetBrains Mono", "Cascadia Code", monospace',
      theme: terminalTheme,
      allowProposedApi: true,
      allowTransparency: true,
      letterSpacing: 0,
      lineHeight: 1.0,
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

    // Immediate fallback: home directory from main process (no daemon involved)
    window.electronAPI.app.getHomedir().then((h) => setCwd((prev) => prev ?? h)).catch(() => {})
    // More accurate: daemon-known CWD (overrides homedir if different)
    window.electronAPI.terminal.getCwd(session.id).then((c) => { if (c) setCwd(c) }).catch(() => {})

    // Replay buffered output from daemon (session survived a window close)
    window.electronAPI.terminal.attach(session.id).then((payload) => {
      if (!payload) return
      if (payload.serialized) {
        terminal.write(payload.serialized)
      } else if (payload.ring) {
        terminal.write(payload.ring)
      }
    }).catch(() => {})

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const mod = e.ctrlKey || e.metaKey

      // Ctrl+C with active selection → copy, don't send SIGINT
      if (mod && !e.shiftKey && e.key === 'c' && terminal.hasSelection()) {
        navigator.clipboard.writeText(terminal.getSelection())
        return false
      }

      // Ctrl+V → paste from clipboard
      if (mod && !e.shiftKey && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.electronAPI.terminal.write(session.id, text)
        })
        return false
      }

      return true
    })

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
        const detectedCwd = parseCwdFromOsc7(data)
        if (detectedCwd) setCwd(detectedCwd)
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
      term.options.fontFamily = terminalTheme.fontFamily ?? '"Consolas", "Noto Sans Mono", "JetBrains Mono", "Cascadia Code", monospace'
      const rows = term.rows
      if (rows > 0) {
        term.refresh(0, rows - 1)
      }
      // refit so cell dimensions update after the font change
      requestAnimationFrame(() => fitAddonRef.current?.fit())
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
      className={`asimov-terminal-panel flex flex-col bg-app-bg overflow-hidden relative group transition-all ${
        isActive ? 'ring-1 ring-accent/25 z-10' : 'ring-1 ring-app-border/5'
      }`}
      style={backgroundStyle}
      onClick={() => setActiveTerminal(session.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(cellIndex))
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      {/* Tab header */}
      <div className={`relative z-20 h-12 flex items-center gap-2 px-4 border-b shrink-0 transition-colors ${
        isActive
          ? 'bg-app-bg-secondary border-app-border/10 border-t border-t-accent/70'
          : 'bg-app-bg border-app-border/5'
      }`}>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: profile?.color || '#7c5cfc', opacity: isActive ? 1 : 0.5 }}
        />

        {isRenaming ? (
          <>
            <input
              ref={renameInputRef}
              list={`rename-list-${session.id}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              className="flex-1 bg-app-hover-overlay/5 border border-accent/30 rounded px-1.5 py-0.5 text-[10px] text-app-text/90 outline-none focus:border-accent/60"
              autoFocus
            />
            <datalist id={`rename-list-${session.id}`}>
              {profiles.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </>
        ) : (
          <>
            <span
              className={`text-[10px] font-medium truncate flex-1 cursor-text transition-colors ${
                isActive ? 'text-app-text/85' : 'text-app-text/40'
              }`}
              onDoubleClick={startRename}
              title="Double-click to rename"
            >
              {displayTitle}
            </span>
            {cwd && (
              <span
                className="text-[9px] font-mono text-app-text/55 truncate max-w-[140px] shrink-0"
                title={cwd}
              >
                {abbreviatePath(cwd)}
              </span>
            )}
          </>
        )}

        <div className={`flex items-center gap-0.5 transition-opacity ${
          isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}>
          <button
            onClick={(e) => { e.stopPropagation(); handleCopyBuffer() }}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/50 hover:text-app-text/80 transition-colors"
            title={copied ? 'Copied!' : 'Copy buffer'}
          >
            {copied ? <CheckIcon size={11} className="text-green-400" /> : <CopyIcon size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleExport() }}
            className="p-1 rounded hover:bg-app-hover-overlay/10 text-app-text/50 hover:text-app-text/80 transition-colors"
            title="Export to file"
          >
            <DownloadIcon size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch) }}
            className={`p-1 rounded hover:bg-app-hover-overlay/10 transition-colors ${
              showSearch ? 'text-accent' : 'text-app-text/50 hover:text-app-text/80'
            }`}
            title="Search (Ctrl+F)"
          >
            <SearchIcon size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose() }}
            className="p-1 rounded hover:bg-red-500/20 text-app-text/50 hover:text-red-400 transition-colors"
            title="Close"
          >
            <CloseIcon size={12} />
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
            <CloseIcon size={11} />
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 terminal-container"
        style={backgroundStyle}
      />
    </div>
  )
}
