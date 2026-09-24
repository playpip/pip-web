'use client'

import { MotionConfig, motion } from 'framer-motion'
import { pct } from '@/config/potOdds'
import { seatById } from '@/config/positions'
import {
  BLINDS,
  SHOVE_SEATS,
  classIndex,
  nashFor,
  rangeShare,
  shoveEv,
} from '@/lib/drills/shoveRange'
import { CardLesson, type LessonCard, Prose } from './CardLesson'

/**
 * The lesson before the shove-or-fold pack: three cards, one idea.
 *
 * **Every number on these cards is the pack's own arithmetic**, run on the
 * worked example as the card draws: the fold chance, the equity when called,
 * the value of the shove, and the Nash ranges by seat. So the lesson cannot
 * quote a figure the pack would then grade differently.
 */

/** The worked example: ace-seven offsuit, on the button, eight big blinds. */
const EXAMPLE = { hand: 'A7o', spot: { seat: 'btn', stack: 8 } } as const

function example() {
  const spot = { ...EXAMPLE.spot }
  return shoveEv(classIndex(EXAMPLE.hand), spot, nashFor(spot).call)
}

const bb = (n: number) => n.toFixed(1).replace(/\.0$/, '')

/** Card one: short means one move. */
function OneMoveCard() {
  return (
    <>
      <div className="flex items-end justify-center gap-5 tabular-nums">
        <Figure label="Your stack" value={`${EXAMPLE.spot.stack}`} unit="big blinds" />
        <span className="pb-6 text-muted-foreground">for</span>
        <Figure label="In the middle" value={bb(BLINDS)} unit="big blinds" />
      </div>
      <Prose>
        <p>
          The starting-hand chart in the guides is for a hundred big blinds, where a raise is two
          and a half and folding to a re-raise costs you little. Short-stacked in a tournament, the
          question changes.
        </p>
        <p>
          With fifteen big blinds or fewer, a raise that is not all-in already commits most of your
          stack. So there are two moves worth making: <strong>all in, or fold</strong>. All in means
          nobody can push you off your hand, and anybody who wants to see it has to risk as much as
          you do.
        </p>
      </Prose>
    </>
  )
}

function Figure({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-4xl font-semibold tracking-tight">{value}</span>
      <span className="text-2xs text-muted-foreground">{unit}</span>
      <span className="text-2xs text-muted-foreground/70">{label}</span>
    </span>
  )
}

/** Card two: the two ways a shove wins. */
function TwoWaysCard() {
  const value = example()
  const called = 1 - value.foldAll
  return (
    <>
      <div className="space-y-1.5">
        <div className="flex h-10 w-full overflow-hidden rounded-2xl">
          <motion.div
            className="flex items-center justify-center bg-emerald-500 text-xs font-medium text-background"
            initial={{ width: '0%' }}
            animate={{ width: `${value.foldAll * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            All fold {pct(value.foldAll)}%
          </motion.div>
          <motion.div
            className="flex items-center justify-center border-l-2 border-background bg-foreground/15 text-xs font-medium"
            initial={{ width: '0%' }}
            animate={{ width: `${called * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
          >
            Called {pct(called)}%
          </motion.div>
        </div>
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>+{bb(BLINDS)} big blinds, every time</span>
          <span>You win {pct(value.equityCalled)}% of these</span>
        </div>
      </div>
      <Prose>
        <p>
          A shove wins two ways. <strong>Everybody folds</strong>, and the blinds are yours. Or{' '}
          <strong>somebody calls</strong>, the cards run out, and you win your share of both stacks.
        </p>
        <p>
          {EXAMPLE.hand} on the button with {EXAMPLE.spot.stack} big blinds: the two behind fold{' '}
          {pct(value.foldAll)}% of the time, and when one calls you still win{' '}
          {pct(value.equityCalled)}%. Add them up and shoving is worth{' '}
          <strong>{bb(value.ev)} big blinds</strong> more than folding. Folding is worth nothing
          from here, so anything above zero is a shove.
        </p>
      </Prose>
    </>
  )
}

/** Card three: who calls, and why the seat matters. */
function WhoCallsCard() {
  const stack = 10
  const seats = SHOVE_SEATS.map((seat) => ({
    seat,
    share: rangeShare(nashFor({ seat, stack }).shove),
  }))
  return (
    <>
      <div className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          Hands to shove at {stack} big blinds
        </p>
        {seats.map(({ seat, share }, i) => (
          <div key={seat} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-2xs font-semibold">{seatById(seat).short}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                initial={{ width: '0%' }}
                animate={{ width: `${share * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.06 * i }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
              {Math.round(share * 100)}%
            </span>
          </div>
        ))}
      </div>
      <Prose>
        <p>
          The players behind call with the hands that do well enough against yours, and you shove
          the hands that make money against those calls. Where the two settle is the{' '}
          <strong>Nash equilibrium</strong>, the standard answer for short-stack all-ins, and it is
          what grades the pack.
        </p>
        <p>
          Fewer players behind means fewer chances somebody wakes up with a hand, so the later you
          sit, the more you shove. Real players call a little wider or tighter than Nash, so a spot
          is only asked when the answer holds either way.
        </p>
      </Prose>
    </>
  )
}

const CARDS: readonly LessonCard[] = [
  { title: 'Short means one move', body: OneMoveCard },
  { title: 'Two ways to win', body: TwoWaysCard },
  { title: 'Who calls', body: WhoCallsCard },
]

export function ShoveLesson({ onDone }: { onDone: () => void }) {
  return (
    <MotionConfig reducedMotion="user">
      <CardLesson name="Shove or fold" cards={CARDS} onDone={onDone} />
    </MotionConfig>
  )
}
