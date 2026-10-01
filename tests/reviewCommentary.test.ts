import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import { commentaryAt } from '@/lib/review/commentary'
import type { GradedDecision } from '@/lib/review/grade'
import { handStateAt } from '@/lib/review/handState'
import type { HandEvent, HandRecord } from '@/store/game'

// When hindsight and the price disagree, the review adds the price. For a fold
// that line has to talk about the fold: "they just had it" under your own fold
// blames the other player for a hand you were the one holding.

const cards = (...s: string[]) => s.map(cardFromString)
const FLOP = cards('Ah', 'Kd', '7c')

function foldHand(): HandRecord {
  const events: HandEvent[] = [
    { kind: 'board', label: 'Flop', cards: FLOP },
    {
      kind: 'action',
      playerId: 'ai1',
      playerName: 'Doris',
      type: 'bet',
      amount: 100,
      pot: 200,
      committed: { hero: 0, ai1: 100 },
    },
    {
      kind: 'action',
      playerId: 'hero',
      playerName: 'Will',
      type: 'fold',
      pot: 200,
      committed: { hero: 0, ai1: 100 },
      decision: { pot: 200, toCall: 100, opponents: 1, selectivity: [0.5], board: FLOP },
    },
  ]
  return {
    handNo: 1,
    smallBlind: 10,
    bigBlind: 20,
    events,
    community: FLOP,
    reveals: [],
    seats: [
      { id: 'hero', name: 'Will', avatar: { seed: 'w', backgroundColor: 'b6e3f4' } },
      { id: 'ai1', name: 'Doris', avatar: { seed: 'd', backgroundColor: 'c0aede' } },
    ],
    hole: [
      { playerId: 'hero', cards: cards('Qc', 'Jd') },
      { playerId: 'ai1', cards: cards('2s', '3c') },
    ],
    buttonId: 'hero',
    start: { stacks: { hero: 1000, ai1: 1000 }, committed: {}, pot: 100 },
    summary: '',
  }
}

const priced = (verdict: 'right' | 'wrong'): GradedDecision => ({
  eventIndex: 2,
  street: 'flop',
  folded: true,
  required: 0.33,
  equity: verdict === 'right' ? 0.25 : 0.45,
  toCall: 100,
  pot: 200,
  margin: 0.08,
  bb: verdict === 'right' ? 2 : -2,
  grade: verdict === 'right' ? 'sound' : 'slip',
  verdict,
})

const say = (verdict: 'right' | 'wrong', heroShare: number) => {
  const record = foldHand()
  const solve = () => ({ share: { hero: heroShare, ai1: 1 - heroShare }, exact: true, runouts: 1 })
  return commentaryAt(
    { record, decisions: [priced(verdict)] },
    handStateAt(record, 3),
    String,
    solve,
  ).verdict
}

test('a fold right on the price that would have won says the fold was right', (t) => {
  const line = say('right', 0.8) ?? ''
  t.regex(line, /the fold was right/)
  t.notRegex(line, /they just had it/)
})

test('a fold wrong on the price that would have lost says the fold was wrong', (t) => {
  const line = say('wrong', 0.1) ?? ''
  t.regex(line, /the fold was wrong on the price/)
  t.notRegex(line, /got there/)
})
