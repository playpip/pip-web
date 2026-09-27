// The landing page draws pictures of product output. Every one of them is a
// claim about what the game does, and four months of a green suite says a
// picture is exactly as checkable as a sentence unless something checks it.
//
// The rule these tests enforce: a card either calls the function the game calls
// or its numbers are constants recomputed here.

import { readFileSync } from 'node:fs'
import test from 'ava'
import { EQUITY_SAMPLE, HAND_LINK_SAMPLE, HAND_LINK_VISIBLE_CHARS } from '@/config/landingMocks'
import { decodeHand, encodeHand } from '@/lib/handLink'
import { cardFromString } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'
import { evaluateHand } from '@/lib/poker/handEval'

const LANDING = readFileSync('src/components/marketing/Landing.tsx', 'utf8')
const cards = (...spec: readonly string[]) => spec.map(cardFromString)

test('the hand-link card shows a token the decoder accepts', (t) => {
  const token = encodeHand(HAND_LINK_SAMPLE)
  t.truthy(decodeHand(token), 'the card pictures a link that does not open')
  t.regex(token, /^[A-Za-z0-9\-_]+$/)
})

test('the hand-link card is not short enough to look like a database key', (t) => {
  // The defect: six characters of token, on the card claiming no server. Any
  // real hand is hundreds, so an ellipsis after a handful of characters is the
  // wrong picture however the token is generated.
  const url = `playpip.io/hand#${encodeHand(HAND_LINK_SAMPLE)}`
  t.true(url.length > 300, `a shared hand is ${url.length} characters, expected over 300`)
  t.true(
    HAND_LINK_VISIBLE_CHARS >= 10,
    'showing fewer than ten characters reads as a short link, not a truncated one',
  )
})

test('no landing card types out a hand link by hand', (t) => {
  const typed = LANDING.match(/hand#[A-Za-z0-9\-_]{3,}/g)
  t.is(typed, null, `hand links must come from encodeHand, found ${typed?.join(', ')}`)
})

test('the equity card is labelled the way the table labels it', (t) => {
  // useHandLabel in Table.tsx: evaluateHand(hole, community).name, verbatim.
  // "Top pair, good kicker" is a phrase the game has never produced.
  const name = evaluateHand(cards(...EQUITY_SAMPLE.hole), cards(...EQUITY_SAMPLE.community)).name
  t.is(name, EQUITY_SAMPLE.label)
})

test('the equity card prints the equity of the spot it names', (t) => {
  const { equity } = estimateEquity({
    hole: cards(...EQUITY_SAMPLE.hole),
    community: cards(...EQUITY_SAMPLE.community),
    opponents: EQUITY_SAMPLE.opponents,
    iterations: 60_000,
  })
  const measured = equity * 100
  // 60,000 hands puts one standard error near 0.2 points; a whole point of
  // slack fails on a copy edit and not on the sampling.
  t.true(
    Math.abs(measured - EQUITY_SAMPLE.winPct) < 1,
    `card says ${EQUITY_SAMPLE.winPct}%, the spot runs ${measured.toFixed(2)}%`,
  )
})

test('the equity card does not restate its own number in words', (t) => {
  // "72%" over "ahead of 4 in 5 hands" is two answers to one question, and the
  // second one drifts silently because nothing computes it.
  t.regex(LANDING, /EQUITY_SAMPLE\.winPct/, 'the percentage must come from the pinned spot')
  t.notRegex(
    LANDING,
    /\b(\d+) in (\d+) hands\b/,
    'a rate written in words beside a percentage is a second, uncheckable claim',
  )
})
