import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloaded'

export default function UpdateToast() {
  const [state, setState] = useState<UpdateState>('idle')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const unsubAvailable = window.electronAPI.updater.onAvailable(() => {
      setState('available')
      setVisible(true)
    })
    const unsubDownloaded = window.electronAPI.updater.onDownloaded(() => {
      setState('downloaded')
      setVisible(true)
    })
    return () => {
      unsubAvailable()
      unsubDownloaded()
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-9 right-3 z-50 w-72 animate-slide-up">
      <div className="bg-app-elevated border border-app-border/10 rounded-lg shadow-lg shadow-black/30 overflow-hidden">
        <div className="flex items-start gap-3 p-3">
          <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
            state === 'downloaded'
              ? 'bg-accent/15 text-accent'
              : 'bg-blue-500/15 text-blue-400'
          }`}>
            {state === 'downloaded'
              ? <RefreshCw size={13} />
              : <Download size={13} className="animate-bounce" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-app-text/90">
              {state === 'downloaded' ? 'Update ready' : 'Update available'}
            </p>
            <p className="text-[10px] text-app-text/50 mt-0.5">
              {state === 'downloaded'
                ? 'Restart OpenMultiTerm to apply the new version.'
                : 'Downloading in the background…'
              }
            </p>
          </div>

          <button
            onClick={() => setVisible(false)}
            className="shrink-0 p-0.5 rounded text-app-text/25 hover:text-app-text/60 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {state === 'downloaded' && (
          <div className="px-3 pb-3">
            <button
              onClick={() => window.electronAPI.updater.install()}
              className="w-full py-1.5 rounded-md bg-accent hover:bg-accent/90 text-white text-[11px] font-medium transition-colors"
            >
              Restart now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
