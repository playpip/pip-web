import test from 'ava'
import {
  UNSEEN_AFTER_FLOP,
  WORKED_SPOTS,
  type WorkedSpot,
  betSizes,
  breakevenFolds,
  requiredEquity,
} from '@/config/potOdds'
import { FIVE_CARD_HANDS, HAND_FREQUENCIES, SEVEN_CARD_HANDS } from '@/config/handFrequencies'
import { SEATS, SEATS_AT_A_TABLE, preflopPlace } from '@/config/positions'
import { BAND_ROUGHLY, type Band, cumulativeShare } from '@/config/startingHands'
import { RANKS, SUITS, cardFromString, cardToString, createDeck } from '@/lib/poker/cards'
import { determineWinners, evaluateHand } from '@/lib/poker/handEval'

// Claims a guide makes in prose rather than through a worked-example widget.
// The widgets are covered by learnExamples.test.ts; this file exists so a
// sentence that names five specific cards and says who wins is settled by the
// same evaluator the game uses, not by the author's arithmetic.

const cards = (strings: string[]) => strings.map(cardFromString)

// /learn/how-to-play-texas-holdem, "A hand, from the deal to the showdown".
// The page walks a full hand and then reads both hands out. The point of the
// passage is the villain's jack playing, which is exactly the sort of detail
// that is easy to write wrong and impossible for a beginner to check.
const BOARD = ['Kd', '8s', '3h', '5c', 'Qh']
const HERO = ['Ks', 'Qs']
const VILLAIN = ['Kh', 'Jd']

test('the worked hand: the hero wins with two pair, kings and queens', (t) => {
  const { winners } = determineWinners(
    [
      { id: 'hero' as const, hole: cards(HERO) },
      { id: 'villain' as const, hole: cards(VILLAIN) },
    ],
    cards(BOARD),
  )
  t.deepEqual(winners, ['hero'])

  const hero = evaluateHand(cards(HERO), cards(BOARD))
  t.is(hero.name, 'Two Pair')
  t.is(hero.description, "Two Pair, K's & Q's")
})

test('the worked hand: the villain has one pair, and his jack plays', (t) => {
  const villain = evaluateHand(cards(VILLAIN), cards(BOARD))
  t.is(villain.name, 'Pair')
  t.is(villain.description, "Pair, K's")
  // The page says his best five are K♥ K♦ Q♥ J♦ 8♠. The jack is the claim: it
  // comes from his own hand and beats the eight already on the table.
  const best = (villain.solved as unknown as { cards: unknown[] }).cards.map(String)
  t.deepEqual(best, ['Kh', 'Kd', 'Qh', 'Jd', '8s'])
})

test('the worked hand deals no card twice', (t) => {
  const all = [...BOARD, ...HERO, ...VILLAIN]
  t.is(new Set(all).size, all.length)
})

// /learn/bet-sizing, "The two prices in every bet". The page shipped saying the
// two columns move in opposite directions, which is wrong: bet/(pot + 2*bet)
// and bet/(pot + bet) both rise with the bet. Nothing on the page was a wrong
// number, so no check on this file could have caught it, and the sentence sat
// live for a day. Pinned here because the corrected line still makes a claim
// about the shape of the table, and the next person to add a size or reword the
// paragraph needs the claim to argue back.
test('both prices in the bet-sizing table climb together, they do not diverge', (t) => {
  const sizes = betSizes(['third', 'half', 'twothirds', 'pot', 'overbet'])
  for (let i = 1; i < sizes.length; i++) {
    const previous = sizes[i - 1]
    const size = sizes[i]
    t.true(
      requiredEquity(size.fraction) > requiredEquity(previous.fraction),
      `${size.id}: the price you give them fell`,
    )
    t.true(
      breakevenFolds(size.fraction) > breakevenFolds(previous.fraction),
      `${size.id}: the price you pay fell`,
    )
  }
  // And the pair the sentence is about: the bluff's price is the harder of the
  // two at every size, which is why the paragraph reads as a warning.
  for (const size of sizes) {
    t.true(breakevenFolds(size.fraction) > requiredEquity(size.fraction), size.id)
  }
})

