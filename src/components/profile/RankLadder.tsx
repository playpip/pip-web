'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { RANKS, nextRank, rankFor, rankIndex, rankProgress } from '@/config/ranks'
import { cn } from '@/lib/utils'

/** How long the fill takes to run the rail; rungs light as it reaches them. */
const FILL_S = 0.9

interface RankLadderProps {
  peakRoll: number
  /** The player's own colour, matching the page's charts. */
  accent: string
  format: (amount: number) => string
  className?: string
}

/**
 * The five rungs, where you are on them, and what the next one costs.
 *
 * Rank comes from *peak* Roll, so this only ever moves forward: a bad night
 * never demotes you. Rungs are evenly spaced rather than drawn to scale (the
 * thresholds are 10x jumps, which would squash the first four into nothing),
 * with the numbers under each rung doing the honest work.
 *
 * Layout: each rung is one absolutely-positioned stack (dot above its labels)
 * so a dot and its name cannot drift apart. The end rungs align to the content
 * edges rather than centring on them, which keeps the whole row inside the
 * card while letting the rail run nearly its full width. Every dot sits in a
 * fixed 14px box, so the rail's ends stay put even when the current rung's dot
 * grows. Out-of-flow stacks reserve no height, so an invisible spacer holds
 * the row open at the height of the tallest rung.
 */
export function RankLadder({ peakRoll, accent, format, className }: RankLadderProps) {
  const current = rankFor(peakRoll)
  const next = nextRank(peakRoll)
  const index = rankIndex(peakRoll)
  const progress = rankProgress(peakRoll)
  const last = RANKS.length - 1
  const reduced = useReducedMotion()

  /** When the fill sweeps past a rung, so its dot can light up on cue. */
  const litAt = (i: number) => (progress > 0 ? Math.min(1, i / last / progress) * FILL_S : 0)

  return (
    <div className={className}>
      <div className="relative">
        {/* inset to the dot centres: half of the 14px dot box, each end */}
        <div className="absolute inset-x-[7px] top-0 h-1.5 rounded-full bg-foreground/10" />
        <motion.div
          className="absolute left-[7px] top-0 h-1.5 origin-left rounded-full"
          style={{
            width: `calc(${progress * 100}% - ${progress * 14}px)`,
            backgroundColor: accent,
          }}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: FILL_S, ease: 'easeOut' }}
        />

        <div className="relative">
          <div aria-hidden className="invisible flex flex-col items-center">
            <div className="h-1.5" />
            <RungLabels name="Amateur" amount={format(1_000_000)} current />
          </div>

          {RANKS.map((rank, i) => (
            <div
              key={rank.name}
              className={cn(
                'absolute top-0 flex flex-col',
                i === 0 && 'items-start',
                i === last && 'items-end',
                i > 0 && i < last && '-translate-x-1/2 items-center',
              )}
              style={i === last ? { right: 0 } : { left: i === 0 ? 0 : `${(i / last) * 100}%` }}
            >
              {/* fixed-width box: the dot centres on the rail and stays put */}
              <div className="flex h-1.5 w-3.5 items-center justify-center">
                {i <= index ? (
                  // reached: solid, with a background ring lifting it off the fill
                  <motion.span
                    className={cn(
                      'rounded-full ring-2 ring-background',
                      i === index ? 'size-3.5' : 'size-2.5',
                    )}
                    style={{ backgroundColor: accent }}
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 24,
                      delay: litAt(i),
                    }}
                  />
                ) : (
                  // Not yet reached: a solid grey stop. The opaque base blocks
                  // the rail (a bare foreground/x fill is alpha, so the rail
                  // shows through it), and the tint on top reads correctly in
                  // both themes, where neither --muted nor --border does.
                  <span className="size-2.5 rounded-full bg-background ring-2 ring-background">
                    <span className="block size-full rounded-full bg-foreground/25" />
                  </span>
                )}
              </div>
              <RungLabels name={rank.name} amount={format(rank.min)} current={i === index} />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        You're {article(current.name)}{' '}
        <span className="font-medium text-foreground">{current.name}</span>.{' '}
        {next ? (
          <>
            <span className="tabular-nums">{format(next.min - peakRoll)}</span> more peak Roll to
            reach {next.name}.
          </>
        ) : (
          <>Top of the ladder, with nothing left to climb.</>
        )}
      </p>
    </div>
  )
}

function RungLabels({ name, amount, current }: { name: string; amount: string; current: boolean }) {
  return (
    <>
      <p
        className={cn(
          'mt-3 whitespace-nowrap text-2xs',
          current ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {name}
      </p>
      <p className="whitespace-nowrap text-3xs tabular-nums text-muted-foreground/60">{amount}</p>
    </>
  )
}

/** "an Amateur", "a Regular" — the rank names are all we ever feed this. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a'
}
