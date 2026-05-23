import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized)
  }, [])

  const handleMaximize = async () => {
    const result = await window.electronAPI.window.maximize()
    setIsMaximized(result)
  }

  return (
    <div className="titlebar-drag h-9 flex items-center justify-between shrink-0 bg-gradient-to-r from-titlebar-start via-titlebar-mid to-titlebar-end border-b border-app-border/5">
      <div className="flex items-center gap-3 pl-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-accent to-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(124,92,252,0.4)]">
            <span className="text-[10px] font-bold text-white">O</span>
          </div>
          <span className="text-xs font-medium text-app-text/80 tracking-wide">OpenMultiTerm</span>
        </div>
      </div>

      <div className="flex items-center h-full no-drag">
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="h-full w-10 flex items-center justify-center hover:bg-app-hover-overlay/5 text-app-text/50 hover:text-app-text/80 transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-10 flex items-center justify-center hover:bg-app-hover-overlay/5 text-app-text/50 hover:text-app-text/80 transition-colors"
        >
          {isMaximized ? <Minimize2 size={13} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="h-full w-10 flex items-center justify-center hover:bg-red-500/80 text-app-text/50 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