// /learn/pot-odds, "Outs are an estimate, and here is how wrong they get".
// Five spots, each one worth a percentage the page prints to one decimal. They
// are not estimates and not simulations: every one of the 990 turn-and-river
// runouts is played here, split pots counted as half a win. The point of the
// passage is that the same nine outs are worth 39.3% in one row and 27.4% in
// the next, so a row that drifts by a point stops the section making sense.
function exhaustiveEquity(spot: WorkedSpot): number {
  const dealt = new Set([...spot.hero, ...spot.flop, ...spot.villain])
  const rest = createDeck()
    .map(cardToString)
    .filter((card) => !dealt.has(card))
  let won = 0
  let runouts = 0
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const { winners } = determineWinners(
        [
          { id: 'hero' as const, hole: cards([...spot.hero]) },
          { id: 'villain' as const, hole: cards([...spot.villain]) },
        ],
        cards([...spot.flop, rest[i], rest[j]]),
      )
      won += winners.length > 1 ? 1 / winners.length : winners[0] === 'hero' ? 1 : 0
      runouts++
    }
  }
  return (won / runouts) * 100
}

for (const spot of WORKED_SPOTS) {
  test(`the ${spot.id} spot is worth ${spot.equity}% by the river`, (t) => {
    const all = [...spot.hero, ...spot.flop, ...spot.villain]
    t.is(new Set(all).size, all.length, 'the spot deals a card twice')
    t.is(Math.round(exhaustiveEquity(spot) * 100) / 100, spot.equity)
  })
}

// The error the CMO caught in her own draft, pinned so it cannot come back: a
// fifteen-out combo draw was written on 9♠ 8♣ 2♦, which is three spades and so not
// a flush draw at all. Counting distinct cards is the only check that finds it,
// because adding 9 and 8 gives the right answer for the wrong board. So the
// outs on every spot are enumerated here, card by card, from the same strings
// the page draws its table from.
const MADE_BY_A_DRAW = new Set(['Straight', 'Flush', 'Straight Flush', 'Royal Flush'])

/** Cards that finish the straight or the flush the spot is drawing to. */
function drawOuts(spot: WorkedSpot, unseen: string[]): string[] {
  return unseen.filter((card) =>
    MADE_BY_A_DRAW.has(evaluateHand(cards([...spot.hero]), cards([...spot.flop, card])).name),
  )
}

/** Cards that pair a hole card that is already bigger than the whole board. */
function overcardOuts(spot: WorkedSpot, unseen: string[]): string[] {
  const board = cards([...spot.flop]).map((card) => RANKS.indexOf(card.rank))
  const live = cards([...spot.hero])
    .filter((card) => board.every((rank) => RANKS.indexOf(card.rank) > rank))
    .map((card) => card.rank)
  return unseen.filter((card) => live.includes(cardFromString(card).rank))
}

test('every spot has the number of outs the page says it counts', (t) => {
  for (const spot of WORKED_SPOTS) {
    // The player's view, not the reader's: the villain's cards are counted as
    // unseen here because that is what somebody counting outs at a table has.
    const seen = new Set([...spot.hero, ...spot.flop])
    const unseen = createDeck()
      .map(cardToString)
      .filter((card) => !seen.has(card))
    t.is(unseen.length, UNSEEN_AFTER_FLOP, `${spot.id}: unseen cards`)
    const draw = drawOuts(spot, unseen)
    const extra = spot.countsOvercards
      ? overcardOuts(spot, unseen).filter((card) => !draw.includes(card))
      : []
    const outs = [...draw, ...extra]
    t.is(new Set(outs).size, outs.length, `${spot.id} counts a card twice`)
    t.is(outs.length, spot.outs, `${spot.id}: ${[...outs].sort().join(' ')}`)
  }
})

// And the same check the other way round: a flush draw needs four cards of the
// suit between the hand and the board, which is the thing three spades looks
// like and is not.
test('every spot that claims a flush draw actually has four of a suit', (t) => {
  for (const spot of WORKED_SPOTS.filter((s) => s.outsLabel.includes('flush'))) {
    const suits = cards([...spot.hero, ...spot.flop]).map((card) => card.suit)
    const most = Math.max(...SUITS.map((suit) => suits.filter((s) => s === suit).length))
    t.is(most, 4, spot.id)
  }
})

