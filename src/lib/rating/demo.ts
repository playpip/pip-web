// A made-up board for checking the leaderboard screen on a laptop with no
// backend (`NEXT_PUBLIC_RATING_DEMO=1 pnpm dev`). Never set in a deployed build.

import { AVATAR_BG_SWATCHES } from '@/lib/avatar'
import type { Board, BoardRow } from './remote'

const NAMES = [
  'Maya',
  'Tom',
  'Priya',
  'Sam',
  'Lena',
  'Ade',
  'Jo',
  'Kit',
  'Rosa',
  'Ben',
  'Ivy',
  'Noor',
]

export function demoBoard(): Board {
  const rows: BoardRow[] = Array.from({ length: 100 }, (_, i) => ({
    userId: `demo-${i}`,
    name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${String.fromCharCode(65 + (i % 26))}.` : ''}`,
    avatar: {
      seed: `demo-${i}`,
      backgroundColor: AVATAR_BG_SWATCHES[i % AVATAR_BG_SWATCHES.length],
    },
    rating: Math.round(2380 - i * 11.5 - (i % 3) * 2),
    weekGain: (i * 37) % 90,
  }))
  const climbers = [...rows].sort((a, b) => b.weekGain - a.weekGain).slice(0, 10)
  return { top: rows, climbers, around: { place: 48, firstPlace: 46, rows: rows.slice(45, 50) } }
}
