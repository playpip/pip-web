'use client'

// The drill rating's line, drawn two ways: a graph on `/stats` and a sparkline
// in the report. One file so the two cannot drift about what the axis is.
//
// **The axis is spots answered.** The history carries no dates and cannot
// (lib/drills/history.ts), so the scrubbed caption says "after 42 spots", never
// a day. A graph over days would be a graph with gaps you could be made to feel
// behind about; this one has no gaps to show.

import { LineGraph } from '@/components/RollGraph'
import type { RatingPoint } from '@/lib/drills/history'

/**
 * The least height of rating the graph spreads over.
 *
 * Without it the first few answers, which move the rating a dozen points, are
 * stretched to the full height of the card and read as a cliff. A hundred is
 * about three answers at the opening K-factor, so a real climb still fills it.
 */
const MIN_SPAN = 100

const toPoints = (history: RatingPoint[]) => history.map(([x, y]) => ({ x, y }))

const spots = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'spot' : 'spots'}`

/** The rating over spots answered. Needs two points; the caller owns the rest. */
export function RatingGraph({
  history,
  accent,
  className,
}: {
  history: RatingPoint[]
  accent: string
  className?: string
}) {
  return (
    <LineGraph
      points={toPoints(history)}
      caption={(i) =>
        history[i][0] === 0 ? 'where everybody starts' : `after ${spots(history[i][0])}`
      }
      minSpan={MIN_SPAN}
      accent={accent}
      className={className}
    />
  )
}

/** The same line, two lines of text tall, with nothing to scrub. */
export function RatingSparkline({
  history,
  accent,
  className,
}: {
  history: RatingPoint[]
  accent: string
  className?: string
}) {
  return (
    <LineGraph
      points={toPoints(history)}
      minSpan={MIN_SPAN}
      accent={accent}
      className={className}
      compact
    />
  )
}
