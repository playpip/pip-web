'use client'

/**
 * Between hands, a newcomer who is signed out is offered a free account: once
 * they are ahead, or a few hands in (lib/newPlayer `offersSaveMidRun`). It sits
 * above "Next hand", so it never covers a decision, and "Not now" puts it away
 * for the rest of the sitting.
 */

import { motion } from 'framer-motion'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { signupFact } from '@/components/settings/AccountOffer'
import { useState } from 'react'
import { offersSaveMidRun } from '@/lib/newPlayer'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

export function SaveNudge({
  handIndex,
  chipsUp,
  cash,
  dismissed,
  onDismiss,
}: {
  handIndex: number
  chipsUp: number
  cash: boolean
  dismissed: boolean
  onDismiss: () => void
}) {
  const money = useMoney()
  const ready = useSync((s) => s.ready)
  const status = useSync((s) => s.status)
  const tournamentsEntered = useProfile((s) => s.stats.tournamentsEntered)
  const [open, setOpen] = useState(false)

  const show = offersSaveMidRun({
    signedOut: ready && status === 'signed-out',
    dismissed,
    betweenHands: true,
    cash,
    tournamentsEntered,
    handIndex,
    chipsUp,
  })
  if (!show && !open) return null

  return (
    <>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-2xl border border-foreground/10 bg-background/80 p-3 text-left backdrop-blur-md"
        >
          <p className="text-sm font-medium">
            {chipsUp > 0
              ? `You're up ${money(chipsUp)} chips. Save your Roll with a free account.`
              : 'Save your Roll with a free account.'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{signupFact()}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                sound.play('tap')
                setOpen(true)
              }}
              className="min-h-10 flex-1 rounded-xl bg-foreground/10 text-sm font-semibold transition hover:bg-foreground/15 active:scale-[0.98]"
            >
              Save my Roll
            </button>
            <button
              type="button"
              onClick={() => {
                sound.play('tap')
                onDismiss()
              }}
              className="min-h-10 rounded-xl px-4 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
      <AccountDialog open={open} mode="signup" onOpenChange={setOpen} />
    </>
  )
}
