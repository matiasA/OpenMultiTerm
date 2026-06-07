import { useState, useEffect } from 'react'
import { Minus, Square, X, Minimize2, PanelLeft } from 'lucide-react'
import { useStore } from '../store'
import openMultiTermLogo from '../assets/openmultiterm-logo-chatgpt-cutout.png'

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
    <div className="titlebar-drag h-[52px] flex items-center justify-between shrink-0 bg-gradient-to-r from-titlebar-start via-titlebar-mid to-titlebar-end border-b border-app-border/10">

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

        <div className="w-px h-5 bg-app-border/10 mx-1" />

        <div className="flex items-center gap-3">
          <img
            src={openMultiTermLogo}
            alt=""
            className="h-8 w-8 object-contain select-none"
            draggable={false}
          />
          <span className="font-display text-[15px] font-medium uppercase tracking-[0.24em] text-app-text/90 select-none">
            OPENMULTITERM
          </span>
        </div>
      </div>

      <div className="flex items-center h-full no-drag">
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="h-full w-10 flex items-center justify-center text-app-text/45 hover:text-[color:var(--asimov-amber)] hover:bg-app-hover-overlay/6 transition-colors"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-10 flex items-center justify-center text-app-text/45 hover:text-[color:var(--asimov-amber)] hover:bg-app-hover-overlay/6 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={12} /> : <Square size={11} />}
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="h-full w-10 flex items-center justify-center text-app-text/45 hover:text-[color:var(--asimov-amber)] hover:bg-app-hover-overlay/6 transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
