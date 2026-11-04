// Quick games: short, single-player games that are not a table (2026-11-04).
//
// Will: "Quick, fast, toilet games essentially, a lot of fun." Each one is a
// round of a minute or two with a score at the end. They sit in their own row
// at the top of the side tables, and they are the membership's: a free player
// gets one round of each a day (lib/quick/rounds), then the limit card.
//
// **Scores are play money and private.** A round never takes from or pays into
// the Roll, so nothing here can be farmed, and the only number kept is the
// player's own best. No leaderboard, no rank.
//
// To add one: an entry here (with `membersOnly`), a scene in CategoryArt under
// the same id, a page at `href`, its name in ROADMAP.md and in the
// `quick-games` blurb in config/membership.ts, and its two analytics events in
// `QUICK_EVENTS` (lib/quick/events.ts) with words for them on /privacy.

import type { MembersOnly } from '@/config/membership'

export interface QuickGame extends MembersOnly {
  /** Also the art id (CategoryArt), the analytics name and the key of its best. */
  id: string
  /** The game's name, as the card and the page say it. */
  title: string
  /** One line on what you do. */
  short: string
  accent: string
  /** Where the game is played. */
  href: string
  /** How a score is written: "412", or "1,280 chips". */
  unit?: 'points' | 'chips'
}

/** The quick games, in the order the shelf shows them. */
export const QUICK_GAMES: readonly QuickGame[] = [
  {
    id: 'solitaire',
    title: 'Poker Solitaire',
    short: 'Place 25 cards on a grid. Every row and column is a hand.',
    accent: '#4FB4A6',
    href: '/game/quick/solitaire',
    unit: 'points',
    membersOnly: true,
  },
  {
    id: 'ten-hands',
    title: 'Ten Hands',
    short: 'Ten fast hands from 1,000 chips. Finish with as many as you can.',
    accent: '#E0A458',
    href: '/game/quick/ten-hands',
    unit: 'chips',
    membersOnly: true,
  },
  {
    // Hold'em with one hole card face down, even to you, until the river
    // (MYSTERY_TABLE in config/venues). Ten hands against five regulars.
    id: 'mystery',
    title: 'Mystery Card',
    short: 'One of your cards stays face down until the river.',
    accent: '#B08BE0',
    href: '/game/quick/mystery',
    unit: 'chips',
    membersOnly: true,
  },
]

/** The membership feature every quick game is sold as. */
export const QUICK_GAMES_FEATURE = 'quick-games'

/**
 * A quick game by id. Throws on an id that is not one: a page names its own game.
 */
export function quickGame(id: string): QuickGame {
  const game = QUICK_GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`no quick game ${id}`)
  return game
}
