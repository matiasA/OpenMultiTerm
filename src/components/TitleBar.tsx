import { useState, useEffect } from 'react'
import { Minus, Square, X, Minimize2, PanelLeft } from 'lucide-react'
import { useStore } from '../store'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const { sidebarOpen, toggleSidebar } = useStore()

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized)
  }, [])

  const handleMaximize = async () => {
    const result = await window.electronAPI.window.maximize()
    setIsMaximized(result)
  }

  return (
    <div className="titlebar-drag h-9 flex items-center justify-between shrink-0 bg-gradient-to-r from-titlebar-start via-titlebar-mid to-titlebar-end border-b border-app-border/5">

      <div className="flex items-center gap-1.5 pl-2">
        <button
          onClick={toggleSidebar}
          className={`no-drag h-6 w-6 flex items-center justify-center rounded transition-colors ${
            sidebarOpen
              ? 'text-app-text/40 hover:text-app-text/70 hover:bg-app-hover-overlay/5'
              : 'text-accent/70 hover:text-accent hover:bg-accent/10'
          }`}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <PanelLeft size={13} />
        </button>

        <div className="w-px h-4 bg-app-border/8 mx-0.5" />

        <div className="flex items-center gap-1.5">
          <img src="./logo.png" alt="" className="w-5 h-5 object-contain opacity-90" />
          <span className="text-[11px] font-semibold text-app-text/70 tracking-wide select-none">
            OpenMultiTerm
          </span>
        </div>
      </div>

      <div className="flex items-center h-full no-drag">
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="h-full w-10 flex items-center justify-center text-app-text/35 hover:text-app-text/70 hover:bg-app-hover-overlay/5 transition-colors"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-10 flex items-center justify-center text-app-text/35 hover:text-app-text/70 hover:bg-app-hover-overlay/5 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={12} /> : <Square size={11} />}
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="h-full w-10 flex items-center justify-center text-app-text/35 hover:text-white hover:bg-red-500/75 transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
