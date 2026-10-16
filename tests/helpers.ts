// Shared test helpers (not a *.test.ts file, so AVA won't run it directly).
import { createDeck, cardFromString, cardToString, type Card, mulberry32 } from '@/lib/poker/cards'
import { createTableMemory, observeAction, observeHandEnd } from '@/lib/poker/ai/memory'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { applyAction, isHandComplete, startHand } from '@/lib/poker/engine'
import type { Variant } from '@/lib/poker/handEval'
import { venueById, type Venue } from '@/config/venues'

/**
 * Build a full 52-card deck whose LAST cards, when popped, yield `popOrder`
 * in the given order. The engine draws with deck.pop(), so popOrder[0] is
 * dealt first. Remaining cards fill the rest and are irrelevant to the test.
 */
export function makeDeck(popOrder: string[]): Card[] {
  const wanted = popOrder.map(cardFromString)
  const wantedKeys = new Set(wanted.map(cardToString))
  const rest = createDeck().filter((c) => !wantedKeys.has(cardToString(c)))
  // Popped from the end → append reversed so pop() returns popOrder in order.
  return [...rest, ...wanted.reverse()]
}

/**
 * Every action at three rungs over twelve hands, folded into one hash: the AI's
 * decisions and its every draw from the rng, at each rung's own profile after
 * `tweak`. tests/aiExperiment.test.ts pins what it comes to with no switches
 * set. `ids` and `variant` narrow or move it for a test that needs to.
 */
export function fingerprint(
  tweak: (p: AiProfile, venue: Venue) => AiProfile = (p) => p,
  ids: readonly string[] = ['garage', 'cardroom', 'mainevent'],
  variant?: Variant,
): string {
  let h = 2166136261
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
  }
  for (const id of ids) {
    const venue = venueById(id) as Venue
    const profile = tweak({ ...venue.ai, iterations: 60 }, venue)
    const rng = mulberry32(11)
    const memory = createTableMemory()
    for (let hand = 0; hand < 12; hand++) {
      let s = startHand({
        seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
        buttonIndex: hand % 6,
        smallBlind: 1,
        bigBlind: 2,
        rng,
        variant,
      })
      while (!isHandComplete(s)) {
        const a = decideAction(s, profile, rng, memory)
        mix(`${a.type}${a.amount ?? ''};`)
        observeAction(memory, s, a)
        s = applyAction(s, a)
      }
      observeHandEnd(memory, s)
    }
  }
  return (h >>> 0).toString(16)
}
