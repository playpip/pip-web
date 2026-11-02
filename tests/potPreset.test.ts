import test from 'ava'
import {
  applyAction,
  legalActions,
  potRaiseTo,
  potSize,
  presetRaiseTo,
  startHand,
  type Action,
  type HandState,
} from '@/lib/poker/engine'
import type { Variant } from '@/lib/poker/handEval'
import { mulberry32 } from '@/lib/poker/cards'

// The sizer's presets: ½, ¾ and the pot (components/table/ActionBar).
const FRACTIONS = [0.5, 0.75, 1] as const

/**
 * Six-handed at The Big Pot's blinds, 25/50, button on seat 0: seat 1 posts the
 * small blind, seat 2 the big one, and seat 3 is first to act.
 */
const sixHanded = (variant?: Variant, stacks = 10_000) =>
  startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, stack: stacks })),
    buttonIndex: 0,
    smallBlind: 25,
    bigBlind: 50,
    rng: mulberry32(7),
    variant,
  })

const play = (hand: HandState, ...actions: Action[]) => actions.reduce(applyAction, hand)
const fold: Action = { type: 'fold' }
const call: Action = { type: 'call' }
const raise = (amount: number): Action => ({ type: 'raise', amount })

const preset = (hand: HandState, fraction: number) => {
  const legal = legalActions(hand)
  if (!legal) throw new Error('nobody to act')
  return presetRaiseTo(hand, legal, fraction)
}

test('with no bet to face, every preset is the old pot fraction', (t) => {
  for (const variant of [undefined, 'omaha'] as const) {
    // Everybody limps or checks to the flop: 300 in the middle, nothing to call.
    const hand = play(sixHanded(variant), call, call, call, call, call, { type: 'check' })
    t.is(hand.street, 'flop')
    const legal = legalActions(hand)!
    t.is(legal.callAmount, 0)
    for (const fraction of FRACTIONS) {
      const before = Math.max(
        legal.minRaiseTo,
        Math.min(legal.maxRaiseTo, hand.currentBet + Math.round(potSize(hand) * fraction)),
      )
      t.is(preset(hand, fraction), before, `${variant ?? 'holdem'} ${fraction}`)
    }
  }
})

test('facing an open at The Big Pot, Pot counts the call: 175 → 600, not 425', (t) => {
  const opened = play(sixHanded('omaha'), raise(175))
  // 25 + 50 + 175 in, 175 to call: raise by 425 on top of the 175.
  t.is(potSize(opened), 250)
  t.is(legalActions(opened)?.callAmount, 175)
  t.is(preset(opened, 1), 600)
  t.is(preset(opened, 0.75), 175 + Math.round(0.75 * 425))
  t.is(preset(opened, 0.5), 175 + Math.round(0.5 * 425))
})

test('facing a 3-bet, the presets size off the pot after the call', (t) => {
  // UTG opens 150, the next seat makes it 450, and it folds back round.
  const threeBet = play(sixHanded(), raise(150), raise(450), fold, fold, fold, fold)
  t.is(threeBet.players[threeBet.toActIndex].id, 's3')
  // 25 + 50 + 150 + 450 = 675 in, 300 more to call: the pot after it is 975.
  t.is(potSize(threeBet), 675)
  t.is(legalActions(threeBet)?.callAmount, 300)
  t.is(preset(threeBet, 1), 450 + 975)
  t.is(preset(threeBet, 0.5), 450 + Math.round(975 / 2))
})

test('the big blind facing a raise is only calling the difference', (t) => {
  // UTG opens 150 and it folds to the big blind, who has 50 in already.
  const toBlind = play(sixHanded(), raise(150), fold, fold, fold, fold)
  t.is(toBlind.players[toBlind.toActIndex].id, 's2')
  t.is(legalActions(toBlind)?.callAmount, 100)
  // 225 in the middle plus the 100 call is a 325 pot to raise into.
  t.is(preset(toBlind, 1), 150 + 325)
  t.is(preset(toBlind, 0.5), 150 + Math.round(325 / 2))
})

test('at pot limit, Pot is the cap', (t) => {
  const spots = [
    play(sixHanded('omaha')),
    play(sixHanded('omaha'), raise(175)),
    play(sixHanded('omaha'), raise(175), raise(600)),
    play(sixHanded('omaha'), raise(175), fold, fold, fold, fold),
    play(sixHanded('omaha'), call, call, call, call, call, { type: 'check' }),
  ]
  for (const spot of spots) {
    const legal = legalActions(spot)!
    t.is(preset(spot, 1), legal.maxRaiseTo)
    t.is(potRaiseTo(spot), legal.maxRaiseTo)
  }
})

test('a preset past the stack is held at all-in', (t) => {
  // 400 behind: the pot over a 175 open is 600, more than the seat has.
  for (const variant of [undefined, 'omaha'] as const) {
    const opened = play(sixHanded(variant, 400), raise(175))
    const legal = legalActions(opened)!
    t.is(legal.maxRaiseTo, 400)
    t.is(potRaiseTo(opened), 600)
    t.is(preset(opened, 1), 400, variant ?? 'holdem')
  }
})
