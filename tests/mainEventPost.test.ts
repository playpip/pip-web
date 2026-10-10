import test from 'ava'
import { VENUES, venueById } from '@/config/venues'
import { disguised } from '@/lib/poker/ai/policy'
import { MAX_STACK } from '@/lib/drills/shoveRange'

// `/blog/a-beginner-beat-the-main-event` describes the bots in sentences. Each
// sentence about the code is pinned here, so a change to the code fails a test
// instead of leaving the post quietly wrong.

test('a two-thirds pot bet breaks even at two folds in five', (t) => {
  const pot = 3
  const bet = 2
  t.is(bet / (pot + bet), 0.4)
})

test('short stacks play the chart at fifteen big blinds or fewer', (t) => {
  t.is(MAX_STACK, 15)
})

test('the Main Event plays at full skill, so off the chart every time', (t) => {
  t.is(venueById('mainevent')?.ai.skill, 1)
})

test('the lower tables keep the size tell and the top hides it', (t) => {
  const bluff = 10
  const value = 30
  const ladder = VENUES.slice(0, VENUES.findIndex((v) => v.id === 'mainevent') + 1)
  const sizes = ladder.map((venue) => disguised(bluff, value, venue.ai.skill ?? 1))
  t.is(sizes[0], bluff, 'the bottom of the ladder keeps the tell')
  t.is(sizes.at(-1), value, 'the Main Event sizes a bluff like value')
  // "From the middle of the ladder up": the tell goes somewhere in the middle third.
  const firstHidden = sizes.findIndex((size) => size > bluff)
  t.true(firstHidden >= ladder.length / 3 && firstHidden <= (ladder.length * 2) / 3)
})
