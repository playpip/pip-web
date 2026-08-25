import test from 'ava'
import { DRILL_KINDS, canPlayDrill, drillKind } from '@/config/drills'
import {
  EASIEST_OUTS,
  HARDEST_OUTS,
  type OutsShape,
  type SpotKind,
  drillAt,
  gradeDrill,
  nextDrill,
  outsDifficulty,
} from '@/lib/drills'
import { spotLadder, standingFor, standingLine } from '@/lib/drills/standing'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { determineWinners, evaluateHand } from '@/lib/poker/handEval'

// "Count your outs" is the first kind anybody pays for, which changes what the
// tests are for. The free kind has to be incapable of marking a correct answer
// wrong; this one has to be that *and* actually be the thing that was sold. So
// two halves here: the count is right (re-derived from the cards, not read back
// off the generator), and the gate is real (the flag is on it, and it was on it
// in the commit that registered it).
//
// Everything is exact. There is no sampling anywhere in this kind, so a test
// that is flaky here is a test that is wrong.

const KIND = 'count-your-outs'

/** Every accepted spot in a range of seeds. */
function accepted(from: number, count: number): Drill[] {
  const drills: Drill[] = []
  for (let seed = from; seed < from + count; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) drills.push(drill)
  }
  return drills
}

const hand = (drill: Drill, label: string) =>
  drill.hands?.find((h) => h.label === label)?.cards ?? []

const hero = (drill: Drill) => hand(drill, 'You')
const villain = (drill: Drill) => hand(drill, 'They have')

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 7, 1_000, 4_294_967_295]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed), `seed ${seed}`)
  }
})

// The pinned spots. The three shapes the sentence has to get right (one draw,
// two draws, three or more) plus the trap clause, so that a change to the
// wording or the arithmetic says so here rather than on a paying player's
// screen.
const PINNED: { seed: number; answer: string; settledBy: SpotKind; explanation: string }[] = [
  {
    seed: 2,
    answer: '6',
    settledBy: 'one-draw',
    explanation:
      '6 of the 44 cards left win it for you, and they all make a pair. 12 more improve your hand and still lose.',
  },
  {
    seed: 7,
    answer: '9',
    settledBy: 'many-draws',
    explanation:
      '9 of the 44 cards left win it for you: 4 make a straight, 3 make two pair and 2 make three of a kind.',
  },
  {
    seed: 13,
    answer: '11',
    settledBy: 'two-draws',
    explanation: '11 of the 44 cards left win it for you: 8 make a straight and 3 make a pair.',
  },
]

test('fixed seeds grade the same way every run', (t) => {
  for (const pin of PINNED) {
    const { drill } = drillAt(KIND, pin.seed)
    if (!drill) {
      t.fail(`seed ${pin.seed} no longer generates a spot`)
      continue
    }
    t.is(drill.answer, pin.answer, `seed ${pin.seed}: answer`)
    t.is(drill.settledBy, pin.settledBy, `seed ${pin.seed}: shape`)
    t.is(drill.explanation, pin.explanation, `seed ${pin.seed}: explanation`)
    t.true(gradeDrill(drill, pin.answer).correct, `seed ${pin.seed}: grade`)
  }
})

// The one that matters most, and the whole reason this kind can be sold. The
// answer is settled at generation time; this counts the outs again from the
// cards the spot actually dealt, using the same showdown call a real hand uses,
// and checks the two agree. If they ever don't, somebody who counted correctly
// is being told they were wrong, on a screen they paid for.
test('every count agrees with a fresh enumeration of the remaining deck', (t) => {
  const drills = accepted(1, 1_200)
  t.true(drills.length > 300, `sample too small to mean anything: ${drills.length}`)

  for (const drill of drills) {
    const seen = [...hero(drill), ...villain(drill), ...drill.board]
    t.is(drill.board.length, 4, `seed ${drill.seed}: the spot is on the turn`)
    t.is(seen.length, 8, `seed ${drill.seed}: a spot is two hands and four board cards`)
    t.is(
      new Set(seen.map((c) => `${c.rank}${c.suit}`)).size,
      8,
      `seed ${drill.seed}: duplicate card`,
    )

    const contenders = [
      { id: 'hero', hole: hero(drill) },
      { id: 'villain', hole: villain(drill) },
    ]
    const rest = fullDeckMinus(seen)
    t.is(rest.length, 44, `seed ${drill.seed}: 44 cards unseen`)

    let outs = 0
    for (const card of rest) {
      const { winners } = determineWinners(contenders, [...drill.board, card])
      if (winners.length === 1 && winners[0] === 'hero') outs++
    }
    t.is(Number(drill.answer), outs, `seed ${drill.seed}: counted ${outs}`)
  }
})

