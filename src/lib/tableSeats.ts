/**
 * Where the opponents sit.
 *
 * Spread along the top arc of an ellipse, y growing down, with the arc's
 * centre below the table midline so the board sits in the space they leave.
 * Lifted out of `components/table/Table.tsx` so the session review can draw the
 * same table rather than a second arrangement that is nearly it — a review that
 * put the seats somewhere else would be a review of a different table.
 */

export interface SeatPoint {
  left: string
  top: string
}

const RX = 41
const RY = 34
/** The arc's centre, below the midline, matching where the board lands. */
const CY = 56

export function opponentPositions(n: number): SeatPoint[] {
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / (n + 1) // 0..1 across the arc
    const deg = 180 + t * 180 // 180° (left) → 360° (right), over the top
    const rad = (deg * Math.PI) / 180
    return {
      left: `${50 + RX * Math.cos(rad)}%`,
      top: `${CY + RY * Math.sin(rad)}%`,
    }
  })
}

/**
 * Everybody but you, in seat order from your left: the order they act in,
 * clockwise from the near rail, which is how the arc lays them out left to
 * right. Not in the hand (busted, watching a room), and every seat is on it.
 */
export function aroundFrom<P extends { id: string }>(players: P[], you: string | null): P[] {
  const at = players.findIndex((p) => p.id === you)
  return at === -1 ? players : [...players.slice(at + 1), ...players.slice(0, at)]
}

/**
 * The live table's geometry: an oval of cloth, the seats on its rail.
 *
 * **Separate from `opponentPositions` on purpose.** The review and the lessons
 * lay their seats out on that arc with the board absolutely placed under it,
 * and both of them are tuned to it. The live table is drawn on an actual table
 * now (components/table/surface.tsx), so its seats sit on the rail of the oval
 * it draws, and the two have to agree with each other rather than with the arc.
 *
 * Every number is a percentage of the stage (the area between the bar and the
 * hero's cards). The oval runs off the bottom of the stage so its near rail
 * passes under the hero's cards: that is what seats the player at the table
 * instead of in front of a picture of one.
 */
export interface FeltGeometry {
  /** The oval: centre and radii, in stage percent. */
  cx: number
  cy: number
  rx: number
  ry: number
  /**
   * The ellipse the seats sit on. The rail itself on a desktop; a little inside
   * it on a phone, where a face on the rail would hang off the screen.
   */
  seatRx: number
  seatRy: number
  /** Widest arc the opponents may take, in degrees, and per opponent. */
  maxSpan: number
  spanPerSeat: number
  /**
   * The stage's usual width over its height. Given, the seats are spaced
   * evenly along the rail as it is drawn rather than by equal angles, which
   * on a tall phone bunch them across the top and on a wide desktop bunch
   * them down the sides. Only the full-ring felts set it.
   */
  railAspect?: number
  /** Where each seat's bet sits: this far from the seat toward `focus`. */
  betReach: number
  /**
   * How far below the face a seat's nameplate reaches, in stage percent. A
   * bet is measured from there, so it lands on the cloth in front of the plate
   * rather than under it.
   */
  plateDrop: number
  focus: SeatPoint
  board: SeatPoint
  pot: SeatPoint
  heroBet: SeatPoint
  /** Where chips go when the hero takes a pot: under the stage, into the cards. */
  hero: SeatPoint
}

export const FELT_WIDE: FeltGeometry = {
  cx: 50,
  cy: 58,
  rx: 44,
  ry: 52,
  seatRx: 44,
  seatRy: 48,
  maxSpan: 200,
  spanPerSeat: 55,
  betReach: 0.3,
  plateDrop: 11,
  focus: { left: '50%', top: '58%' },
  board: { left: '50%', top: '49%' },
  pot: { left: '50%', top: '72%' },
  heroBet: { left: '50%', top: '90%' },
  hero: { left: '50%', top: '106%' },
}

export const FELT_COMPACT: FeltGeometry = {
  cx: 50,
  cy: 58,
  rx: 47.5,
  ry: 52,
  seatRx: 39,
  seatRy: 46,
  maxSpan: 124,
  spanPerSeat: 36,
  // On a phone the bets go straight in toward the middle of the cloth, and
  // the pot sits under the board, so the band between the seats and the board
  // is left for the bets alone.
  betReach: 0.38,
  plateDrop: 0,
  focus: { left: '50%', top: '58%' },
  board: { left: '50%', top: '59%' },
  pot: { left: '50%', top: '74%' },
  heroBet: { left: '50%', top: '89%' },
  hero: { left: '50%', top: '108%' },
}

