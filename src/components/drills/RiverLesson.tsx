'use client'

import { MotionConfig, motion } from 'framer-motion'
import { pct, requiredEquity } from '@/config/potOdds'
import { cn } from '@/lib/utils'
import { CardLesson, Prose } from './CardLesson'

/**
 * The lesson before the river pack: three cards, one idea.
 *
 * **One idea, said three ways**: what the call costs, what a river bet is made
 * of, and how the two meet. Every figure on these cards is arithmetic off the
 * same functions the spots are graded with (`requiredEquity`, the range strip),
 * so the lesson cannot teach a price the pack would then mark differently.
 *
 * The house voice (docs/brand.md): plain, short, and honest about what is a
 * model. The claims about how often players bluff are the measured ones from
 * lib/drills/riverRange.ts, rounded the way a person would say them.
 */

/** The strip that draws a range: what you beat, what beats you, and the price. */
export function RangeStrip({
  valueBeaten,
  value,
  bluffsBeaten,
  bluffs,
  required,
  animate = true,
}: {
  valueBeaten: number
  value: number
  bluffsBeaten: number
  bluffs: number
  /** The share you need, in [0, 1]. Drawn as a marker, or not at all when absent. */
  required?: number
  animate?: boolean
}) {
  const total = value + bluffs
  const share = (n: number) => (total === 0 ? 0 : (n / total) * 100)
  const equity = total === 0 ? 0 : (valueBeaten + bluffsBeaten) / total
  // Beaten first, so the green runs from the left and its right-hand end *is*
  // your equity: a marker to its right is a fold, to its left a call.
  const segments = [
    { key: 'vb', width: share(valueBeaten), className: 'bg-emerald-500' },
    { key: 'bb', width: share(bluffsBeaten), className: 'bg-emerald-500/45' },
    { key: 'bl', width: share(bluffs - bluffsBeaten), className: 'bg-foreground/15' },
    { key: 'vl', width: share(value - valueBeaten), className: 'bg-foreground/35' },
  ]
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full">
        <div className="relative pt-5">
          {required !== undefined && (
            <motion.div
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              initial={animate ? { left: '0%', opacity: 0 } : false}
              animate={{ left: `${required * 100}%`, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 22, delay: 0.15 }}
            >
              <span className="whitespace-nowrap text-2xs font-medium tabular-nums text-foreground">
                Need {pct(required)}%
              </span>
              <span className="mt-0.5 h-6 w-0.5 rounded-full bg-foreground" />
            </motion.div>
          )}
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
          <span className="tabular-nums">
            <span className="font-semibold text-emerald-500">You win {pct(equity)}%</span>
          </span>
          <span className="flex items-center gap-2">
            <Swatch className="bg-emerald-500" label="You beat" />
            <Swatch className="bg-emerald-500/45" label="Misses you beat" />
            <Swatch className="bg-foreground/35" label="Beats you" />
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

/** "1 in 4", from the price itself. Only ever shown for prices that come out whole. */
const oneIn = (fraction: number) => `1 in ${Math.round(1 / requiredEquity(fraction))}`

/** The worked example the first card is built on: half the pot. */
const EXAMPLE = { pot: 100, bet: 50 }

/** Card one: the price, said as a count. */
function PriceCard() {
  const fraction = EXAMPLE.bet / EXAMPLE.pot
  const out = Math.round(1 / requiredEquity(fraction))
  return (
    <>
      <div className="flex items-end justify-center gap-4 tabular-nums">
        <Figure label="You call" value={EXAMPLE.bet} />
        <span className="pb-2 text-muted-foreground">to win</span>
        <Figure label="Pot + their bet" value={EXAMPLE.pot + EXAMPLE.bet} />
      </div>
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: out }, (_, i) => (
          <motion.span
            key={i}
            className={cn(
              'size-7 rounded-full border-2',
              i === 0 ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/20',
            )}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.1 + i * 0.07 }}
          />
        ))}
      </div>
      <Prose>
        <p>
          They bet {EXAMPLE.bet} into {EXAMPLE.pot}. Calling costs {EXAMPLE.bet} and wins the{' '}
          {EXAMPLE.pot + EXAMPLE.bet} in the middle, so you are putting in one chip for every three
          you could take out.
        </p>
        <p>
          So you need to win <strong>one time in {out}</strong>, which is{' '}
          {pct(requiredEquity(fraction))}%. Win more often than that and calling makes money over
          time. Win less and it does not.
        </p>
      </Prose>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'A third of the pot', fraction: 1 / 3 },
          { label: 'Half the pot', fraction: 1 / 2 },
          { label: 'The pot', fraction: 1 },
        ].map((size) => (
          <div key={size.label} className="rounded-xl bg-foreground/[0.04] px-2 py-2">
            <div className="text-2xs text-muted-foreground">{size.label}</div>
            <div className="text-sm font-semibold tabular-nums">{oneIn(size.fraction)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </span>
  )
}

/** Card two: what a river bet is made of. */
function RangeCard() {
  return (
    <>
      <div className="space-y-2">
        <div className="flex h-10 w-full overflow-hidden rounded-2xl">
          <motion.div
            className="flex items-center justify-center bg-foreground/35 text-xs font-medium text-background"
            initial={{ width: '0%' }}
            animate={{ width: '75%' }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            Want a call
          </motion.div>
          <motion.div
            className="flex items-center justify-center border-l-2 border-background bg-foreground/15 text-xs font-medium"
            initial={{ width: '0%' }}
            animate={{ width: '25%' }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
          >
            Missed
          </motion.div>
        </div>
      </div>
      <Prose>
        <p>
          A river bet is two kinds of hand. <strong>Hands that want a call</strong>: here, the
          stronger half of the pairs and better they could have, or the strongest third when the bet
          is over two-thirds of the pot. And <strong>hands that missed</strong>, bet because it is
          the only way they win.
        </p>
        <p>
          How often is it the second kind? We counted our own regulars. When the river is checked to
          them, about one bet in seven at the Garage is a hand that missed, and about two in five at
          the Main Event. After they have bet every street, far fewer.
        </p>
        <p className="text-muted-foreground">
          Most river bets are exactly what they look like. That is what makes them work.
        </p>
      </Prose>
    </>
  )
}

/** The worked example for card three. Counts, so the strip is exact. */
const COMBINED = { value: 30, valueBeaten: 6, bluffs: 10, bluffsBeaten: 10, fraction: 1 / 2 }

/** Card three: put the two together. */
function TogetherCard() {
  const won = COMBINED.valueBeaten + COMBINED.bluffsBeaten
  const total = COMBINED.value + COMBINED.bluffs
  return (
    <>
      <RangeStrip {...COMBINED} required={requiredEquity(COMBINED.fraction)} />
      <Prose>
        <p>
          Say they bet half the pot with {COMBINED.value} hands that want a call and{' '}
          {COMBINED.bluffs} that missed. Your pair beats all {COMBINED.bluffs} misses and{' '}
          {COMBINED.valueBeaten} of the rest: {won} of {total}, or {pct(won / total)}%. Half the pot
          needs {pct(requiredEquity(COMBINED.fraction))}%. Call.
        </p>
        <p>
          Beat nothing they bet for value and you are a <strong>bluff-catcher</strong>. It catches
          bluffs. It needs some to catch, and a small enough price to wait for them.
        </p>
      </Prose>
    </>
  )
}

const CARDS = [
  { title: 'What the call costs', body: PriceCard },
  { title: 'What bets like this', body: RangeCard },
  { title: 'Put them together', body: TogetherCard },
] as const

/** The three cards, paged. See ./CardLesson for the pager itself. */
export function RiverLesson({ onDone }: { onDone: () => void }) {
  return <CardLesson name="Calling the river" cards={CARDS} onDone={onDone} />
}
