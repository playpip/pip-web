// Randomness for the shuffles nobody is meant to be able to predict. The engine
// stays seeded and pure (lib/poker takes an `Rng` and never reaches for a
// global); the callers that deal for real hand it this one. The Daily Deal is
// the deliberate exception: its deck is a published, reproducible seed.

import type { Rng } from './poker/cards'

/** A random number in [0, 1) from the platform's CSPRNG. Every live shuffle uses this. */
export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296

/** A random integer in [0, n). */
export function cryptoInt(n: number): number {
  return Math.floor(cryptoRng() * n)
}
