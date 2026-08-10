'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { currentChallenge } from '@/lib/challenge'
import { useProfile } from '@/store/profile'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'

/**
 * The standing challenge: a cast member waiting on the home screen with a
 * heads-up game. Their face, their line, the stakes, one way in.
 *
 * **There is no dismiss control and there never will be.** Nothing here
 * expires, counts down or keeps score, so there is nothing to nag you with and
 * nothing to close — which is the whole reason this is the version of a
 * retention loop that survives the house philosophy (technology#22).
 *
 * Renders nothing when the Roll cannot cover even the lowest challenge buy-in:
 * a standing invitation you cannot accept is worse than no invitation, and the
 * freeroll is the answer at that point, not a locked card.
 */
export function ChallengeCard({ delay = 0 }: { delay?: number }) {
  const router = useRouter()
  const money = useMoney()
  const { roll, venueRecords, challengeWins, challengesPlayed } = useProfile()

  const challenge = currentChallenge({ roll, venueRecords, challengeWins, challengesPlayed })
  if (!challenge) return null
  const { character, venue, rematch } = challenge

  return (
    // Same treatment as the other menu cards: animate a plain wrapper and leave
    // the rounded card static, so iOS doesn't re-rasterise its mask each frame.
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3">
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.04]">
            <PlayerAvatar spec={character.avatar} size={44} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{character.name}</span>
              {/* Cleared the band, so this one is a rematch — said plainly,
                  because a face you have already beaten reappearing without a
                  word reads as the game losing track. */}
              {rematch && (
                <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Rematch
                </span>
              )}
            </div>
            {character.lines.challenge && (
              <p className="mt-0.5 text-sm text-muted-foreground">{character.lines.challenge}</p>
            )}
          </div>
        </div>
        {/* Stakes and the way in, on their own row: at 320px a button beside
            the line squeezes the copy to two words a row. */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm tabular-nums text-muted-foreground">
            Heads-up · {money(venue.buyIn)} in · {money(venue.prize)} to win
          </p>
          <button
            onClick={() => {
              sound.play('call')
              router.push(`/play/${venue.id}`)
            }}
            className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            Sit down
          </button>
        </div>
      </div>
    </motion.div>
  )
}
