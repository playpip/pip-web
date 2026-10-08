'use client'

import { useState } from 'react'
import type { HandState } from '@/lib/poker/engine'
import type { SeatAction } from './seat'

type Labels = Readonly<Record<string, SeatAction>>

/**
 * What each seat last did, read off the difference between two hand states.
 *
 * **Presentation only, and derived rather than stored.** The store keeps its
 * event log to itself and the engine's `HandState` says where the chips are,
 * not how they got there, so this compares the hand it was last given with the
 * one it has now: whoever was to act is the one who moved, and what moved tells
 * you what they did. The labels clear when the street moves on, except a fold
 * or an all-in, which are still true.
 *
 * Kept in state and updated during render (React's "adjusting state when a
 * prop changes"), not in an effect: `set-state-in-effect` is ruled out here
 * (docs/development.md), and this way the label lands in the same frame as
 * the chips.
 */
export function useSeatActions(hand: HandState | null, handIndex: number): Labels {
  const [memo, setMemo] = useState<{ hand: HandState | null; handIndex: number; labels: Labels }>({
    hand,
    handIndex,
    labels: {},
  })
  if (memo.hand === hand && memo.handIndex === handIndex) return memo.labels
  const labels = nextLabels(memo.hand, hand, memo.handIndex === handIndex ? memo.labels : {})
  setMemo({ hand, handIndex, labels })
  return labels
}

function nextLabels(prev: HandState | null, hand: HandState | null, labels: Labels): Labels {
  if (!hand || !prev || prev.players.length !== hand.players.length) return {}
  const streetMoved = prev.street !== hand.street
  const kept: Record<string, SeatAction> = {}
  for (const [id, label] of Object.entries(labels)) {
    if (!streetMoved || label === 'Fold' || label === 'All in') kept[id] = label
  }

  const before = prev.players[prev.toActIndex]
  const after = before && hand.players.find((p) => p.id === before.id)
  if (!before || !after || prev.street === 'draw') return kept

  let label: SeatAction
  const put = after.committedThisHand - before.committedThisHand
  if (after.status === 'folded' && before.status !== 'folded') label = 'Fold'
  else if (after.status === 'allin' && put > 0) label = 'All in'
  else if (put <= 0) label = 'Check'
  else if (before.committedThisStreet + put > prev.currentBet)
    label = prev.currentBet === 0 ? 'Bet' : 'Raise'
  else label = 'Call'

  // A call that closes the street is gone with the street; the chips say it.
  if (streetMoved && label !== 'Fold' && label !== 'All in') return kept
  kept[before.id] = label
  return kept
}
