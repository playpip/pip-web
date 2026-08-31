# Roadmap

Where Pip is going, in the open. This is **direction, not a promise** — priorities shift,
and dates aren't listed on purpose. If something here matters to you,
[open an issue](https://github.com/playpip/pip-web/issues) or a discussion and help shape it.

## Shipped

- Single-player Texas Hold'em against a cast of AI regulars
- The ten-venue ladder + side tables (turbo, deep, heads-up, bounty)
- The Daily Deal — one date-seeded tournament a day, identical for everyone
- Hand permalinks — share any hand as a URL that replays step by step
- The Chip Shop — earned cosmetics (style, never edge) + collectible award chips
- The Kitchen Table freeroll — win your way back when you're broke
- Ambient help — live equity, hand strength, opponent reads, last-hand review
- Light/dark themes, sound, desktop + mobile, installable PWA
- Local-first: your profile lives in your browser (versioned, exportable), with an
  optional account if you want it on more than one device
- Written guides at `/learn`, with every figure on them computed rather than typed
- A free poker odds calculator that prints the margin of error next to the answer
- Drills: short spots with a right answer, graded by the engine, never metered
- A card at the end of a tournament that reads the run you just played, and stores nothing

## Considering next

Roughly in order of interest, honestly uncertain:

- **Multiplayer** — real tables against real people, not just the AI cast. It's the
  biggest lift on this list and a genuine goal for Pip, so it sits further out — but it's
  on the map, and the open, deterministic engine is built to support it.
- **A reason to come back** — Pip has no way to pull you back once you close the tab.
  Exploring options that keep "no account needed" true (a returning ritual around
  the Daily, an *optional* reminder). Retention is the honest weak spot.
- **More table life** — new opponents, more table-talk, deeper career reads.
- **More to play** — additional venues and side-table formats.
- **Learning** — a stronger path for people picking up Hold'em (the tutorial + equity
  readout are the seed).
- **Depth in the AI** — it plays real poker (equity, pot odds, position, bluffs) but a
  strong player will out-read it. Making it tougher and more varied over time.

## How Pip pays for itself

Worth saying plainly, because a free product that never explains this is usually about to
surprise you.

**The game on this page stays free and complete.** Not a trial, not a demo, and nothing in
it gets metered later. That covers the ladder, the venues, the Daily, the Chip Shop economy,
moving your profile between devices, and every written guide.

There will eventually be a **membership**, for the things that cost real money to run or
that don't exist yet: multiplayer, and more kinds of drill. The drill that shipped free
stays free and unmetered, which is the paragraph above applied to the thing most likely to
test it.

**Part of it is built, and this section said it wasn't until 26 August.** The membership
check is live in the app, and since 25 August the drills called "Count your outs" and "Pot
odds" have sat behind it. There is no price, no membership page and no way to pay, so
nobody is a member and nobody has given us any money. That is the whole of the state.

If that ever stops being true, this section is where you'd catch us. It has stopped being
true twice: the first version of this section said the membership wasn't built, and the
correction said one drill was behind it when it was already two. This is the second fix.

## Not planned

- **Pay-to-win — ever.** Chip Shop cosmetics are earned, not sold, and edge is never for
  sale at any price.
- **Real-money gambling.** Play money only, forever. Chips are not a currency.
- **Accounts you're forced into, ads, or tracking that identifies you.** Not happening.
  The account is optional, and Pip works fully without one.

Multiplayer is a real goal — a bigger build, so further out, but on the map. Whatever lands,
the open codebase is what keeps the anti-scam promise honest.
