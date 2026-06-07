import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, Check, AlertCircle } from 'lucide-react'
import { useStore } from '../store'

type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'

interface UpdateToastProps {
  onStateChange?: (state: UpdateState) => void
}

export default function UpdateToast({ onStateChange }: UpdateToastProps) {
  const [state, setState] = useState<UpdateState>('idle')
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  const transition = (next: UpdateState, show: boolean) => {
    setState(next)
    setVisible(show)
    onStateChange?.(next)
  }

  useEffect(() => {
    const unsubs = [
      window.electronAPI.updater.onChecking(() => transition('checking', false)),
      window.electronAPI.updater.onAvailable(() => transition('available', true)),
      window.electronAPI.updater.onNotAvailable(() => {
        transition('not-available', true)
        setTimeout(() => setVisible(false), 3000)
      }),
      window.electronAPI.updater.onDownloaded(() => transition('downloaded', true)),
      window.electronAPI.updater.onError(() => {
        transition('error', true)
        setTimeout(() => setVisible(false), 4000)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  if (!visible) return null

  const config = {
    available: {
      icon: <Download size={13} className="animate-bounce" />,
      iconBg: 'bg-blue-500/15 text-blue-400',
      title: 'Update available',
      body: 'Downloading in the background…',
    },
    downloaded: {
      icon: <RefreshCw size={13} />,
      iconBg: 'bg-accent/15 text-accent',
      title: 'Update ready',
      body: 'Restart OpenMultiTerm to apply the new version.',
    },
    'not-available': {
      icon: <Check size={13} />,
      iconBg: 'bg-green-500/15 text-green-400',
      title: 'Up to date',
      body: 'You are running the latest version.',
    },
    error: {
      icon: <AlertCircle size={13} />,
      iconBg: 'bg-red-500/15 text-red-400',
      title: 'Update check failed',
      body: 'Could not reach the update server.',
    },
  } as const

  if (state === 'idle' || state === 'checking') return null
  const c = config[state as keyof typeof config]
  if (!c) return null

  return (
    <div className="fixed bottom-9 right-3 z-50 w-72 animate-slide-up">
      <div className="bg-app-elevated border border-app-border/10 rounded-lg shadow-lg shadow-black/30 overflow-hidden">
        <div className="flex items-start gap-3 p-3">
          <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${c.iconBg}`}>
            {c.icon}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-app-text/90">{c.title}</p>
            <p className="text-[10px] text-app-text/50 mt-0.5">{c.body}</p>
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
              onClick={async () => {
                if (installing) return
                setInstalling(true)
                const { terminals, getSnapshot } = useStore.getState()
                if (terminals.length > 0) {
                  await window.electronAPI.snapshot.save(getSnapshot())
                }
                await window.electronAPI.updater.install()
              }}
              disabled={installing}
              className="w-full py-1.5 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-60 disabled:cursor-default text-white text-[11px] font-medium transition-colors"
            >
              {installing ? 'Restarting…' : 'Restart now'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
