import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Profile, TerminalSession, SavedLayout } from '../types'
import { DARK_THEMES, LIGHT_THEMES } from '../themes'
import {
  Plus, Terminal, Sparkles, Monitor, RectangleHorizontal, GitBranch,
  Trash2, Grid3X3, Columns2, Rows2, LayoutGrid, PanelRight,
  Radio, Save, ChevronDown, Sun, Moon, Palette, Bookmark, Zap,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Terminal, Sparkles, Monitor, RectangleHorizontal, GitBranch,
}

function ProfileIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = ICON_MAP[icon] || Terminal
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <Icon size={14} />
    </div>
  )
}

export default function Sidebar() {
  const {
    profiles, terminals, activeTerminalId, gridLayout,
    broadcastMode, savedLayouts, appTheme, terminalTheme,
    addTerminal, removeTerminal, setActiveTerminal, setGridLayout,
    toggleSidebar, toggleBroadcast,
    saveLayout, loadLayout, deleteLayout, setSavedLayouts,
    setAppTheme, setTerminalTheme, renameSession,
  } = useStore()

  const [showDelete, setShowDelete] = useState<string | null>(null)
  const [showThemes, setShowThemes] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [showLayoutSave, setShowLayoutSave] = useState(false)
  const [showLayouts, setShowLayouts] = useState(false)

  useEffect(() => {
    window.electronAPI.layouts.load().then((layouts: SavedLayout[]) => {
      if (layouts.length) setSavedLayouts(layouts)
    })
  }, [])

  const handleNewTerminal = async (profile: Profile) => {
    try {
      const { sessionId } = await window.electronAPI.terminal.create(profile.id, 120, 40)
      const session: TerminalSession = {
        id: sessionId,
        profileId: profile.id,
        title: `${profile.name}`,
        status: 'running',
        lastActivityTime: Date.now(),
      }
      addTerminal(session)
    } catch (err: any) {
      console.error('Failed to create terminal:', err)
    }
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.terminal.destroy(id)
    removeTerminal(id)
  }

  const handleSaveLayout = () => {
    if (!layoutName.trim()) return
    saveLayout(layoutName.trim())
    window.electronAPI.layouts.save(useStore.getState().savedLayouts)
    setLayoutName('')
    setShowLayoutSave(false)
  }

  const handleLoadLayout = (layoutId: string) => {
    const layout = savedLayouts.find((l) => l.id === layoutId)
    if (!layout) return

    useStore.getState().terminals.forEach((t) => {
      window.electronAPI.terminal.destroy(t.id)
    })
    useStore.setState({ terminals: [], activeTerminalId: null })

    loadLayout(layoutId)

    setTimeout(() => {
      layout.terminals.forEach((lt) => {
        const profile = profiles.find((p) => p.id === lt.profileId)
        if (profile) {
          window.electronAPI.terminal.create(profile.id, 120, 40).then(
            ({ sessionId }) => {
              const session: TerminalSession = {
                id: sessionId,
                profileId: profile.id,
                title: lt.title || profile.name,
                customTitle: lt.title !== profile.name ? lt.title : undefined,
                status: 'running',
                lastActivityTime: Date.now(),
              }
              addTerminal(session)
            }
          )
        }
      })
    }, 200)
  }

  const handleDeleteLayout = (layoutId: string) => {
    deleteLayout(layoutId)
    window.electronAPI.layouts.save(useStore.getState().savedLayouts)
  }

  const gridPresets = [
    { cols: 1, rows: 1, icon: Grid3X3, label: '1x1' },
    { cols: 1, rows: 2, icon: Rows2, label: '1x2' },
    { cols: 2, rows: 1, icon: Columns2, label: '2x1' },
    { cols: 2, rows: 2, icon: LayoutGrid, label: '2x2' },
    { cols: 3, rows: 2, icon: LayoutGrid, label: '3x2' },
    { cols: 3, rows: 3, icon: Grid3X3, label: '3x3' },
  ]

  return (
    <aside className="w-60 shrink-0 glass border-r border-app-border/5 flex flex-col animate-slide-in overflow-y-auto">

      <div className="p-3 border-b border-app-border/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text/30">
            Profiles
          </span>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-app-hover-overlay/5 text-app-text/30 hover:text-app-text/60 transition-colors"
          >
            <PanelRight size={14} />
          </button>
        </div>
        <div className="space-y-0.5">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleNewTerminal(profile)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-app-hover-overlay/5 text-app-text/70 hover:text-app-text transition-all group"
            >
              <ProfileIcon icon={profile.icon} color={profile.color} />
              <span className="text-xs flex-1 text-left truncate">{profile.name}</span>
              <Plus
                size={14}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-app-text/40"
              />
            </button>
          ))}
        </div>
      </div>

      {terminals.length > 0 && (
        <div className="p-3 border-b border-app-border/5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text/30 mb-3 block">
            Sessions
          </span>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {terminals.map((term) => {
              const profile = profiles.find((p) => p.id === term.profileId)
              const idleFor = term.lastActivityTime ? Math.round((Date.now() - term.lastActivityTime) / 1000) : 999
              const isIdle = idleFor > 15 && term.status === 'running'
              return (
                <div
                  key={term.id}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all ${
                    activeTerminalId === term.id
                      ? 'bg-app-hover-overlay/8 text-app-text'
                      : isIdle ? 'text-app-text/30' : 'text-app-text/50 hover:bg-app-hover-overlay/5 hover:text-app-text/70'
                  }`}
                  onClick={() => setActiveTerminal(term.id)}
                  onMouseEnter={() => setShowDelete(term.id)}
                  onMouseLeave={() => setShowDelete(null)}
                >
                  <span className={`status-dot shrink-0 ${term.status}`} />
                  {profile && <ProfileIcon icon={profile.icon} color={profile.color} />}
                  <span className="text-xs flex-1 text-left truncate">
                    {term.customTitle || term.title}
                  </span>
                  {isIdle && <span className="text-[8px] text-app-text/15">{idleFor}s</span>}
                  {showDelete === term.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCloseTerminal(term.id) }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-app-text/30 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="p-3 border-b border-app-border/5">
        <button
          onClick={toggleBroadcast}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            broadcastMode
              ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
              : 'text-app-text/40 hover:bg-app-hover-overlay/5 hover:text-app-text/60'
          }`}
        >
          <Radio size={13} className={broadcastMode ? 'animate-pulse' : ''} />
          <span>Broadcast {broadcastMode ? 'ON' : 'OFF'}</span>
          {broadcastMode && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          )}
        </button>
      </div>

      <div className="p-3 border-b border-app-border/5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text/30 mb-2 block">
          Layout
        </span>
        <div className="flex flex-wrap gap-1 mb-2">
          {gridPresets.map((preset) => {
            const Icon = preset.icon
            const isActive = gridLayout.cols === preset.cols && gridLayout.rows === preset.rows
            return (
              <button
                key={preset.label}
                onClick={() => setGridLayout(preset.cols, preset.rows)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-app-text/30 hover:bg-app-hover-overlay/5 hover:text-app-text/50'
                }`}
                title={`${preset.cols}x${preset.rows}`}
              >
                <Icon size={12} />
                {preset.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowLayouts(!showLayouts)}
          className="flex items-center gap-1 text-[10px] text-app-text/25 hover:text-app-text/50 transition-colors mb-1"
        >
          <ChevronDown size={10} className={`transition-transform ${showLayouts ? 'rotate-0' : '-rotate-90'}`} />
          Saved Layouts
        </button>

        {showLayouts && (
          <div className="space-y-0.5 mb-1 animate-slide-up">
            {savedLayouts.length === 0 && (
              <span className="text-[10px] text-app-text/15 italic">No saved layouts</span>
            )}
            {savedLayouts.map((layout) => (
              <div key={layout.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => handleLoadLayout(layout.id)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-app-text/40 hover:bg-app-hover-overlay/5 hover:text-app-text/70 transition-all text-left"
                >
                  <Bookmark size={10} />
                  <span className="truncate">{layout.name}</span>
                  <span className="text-app-text/15">{layout.cols}x{layout.rows}</span>
                </button>
                <button
                  onClick={() => handleDeleteLayout(layout.id)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-app-text/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showLayoutSave ? (
          <div className="flex gap-1 animate-slide-up">
            <input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLayout(); if (e.key === 'Escape') setShowLayoutSave(false) }}
              placeholder="Layout name..."
              className="flex-1 bg-app-hover-overlay/5 border border-app-border/10 rounded px-1.5 py-0.5 text-[10px] text-app-text/70 outline-none focus:border-accent/50 placeholder:text-app-text/20"
              autoFocus
            />
            <button
              onClick={handleSaveLayout}
              className="px-2 py-0.5 rounded bg-accent/20 text-accent text-[10px] font-medium hover:bg-accent/30 transition-colors"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLayoutSave(true)}
            className="flex items-center gap-1 text-[10px] text-app-text/25 hover:text-accent/60 transition-colors"
          >
            <Save size={10} />
            Save current layout
          </button>
        )}
      </div>

      <div className="p-3 border-b border-app-border/5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-app-text/30 mb-2 block">
          View
        </span>
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setAppTheme('dark')}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
              appTheme === 'dark' ? 'bg-accent/20 text-accent' : 'text-app-text/30 hover:bg-app-hover-overlay/5'
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setAppTheme('light')}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
              appTheme === 'light' ? 'bg-accent/20 text-accent' : 'text-app-text/30 hover:bg-app-hover-overlay/5'
            }`}
          >
            Light
          </button>
        </div>

        <button
          onClick={() => setShowThemes(!showThemes)}
          className="flex items-center gap-1 text-[10px] text-app-text/25 hover:text-app-text/50 transition-colors mb-1"
        >
          <Palette size={10} />
          <ChevronDown size={10} className={`transition-transform ${showThemes ? 'rotate-0' : '-rotate-90'}`} />
          Terminal Themes
        </button>

        {showThemes && (
          <div className="space-y-0.5 animate-slide-up">
            {(appTheme === 'dark' ? DARK_THEMES : LIGHT_THEMES).map((theme) => (
              <button
                key={theme.name}
                onClick={() => setTerminalTheme(theme)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-all ${
                  terminalTheme.name === theme.name
                    ? 'bg-accent/15 text-accent'
                    : 'text-app-text/30 hover:bg-app-hover-overlay/5 hover:text-app-text/50'
                }`}
              >
                <div
                  className="w-4 h-4 rounded border border-app-border/10 shrink-0"
                  style={{ background: theme.background }}
                />
                <span className="flex-1 text-left">{theme.name}</span>
                {terminalTheme.name === theme.name && <Zap size={10} className="text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
