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
- **Pot-Limit Omaha** — four cards, use exactly two, pot-limit betting. Same engine
- **Build your own table** — seats, stakes, depth, speed, bounty and who sits down. The
  opposition still comes from the buy-in, so you cannot build yourself an easy game
- **Member rooms** — four more tables and three regulars you only meet in them
- **A report on your own play** — leaks and strengths drawn from every hand you have
  played, each one showing the sample it came from
- **Watching a tournament out after you bust**, with every hand face up

## Considering next

Roughly in order of interest, honestly uncertain:

- **Multiplayer** — real tables against real people, not just the AI cast. It's the
  biggest lift on this list and a genuine goal for Pip, so it sits further out — but it's
  on the map, and the open, deterministic engine is built to support it.
- **A reason to come back** — Pip has no way to pull you back once you close the tab.
  Exploring options that keep "no account needed" true (a returning ritual around
  the Daily, an *optional* reminder). Retention is the honest weak spot.
- **More table life** — more table-talk and deeper career reads. Three new regulars and
  the play report have landed; the talk is still thinner than it should be.
- **Depth in the AI** — it plays real poker (equity, pot odds, position, bluffs) but a
  strong player will out-read it. Making it tougher and more varied over time. **Omaha
  sharpens this**: its opponents read genuine Omaha equity but their personalities were
  tuned against two cards, so that table is the one most in need of a pass.
- **Learning** — a stronger path for people picking up Hold'em (the tutorial, the guides
  and the drills are the seed).

## How Pip pays for itself

Worth saying plainly, because a free product that never explains this is usually about to
surprise you.

**Pip is free to play and a large part of the game is open to everybody.** Not a trial, not
a demo, and — the part that actually matters — **nothing that shipped free ever gets metered
later.** Free, permanently: the whole ten-venue ladder and every side table, the Rail's cash
games, the challenge tables, the Daily Deal, the Chip Shop economy, the Kitchen Table
freeroll, the read on every hand as you finish it, the card at the end of a run, a drill kind
played as often as you like, every written guide, the odds calculator, and moving your
profile between devices. You can play Pip for years and never see a price.

**There is also a membership, and it is a real fence.** It does not unlock the game above —
it adds rooms and tools beside it. We would rather say "fence" than pretend otherwise.

There will eventually be a **membership**, for the things that cost real money to run or
that don't exist yet. **Built and sitting behind the check today**: the drills called
"Count your outs", "Pot odds" and "Who gets there?" plus the play-it-out mode; four member
rooms with three regulars of their own; build-your-own-table; Pot-Limit Omaha; a report that
reads your play across every hand you have ever played; watching a tournament out after you
bust; and four member card backs. **Not built**: multiplayer, which is the big one and is
honestly some way off.

The drill that shipped free stays free and unmetered, which is the paragraph above applied
to the thing most likely to test it. The full list, including which parts are real, is at
[/membership](https://playpip.io/membership) — that page is generated from the same data
this paragraph is written from, and a test stops it advertising anything unbuilt.

**Member rooms count toward your rank, and you should know that without having to work it
out.** Rank comes from the highest Roll you have ever reached, so a member with more tables
to win at reaches a rank sooner. We thought hard about whether that makes "no pay-to-win"
false and decided it does not: pay-to-win means buying an advantage over another player, and
Pip is single-player with no leaderboard and nobody to overtake. There is no contest to buy
your way to the front of, and if somebody wants to farm chips all evening, that is their
evening. **The promise that holds absolutely, in every case, is that nothing you can buy
changes a hand** — not the cards, the odds, what you are shown, or a rebuy.

**That argument is ours to make again if multiplayer ships**, because then there is somebody
to win against and "no leaderboard" stops being an answer. It is written down as a condition
rather than left to be noticed.

**Most of it is now built, and there is still no way to pay for any of it.** The membership
check is live and everything listed above sits behind it. There is a `/membership` page,
which tells you the price — but **there is no checkout, no Stripe account, and not one
person has given us any money.** Nobody is a member. That is the whole of the state, and it
is a stranger state than it sounds: we built the thing before we built the till, on purpose,
because a half-built product with a working payment button is how people get taken.

If that ever stops being true, this section is where you'd catch us. It has stopped being
true three times: the first version said the membership wasn't built; the correction said one
drill was behind it when it was already two; and it described the membership as mostly
unbuilt on the day most of it shipped. This is the third fix.

One near-miss worth recording, because a correction log that only lists the times we were
wrong is not much of a log. When member rooms were ruled ranked, this section briefly
retired "pay-to-win" as no longer strictly true and reworded the landing page with it. That
was over-cautious and it was put back: the phrase means an advantage over another player,
and there is not one here to have. The reasoning is in `docs/brand.md`.

## Not planned

- **Pay-to-win — ever.** Nothing you can pay for touches the cards, the odds, the
  information on your screen, or how a hand plays out. No bought chips, no rebuys, no
  insurance, no stat boosts. Chip Shop cosmetics stay earned with chips you won, and award
  chips are earned-only forever. The membership sells access to more of the game, never an
  advantage inside a hand of it.
- **Real-money gambling.** Play money only, forever. Chips are not a currency.
- **Accounts you're forced into, ads, or tracking that identifies you.** Not happening.
  The account is optional, and Pip works fully without one.

Multiplayer is a real goal — a bigger build, so further out, but on the map. Whatever lands,
the open codebase is what keeps the anti-scam promise honest.
