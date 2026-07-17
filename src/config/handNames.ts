// Poker's folk names for starting hands — Snowmen, Big Slick, The Hammer.
// A curated set of genuinely established nicknames (no invented ones), shown
// as a whisper when you're dealt a named hand. Teaches the culture ambiently.

import { RANKS, type Card } from '@/lib/poker/cards'

// Keys: rank pair high-first (`AA`), optionally suffixed `s`/`o` when the
// nickname belongs to only one variant (The Hammer is 7-2 *offsuit*). Bare
// keys apply to suited and offsuit alike.
const NICKNAMES: Record<string, string> = {
  AA: 'Pocket Rockets',
  KK: 'Cowboys',
  QQ: 'Ladies',
  JJ: 'Fishhooks',
  TT: 'Dimes',
  '88': 'Snowmen',
  '77': 'Hockey Sticks',
  '66': 'Route 66',
  '55': 'Presto',
  '44': 'Sailboats',
  '33': 'Crabs',
  '22': 'Ducks',
  AK: 'Big Slick',
  AJ: 'Ajax',
  A8: "Dead Man's Hand",
  KQ: 'Marriage',
  KJ: 'Kojak',
  K9: 'Canine',
  QJ: 'Maverick',
  Q7: 'The Computer Hand',
  J5: 'Motown',
  J4: 'Flat Tire',
  T2: 'The Brunson',
  T4: 'Ten-Four',
  '95': 'Dolly Parton',
  '72o': 'The Hammer',
  '57': 'The Heinz',
  '39': 'Jack Benny',
}

/** Canonical starting-hand key: high rank first, `s`/`o` for non-pairs. */
export function holeKey(cards: readonly Card[]): string | null {
  if (cards.length !== 2) return null
  const [a, b] = [...cards].sort((x, y) => RANKS.indexOf(y.rank) - RANKS.indexOf(x.rank))
  if (a.rank === b.rank) return `${a.rank}${b.rank}`
  return `${a.rank}${b.rank}${a.suit === b.suit ? 's' : 'o'}`
}

/** The folk name for these hole cards, or null — most hands have none. */
export function nicknameFor(cards: readonly Card[]): string | null {
  const key = holeKey(cards)
  if (!key) return null
  return NICKNAMES[key] ?? NICKNAMES[key.slice(0, 2)] ?? null
}
