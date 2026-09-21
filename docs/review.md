# Session review & the report

The two coaching surfaces that read more than one hand. Both come with the
membership; both are counted for everybody.

## The coaching line, in one table

| | Reads | Who gets it | Where |
|---|---|---|---|
| **Second opinion** | one hand | everybody, free forever | the handover banner (`lib/coach.ts`) |
| **End-of-run card** | one run | everybody, free forever | the bust/win overlay (`lib/recap.ts`) |
| **Session review** | one session, hand by hand | members | `/game/review` |
| **Your report** | every hand you have played | members | `/game/report` (`lib/deepCoach.ts`) |

**The hand is free, the player is paid** (Will, 2026-07-30). That is the whole
split and it has not moved.

## One pass of arithmetic, three consumers

`finishHand` in `store/game.ts` scores each finished hand **once**:

```ts
const scored = scoreDecisions(record, { max: MAX_REVIEWED_DECISIONS })
set({ lastRead: handCoaching ? readFrom(scored, record) : null })   // free
appendReviewHand(record, scored)                                     // the session
profile.recordReviewHand(reviewed)                                   // the career
```

It is fifteen hundred Monte Carlo simulations per priced decision, so doing it
twice would be doing it twice. `lib/coach.ts` owns that arithmetic and **knows
nothing about entitlement** — see the note under "the import rule" below.

## What counts as a priced decision

A call or a fold the pot put a price on, judged against the equity the hero had
at the moment they acted, out of the `HeroDecision` snapshot the store took then.

- **Bets and raises are never graded.** What makes them good is fold equity,
  which is a guess about an opponent rather than a number on the table. The
  screens say so out loud rather than letting a player infer their betting was
  fine because nothing was marked.
- **No card the player could not see.** Grading reads snapshots, never
  `record.reveals` beyond the hero's own hole cards. `tests/review.test.ts`
  targets it, as `tests/coach.test.ts` does for the free read.
- **Inside the noise floor is its own answer.** The free read goes silent there;
  the review marks the spot `close` and says the estimate cannot call it. A list
  claiming to be complete cannot go quiet.

## The screen: it is the game screen

**Not a diagram of the table — the table** (Will, 2026-09-21). `/game/review` is
full-bleed, with the same AppBar, the same seats on the same arc, the same
cards, the same `POT`, and the same hero cards and panel at the bottom. The
only thing in a different place is the row where Fold / Check / Raise sit while
a hand is live: the review puts the step arrows there.

That holds by construction rather than by care. `components/table/parts.tsx`
(`Seat`, `HeroCards`, `HeroPanel`, lifted out of `Table.tsx`) takes the engine's
own `Player` and `HandState` and nothing else — no store, no clock — so
`lib/review/handState.ts` rebuilds a real `HandState` for any step of a
recorded hand and the felt renders it. A second implementation of the table
would look right the day it shipped and be wrong by the end of the month.

