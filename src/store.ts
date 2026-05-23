import { create } from 'zustand'
import type { Profile, TerminalSession, GridLayout, CommandEntry, SavedLayout, SessionSnapshot, AppTheme, XtermTheme } from './types'
import { OMT_DARK } from './themes'

interface AppState {
  terminals: TerminalSession[]
  profiles: Profile[]
  activeTerminalId: string | null
  gridLayout: GridLayout
  sidebarOpen: boolean
  viewMode: 'grid' | 'tab'
  broadcastMode: boolean
  commandHistory: CommandEntry[]
  savedLayouts: SavedLayout[]
  appTheme: AppTheme
  terminalTheme: XtermTheme
  showCommandPalette: boolean
  notifyTimeout: number

  setProfiles: (profiles: Profile[]) => void
  addTerminal: (session: TerminalSession) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  updateTerminalStatus: (id: string, status: 'running' | 'exited', exitCode?: number) => void
  updateTerminalActivity: (id: string) => void
  renameSession: (id: string, title: string) => void
  setGridLayout: (cols: number, rows: number) => void
  toggleSidebar: () => void
  setViewMode: (mode: 'grid' | 'tab') => void
  toggleBroadcast: () => void
  moveTerminal: (fromIndex: number, toIndex: number) => void
  getNextCellIndex: () => number
  addCommand: (sessionId: string, sessionTitle: string, command: string) => void
  clearCommandHistory: () => void

  saveLayout: (name: string) => SavedLayout
  loadLayout: (layoutId: string) => void
  deleteLayout: (layoutId: string) => void
  setSavedLayouts: (layouts: SavedLayout[]) => void

  getSnapshot: () => SessionSnapshot
  restoreSnapshot: (snapshot: SessionSnapshot, cb: (profileId: string) => void) => void

  setAppTheme: (theme: AppTheme) => void
  setTerminalTheme: (theme: XtermTheme) => void
  setShowCommandPalette: (show: boolean) => void
}

function autoGrid(count: number): GridLayout {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (count <= 2) return { cols: 1, rows: 2 }
  if (count <= 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: 2 }
  if (count <= 9) return { cols: 3, rows: 3 }
  const cols = Math.ceil(Math.sqrt(count))
  return { cols, rows: Math.ceil(count / cols) }
}

export const useStore = create<AppState>((set, get) => ({
  terminals: [],
  profiles: [],
  activeTerminalId: null,
  gridLayout: { cols: 2, rows: 2 },
  sidebarOpen: true,
  viewMode: 'grid',
  broadcastMode: false,
  commandHistory: [],
  savedLayouts: [],
  appTheme: 'dark',
  terminalTheme: OMT_DARK,
  showCommandPalette: false,
  notifyTimeout: 15,

  setProfiles: (profiles) => set({ profiles }),

  addTerminal: (session) =>
    set((state) => {
      const terminals = [...state.terminals, session]
      const grid = autoGrid(terminals.length)
      return { terminals, gridLayout: grid, activeTerminalId: session.id }
    }),

  removeTerminal: (id) =>
    set((state) => {
      const terminals = state.terminals.filter((t) => t.id !== id)
      const grid = autoGrid(Math.max(1, terminals.length))
      const activeTerminalId =
        state.activeTerminalId === id
          ? terminals.length > 0
            ? terminals[terminals.length - 1].id
            : null
          : state.activeTerminalId
      return { terminals, gridLayout: grid, activeTerminalId }
    }),

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  updateTerminalStatus: (id, status, exitCode) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, status, exitCode } : t
      ),
    })),

  updateTerminalActivity: (id) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, lastActivityTime: Date.now() } : t
      ),
    })),

  renameSession: (id, title) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, customTitle: title } : t
      ),
    })),

  setGridLayout: (cols, rows) => set({ gridLayout: { cols, rows } }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleBroadcast: () => set((state) => ({ broadcastMode: !state.broadcastMode })),

  moveTerminal: (fromIndex, toIndex) =>
    set((state) => {
      const terminals = [...state.terminals]
      const [moved] = terminals.splice(fromIndex, 1)
      terminals.splice(toIndex, 0, moved)
      return { terminals }
    }),

  getNextCellIndex: () => {
    const { terminals, gridLayout } = get()
    const maxCells = gridLayout.cols * gridLayout.rows
    if (terminals.length < maxCells) return terminals.length
    return terminals.length
  },

  addCommand: (sessionId, sessionTitle, command) =>
    set((state) => ({
      commandHistory: [
        {
          id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sessionId,
          sessionTitle,
          command,
          timestamp: Date.now(),
        },
        ...state.commandHistory,
      ].slice(0, 500),
    })),

  clearCommandHistory: () => set({ commandHistory: [] }),

  saveLayout: (name) => {
    const state = get()
    const layout: SavedLayout = {
      id: `layout_${Date.now()}`,
      name,
      cols: state.gridLayout.cols,
      rows: state.gridLayout.rows,
      terminals: state.terminals.map((t) => ({
        profileId: t.profileId,
        title: t.customTitle || t.title,
      })),
      createdAt: Date.now(),
    }
    set((s) => ({ savedLayouts: [...s.savedLayouts, layout] }))
    return layout
  },

  loadLayout: (layoutId) => {
    const layout = get().savedLayouts.find((l) => l.id === layoutId)
    if (!layout) return
    set({
      gridLayout: { cols: layout.cols, rows: layout.rows },
    })
  },

  deleteLayout: (layoutId) =>
    set((state) => ({
      savedLayouts: state.savedLayouts.filter((l) => l.id !== layoutId),
    })),

  setSavedLayouts: (layouts) => set({ savedLayouts: layouts }),

  getSnapshot: () => {
    const state = get()
    return {
      gridLayout: state.gridLayout,
      terminals: state.terminals.map((t) => ({
        profileId: t.profileId,
        customTitle: t.customTitle,
      })),
      sidebarOpen: state.sidebarOpen,
      timestamp: Date.now(),
    }
  },

  restoreSnapshot: (_snapshot, _cb) => {},

  setAppTheme: (theme) => set({ appTheme: theme }),

  setTerminalTheme: (theme) => set({ terminalTheme: theme }),

  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
}))
