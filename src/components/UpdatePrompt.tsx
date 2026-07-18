'use client'

import { sound } from '@/lib/sound'
import { useServiceWorkerUpdate } from '@/lib/useServiceWorker'

/**
 * A quiet nudge, bottom-centre, when a new version has been deployed and is
 * waiting to take over. Tapping Reload applies it (the page refreshes onto the
 * new assets). Non-blocking — the user can keep playing and reload later.
 */
export function UpdatePrompt() {
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()
  if (!updateReady) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full bg-foreground px-4 py-2.5 text-background shadow-lg">
        <span className="text-sm font-medium">A new version of Pip is ready.</span>
        <button
          onClick={() => {
            sound.play('tap')
            applyUpdate()
          }}
          className="rounded-full bg-background/15 px-3 py-1 text-sm font-semibold transition hover:bg-background/25"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
