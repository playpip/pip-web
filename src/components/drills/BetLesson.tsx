'use client'

import { MotionConfig, motion } from 'framer-motion'
import { pct } from '@/config/potOdds'
import { cn } from '@/lib/utils'
import { CALL_SHARES } from '@/lib/drills/valueRange'
import { CardLesson, type LessonCard, Prose } from './CardLesson'

/**
 * The lesson before the bet-or-check pack: three cards, one idea.
 *
 * **One idea, the river pack's from the other seat**: a bet only makes money
 * from the hands that call it, so what matters is how many of *those* you
 * beat. Every share on these cards is read off the same table the spots are
 * graded with (`CALL_SHARES` in lib/drills/valueRange.ts), so the lesson cannot
 * teach a range the pack then grades differently.
 */

/**
 * The strip that draws who calls: the calls you beat, the calls that beat you,
 * and a line at a half, which is where a value bet breaks even whatever its
 * size. Beaten first, so the green's right-hand end *is* your share.
 */
export function CallStrip({
  calls,
  callsBeaten,
  animate = true,
}: {
  calls: number
  callsBeaten: number
  animate?: boolean
}) {
  const share = calls === 0 ? 0 : callsBeaten / calls
  const segments = [
    { key: 'beaten', width: share * 100, className: 'bg-emerald-500' },
    { key: 'beats', width: (1 - share) * 100, className: 'bg-foreground/35' },
  ]
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full">
        <div className="relative pt-5">
          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
            <span className="whitespace-nowrap text-2xs font-medium text-foreground">Need 50%</span>
            <span className="mt-0.5 h-6 w-0.5 rounded-full bg-foreground" />
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            {segments.map((segment, i) => (
              <motion.span
                key={segment.key}
                className={cn('h-full', segment.className, i > 0 && 'border-l border-background')}
                initial={animate ? { width: '0%' } : false}
                animate={{ width: `${segment.width}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.05 * i }}
              />
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3 text-2xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-emerald-500">You win {pct(share)}%</span>
          <span className="flex items-center gap-2">
            <Swatch className="bg-emerald-500" label="Calls you beat" />
            <Swatch className="bg-foreground/35" label="Calls that beat you" />
          </span>
        </div>
      </div>
    </MotionConfig>
  )
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-full', className)} />
      {label}
    </span>
  )
}

/** Card one: why the only hands that matter are the ones that call. */
function WhyCard() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-foreground/[0.04] px-3 py-3">
          <div className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
            They fold
          </div>
          <div className="mt-1 text-sm font-semibold">You win the pot</div>
          <div className="text-2xs text-muted-foreground">Same as checking, mostly</div>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 px-3 py-3 ring-1 ring-emerald-500/30">
          <div className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
            They call
          </div>
          <div className="mt-1 text-sm font-semibold">One more bet changes hands</div>
          <div className="text-2xs text-muted-foreground">Yours when you are ahead</div>
        </div>
      </div>
      <Prose>
        <p>
          It is checked to you on the river. Check, and the best hand wins the pot. Bet, and a hand
          that folds would mostly have lost to you anyway: the pot was yours either way.
        </p>
        <p>
          The bet only earns anything from <strong>the hands that call it</strong>. Each of those
          pays you a bet when you are ahead and takes a bet off you when you are not.
        </p>
      </Prose>
    </>
  )
}

/** Card two: who calls, and how the size changes it. */
function WhoCard() {
  const sizes = [
    { label: 'Half the pot', band: CALL_SHARES[0] },
    { label: 'Two-thirds', band: CALL_SHARES[1] },
    { label: 'The pot', band: CALL_SHARES[2] },
  ]
  return (
    <>
      <div className="space-y-2">
        {sizes.map((size, i) => {
          const mid = (size.band.tight + size.band.loose) / 2
          return (
            <div key={size.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-2xs text-muted-foreground">{size.label}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/40"
                  initial={{ width: '0%' }}
                  animate={{ width: `${mid * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.08 * i }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                {Math.round(size.band.tight * 100)}–{Math.round(size.band.loose * 100)}%
              </span>
            </div>
          )
        })}
      </div>
      <Prose>
        <p>
          What calls is <strong>the better part of the hands they made</strong>: a pair or better
          with one of their own cards, strongest first. Almost nothing that missed calls, because it
          cannot beat anything.
        </p>
        <p>
          How much of it depends on the size. We counted our own regulars: against half the pot they
          call with most of their pairs and better; against the pot, with not much more than half. A
          bigger bet wins more from the hands that call, and is called by better ones.
        </p>
      </Prose>
    </>
  )
}

/** The worked example for card three. Counts, so the strip is exact. */
const EXAMPLE = { calls: 40, callsBeaten: 26 }

/** Card three: the line that never moves. */
function LineCard() {
  return (
    <>
      <CallStrip {...EXAMPLE} />
      <Prose>
        <p>
          Say {EXAMPLE.calls} hands call and you beat {EXAMPLE.callsBeaten} of them. That is{' '}
          {pct(EXAMPLE.callsBeaten / EXAMPLE.calls)}%: more often than not, each call pays you. Bet.
        </p>
        <p>
          <strong>The line is always a half.</strong> The river call had a price to work out; a
          value bet does not. What the size changes is who is on the strip. With a hand that beats
          the weaker pairs but not the stronger, a big bet can fold out what you beat and be called
          by what beats you. Then check.
        </p>
      </Prose>
    </>
  )
}

const CARDS: readonly LessonCard[] = [
  { title: 'Who pays you', body: WhyCard },
  { title: 'What calls', body: WhoCard },
  { title: 'More than half', body: LineCard },
]

export function BetLesson({ onDone }: { onDone: () => void }) {
  return <CardLesson name="Bet or check" cards={CARDS} onDone={onDone} />
}