// /learn/hand-rankings, "The order is not arbitrary". The page shipped saying
// every hand is rarer than the one below it and that this "holds exactly, all
// the way down the list", directly above its own table showing one pair at
// 43.8% and high card at 17.4%. Every figure in that table was right. The
// sentence describing its shape was not, which is the same failure as the
// bet-sizing columns above and the reason this file exists.
test('the ranking order is exactly five-card rarity, top to bottom', (t) => {
  for (let i = 1; i < HAND_FREQUENCIES.length; i++) {
    const above = HAND_FREQUENCIES[i - 1]
    const below = HAND_FREQUENCIES[i]
    t.true(above.five < below.five, `${above.hand} is not rarer than ${below.hand} on five cards`)
  }
})

test('seven cards break that rule in exactly one place, and it is the last one', (t) => {
  const inversions = HAND_FREQUENCIES.filter(
    (row, i) => i > 0 && HAND_FREQUENCIES[i - 1].seven >= row.seven,
  )
  t.is(inversions.length, 1)
  t.is(inversions[0].hand, 'High card')
})

// The reason the counts are counts and not the ten percentages the page prints:
// a wrong percentage is invisible, and a wrong count fails this.
test('the hand counts add up to every five-card and seven-card hand there is', (t) => {
  t.is(
    HAND_FREQUENCIES.reduce((sum, row) => sum + row.five, 0),
    FIVE_CARD_HANDS,
  )
  t.is(
    HAND_FREQUENCIES.reduce((sum, row) => sum + row.seven, 0),
    SEVEN_CARD_HANDS,
  )
})

test('the ranking is numbered in the order it is listed', (t) => {
  t.deepEqual(
    HAND_FREQUENCIES.map((row) => row.n),
    HAND_FREQUENCIES.map((_, i) => i + 1),
  )
})

// /learn/starting-hands and /learn/position both put each band's share into
// words. They disagreed about the first seat for four days - a hand in seven on
// one page, a hand in eight on the other - because both were computing the
// percentage and writing the fraction by hand. The fraction is now shared, and
// this is the check the computation never covered.
const BANDS: Band[] = ['any', 'middle', 'late']

test('each band’s plain-English fraction is within a point of its real share', (t) => {
  for (const band of BANDS) {
    const share = cumulativeShare(band)
    const said = BAND_ROUGHLY[band].fraction * 100
    t.true(Math.abs(share - said) < 1, `${band}: "${BAND_ROUGHLY[band].text}" against ${share}%`)
  }
})

test('and no simpler fraction describes the share better', (t) => {
  for (const band of BANDS) {
    const share = cumulativeShare(band)
    const error = Math.abs(share - BAND_ROUGHLY[band].fraction * 100)
    for (let denominator = 2; denominator <= 10; denominator++) {
      for (let numerator = 1; numerator < denominator; numerator++) {
        const other = Math.abs(share - (numerator / denominator) * 100)
        t.true(other >= error - 1e-9, `${band}: ${numerator}/${denominator} beats it`)
      }
    }
  }
})

// Both pages say the playable set "roughly triples" between the first seat and
// the last. Nothing computed it; it is a ratio between two numbers that are.
test('the playable set roughly triples from the first seat to the last', (t) => {
  const ratio = cumulativeShare('late') / cumulativeShare('any')
  t.true(ratio > 2.5 && ratio < 3.5, `${ratio}`)
})

// /learn/position, "the action folds around to the button about four times in
// ten". That is the three seats before the button all folding, at the rates the
// chart on the other page sets, and it moves if any band is edited.
test('the action folds round to the button about four times in ten', (t) => {
  const button = SEATS.find((seat) => seat.id === 'btn')!
  const opensBefore = SEATS.filter(
    (seat) => seat.opens !== null && preflopPlace(seat) < preflopPlace(button),
  )
  t.is(opensBefore.length, 3)
  const folded = opensBefore.reduce(
    (odds, seat) => odds * (1 - cumulativeShare(seat.opens!) / 100),
    1,
  )
  t.is(Math.round(folded * 10), 4)
})

// ...and the sentence above it, which said five players had acted before the
// button. Three have. The other two are the blinds, who have posted and not yet
// acted, and the page's own table says so two sections earlier.
test('three players act before the button before the flop', (t) => {
  const button = SEATS.find((seat) => seat.id === 'btn')!
  t.is(preflopPlace(button) - 1, 3)
  t.is(SEATS_AT_A_TABLE - preflopPlace(button), 2)
})
