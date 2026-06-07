import { useEffect, useCallback, useRef } from 'react'
import { useStore } from './store'
import { assetUrl } from './asset-url'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import TerminalGrid from './components/TerminalGrid'
import StatusBar from './components/StatusBar'
import CommandPalette from './components/CommandPalette'
import UpdateToast from './components/UpdateToast'
import type { Profile, SessionSnapshot } from './types'
import { ASIMOV_DARK, OMT_LIGHT } from './themes'

export default function App() {
  const {
    setProfiles, terminals, sidebarOpen, setShowCommandPalette,
    setAppTheme, setTerminalTheme, appTheme, addTerminal, setGridLayout,
    toggleSidebar, setSavedLayouts,
  } = useStore()

  const restoredRef = useRef(false)
  const assetStyle = {
    '--asimov-orbital-map': `url("${assetUrl('assets/asimov-orbital-map.svg')}")`,
    '--asimov-city': `url("${assetUrl('assets/asimov-city.svg')}")`,
  } as React.CSSProperties

  useEffect(() => {
    const loadData = async () => {
      // Profiles — retry once if the daemon is still warming up
      let profiles: Profile[] = []
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          profiles = await window.electronAPI.profiles.get()
          break
        } catch (err) {
          if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
          else console.error('Could not load profiles:', err)
        }
      }
      setProfiles(profiles)

      try {
        const layouts = await window.electronAPI.layouts.load()
        if (layouts.length) setSavedLayouts(layouts)
      } catch {}

      if (restoredRef.current) return
      restoredRef.current = true

      // Primary path: re-attach to live daemon sessions (PTYs survived window close)
      const liveSessions = await window.electronAPI.terminal.list().catch(() => [])
      if (liveSessions.length > 0) {
        const snapshot = await window.electronAPI.snapshot.load().catch(() => null)
        if (snapshot?.gridLayout) setGridLayout(snapshot.gridLayout.cols, snapshot.gridLayout.rows)
        liveSessions.forEach(({ sessionId, profileId }: { sessionId: string; profileId: string }) => {
          const profile = profiles.find((p: Profile) => p.id === profileId)
          addTerminal({ id: sessionId, profileId, title: profile?.name ?? 'Terminal', status: 'running', lastActivityTime: Date.now() })
        })
        return
      }

      // Fallback: no live sessions → daemon restarted, restore from snapshot
      try {
        const snapshot = await window.electronAPI.snapshot.load()
        if (snapshot && snapshot.terminals && snapshot.terminals.length > 0) {
          await window.electronAPI.snapshot.clear()
          setTimeout(() => restoreSnapshot(snapshot), 400)
        }
      } catch {}
    }

    loadData()

    const unsubExit = window.electronAPI.terminal.onExit((sessionId, code) => {
      useStore.getState().updateTerminalStatus(sessionId, 'exited', code)
    })

    const unsubWillQuit = window.electronAPI.app.onWillQuit(() => {
      saveSnapshot()
    })

    return () => {
      unsubExit()
      unsubWillQuit()
    }
  }, [])

  const restoreSnapshot = useCallback((snapshot: SessionSnapshot) => {
    const { profiles, addTerminal, setGridLayout } = useStore.getState()

    setGridLayout(snapshot.gridLayout.cols, snapshot.gridLayout.rows)

    snapshot.terminals.forEach((st) => {
      const profile = profiles.find((p) => p.id === st.profileId)
      if (profile) {
        window.electronAPI.terminal.create(profile.id, 120, 40).then(
          ({ sessionId }) => {
            addTerminal({
              id: sessionId,
              profileId: profile.id,
              title: st.customTitle || profile.name,
              customTitle: st.customTitle,
              status: 'running',
              lastActivityTime: Date.now(),
            })
          }
        )
      }
    })
  }, [])

  const saveSnapshot = useCallback(() => {
    const state = useStore.getState()
    if (state.terminals.length === 0) return
    const snapshot = state.getSnapshot()
    window.electronAPI.snapshot.save(snapshot)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      if (mod && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        const { profiles, addTerminal } = useStore.getState()
        const profile = profiles[0]
        if (profile) {
          window.electronAPI.terminal.create(profile.id, 120, 40).then(
            ({ sessionId }) => {
              addTerminal({
                id: sessionId,
                profileId: profile.id,
                title: profile.name,
                status: 'running',
                lastActivityTime: Date.now(),
              })
            }
          )
        }
        return
      }

      if (mod && e.shiftKey && e.key === 'W') {
        e.preventDefault()
        const { activeTerminalId, removeTerminal } = useStore.getState()
        if (activeTerminalId) {
          window.electronAPI.terminal.destroy(activeTerminalId)
          removeTerminal(activeTerminalId)
        }
        return
      }

      if (mod && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        useStore.getState().toggleBroadcast()
        return
      }

      if (mod && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      if (mod && e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        const { terminals, setActiveTerminal } = useStore.getState()
        if (terminals[index]) {
          setActiveTerminal(terminals[index].id)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleBeforeUnload = () => saveSnapshot()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveSnapshot])

  useEffect(() => {
    if (appTheme === 'light') {
      setTerminalTheme(OMT_LIGHT)
    } else {
      setTerminalTheme(ASIMOV_DARK)
    }
  }, [appTheme])

  return (
    <div
      data-theme={appTheme}
      style={assetStyle}
      className="asimov-shell h-full w-full flex flex-col bg-app-bg text-app-text"
    >
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="asimov-main flex-1 flex flex-col overflow-hidden">
          <TerminalGrid />
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
      <UpdateToast />
    </div>
  )
}