Two props on those components exist only for the review, and both are additive:
`badge` (a seat's chance of taking it) and `defaultPage` / `oddsPrefix` (so the
hero's panel opens on the odds). Neither changes what a live table draws.

**Every hole card is face up, including the ones that folded and mucked.**
`HandRecord.hole` keeps every hand dealt — separate from `reveals`, which is
what the table actually turned over and what a `/hand` link carries. A shared
hand shows what the players showed; a review shows everything, because the hand
is over and nothing anybody learns can be played. Same argument as "Watch it
out", and half of what a review teaches is what the hand you folded would have
made.

**Each seat carries its chance from right there, exact wherever exact is
affordable** (`showdownOdds`, lib/poker/equity). With every hole card known the
only unknown is the board: one runout on the river, forty-odd on the turn, a few
hundred on the flop, all dealt out. Preflop runs to millions, so it samples and
the figure wears `≈`.

**Every step is rated, in one place.** The line by the board leads with the
chip — *Brilliant · Good · Standard · Mistake · Blunder* — then what happened
and what it was worth. It names whoever made the move, so the chip needs no
second home: a copy on the seat and another above your own cards both said the
same thing twice. The seats keep their own badge for the one thing the line
does not carry, which is each player's chance of taking it from here.

**Every move gets a rating, `Standard` included**: a step that showed nothing
read as a step where the feature had failed. `Standard` wears a light green,
because it means nothing went wrong rather than nothing to say.

**Nothing is rebuilt.** Stacks, chips in front and the pot ride on each action
event, and the table as the cards landed rides on `record.start`, so step zero
is the felt after the blinds rather than a row of zeroes. A hand recorded before
those fields existed shows what it has (`tests/replay.test.ts`).

**The hand list and the session's numbers live in one sheet** (`HandPicker`),
opened from the controls or the AppBar. The felt is the screen; a scoreboard
over it is a second screen fighting the first.

Keys: `←`/`→` step, `↑`/`↓` (or `j`/`k`) change hand, `Home`/`End` jump to the
ends of the hand, space steps forward.

## Grading a move: two questions, two answers

| | Reads | Grades | Powers |
|---|---|---|---|
| `lib/coach.ts` → `lib/review/grade.ts` | only what you could see | your calls and folds | the free read, and the **report** |
| `lib/review/moveGrade.ts` | every card, face up | **every move, by everybody** | the **review's** chip per step |

**The review grades bets, and the report never will.** What makes a bet good is
fold equity — a guess about an opponent — so a module that only knows what was
visible cannot touch one. The review knows what everyone actually held and what
they actually did, so it can, and the arithmetic has no guess in it:

- **They folded.** The bet won a pot worth only `equity` of it to you, so it
  made `pot × (1 − equity)` — **worth more the worse the hand was**. That is why
  a bluff that works is genuinely good and this can prove it.
- **They called.** You are in a pot of `pot + 2B` having put in `B`, so against
  checking it back the bet made `B × (2 × equity − 1)`: profit above half,
  loss below. Betting into a better hand costs, and the number says how much.
- **A call or a fold** is `equity × (pot + toCall) − toCall`, positive or
  negative, exactly as the free read prices it — but with their cards face up
  instead of a range.
- **A check commits nothing**, so it is never a mistake. Whether a bet would
  have been better needs fold equity, and that is the one guess this refuses.

**Everybody is graded, not just you.** Watching where the table went wrong is
most of what makes a replay worth stepping through, and each player's price
comes off the same recorded `committed` maps — nobody needs a snapshot of their
own.

| Verdict | When |
|---|---|
| **Brilliant** | worth ≥ `BRILLIANT_BB` while holding under `BRILLIANT_EQUITY` — the bluff that worked, the hero call that was right |
| **Good** | worth ≥ `FINE_BB` |
| **Fine** | inside `FINE_BB` either way, or a check |
| **Mistake** | cost more than `FINE_BB` |
| **Blunder** | cost `BLUNDER_BB` or more |

**It is hindsight, and it says so when hindsight and the price disagree.** A
call that was right on the price and lost is not a mistake; a call that was
wrong on the price and got there is not a read. Where the two part company the
line adds the price: *"You needed 29% and had about 13%, so the price justified
it — they just had it."* That sentence is the whole reason the review may be
results-oriented at all.

**Priced at one street.** No implied odds, no future betting — the same
simplification `lib/coach.ts` makes. A raise is read as a bet of what it added,
and a hand with no recorded pot or chips in front is not graded at all rather
than graded at zero.

## Grades (the report's, on calls and folds only)

In **big blinds** — chips are meaningless across a 100-chip Garage and a
1,000,000-chip Main Event, and blinds climb inside a single tournament too.

| Grade | When |
|---|---|
| `sharp` | right, and the edge was thin (`< SHARP_EDGE`) |
| `sound` | right, comfortably |
| `close` | inside `EDGE_FLOOR` — unknowable, and said so |
| `slip` | wrong, under `COSTLY_BB` |
| `costly` | wrong by `COSTLY_BB` or more |

Chips appear beside a single decision, where they are what the player actually
pushed. **Anything summed anywhere is in big blinds** — and it is spelled out in
those words rather than as "bb", which is a sentence in a language the reader
may not speak (Will, 2026-09-21). The review's per-move lines are in chips for
the same reason: one hand is one blind level, so the two units cannot disagree
about which way a move went, and "it cost 16 chips" needs no glossary.

## Which tables are reviewed

`reviewableVenue()` in `config/venues.ts`: the ladder, the Rail, the Daily and
the freeroll — the four things rule 1 protects — and Hold'em only. Side tables,
Deep Stack, challenge tables and built tables are out by omission, and the
non-Hold'em rooms are out because the arithmetic is two-card equity and a
four-card game graded by it would be confidently wrong.

It is a **list of ids, not a shape test**: a Deep Stack room and a ladder rung
are the same shape, one is reviewed and one is not, and there is nowhere else
that difference could be written down.

## Storage

| | Where | Lives for |
|---|---|---|
| The session | `localStorage` `pip.review` | one session — the next sit-down replaces it |
| The career table | `profile.reviewStats` (v20) | forever, and it syncs |

**One session, not a library** (Will, 2026-09-20). No dates, nothing to fall
behind on — the call `lib/recap.ts` already made about runs. Capped at
`MAX_REVIEW_HANDS`; when it bites the screen says how many hands were dropped.

`reviewStats` keeps counters per street and per kind, plus up to three `/hand`
tokens per `EvidenceKey` — the worst hands a finding actually happened in, which
is what "See the hands" opens.

**Collected for everybody, shown to members.** The store never asks who is
paying (`tests/membershipSurfaces.test.ts` fails the build if it learns), so a
player who joins on a Tuesday gets a report with their history in it rather than
an instruction to go and play. It costs a few hundred bytes.

## The gate, and why the table never asks

`store/game.ts` is handed `member` at sit-down like it is handed the venue.
`Table.tsx` uses it to decide whether the end overlay and the leave dialog offer
**Review the session** — the same shape "Watch it out" already uses. Neither
links to `/membership` or imports `config/membership`.

`/game/review` and `/game/report` do the asking, with `useEntitlement()`, and a
non-member gets a padlock, a plain line and one text link. The page renders; it
does not vanish (docs/membership.md).

## The import rule, restated

docs/membership.md used to say `lib/coach.ts` and `lib/deepCoach.ts` must not
import each other. `deepCoach` now takes `PricedStreet` from `coach`, and
`lib/review/` takes `scoreDecisions` from it, because there is one set of four
streets and one piece of pricing arithmetic, and two spellings of either would be
worse.

**The property being protected is that `lib/coach.ts` never behaves differently
for a member.** It holds because there is nothing in that file to gate: no
entitlement import, no membership import, no branch. `tests/deepCoach.test.ts`
enforces exactly that — the free module may not import a paid one, and the paid
module may take a *type* from the free one and nothing else.

## Where to make changes

| Want to change… | Edit |
|---|---|
| Which tables are reviewed | `reviewableVenue` in `config/venues.ts` (+ `tests/review.test.ts`) |
| What counts as a mistake, in the report | `lib/review/grade.ts` |
| What a move was worth, in the review | `lib/review/moveGrade.ts` (+ `tests/moveGrade.test.ts`) |
| Which hands get picked out | `lib/review/highlights.ts` |
| What the report says | `lib/deepCoach.ts` (+ `tests/deepCoach.test.ts`) |
| Where a healthy number sits | `BANDS` in `lib/deepCoach.ts` — the meters draw from it |
| The replay itself | `components/replay/` — the transport, shared with the `/hand` permalink |
| The table the hand is replayed on | `components/review/ReplayTable.tsx` + `lib/review/replay.ts` |
| How the odds are worked out | `showdownOdds` in `lib/poker/equity.ts` |
