// Shared test helpers (not a *.test.ts file, so AVA won't run it directly).
import { createDeck, cardFromString, cardToString, type Card } from '@/lib/poker/cards'

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