/** The 52 cards, less the ones this spot has already shown. */
function fullDeckMinus(seen: { rank: string; suit: string }[]) {
  const gone = new Set(seen.map((c) => `${c.rank}${c.suit}`))
  const deck: { rank: string; suit: string }[] = []
  for (const rank of '23456789TJQKA') {
    for (const suit of 'cdhs') {
      if (!gone.has(`${rank}${suit}`)) deck.push({ rank, suit })
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: the loop above builds real cards from the real alphabets.
  return deck as any[]
}

// The two rejections that exist so a player is never marked wrong for a
// defensible reading. Checked from the outside: an accepted spot must have the
// hero behind, and no river may split the pot.
test('an accepted spot has the hero behind, with nothing that chops', (t) => {
  for (const drill of accepted(1, 600)) {
    const contenders = [
      { id: 'hero', hole: hero(drill) },
      { id: 'villain', hole: villain(drill) },
    ]
    const turn = determineWinners(contenders, drill.board)
    t.false(turn.winners.includes('hero'), `seed ${drill.seed}: hero is not behind on the turn`)

    for (const card of fullDeckMinus([...hero(drill), ...villain(drill), ...drill.board])) {
      const { winners } = determineWinners(contenders, [...drill.board, card])
      t.is(winners.length, 1, `seed ${drill.seed}: a river chops the pot`)
    }
  }
})

test('the filter rejects for the reasons this kind has, and no others', (t) => {
  const counts: Record<RejectReason, number> = {
    'one-sided': 0,
    unexplainable: 0,
    'already-ahead': 0,
    'chop-possible': 0,
    'drawing-dead': 0,
    ambiguous: 0,
  }
  let kept = 0
  for (let seed = 1; seed <= 4_000; seed++) {
    const { drill, rejected } = drillAt(KIND, seed)
    if (drill) kept++
    else if (rejected) counts[rejected]++
  }

  t.true(kept > 800, `the filter is throwing away too much: ${kept} kept of 4,000`)
  t.true(counts['already-ahead'] > 100, 'the hero is never already ahead, which cannot be right')
  t.true(counts['chop-possible'] > 10, 'no spot has ever been rejected for chopping')
  t.true(counts['drawing-dead'] > 10, 'no spot has ever been rejected for being drawing dead')
  // "one-sided" belongs to the free kind, and "unexplainable" is not a tuning
  // knob: it fires when a winning river makes a hand we cannot name, which
  // would mean the sentence and the count came from different readings.
  t.is(counts['one-sided'], 0, "one-sided is not this kind's vocabulary")
  t.is(counts.ambiguous, 0, 'the count is exact, so no spot here is ever too close to ask')
  t.is(counts.unexplainable, 0, 'a spot could not be explained from its own enumeration')
})

test('the grader accepts the count and nothing else', (t) => {
  for (const drill of accepted(20_000, 400)) {
    t.is(drill.choices.length, 4, `seed ${drill.seed}: four numbers on offer`)
    const ids = drill.choices.map((c) => c.id)
    t.is(new Set(ids).size, 4, `seed ${drill.seed}: a number is offered twice`)
    t.is(drill.choices.filter((c) => c.winning).length, 1, `seed ${drill.seed}: one right answer`)
    t.true(ids.includes(drill.answer), `seed ${drill.seed}: the answer is not on a button`)

    for (const choice of drill.choices) {
      const grade = gradeDrill(drill, choice.id)
      t.is(grade.correct, choice.id === drill.answer, `seed ${drill.seed}: ${choice.id}`)
      t.is(grade.correct, choice.winning, `seed ${drill.seed}: ${choice.id} marked inconsistently`)
    }
  }
})

// Ascending, positive, and never the count twice. A button showing a number
// below one you can reach is fine; a button showing 0 is not, because a spot
// with no outs is never dealt and the button would be free to discount.
test('the numbers on offer are ascending, distinct and reachable', (t) => {
  for (const drill of accepted(1, 800)) {
    const numbers = drill.choices.map((c) => Number(c.id))
    t.deepEqual(
      numbers,
      [...numbers].sort((a, b) => a - b),
      `seed ${drill.seed}: not ascending`,
    )
    for (const n of numbers) {
      t.true(Number.isInteger(n) && n >= 1 && n <= 44, `seed ${drill.seed}: ${n} is not a count`)
    }
    t.true(
      drill.choices.every((c) => c.label === c.id),
      `seed ${drill.seed}: a button says something other than its number`,
    )
  }
})

// The guess this drill must not reward. If the answer sat in one slot much more
// often than the others, "always pick the second one" would beat counting, and
// nobody would find out because every individual spot would still be correct.
// The measured spread is 24 / 30 / 28 / 19; the bound is wide enough not to be
// a tuning knob and tight enough to catch a slot becoming the answer.
test('no slot is the answer often enough to guess', (t) => {
  const drills = accepted(1, 6_000)
  const slots = [0, 0, 0, 0]
  for (const drill of drills) {
    slots[drill.choices.findIndex((c) => c.id === drill.answer)]++
  }
  for (const [slot, hits] of slots.entries()) {
    const share = hits / drills.length
    t.true(share > 0.15 && share < 0.35, `slot ${slot} is the answer ${(share * 100).toFixed(1)}%`)
  }
})

test('every spot shows both hands, and the hands are not choices', (t) => {
  for (const drill of accepted(1, 400)) {
    t.is(drill.hands?.length, 2, `seed ${drill.seed}: two hands are shown`)
    t.is(hero(drill).length, 2, `seed ${drill.seed}: the hero has two cards`)
    t.is(villain(drill).length, 2, `seed ${drill.seed}: the villain has two cards`)
    // Every choice is a number, so nothing the runner draws as a hand can be
    // clicked and nothing clickable carries cards.
    t.true(
      drill.choices.every((c) => c.cards.length === 0),
      `seed ${drill.seed}: a choice carries cards`,
    )
    // What the villain has is named from the start. You cannot count what beats
    // you without being told what you are up against.
    const named = evaluateHand(villain(drill), drill.board)
    t.truthy(drill.hands?.[1].detail, `seed ${drill.seed}: the villain's hand is not named`)
    t.is(
      drill.hands?.[1].detail?.toLowerCase().replace(/^an? /, ''),
      named.name.toLowerCase(),
      `seed ${drill.seed}: the villain's hand is named as something it is not`,
    )
  }
})

// The shape sets the difficulty and the sentence lists the hands, so the two
// have to be the same reading. A spot calling itself "one draw" while its
// sentence lists two is a spot whose rating is wrong.
test('the shape on the spot is the number of hands its sentence names', (t) => {
  for (const drill of accepted(1, 1_000)) {
    // Only the first sentence lists the draws. The trap clause is its own
    // sentence and counting it as a draw is what an earlier version of this
    // test did.
    const listed = drill.explanation.split('. ')[0]
    const groups = listed.includes(':') ? listed.split(':')[1].split(/,| and /).length : 1
    const expected: OutsShape =
      groups === 1 ? 'one-draw' : groups === 2 ? 'two-draws' : 'many-draws'
    t.is(drill.settledBy, expected, `seed ${drill.seed}: ${drill.explanation}`)
  }
})

test('every difficulty is on the scale this kind declares', (t) => {
  for (const drill of accepted(1, 2_000)) {
    t.true(
      drill.difficulty >= EASIEST_OUTS && drill.difficulty <= HARDEST_OUTS,
      `seed ${drill.seed}: ${drill.difficulty} is off the scale`,
    )
    // Either the plain rating for its shape or that plus the trap bump, and
    // nothing in between: the difficulty is a lookup, not a calculation.
    const plain = outsDifficulty(drill.settledBy as OutsShape, false)
    const trapped = outsDifficulty(drill.settledBy as OutsShape, true)
    t.true(
      drill.difficulty === plain || drill.difficulty === trapped,
      `seed ${drill.seed}: ${drill.difficulty} is neither ${plain} nor ${trapped}`,
    )
    // The trap clause and the trap bump are the same fact, so they travel
    // together or the rating is describing a spot the player was not shown.
    t.is(
      drill.difficulty === trapped && trapped !== plain,
      drill.explanation.includes('still lose'),
      `seed ${drill.seed}: the bump and the sentence disagree`,
    )
  }
})

// ---------------------------------------------------------------------------
// The gate. This is the half that is about money rather than poker.
// ---------------------------------------------------------------------------

// technology#55, and rule #8 under it: we never charge later for something that
// shipped free. A paid kind registered without the flag has given itself away
// in the commit that added it, and no later commit can take it back. So this
// asserts the flag by name rather than trusting the registry to be read.
test("count your outs is registered as the membership's, not as free", (t) => {
  const kind = drillKind(KIND)
  t.true(kind.membersOnly, 'the first paid kind shipped without membersOnly')
  t.false(canPlayDrill(kind, false), 'a non-member can open a kind that comes with the membership')
  t.true(canPlayDrill(kind, true), 'a member cannot open the kind they paid for')
})

// The other side of the same ruling, and the one that would be quietly
// catastrophic: "which hand wins" is free forever (technology#38). No commit
// may ever give it a flag.
test('which hand wins is still free, and unmetered', (t) => {
  const free = drillKind('which-hand-wins')
  t.falsy(free.membersOnly, 'the free kind has been made part of the membership')
  t.true(canPlayDrill(free, false), 'the free kind is no longer free')
})

test('every registered kind says which side of the line it is on', (t) => {
  for (const kind of DRILL_KINDS) {
    t.true(kind.title.length > 0 && kind.blurb.length > 0, `${kind.id}: unlabelled`)
    t.true(kind.question.length > 0 && kind.gradedBy.length > 0, `${kind.id}: unexplained`)
    // A kind is free or it is the membership's and there is no third thing.
    t.true(
      kind.membersOnly === true || kind.membersOnly === undefined,
      `${kind.id}: membersOnly is neither true nor absent`,
    )
  }
})

// Nothing in the drills layer may become a thing you run out of, and a paid
// kind is exactly where that rule is easiest to erode for a good reason. The
// copy on the kind is generated from nothing, so this reads it directly.
test('nothing about the paid kind is metered', (t) => {
  const kind = drillKind(KIND)
  for (const line of [kind.title, kind.blurb, kind.question, kind.gradedBy]) {
    t.notRegex(
      line,
      /\b(streak|daily|today|trial|free spots?|remaining|left today|limit|locked|upgrade now)\b/i,
      `"${line}"`,
    )
  }
})

// ---------------------------------------------------------------------------
// The ladder, which is where a rating turns into a sentence about a player.
// ---------------------------------------------------------------------------

test('the outs ladder is its own shapes, easiest first, reading their difficulty', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the paid kind has no ladder')

  t.deepEqual(
    ladder.map((s) => s.settledBy),
    ['one-draw', 'two-draws', 'many-draws'],
    "the ladder is not this kind's shapes in order",
  )
  for (const shape of ladder) {
    t.is(shape.rating, outsDifficulty(shape.settledBy as OutsShape, false), `${shape.settledBy}`)
    t.true(shape.label.length > 0 && shape.label === shape.label.toLowerCase())
  }
  const ratings = ladder.map((s) => s.rating)
  t.deepEqual(
    ratings,
    [...ratings].sort((a, b) => a - b),
    'the ladder is not easiest first',
  )
  t.is(ratings[0], EASIEST_OUTS)
})

// The generator dealing a shape the ladder does not carry means a player above
// it is told they are still working up to something they clear every time.
test('the ladder describes every shape the generator actually deals', (t) => {
  const dealt = new Set(accepted(1, 3_000).map((d) => d.settledBy))
  const described = new Set(spotLadder(KIND)?.map((s) => s.settledBy))
  for (const shape of dealt) t.true(described.has(shape), `${shape} is dealt and not on the ladder`)
})

// The sentence used to end "split pots included", which was true of the only
// kind there was. A player at the top of this ladder has never been asked about
// a split pot.
test("the top of the outs ladder is not described with the other kind's shapes", (t) => {
  const top = standingLine(KIND, HARDEST_OUTS + 1)
  t.is(
    top,
    'You read every shape these spots come in more often than not, spots with three or more draws at once included.',
  )
  t.false(top?.includes('split'), 'the outs standing mentions split pots')
  t.false(top?.includes('Next up'), 'there is nowhere above the top of the ladder to point at')
})

test('the outs standing never becomes a thing to be behind on', (t) => {
  for (let rating = 400; rating <= HARDEST_OUTS + 400; rating += 7) {
    const line = standingLine(KIND, rating)
    if (!line) continue
    t.notRegex(
      line,
      /\b(streak|today|daily|day|week|yesterday|back|goal|target|progress|left|behind|keep going)\b/i,
      `"${line}"`,
    )
    const standing = standingFor(KIND, rating)
    for (const shape of standing?.cleared.slice(0, -1) ?? []) {
      t.false(line.includes(shape.label), `${rating}: "${line}" lists a shape below the top one`)
    }
  }
})

// ---------------------------------------------------------------------------
// Purity, which the free kind's tests hold for the folder and this holds for
// the new file: no storage, no store, no clock. A drill that could read the
// clock could decay, and the rating is a mirror.
// ---------------------------------------------------------------------------

test('nextDrill finds a spot well inside the attempt limit', (t) => {
  // Not a performance test. Walking a long way from a seed would mean the
  // filter had started rejecting nearly everything, and throwing is the honest
  // answer to that rather than a screen that hangs.
  for (let seed = 1; seed <= 300; seed++) {
    const drill = nextDrill(KIND, seed)
    t.true(drill.seed - seed < 60, `seed ${seed}: walked ${drill.seed - seed} seeds`)
    t.is(drill.kind, KIND)
  }
})
