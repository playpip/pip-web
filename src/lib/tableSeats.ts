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
