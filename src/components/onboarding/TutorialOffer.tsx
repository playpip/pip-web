'use client'

// The one-time "New to poker?" beat after profile creation — an interstitial
// step in the create flow, not a modal and not persisted state. `created`
// gates onboarding, so it can only ever appear once; no flag, no nag.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { sound } from '@/lib/sound'

export function TutorialOffer({ onDeclined }: { onDeclined: () => void }) {
  // Two equal-weight choices — the tour is an offer, not a tollbooth.
  const choice =
    'w-full rounded-2xl bg-foreground/[0.05] py-4 text-lg font-semibold transition hover:bg-foreground/10 active:scale-[0.98]'
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="w-full max-w-sm text-center"
      >
        <h1 className="text-3xl font-semibold tracking-tight">New to poker?</h1>
        <p className="mt-3 text-muted-foreground">
          Three minutes, eight ideas, no quiz. Skippable at any point.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/learn?from=onboarding" onClick={() => sound.play('call')} className={choice}>
            Show me the basics
          </Link>
          <button
            onClick={() => {
              sound.play('call')
              onDeclined()
            }}
            className={choice}
          >
            Deal me in
          </button>
        </div>
      </motion.div>
    </div>
  )
}
