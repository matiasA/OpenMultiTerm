import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Profile, TerminalSession, SavedLayout } from '../types'
import { DARK_THEMES, LIGHT_THEMES } from '../themes'
import { AGENTS, type AgentDef } from '../agents'
import { PROFILE_INSTALL_INFO, type ProfileInstallInfo } from '../profile-install-info'
import AgentInstallModal from './AgentInstallModal'
import {
  Plus, Trash2, ChevronDown, Palette, RotateCw,
} from 'lucide-react'
import {
  AgentIcon, AlertIcon, BookmarkIcon, BroadcastIcon, CheckIcon, CliIcon, CodeIcon,
  CommandIcon, DarkModeIcon, FolderIcon, Layout1x1Icon, Layout1x2Icon, Layout2x1Icon,
  Layout3x3Icon, LayoutGridIcon, LightModeIcon, NexusShellIcon, PlayIcon,
  RefreshIcon, RobotIcon, SaveIcon, TerminalWindowIcon,
} from '../icons/agent-aleph-icons'

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bot: RobotIcon,
  Sparkles: AgentIcon,
  Terminal: CliIcon,
  Monitor: TerminalWindowIcon,
  RectangleHorizontal: CommandIcon,
  GitBranch: CodeIcon,
  Zap: NexusShellIcon,
}

const AGENT_PROFILE_IDS = new Set(['claude', 'opencode', 'gh', 'gemini', 'hermes', 'clawbot', 'codex', 'antigravity', 'warp'])
const WINDOWS_ONLY_PROFILE_IDS = new Set(['powershell', 'cmd', 'wsl', 'git-bash'])

function isWindowsRuntime() {
  return navigator.userAgent.includes('Win')
}

function ProfileIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = ICON_MAP[icon] || TerminalWindowIcon
  return (
    <div
      className="aleph-icon-tile w-7 h-7 rounded-md flex items-center justify-center shrink-0"
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
    toggleBroadcast,
    saveLayout, updateLayout, renameLayout, loadLayout, deleteLayout, setSavedLayouts,
    setAppTheme, setTerminalTheme,
  } = useStore()

  const [showDelete, setShowDelete] = useState<string | null>(null)
  const [showAllAgents, setShowAllAgents] = useState(false)
  const [showAllShells, setShowAllShells] = useState(false)
  const [pendingAgent, setPendingAgent] = useState<{ profileId: string; cwd: string } | null>(null)
  const [showThemes, setShowThemes] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [showLayoutSave, setShowLayoutSave] = useState(false)
  const [showLayouts, setShowLayouts] = useState(false)
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null)
  const [renamingLayoutId, setRenamingLayoutId] = useState<string | null>(null)
  const [renameLayoutValue, setRenameLayoutValue] = useState('')
  const [installModal, setInstallModal] = useState<AgentDef | null>(null)
  const [installedProfiles, setInstalledProfiles] = useState<string[]>([])
  const [profileInstallModal, setProfileInstallModal] = useState<ProfileInstallInfo | null>(null)
  const [appVersion, setAppVersion] = useState<string>('')
  const [updateCheckState, setUpdateCheckState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')

  useEffect(() => {
    window.electronAPI.layouts.load().then((layouts: SavedLayout[]) => {
      if (layouts.length) setSavedLayouts(layouts)
    })
    window.electronAPI.profiles.detectInstalled().then(setInstalledProfiles).catch(() => {})
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})

    const unsubChecking = window.electronAPI.updater.onChecking(() => setUpdateCheckState('checking'))
    const unsubOk = window.electronAPI.updater.onNotAvailable(() => {
      setUpdateCheckState('ok')
      setTimeout(() => setUpdateCheckState('idle'), 3000)
    })
    const unsubErr = window.electronAPI.updater.onError(() => {
      setUpdateCheckState('error')
      setTimeout(() => setUpdateCheckState('idle'), 4000)
    })
    const unsubAvailable = window.electronAPI.updater.onAvailable(() => setUpdateCheckState('idle'))
    return () => { unsubChecking(); unsubOk(); unsubErr(); unsubAvailable() }
  }, [])

  const handleNewTerminal = async (profile: Profile, cwd?: string) => {
    try {
      const { sessionId } = await window.electronAPI.terminal.create(profile.id, 120, 40, cwd || null)
      const session: TerminalSession = {
        id: sessionId,
        profileId: profile.id,
        title: `${profile.name}`,
        status: 'running',
        lastActivityTime: Date.now(),
      }
      addTerminal(session)
      if (profile.launchCommand) {
        setTimeout(() => {
          window.electronAPI.terminal.write(sessionId, profile.launchCommand! + '\r')
        }, 600)
      }
    } catch (err: any) {
      console.error('Failed to create terminal:', err)
    }
  }

  const handleBrowseFolder = async () => {
    const selected = await window.electronAPI.dialog.selectFolder()
    if (selected !== null && pendingAgent) {
      setPendingAgent({ ...pendingAgent, cwd: selected })
    }
  }

  const handleLaunchAgent = async () => {
    if (!pendingAgent) return
    const profile = profiles.find((p) => p.id === pendingAgent.profileId)
    if (!profile) return
    setPendingAgent(null)
    await handleNewTerminal(profile, pendingAgent.cwd || undefined)
  }

  const handleCloseTerminal = (id: string) => {
    window.electronAPI.terminal.destroy(id)
    removeTerminal(id)
  }

  const handleInstallAgent = async (command: string) => {
    const profile = profiles.find(p =>
      navigator.userAgent.includes('Win')
        ? p.command.toLowerCase().includes('powershell') || p.command.toLowerCase().includes('cmd')
        : p.command.includes('bash') || p.command.includes('zsh') || p.command.includes('sh')
    ) ?? profiles[0]
    if (!profile) return
    const { sessionId } = await window.electronAPI.terminal.create(profile.id, 120, 40)
    addTerminal({ id: sessionId, profileId: profile.id, title: 'Installing...', status: 'running', lastActivityTime: Date.now() })
    const lines = command.split('\n')
    lines.forEach((line, i) => {
      setTimeout(() => window.electronAPI.terminal.write(sessionId, line + '\r'), 600 + i * 400)
    })
  }

  const handleSaveLayout = async () => {
    if (!layoutName.trim()) return
    const cwds: Record<string, string | null> = {}
    await Promise.all(
      terminals.map(async (t) => {
        cwds[t.id] = await window.electronAPI.terminal.getCwd(t.id).catch(() => null)
      })
    )
    saveLayout(layoutName.trim(), cwds)
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
          window.electronAPI.terminal.create(profile.id, 120, 40, lt.cwd).then(
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

  const startRenameLayout = (layout: SavedLayout, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingLayoutId(layout.id)
    setRenameLayoutValue(layout.name)
  }

  const commitRenameLayout = (layoutId: string) => {
    const val = renameLayoutValue.trim()
    if (val) renameLayout(layoutId, val)
    window.electronAPI.layouts.save(useStore.getState().savedLayouts)
    setRenamingLayoutId(null)
  }

  const handleRenameLayoutKeyDown = (e: React.KeyboardEvent, layoutId: string) => {
    if (e.key === 'Enter') commitRenameLayout(layoutId)
    if (e.key === 'Escape') setRenamingLayoutId(null)
  }

  const handleUpdateLayout = async (layoutId: string) => {
    const cwds: Record<string, string | null> = {}
    await Promise.all(
      terminals.map(async (t) => {
        cwds[t.id] = await window.electronAPI.terminal.getCwd(t.id).catch(() => null)
      })
    )
    updateLayout(layoutId, cwds)
    window.electronAPI.layouts.save(useStore.getState().savedLayouts)
  }

  const handleDeleteLayout = (layoutId: string) => {
    if (selectedLayoutId === layoutId) setSelectedLayoutId(null)
    deleteLayout(layoutId)
    window.electronAPI.layouts.save(useStore.getState().savedLayouts)
  }

  const gridPresets = [
    { cols: 1, rows: 1, icon: Layout1x1Icon, label: '1x1' },
    { cols: 1, rows: 2, icon: Layout1x2Icon, label: '1x2' },
    { cols: 2, rows: 1, icon: Layout2x1Icon, label: '2x1' },
    { cols: 2, rows: 2, icon: LayoutGridIcon, label: '2x2' },
    { cols: 3, rows: 2, icon: LayoutGridIcon, label: '3x2' },
    { cols: 3, rows: 3, icon: Layout3x3Icon, label: '3x3' },
  ]

  return (
    <aside className="asimov-sidebar w-[286px] shrink-0 glass border-r border-app-border/10 flex flex-col animate-slide-in overflow-y-auto font-mono">

      {/* === AGENTS === */}
      <div className="px-3 pt-3 pb-2 border-b border-app-border/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-app-text/35">Agents</span>
          <div className="flex-1 h-px bg-app-border/6" />
        </div>
        <div className="space-y-0.5">
          {(() => {
            const agentProfiles = profiles.filter((p) => AGENT_PROFILE_IDS.has(p.id))
            const visibleAgents = showAllAgents ? agentProfiles : agentProfiles.slice(0, 3)
            return (
              <>
                {visibleAgents.map((profile) => {
                  const isInstalled = installedProfiles.length === 0 || installedProfiles.includes(profile.id)
                  const agentDef = AGENTS.find((a) => a.id === profile.id)
                  const canInstall = !isInstalled && !!agentDef
                  const isPending = pendingAgent?.profileId === profile.id
                  return (
                    <div key={profile.id}>
                      <button
                        onClick={() => {
                          if (canInstall) setInstallModal(agentDef!)
                          else if (isPending) setPendingAgent(null)
                          else setPendingAgent({ profileId: profile.id, cwd: '' })
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group ${
                          isPending
                            ? 'bg-app-hover-overlay/8 text-app-text'
                            : isInstalled
                            ? 'hover:bg-app-hover-overlay/5 text-app-text/70 hover:text-app-text'
                            : 'text-app-text/30 hover:bg-app-hover-overlay/3 cursor-pointer'
                        }`}
                        title={canInstall ? `${profile.name} — not installed, click to install` : (agentDef?.description || profile.name)}
                      >
                        <div className={isInstalled ? '' : 'opacity-40'}>
                          <ProfileIcon icon={profile.icon} color={profile.color} />
                        </div>
                        <span className="text-xs flex-1 text-left truncate">{profile.name}</span>
                        {isInstalled ? (
                          <FolderIcon size={13} className={`transition-opacity text-app-text/40 ${isPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        ) : (
                          <span className="text-[9px] text-app-text/25 shrink-0">not installed</span>
                        )}
                      </button>

                      {isPending && (
                        <div className="mt-0.5 mx-1 mb-1 p-2 rounded-md bg-app-hover-overlay/6 border border-app-border/8 animate-slide-up">
                          <div className="flex items-center gap-1.5 mb-2 min-w-0">
                            <FolderIcon size={11} className="text-app-text/40 shrink-0" />
                            <input
                              value={pendingAgent!.cwd}
                              onChange={(e) => setPendingAgent({ ...pendingAgent!, cwd: e.target.value })}
                              placeholder="Home folder (default)"
                              className="flex-1 min-w-0 bg-transparent text-[10px] text-app-text/75 outline-none placeholder:text-app-text/30 truncate"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLaunchAgent()
                                if (e.key === 'Escape') setPendingAgent(null)
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleBrowseFolder}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-app-text/55 hover:text-app-text/85 hover:bg-app-hover-overlay/8 transition-colors"
                            >
                              <FolderIcon size={10} />
                              Browse
                            </button>
                            <button
                              onClick={() => setPendingAgent(null)}
                              className="px-2 py-1 rounded text-[10px] text-app-text/35 hover:text-app-text/65 hover:bg-app-hover-overlay/5 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleLaunchAgent}
                              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                            >
                              <PlayIcon size={10} />
                              Launch
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {agentProfiles.length > 3 && (
                  <button
                    onClick={() => setShowAllAgents(!showAllAgents)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-app-text/40 hover:text-app-text/65 hover:bg-app-hover-overlay/5 transition-all"
                  >
                    <ChevronDown size={10} className={`transition-transform ${showAllAgents ? 'rotate-0' : '-rotate-90'}`} />
                    {showAllAgents ? 'Show less' : `${agentProfiles.length - 3} more…`}
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* === SHELLS === */}
      <div className="px-3 pt-3 pb-2 border-b border-app-border/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-app-text/35">Shells</span>
          <div className="flex-1 h-px bg-app-border/6" />
        </div>
        <div className="space-y-0.5">
          {(() => {
            const shellProfiles = profiles
              .filter((p) => !AGENT_PROFILE_IDS.has(p.id))
              .filter((p) => isWindowsRuntime() || !WINDOWS_ONLY_PROFILE_IDS.has(p.id))
              .sort((a, b) => a.id === 'nexus' ? -1 : b.id === 'nexus' ? 1 : 0)
            const visibleShells = showAllShells ? shellProfiles : shellProfiles.slice(0, 3)
            return (
              <>
                {visibleShells.map((profile) => {
                  const isInstalled = installedProfiles.length === 0 || installedProfiles.includes(profile.id)
                  const installInfo = PROFILE_INSTALL_INFO.find((i) => i.id === profile.id)
                  const canShowInstall = !isInstalled && !!installInfo
                  return (
                    <button
                      key={profile.id}
                      onClick={() => canShowInstall ? setProfileInstallModal(installInfo!) : handleNewTerminal(profile)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group ${
                        isInstalled
                          ? 'hover:bg-app-hover-overlay/5 text-app-text/70 hover:text-app-text'
                          : 'text-app-text/30 hover:bg-app-hover-overlay/3 cursor-pointer'
                      }`}
                      title={canShowInstall ? `${profile.name} — not installed, click to install` : profile.name}
                    >
                      <div className={isInstalled ? '' : 'opacity-40'}>
                        <ProfileIcon icon={profile.icon} color={profile.color} />
                      </div>
                      <span className="text-xs flex-1 text-left truncate">{profile.name}</span>
                      {isInstalled ? (
                        <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-app-text/50" />
                      ) : (
                        <span className="text-[9px] text-app-text/25 shrink-0">not installed</span>
                      )}
                    </button>
                  )
                })}
                {shellProfiles.length > 3 && (
                  <button
                    onClick={() => setShowAllShells(!showAllShells)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-app-text/40 hover:text-app-text/65 hover:bg-app-hover-overlay/5 transition-all"
                  >
                    <ChevronDown size={10} className={`transition-transform ${showAllShells ? 'rotate-0' : '-rotate-90'}`} />
                    {showAllShells ? 'Show less' : `${shellProfiles.length - 3} more…`}
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {terminals.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-app-border/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-app-text/35">Sessions</span>
            <div className="flex-1 h-px bg-app-border/6" />
          </div>
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
                      : isIdle ? 'text-app-text/50' : 'text-app-text/65 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
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
                  {isIdle && <span className="text-[8px] text-app-text/40">{idleFor}s</span>}
                  {showDelete === term.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCloseTerminal(term.id) }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-app-text/50 hover:text-red-400 transition-colors shrink-0"
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

      <div className="px-3 py-2 border-b border-app-border/5">
        <button
          onClick={toggleBroadcast}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            broadcastMode
              ? 'bg-yellow-500/12 text-yellow-400/90 ring-1 ring-yellow-500/20'
              : 'text-app-text/45 hover:bg-app-hover-overlay/5 hover:text-app-text/70'
          }`}
        >
          <BroadcastIcon size={12} className={broadcastMode ? 'animate-pulse' : ''} />
          <span>Broadcast</span>
          <span className={`ml-auto text-[9px] font-bold tracking-wider ${broadcastMode ? 'text-yellow-400' : 'text-app-text/25'}`}>
            {broadcastMode ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      <div className="px-3 pt-3 pb-2 border-b border-app-border/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-app-text/35">Layout</span>
          <div className="flex-1 h-px bg-app-border/6" />
        </div>
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
                    : 'text-app-text/55 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
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
          className="flex items-center gap-1 text-[10px] text-app-text/50 hover:text-app-text/75 transition-colors mb-1"
        >
          <ChevronDown size={10} className={`transition-transform ${showLayouts ? 'rotate-0' : '-rotate-90'}`} />
          Saved Layouts
        </button>

        {showLayouts && (
          <div className="space-y-0.5 mb-1 animate-slide-up">
            {savedLayouts.length === 0 && (
              <span className="text-[10px] text-app-text/40 italic">No saved layouts</span>
            )}
            {savedLayouts.map((layout) => {
              const isSelected = selectedLayoutId === layout.id
              return (
                <div
                  key={layout.id}
                  className={`flex items-center gap-1 group rounded transition-all ${
                    isSelected ? 'bg-accent/10 ring-1 ring-accent/20' : ''
                  }`}
                >
                  {renamingLayoutId === layout.id ? (
                    <input
                      value={renameLayoutValue}
                      onChange={(e) => setRenameLayoutValue(e.target.value)}
                      onBlur={() => commitRenameLayout(layout.id)}
                      onKeyDown={(e) => handleRenameLayoutKeyDown(e, layout.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-app-hover-overlay/5 border border-accent/40 rounded px-1.5 py-0.5 text-[10px] text-app-text/80 outline-none focus:border-accent/70 mx-1"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedLayoutId(isSelected ? null : layout.id)}
                      onDoubleClick={(e) => startRenameLayout(layout, e)}
                      className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-all text-left ${
                        isSelected
                          ? 'text-accent'
                          : 'text-app-text/60 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
                      }`}
                      title="Double-click to rename"
                    >
                      <BookmarkIcon size={10} className={isSelected ? 'text-accent' : ''} />
                      <span className="truncate">{layout.name}</span>
                      <span className={isSelected ? 'text-accent/60' : 'text-app-text/40'}>
                        {layout.cols}x{layout.rows}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLoadLayout(layout.id) }}
                    className="p-0.5 rounded hover:bg-app-hover-overlay/10 text-app-text/40 hover:text-app-text/70 transition-colors opacity-0 group-hover:opacity-100"
                    title="Load layout"
                  >
                    <PlayIcon size={10} />
                  </button>
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpdateLayout(layout.id) }}
                      className="p-0.5 rounded hover:bg-accent/20 text-accent/60 hover:text-accent transition-colors"
                      title="Update with current state"
                    >
                      <RotateCw size={10} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteLayout(layout.id) }}
                    className="p-0.5 rounded hover:bg-red-500/20 text-app-text/45 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete layout"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {showLayoutSave ? (
          <div className="flex gap-1 animate-slide-up">
            <input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLayout(); if (e.key === 'Escape') setShowLayoutSave(false) }}
              placeholder="Layout name..."
              className="flex-1 bg-app-hover-overlay/5 border border-app-border/10 rounded px-1.5 py-0.5 text-[10px] text-app-text/70 outline-none focus:border-accent/50 placeholder:text-app-text/40"
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
            className="flex items-center gap-1 text-[10px] text-app-text/50 hover:text-accent/70 transition-colors"
          >
            <SaveIcon size={10} />
            Save current layout
          </button>
        )}
      </div>

      <div className="px-3 pt-3 pb-2 border-b border-app-border/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-app-text/35">View</span>
          <div className="flex-1 h-px bg-app-border/6" />
        </div>
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setAppTheme('dark')}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
              appTheme === 'dark' ? 'bg-accent/20 text-accent' : 'text-app-text/55 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
            }`}
          >
            <DarkModeIcon size={12} />
            Dark
          </button>
          <button
            onClick={() => setAppTheme('light')}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
              appTheme === 'light' ? 'bg-accent/20 text-accent' : 'text-app-text/55 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
            }`}
          >
            <LightModeIcon size={12} />
            Light
          </button>
        </div>

        <button
          onClick={() => setShowThemes(!showThemes)}
          className="flex items-center gap-1 text-[10px] text-app-text/50 hover:text-app-text/75 transition-colors mb-1"
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
                    : 'text-app-text/55 hover:bg-app-hover-overlay/5 hover:text-app-text/80'
                }`}
              >
                <div
                  className="w-4 h-4 rounded border border-app-border/10 shrink-0"
                  style={{ background: theme.background }}
                />
                <span className="flex-1 text-left leading-tight">
                  {theme.name}
                  {theme.fontFamily && (
                    <span className="block text-[9px] text-app-text/35 font-normal">
                      {theme.fontFamily.split(',')[0].replace(/"/g, '')}
                    </span>
                  )}
                </span>
                {terminalTheme.name === theme.name && <NexusShellIcon size={10} className="text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {installModal && (
        <AgentInstallModal
          agent={installModal}
          onClose={() => setInstallModal(null)}
          onInstall={handleInstallAgent}
        />
      )}

      {profileInstallModal && (
        <AgentInstallModal
          agent={{ ...profileInstallModal, command: profileInstallModal.id }}
          onClose={() => setProfileInstallModal(null)}
          onInstall={handleInstallAgent}
        />
      )}

      <div className="mt-auto p-3 border-t border-app-border/5 flex items-center justify-between">
        <span className="text-[10px] text-app-text/30 font-mono">
          {appVersion ? `v${appVersion}` : ''}
        </span>
        <button
          onClick={() => {
            setUpdateCheckState('checking')
            window.electronAPI.updater.checkForUpdates()
          }}
          disabled={updateCheckState === 'checking'}
          title={
            updateCheckState === 'checking' ? 'Checking for updates…'
            : updateCheckState === 'ok' ? 'Up to date'
            : updateCheckState === 'error' ? 'Update check failed'
            : 'Check for updates'
          }
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all disabled:cursor-not-allowed text-app-text/35 hover:text-app-text/70 hover:bg-app-hover-overlay/5 disabled:text-app-text/25"
        >
          {updateCheckState === 'checking' && <RefreshIcon size={10} className="animate-spin" />}
          {updateCheckState === 'ok' && <CheckIcon size={10} className="text-green-400" />}
          {updateCheckState === 'error' && <AlertIcon size={10} className="text-red-400" />}
          {updateCheckState === 'idle' && <RefreshIcon size={10} />}
          <span>
            {updateCheckState === 'checking' ? 'Checking…'
              : updateCheckState === 'ok' ? 'Up to date'
              : updateCheckState === 'error' ? 'Check failed'
              : 'Check for updates'}
          </span>
        </button>
      </div>
    </aside>
  )
}
