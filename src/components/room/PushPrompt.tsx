'use client'

// Pip's own question before a browser's, asked once and never again once
// answered either way: in the lobby (`menu/LobbyPush`), or at the first slow
// game's table for anyone who skipped it there. A browser only shows its
// prompt from a tap, so this card is the tap. The app asks the system
// straight away instead (LobbyPush).
//
// It also records this device's timezone for your quiet hours, the first time,
// so a slow clock stops at your night rather than at UTC's.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { deviceTimeZone } from '@/components/settings/SlowGamesSection'
import {
  enablePush,
  markPushAsked,
  pushAskedBefore,
  pushSupport,
  saveTimeZoneOnce,
} from '@/lib/push'
import { sound } from '@/lib/sound'

/** Whether this device could be asked, and has not been. */
function askable(): boolean {
  const support = pushSupport()
  if (support === 'web') return Notification.permission === 'default' && !pushAskedBefore()
  return support === 'app' && !pushAskedBefore()
}

export function PushPrompt({ question = 'Tell you when it’s your move?' }: { question?: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    void saveTimeZoneOnce(deviceTimeZone()).then((got) => {
      if (live && got?.push && askable()) setOpen(true)
    })
    return () => {
      live = false
    }
  }, [])

  const answer = async (yes: boolean) => {
    sound.play('tap')
    markPushAsked()
    setOpen(false)
    if (yes) await enablePush()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex w-full items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3 ring-1 ring-foreground/10"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Bell className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">{question}</p>
          <button
            onClick={() => void answer(false)}
            className="shrink-0 px-2 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Not now
          </button>
          <button
            onClick={() => void answer(true)}
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97]"
          >
            Turn on
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