/**
 * A phone table with six or seven opponents. `FELT_COMPACT`'s arc puts them
 * shoulder to shoulder across the top: on a 375px screen the four highest
 * plates touched. So the arc opens wider and runs further down the rail, the
 * seats draw smaller (`FeltSeat` `crowded`), and the board and pot drop to
 * leave the lowest two room above the cards. Everything else is the compact
 * felt unchanged, and five opponents or fewer never see this.
 *
 * This is the short phone's (a screen wider than half its height, 375×667):
 * there the stage is nearly square and every bit of the arc is spoken for.
 */
export const FELT_COMPACT_FULL_SHORT: FeltGeometry = {
  ...FELT_COMPACT,
  seatRx: 41,
  seatRy: 46,
  maxSpan: 155,
  spanPerSeat: 26,
  // Further in than the compact felt's 0.38: the seats are closer together,
  // and a bet that stopped short landed on the next seat down's action pill.
  betReach: 0.45,
  focus: { left: '50%', top: '70%' },
  board: { left: '50%', top: '72%' },
  pot: { left: '50%', top: '86.5%' },
  // Beside the pot rather than under it: under it is the table talk line, and
  // on a short phone there is no room below that before your cards.
  heroBet: { left: '22%', top: '86.5%' },
}

/**
 * The full ring on a tall phone, which is most of them. By equal angles the
 * short felt's arc bunched four seats across the top and left a band of empty
 * cloth over the board; spaced evenly along the rail, and the arc a little
 * lower, the seven sit round the table instead of over it.
 */
export const FELT_COMPACT_FULL: FeltGeometry = {
  ...FELT_COMPACT_FULL_SHORT,
  seatRy: 44,
  maxSpan: 165,
  railAspect: 0.71,
}

/**
 * A desktop table with six or seven opponents: the wide felt, spaced evenly
 * along the rail. By equal angles the lowest four sat stacked down the sides,
 * an action pill on the seat above's nameplate, with the top of the rail empty.
 */
export const FELT_WIDE_FULL: FeltGeometry = {
  ...FELT_WIDE,
  railAspect: 2.5,
}

/** The screen a phone's full ring spreads out on: at least twice as tall as wide. */
export const TALL_PHONE = '(max-aspect-ratio: 1/2)'

/** The live table's felt for this many opponents. Up to five, exactly as before. */
export function feltFor(compact: boolean, opponents: number, tall = false): FeltGeometry {
  if (opponents < 6) return compact ? FELT_COMPACT : FELT_WIDE
  if (!compact) return FELT_WIDE_FULL
  return tall ? FELT_COMPACT_FULL : FELT_COMPACT_FULL_SHORT
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`

/** Opponents on the far rail, spread evenly across an arc centred on the top. */
export function feltSeatPositions(n: number, g: FeltGeometry): SeatPoint[] {
  const span = n <= 1 ? 0 : Math.min(g.maxSpan, g.spanPerSeat * n)
  const angles = Array.from({ length: n }, (_, k) =>
    n <= 1 ? 270 : 270 - span / 2 + (span * k) / (n - 1),
  )
  const degs = g.railAspect && n > 2 ? alongRail(angles, g, g.railAspect) : angles
  return degs.map((deg) => {
    const rad = (deg * Math.PI) / 180
    return {
      left: pct(g.cx + g.seatRx * Math.cos(rad)),
      top: pct(g.cy + g.seatRy * Math.sin(rad)),
    }
  })
}

/**
 * The same arc's ends, the seats between them moved so each is the same
 * distance along the rail from the next, measured as drawn: a stage `aspect`
 * times as wide as it is tall.
 */
function alongRail(angles: number[], g: FeltGeometry, aspect: number): number[] {
  const from = angles[0]
  const to = angles[angles.length - 1]
  const steps = 720
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [g.seatRx * Math.cos(rad) * aspect, g.seatRy * Math.sin(rad)]
  }
  const run = [0]
  let last = at(from)
  for (let i = 1; i <= steps; i++) {
    const next = at(from + ((to - from) * i) / steps)
    run.push(run[i - 1] + Math.hypot(next[0] - last[0], next[1] - last[1]))
    last = next
  }
  const total = run[steps]
  return angles.map((_, k) => {
    const goal = (total * k) / (angles.length - 1)
    let i = 1
    while (i < steps && run[i] < goal) i++
    const part = (goal - run[i - 1]) / (run[i] - run[i - 1] || 1)
    return from + ((to - from) * (i - 1 + part)) / steps
  })
}

/** A point part of the way from one place on the stage to another. */
export function towards(from: SeatPoint, to: SeatPoint, t: number): SeatPoint {
  const a = (p: string) => Number.parseFloat(p)
  return {
    left: pct(a(from.left) + (a(to.left) - a(from.left)) * t),
    top: pct(a(from.top) + (a(to.top) - a(from.top)) * t),
  }
}
