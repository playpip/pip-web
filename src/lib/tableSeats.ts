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

const pct = (n: number) => `${Math.round(n * 100) / 100}%`

/** Opponents on the far rail, spread evenly across an arc centred on the top. */
export function feltSeatPositions(n: number, g: FeltGeometry): SeatPoint[] {
  const span = n <= 1 ? 0 : Math.min(g.maxSpan, g.spanPerSeat * n)
  return Array.from({ length: n }, (_, k) => {
    const deg = n <= 1 ? 270 : 270 - span / 2 + (span * k) / (n - 1)
    const rad = (deg * Math.PI) / 180
    return {
      left: pct(g.cx + g.seatRx * Math.cos(rad)),
      top: pct(g.cy + g.seatRy * Math.sin(rad)),
    }
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
