// The player's chance to win, as the odds panel shows it on your turn.
//
// Shared by the ladder (store/game) and a multiplayer room (RoomTable), so the
// number reads the same at both. It needs only your own cards, the board and
// what each opponent has put in, never their cards, which is what lets a room
// work it out from the view the server sends you.

import { opponentSelectivity } from './ai/policy'
import type { HandState } from './engine'
import { estimateEquity } from './equity'
import type { Rng } from './cards'

export function heroEquity(hand: HandState, heroId: string, rng?: Rng): number | null {
  const hero = hand.players.find((p) => p.id === heroId)
  // A Mystery Card hand before the river holds one card you can see, and the
  // number is read off that one: the face-down card is dealt from the unseen
  // deck on every run-out, so it is the chance you can actually know.
  if (!hero || hero.hole.length < (hand.mystery && hero.mystery ? 1 : 2)) return null
  // **No number at all at Five-Card Draw**, which is better than a wrong one.
  // `estimateEquity` works by running out a board, and a draw hand has none:
  // asked anyway it deals five community cards onto five hole cards and
  // evaluates ten, which produces a confident percentage of nothing. The real
  // answer would have to model what four opponents are about to discard, and
  // until that exists the odds panel shows an em dash.
  if (hand.variant === 'draw') return null
  const opponents = hand.players.filter(
    (p) => p.id !== heroId && p.status !== 'folded' && p.status !== 'out',
  )
  if (opponents.length === 0) return 1
  return estimateEquity({
    hole: hero.hole,
    community: hand.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => opponentSelectivity(hand, p)),
    iterations: 800,
    variant: hand.variant,
    rng,
  }).equity
}
