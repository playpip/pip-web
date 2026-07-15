# Brand — Pip

## Name

**Pip** (lowercase wordmark: `pip`).

A pip is the small suit symbol printed on every playing card — the atom of the card
world. It's charming, minimal, and instantly card-flavored without needing poker
literacy: exactly the register of the clean, calm UI. One soft syllable, easy to say
and spell, and it names a *thing you can draw* — the identity (favicon, wordmark,
motifs) falls out of it naturally.

(GitHub repo: [`playpip/pip-web`](https://github.com/playpip/pip-web).)

## Positioning

Casual, single-player Texas Hold'em, **redesigned** — inspired by [Offsuit](https://offsuit.app/)'s
anti-casino ethos but its own product (desktop-first; Offsuit is phone-only).

The founding frustration we design against: free poker apps that *"look and feel like a
scam"* — fake felt, leather, neon, and more time spent closing pop-ups than playing.
Pip is the opposite.

It is also **open source and local-first** — the code is public and the app runs entirely
in your browser. That openness is core positioning, not a dev detail: it's the credibility
that lets us grow (paid cosmetics, multiplayer) without becoming the thing we replaced.

## Principles

1. **No scam energy.** Play money only. No real currency, no `$` symbols (balances read
   `N chips`). No dark patterns, no forced pop-ups, no pay-to-win.
2. **Clean over decorated.** Flat, black-first, one accent at a time. No skeuomorphic felt.
3. **Calm information.** Helpful stats (win %, hand strength) are ambient, never nagging.
4. **Premium restraint.** Subtle motion and sound; generous space; nothing gratuitous.
5. **Account-free & local.** No login, no barrier. Your progress is yours, on your device.
6. **Open by default.** Pip is open source — the deterministic, seeded engine most of
   all. Anyone can read exactly how a hand is dealt and shuffled, fork it, or self-host.
   This is a deliberate trust foundation, not a footnote: when we later add things you
   can pay for (cosmetics, extras — never pay-to-win) and social/multiplayer play,
   *"you can read the code"* is what keeps the no-scam promise credible. Provably fair
   beats "trust us." Guard this — closing the source, or shipping logic the public repo
   doesn't reflect, would quietly break the brand's core promise.

## Voice & tone

- Short, confident, unfussy. Lowercase wordmark; sentence-case UI.
- Poker-literate but friendly (venue taglines: *"Hustlers between shots."*,
  *"Balanced ranges, semi-bluffs, traps."*). Never hype-y or casino-barker.
- Encouraging, not exploitative — the broke-player line is *"Broke? Win your way back
  at the Kitchen Table."* (a freeroll, not a handout).

## Naming within the product

- The bankroll is **"your Roll."**
- Tables are **venues**, arranged as a **ladder** from *Friends' Garage* → *The Main Event*.
- Opponents get friendly first names (see `config/names.ts`).

## Do / Don't

| Do | Don't |
|----|-------|
| Say "chips", show `1,200 chips` | Show `$1,200` or imply real money |
| Use one accent per surface | Rainbow gradients, neon |
| Flat cards, subtle shadow | Fake felt, leather textures, glossy 3D |
| Quiet, tactile SFX | Casino jingles, coin-clatter, fanfares |
| Open source, provably fair | Hidden logic, "trust us", closed shuffles |
