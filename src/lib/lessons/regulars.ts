import { type Character, characterById, profileFor, rosterFor } from '@/config/cast'
import { ALL_VENUES, type Venue } from '@/config/venues'
import type { AiProfile } from '@/lib/poker/ai/policy'

// What the regulars do, read off the only place it is decided.
//
// **Every claim the Regulars lesson makes about a character is a parameter.**
// A character is a small nudge (`delta`) over the room's AI profile
// (config/cast.ts → `profileFor`), and the AI reads exactly three of those
// dials (lib/poker/ai/policy.ts):
//
// - **tightness** raises the bar a starting hand has to clear before chips go
//   in (`0.15 + tightness × 0.5` on the preflop scale) and the equity it asks
//   for over the price before calling a bet. Looser plays more hands.
// - **bluff** is the chance of betting a hand with next to no equity when the
//   pot is checked to them.
// - **aggression** is how often a strong hand bets or raises rather than
//   checking or calling, and how big the bet is.
//
// So a question here is answered by comparing the dial, never by a sentence
// somebody wrote about the character, and `tests/lessons.test.ts` pins each
// trait the lesson names to its dial and re-measures the direction in a
// simulated game, so a cast retune that makes the lesson false fails the build.
// Nothing claims more than the dial does: no reads, no tells, nothing about
// the river that the numbers do not produce.

/** The dials a lesson may teach from, and which way each trait turns one. */
export const TRAITS = {
  loose: { dial: 'tightness', sign: -1, question: 'plays the most hands' },
  tight: { dial: 'tightness', sign: 1, question: 'folds the most hands' },
  bluffs: { dial: 'bluff', sign: 1, question: 'bets the most with nothing' },
} as const satisfies Record<
  string,
  {
    dial: keyof Pick<AiProfile, 'tightness' | 'aggression' | 'bluff'>
    sign: 1 | -1
    question: string
  }
>

export type Trait = keyof typeof TRAITS

/** The room a lesson seats the regulars in, by id. */
export function roomById(id: string): Venue {
  const venue = ALL_VENUES.find((v) => v.id === id)
  if (!venue) throw new Error(`No room "${id}"`)
  return venue
}

function regular(id: string): Character {
  const ch = characterById(id)
  if (!ch) throw new Error(`No regular "${id}"`)
  return ch
}

/** How far a character's dial sits from the room's, in the trait's direction. */
export function lean(id: string, trait: Trait, room: Venue): number {
  const { dial, sign } = TRAITS[trait]
  return sign * (profileFor(room, regular(id))[dial] - room.ai[dial])
}

/**
 * Of these regulars, who has the most of the trait at this room. Throws on a
 * tie, or when the winner is no different from the room: a question whose
 * answer is "nobody in particular" is a lesson written wrong.
 */
export function mostOf(trait: Trait, among: readonly string[], room: Venue): string {
  const ranked = [...among].sort((a, b) => lean(b, trait, room) - lean(a, trait, room))
  const [first, second] = ranked
  if (!first || !second) throw new Error('A question about the regulars needs two of them')
  const top = lean(first, trait, room)
  if (top <= 0) throw new Error(`${first} is not ${trait} at ${room.id}`)
  if (top - lean(second, trait, room) < 0.02) throw new Error(`${first} and ${second} tie`)
  return first
}

/** Does this regular sit at this room at all? A lesson only seats them where they play. */
export const playsAt = (id: string, room: Venue) => rosterFor(room).some((ch) => ch.id === id)

const two = (n: number) => Math.abs(n).toFixed(2)

/**
 * Why, in the lesson's words, with the dial's own number in it. Every clause is
 * the parameter or what policy.ts does with it.
 */
export function traitBecause(trait: Trait, id: string, room: Venue): string {
  const name = regular(id).name
  const by = two(lean(id, trait, room))
  if (trait === 'loose') {
    return `${name}: tightness ${by} below the room’s, on a scale of nought to one. It is the bar a hand has to clear before chips go in, so ${name} plays hands the others fold.`
  }
  if (trait === 'tight') {
    return `${name}: tightness ${by} above the room’s. A higher bar before the flop, and more asked of a price before calling.`
  }
  return `${name}: bluff ${by} above the room’s. It is the chance of betting next to nothing when the pot is checked round, and nobody else here has it as high.`
}
