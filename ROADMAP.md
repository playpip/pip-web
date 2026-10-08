# Roadmap

Where Pip is going, in the open. This is **direction, not a promise** — priorities shift,
and dates aren't listed on purpose. If something here matters to you,
[open an issue](https://github.com/playpip/pip-web/issues) or a discussion and help shape it.

## Shipped

- Single-player Texas Hold'em against a cast of AI regulars
- The ten-venue ladder, plus side tables (turbo, deep, heads-up, bounty) with the membership
- The Daily Deal — one free date-seeded tournament a day, identical for everyone; a play streak
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
- **Short Deck, Omaha Hi-Lo, Five-Card Draw and blackjack** — the other games at the side tables
- **Lessons with Webb** — five levels of interactive lessons on the real felt, each with a
  practice pack; Level 1 free
- **Build your own table** — seats, stakes, depth, speed, bounty and who sits down. Invite
  the high rollers to a cheap table and they bring their own game with them; the prize is
  the same, and nobody you invite can build you an easier one
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
  A free Daily, a streak for days played and an opt-in reminder email are the first answer.
  Still to explore: push reminders in the iOS app. Retention is the honest weak spot.
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
a demo, and — the part that actually matters — **the core game is free forever and never
metered.** Free, permanently: the whole ten-venue ladder, the Rail's cash
games, the challenge tables, the Daily Deal, the Chip Shop economy, the Kitchen Table
freeroll, the read on every hand as you finish it, the card at the end of a run, two drill
kinds played as often as you like, Level 1 of Lessons with Webb, every written guide, the odds calculator, and moving your
profile between devices. You can play Pip for years and never see a price.

**There is also a membership, and it is a real fence.** It does not unlock the game above —
it adds rooms and tools beside it. We would rather say "fence" than pretend otherwise.

**Built and sitting behind the check today**: every side table and the games that are
not Hold'em (Pot-Limit Omaha, Short Deck, Omaha Hi-Lo, Five-Card Draw, blackjack); the drills called
"Which five play?", "Count your outs", "Pot odds" and "Who gets there?" plus the play-it-out
mode; the practice packs "Calling the river", "Open or fold", "Bet or check" and "Shove or
fold"; the interactive lessons with
Webb from Level 2 up; four member rooms with three regulars of their own; build-your-own-table;
a report that reads your play across every hand you have ever played; watching a
tournament out after you bust; the session review; and four member card backs. **Not
built**: multiplayer, which is the big one and is honestly some way off.

**One member game a day is free without joining** (2026-10-07): any one poker table on the
side tables shelf, Omaha and Short Deck included. Lessons are not in it.
It comes back at midnight UTC. It is a whole game, never part of one, and it is the same
table a member gets. A non-member whose report has something to say also sees its
top finding on the card at the end of a run, with a link to the rest.

The drills that shipped free stay free and unmetered, which is the paragraph above applied
to the thing most likely to test it. Two of the ten are free, and the free pair is the pair
a beginner starts on: naming the hand you are holding, and reading two finished hands
against each other. The full list, including which parts are real, is at
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

**All of it is built, and the till is open.** The membership check is live and everything
listed above sits behind it. `/membership` tells you the price, and checkout, billing and
cancelling run through Stripe. We built the thing before we built the till, on purpose,
because a half-built product with a working payment button is how people get taken — so
nothing went on sale until everything above was real.

**One line moved, and you should hear it from us.** This section used to say every side
table was free permanently. On 2026-09-20 the side tables moved behind the membership —
before the till existed, so before anybody could have paid for or relied on the promise.
The promise was narrowed to the core game rather than quietly edited; the full account is
in [docs/membership.md](docs/membership.md), including why it does not happen again.

If any of this ever stops being true, this section is where you'd catch us. It has stopped
being true four times: the first version said the membership wasn't built; the correction
said one drill was behind it when it was already two; it described the membership as mostly
unbuilt on the day most of it shipped; and it still called the side tables free after they
moved and said there was no way to pay after there was one. This is the fourth fix.

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
