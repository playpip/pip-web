import test from 'ava'
import {
  EASIEST_SPOT,
  HARDEST_SPOT,
  RATING_FLOOR,
  STARTING_RATING,
  drillAt,
  expectedScore,
  spotDifficulty,
} from '@/lib/drills'
import { drillAccuracy, spotLadder, standingFor, standingLine } from '@/lib/drills/standing'

// The rating is four digits with no unit until something says what it means,
// and what it means is a claim about a player: "better than even on kickers".
// So the tests here are mostly about that claim being true rather than nearly
// true. A ladder that drifted a shape out of order, or a sentence that rounded
// a coin flip in our favour, would both read fine and both be a lie about
// somebody's poker.
//
// The other half is coverage: the ladder describes the shapes the generator
// actually deals, and a shape it stops describing is a shape the standing
// silently under-reports.

const KIND = 'which-hand-wins'

test('the ladder is the spots, in order, and it reads their difficulty rather than repeating it', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the free kind has no ladder')

  for (const shape of ladder) {
    t.is(
      shape.rating,
      spotDifficulty(shape.settledBy, false),
      `${shape.settledBy}: the ladder has its own number for this shape`,
    )
    t.true(shape.label.length > 0 && shape.label === shape.label.toLowerCase())
  }

  const ratings = ladder.map((s) => s.rating)
  t.deepEqual(
    ratings,
    [...ratings].sort((a, b) => a - b),
    'the ladder is not easiest first',
  )
  t.is(ratings[0], EASIEST_SPOT)
  t.is(ratings.at(-1), HARDEST_SPOT)
})

// If the generator starts dealing a shape the ladder does not carry, a player
// above it is told they are still working up to it, or worse, told nothing.
// Sampled from real spots rather than from the type, because the type is what
// would be updated in the same commit that broke this.
test('the ladder covers every shape the generator actually deals', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the free kind has no ladder')

  const dealt = new Set<string>()
  for (let seed = 1; seed < 3_000; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) dealt.add(drill.settledBy)
  }

  t.true(dealt.size >= 4, `only ${dealt.size} shapes in 3,000 seeds`)
  for (const shape of dealt) {
    t.true(
      ladder.some((s) => s.settledBy === shape),
      `the generator deals "${shape}" and the ladder does not know about it`,
    )
  }
})

// The claim under the copy. "Better than even" has one meaning and Elo already
// supplies it, so cleared shapes have to be strictly over the coin flip and the
// next one up has to be at or under it. This is the test that stops the
// boundary being nudged: `>=` instead of `>` on the compare would move a shape
// that is exactly a coin flip into "you read this more often than not".
test('"better than even" is better than even, and the next one up is not', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the free kind has no ladder')

  for (let rating = RATING_FLOOR; rating <= HARDEST_SPOT + 400; rating += 7) {
    const standing = standingFor(KIND, rating)
    if (!standing) return t.fail('no standing for a kind with a ladder')

    for (const shape of standing.cleared) {
      t.true(
        expectedScore(rating, shape.rating) > 0.5,
        `${rating} is told it clears ${shape.settledBy} at ${expectedScore(rating, shape.rating)}`,
      )
    }
    if (standing.next) {
      t.true(
        expectedScore(rating, standing.next.rating) <= 0.5,
        `${rating} is told ${standing.next.settledBy} is still ahead of it`,
      )
    }
    // Cleared is a prefix of the ladder: you cannot be better than even on
    // split pots and not on the hand rankings, because the ladder is ordered.
    t.deepEqual(standing.cleared, ladder.slice(0, standing.cleared.length))
  }
})

// Exactly on a shape's rating is a coin flip, which is the one boundary the
// whole reading rests on.
test('a spot at your own rating is not a spot you read more often than not', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the free kind has no ladder')

  for (const shape of ladder) {
    const standing = standingFor(KIND, shape.rating)
    t.false(
      standing?.cleared.some((s) => s.settledBy === shape.settledBy),
      `${shape.settledBy} counts as cleared by a rating equal to it`,
    )
    t.is(standing?.next?.settledBy, shape.settledBy)
    t.is(expectedScore(shape.rating, shape.rating), 0.5)
  }
})

test('the sentence says where you are and what is next, and nothing else', (t) => {
  // Below the whole ladder: no claim about anybody, just what comes first.
  const bottom = standingLine(KIND, RATING_FLOOR)
  t.is(bottom, 'Next up: the hand rankings.')

  // Where everybody starts, which clears the ranking spots and nothing else.
  const start = standingLine(KIND, STARTING_RATING)
  t.is(start, 'Better than even on the hand rankings. Next up: the same hand on both sides.')

  // Above the hardest shape there is nothing left to point at, and the sentence
  // has to stop rather than invent a next step. This is the line that would
  // otherwise become "keep going": there is nowhere to go.
  const top = standingLine(KIND, HARDEST_SPOT + 1)
  t.is(top, 'You read every shape these spots come in more often than not, split pots included.')
  t.false(top?.includes('Next up'))
})

// One line, two facts. Naming every shape below you turns the sentence into a
// checklist, and a checklist is a thing you can be behind on, which is the one
// shape this whole layer refuses (lib/daily.ts, lib/drills/rating.ts).
test('the sentence never lists the shapes you have already cleared', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) return t.fail('the free kind has no ladder')

  for (let rating = RATING_FLOOR; rating <= HARDEST_SPOT + 400; rating += 11) {
    const standing = standingFor(KIND, rating)
    const line = standingLine(KIND, rating)
    if (!standing || !line) continue
    for (const shape of standing.cleared.slice(0, -1)) {
      t.false(line.includes(shape.label), `${rating}: "${line}" lists a shape below the top one`)
    }
  }
})

// The vocabulary of a thing you can be behind on. The sentence is generated
// rather than written down, so this is the guard that catches a well-meant
// edit to the template.
test('nothing in the standing can be fallen behind on', (t) => {
  for (let rating = RATING_FLOOR; rating <= HARDEST_SPOT + 400; rating += 3) {
    const line = standingLine(KIND, rating)
    if (!line) continue
    t.notRegex(
      line,
      /\b(streak|today|daily|day|week|yesterday|back|goal|target|progress|left|behind|keep going)\b/i,
      `"${line}"`,
    )
  }
})

test('accuracy is absent before there is one, and rounded once', (t) => {
  t.is(drillAccuracy({ answered: 0, correct: 0 }), null, '0% is not a fact about a new player')
  t.is(drillAccuracy({ answered: 4, correct: 3 }), 75)
  t.is(drillAccuracy({ answered: 3, correct: 1 }), 33)
  t.is(drillAccuracy({ answered: 3, correct: 2 }), 67)
  t.is(drillAccuracy({ answered: 96, correct: 96 }), 100)
})
