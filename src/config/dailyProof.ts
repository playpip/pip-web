// The worked example behind /blog/verify-todays-deal.
//
// The post tells a stranger how to regenerate the Daily's shuffle without our
// code, and then prints one day's answer so they have something to check
// against. Both halves are claims about this repo's own functions, and both are
// the kind nobody re-reads: a number in prose and a snippet in a code block.
// So neither is written twice. The figures below are typed out on purpose,
// because a figure derived from the engine can never disagree with it and
// therefore proves nothing; tests/dailyProof.test.ts settles them against
// src/lib/daily.ts, and runs SNIPPET as real code to check the published
// version still produces the published deck.

/** The day the post works through. Fixed, not "today" — a date is checkable forever. */
export const PROOF_DATE = '2026-08-20'

/** Which Daily that was. */
export const PROOF_DAILY_NUMBER = 36

/** FNV-1a over PROOF_DATE. */
export const PROOF_DAY_SEED = 3506893447

/** The first hand's seed, mixed out of the day seed. */
export const PROOF_HAND_SEED = 1328646974

/** The first hand's 52 cards, in dealt order. */
export const PROOF_DECK =
  '8c 7d 9c Tc 5d 6s Ah 6h 5s 9s Kc Ks 8d Qh 5c 3d 9h 2c Ts 9d Qs As Kd 7s 2d 2h Td Kh 6d 4d 3c 4h Ad Jc 4s 4c Jh 2s 3h Qd 5h Ac Th 8h Js Qc 7c 6c 7h Jd 3s 8s'

/** How many of the deck the post prints in the body, before the full list. */
export const PROOF_PREVIEW_CARDS = 9

/**
 * The snippet the post publishes. Plain JavaScript, no imports, nothing from
 * this repo: the whole point is that it runs anywhere and still agrees with us.
 */
export const SNIPPET = `const dateKey = '${PROOF_DATE}' // any UTC date, including today's

const fnv1a = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The day's seed, then the first hand's.
const daySeed = fnv1a(dateKey)
const handSeed = (daySeed ^ Math.imul(1, 0x9e3779b9)) >>> 0

// A fresh deck in rank order, then one pass of Fisher-Yates down from the top.
const rng = mulberry32(handSeed)
const deck = []
for (const rank of '23456789TJQKA') for (const suit of 'cdhs') deck.push(rank + suit)
for (let i = deck.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1))
  ;[deck[i], deck[j]] = [deck[j], deck[i]]
}

console.log(deck.join(' '))`
