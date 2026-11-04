import test from 'ava'
import { ALL_VENUES, cashOutValue, houseStack, TEN_HANDS } from '@/config/venues'

// Ten Hands (a quick game): the chips are a score, never the Roll's. If any of
// this stopped holding, a round could be sat for free and stood up from for
// chips, which is a farm.

test('Ten Hands costs nothing, pays nothing and cashes for nothing', (t) => {
  t.is(TEN_HANDS.buyIn, 0)
  t.is(TEN_HANDS.prize, 0)
  t.true(houseStack(TEN_HANDS), 'the stack is not the house’s')
  for (const stack of [0, 1_000, 6_000]) t.is(cashOutValue(TEN_HANDS, stack), 0)
})

test('Ten Hands is ten hands at flat blinds, with every seat kept full', (t) => {
  t.is(TEN_HANDS.scoreHands, 10)
  t.is(TEN_HANDS.startingStack, 1_000)
  t.true(TEN_HANDS.cash, 'a busted opponent would leave an empty seat')
  t.false(TEN_HANDS.escalation)
  t.true(TEN_HANDS.membersOnly)
})

test('Ten Hands is on no shelf and no route but its own page', (t) => {
  t.false(ALL_VENUES.some((v) => v.id === TEN_HANDS.id))
  t.false(ALL_VENUES.some((v) => v.scoreHands !== undefined))
})
