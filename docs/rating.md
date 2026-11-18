# The Pip Rating

> **Status: live since 2026-11-04; second scale 2026-11-05** ([The scale, v2](#the-scale-v2)). The migration is applied, `submit-rating` is deployed, and
> the repo Variable `NEXT_PUBLIC_RATING=1` is set. [To go live](#to-go-live) is kept as the
> record of how, and for a fresh project.

A number on a chess-like scale for **how well you decide**, not how much you win (Will,
2026-11-04). It is called the **Pip Rating**, never "Elo". It is public, with a live
leaderboard. The number is free for everyone; members also get the breakdown.

## Public, by decision

Pip's old rule was that nobody sees anybody else's rank. **The Pip Rating is public by Will's
decision of 2026-11-04.** The Roll (your chip balance) and the Roll titles stay private. A
player can hide themselves from the leaderboard from the rating sheet at any time.

It is not pay-to-win (docs/membership.md rule 3): the rating measures the quality of each
decision, so more tables, more hands or more chips cannot raise it, and nothing you can buy
changes a hand. What a member gets is the breakdown, which is coaching about their own play.

## The maths

All of it is `src/lib/rating/maths.ts`, one file with no imports and no secret, run by the
browser and the tests. The Edge Function runs an exact copy, `supabase/functions/_shared/rating.ts`
(the browser may not import from that folder), and `tests/rating.test.ts` fails if the two differ.
Edit `maths.ts` and copy it across.

1. **What a decision cost.** Every priced call or fold the hero makes, as `finishHand` in
   `store/game.ts` already scores it for the read (`scoreDecisions` then `gradeDecision`). The
   loss is the big blinds it gave up against the other choice, from the cards the player
   could see; **a right decision costs 0 whatever the cards did next**, so a bad beat costs
   nothing. A spot inside the noise floor (`close`) costs 0. One decision costs at most 20 big
   blinds. A first move when it folds round to you is graded off the charts instead
   ([What counts](#what-counts)); bets and raises after the flop are not rated. Its **stake**
   is the pot plus the price, in big blinds, capped at 200.
2. **Recent play counts more.** `loss = Σ w·cost / Σ w·stake`, where each new decision
   multiplies every earlier one's weight by `1 − 1/300`. So it is the share of what was at
   stake that you gave away, over roughly your last 300 decisions. Weighting by stake is what
   stops a player who folds every hand rating well on hundreds of cheap, correct folds.
3. **The scale.** `rating = 1000 − 350 × log2(loss / 0.025)`, clamped to 100..3000. 1000
   gives away 2.5% of the stake; every halving of that is 350 points.
4. **New players** start at 1000: a prior worth 100 big blinds of stake (about twenty
   decisions) that fades like any old decision. **Provisional** until 50 rated decisions;
   the sheet says "Rated after N more hands" (N is the decisions left, an upper bound on
   hands for a player who calls or folds every hand).
5. **Experience caps** (`EXPERIENCE_CAPS`). The number shown is held under Strong (1599)
   until 300 rated decisions, under Expert (1999) until 1,000, and under Master (2399) until
   2,500. The play underneath counts in full (`rawRatingOf`), so the number catches up when a
   cap lifts, and the server's 60-point limit is applied to the uncapped number so a cap
   lifting is never clamped. The sheet says when a cap is holding someone back.

### Where the numbers come from

`pnpm rating-calibrate --hands 400 --venue garage,ring-micro --hero <name>` seats a proxy at a
real table against that table's own AI and rates its hands exactly as the store does
(`ratedDecisionsOf`). Run 2026-11-05, after first moves were graded off the charts; about 200
to 770 rated decisions each, so each line is ±100 or so:

| Hero | Share given away | Rating |
|---|---:|---:|
| Calls everything | 7.9% to 8.8% | 360 to 420 |
| Folds to any bet | 7.1% to 8.3% | 400 to 470 |
| Coin flip | 7.2% to 9.0% | 350 to 470 |
| Garage / Pool Hall / Card Room regulars | 2.8% to 4.4% | 710 to 950 |
| Pub regulars | 1.7% to 5.1% | 640 to 1190 |
| Proxy "beginner" | 2.0% to 4.1% | 750 to 1110 |
| Proxy "casual" | 1.75% to 2.7% | 960 to 1180 |
| Casino regulars | 2.0% to 2.3% | 1040 to 1120 |
| Riverboat regulars | 1.1% to 1.4% | 1300 to 1400 |
| Proxy "competent" | 0.8% to 1.1% | 1420 to 1590 |
| Proxy "best" | 0.25% to 0.66% | 1670 to 2160 |

The first run (2026-11-04, calls and folds only) put "best" at 1.5% to 1.6%. It gives away far
less now because it plays the shove chart exactly, and those spots are now scored. The scale
was redrawn so that 2000 sits at the edge of the best play Pip has: like 2000 in chess, most
players never get there. A sound human beginner will sit below the beginner proxy, roughly
600 to 900. The proxies decide with the same equity estimate that grades them, so they agree
with the grader more than a person would; real players will sit lower than their proxy. The
ladder's regulars do not rate in ladder order (their difficulty is partly aggression, which
this does not grade), which is why the bands are not named after venues.

**Bands** (`RATING_BANDS`): Learning (under 800), Steady (800), Solid (1200), Strong (1600),
Expert (2000), Master (2400). None reuses a Roll title from `config/ranks.ts`.

## What counts

Every Hold'em hand dealt through `store/game.ts`: the ladder, the Rail, the Daily, the freeroll,
Hold'em side tables and quick games that deal through the store. Not other variants (the pricing
is two-card equity), not drills, not multiplayer rooms (yet). `ratedDecisionsOf`
(`src/lib/rating/hand.ts`) turns a finished hand into its rated decisions, and both the store and
`pnpm rating-calibrate` call it, so the calibration measures exactly what the table rates.

Two families of decision (Will, 2026-11-05: "measure more factors too, like raising"):

1. **Calls and folds facing a bet**, by street, priced as above (`preflop-call` … `river-fold`).
2. **Your first move when it folds round to you before the flop**, graded off the two charts
   the app already teaches (`src/lib/rating/preflop.ts`). These replaced the call-or-fold
   pricing for those spots, which treated a first-in fold or limp as a call against every
   player at the table and could not see a raise at all.
   - **15 big blinds or fewer, `preflop-shove`:** the shove chart (`lib/drills/shoveRange`)
     solves shove-or-fold for every seat and stack from 3 to 15 big blinds, and `shoveEv`
     prices any hand against the solved calling ranges behind. A shove or a fold has an exact
     value in big blinds; inside the chart's sampling margin it costs nothing. The callers are
     the equilibrium ones, not Pip's bots, so nothing is a guess about opponents. A raise of
     half your stack or more counts as a shove; a smaller raise or a limp is not graded.
   - **25 big blinds or more, `preflop-open`:** the opening chart the guides teach
     (`opensHand` in config/positions). It says raise or fold and not by how much, so the costs
     are fixed sizes (`OPEN_COST`): 0.4 big blinds for each band a raised hand sits past where
     the seat opens, 0.3 plus 0.4 a band for folding a hand the seat opens, 2 for folding jacks
     or better or ace-king, 0.25 for limping a hand worth a raise. This is a stated
     simplification, not solver output.
   - **Not graded:** the small blind's deep first move (the chart opens from four seats),
     stacks between 15 and 25 big blinds (neither chart is for them), and clear folds:
     junk deep, or a hand that loses more than a big blind shoved. Counting thousands of free,
     obvious folds would let a player who never plays a hand rate well on them.
3. **Bets and raises after the flop are not rated.** Their value depends on how often
   opponents fold. Pip could measure that against its own bots, but then the rating would
   reward beating Pip's bots rather than good poker. The hand review grades them with every
   card face up (`lib/review/moveGrade.ts`), which is where they belong for now.

**Only what the player could see.** The cost comes from the `HeroDecision` snapshot, taken
when the player acted, and the hero's own hole cards. A format that hides a card from the
player (Mystery Card) must leave it out of the snapshot or mark the venue `unrated`.

## Storage

- On the device: `profile.rating` (persisted, synced; the side with more rated decisions wins
  the merge, like a drill rating) and a queue of unsent hands in `localStorage`
  `pip.ratingQueue` (at most 200 hands). A guest's hands queue too and go up only once they
  sign in, so the server replays them rather than starting the account at one hand. Before a
  send, hands within an hour of the 14-day limit are dropped and only the oldest that fit
  under the hourly limit go, because one refused hand refuses the whole submission.
- On the server: `public.ratings`, the board (name, face, rating, peak, rated decisions,
  week start, hidden, flagged), readable by anyone where not hidden or flagged, and always by
  its owner; `public.rating_state`, the arithmetic and rate limits, readable by nobody. Only
  the Edge Function writes either, with the service role.

## Anti-cheat: what the server checks, and what it cannot

**Said plainly: hands against the AI are dealt, played and priced on the player's device.** The
server never sees a hand, only the list of decisions and their costs. A determined cheat can
send decisions that never happened, and no check below can prove otherwise. The checks make
that slow, bounded and visible, not impossible.

`submit-rating` (`decideSubmission`):

- **Signed in only**; it rates the caller's own row and nothing else.
- **It recomputes.** The client's rating is never read; the decisions are replayed onto the
  server's stored state.
- **Shape**: at most 200 hands a submission, 1 to 8 decisions a hand, a known kind, a loss
  from 0 to 20 big blinds and never more than its stake, a stake from 1 to 200. One bad
  value refuses the whole submission.
- **Timing**: hands in order, at least 2 seconds apart, no more than 2 minutes in the future,
  no more than 14 days old. A hand no newer than the last one counted is left out, not refused
  (no hand counts twice): another device counted past it, and refusing would cost the newer
  hands sent with it. A submission with nothing newer is refused as `already-counted`.
- **Rate**: one submission per 15 seconds, at most 900 decisions an hour.
- **Max change**: once established, one submission moves the rating at most 60 points.
- **Flag**: after 200 decisions, a record that rates 2600 or better (about 0.1% of the
  stake, some 450 points past the best proxy measured) flags the row off the board until a
  person clears it. Rejections are
  counted in `rating_state.rejected` for whoever reviews it.
- Names and faces are cleaned (length, control characters, avatar shape).

A cheat who sends plausible-looking decisions slowly will not be caught by this. Review the
top of the board by hand; if it becomes a problem the upgrade is rating only server-dealt
hands (multiplayer).

## Who sees what

| | Guest | Free account | Member |
|---|---|---|---|
| Own rating, peak, band | yes, local | yes | yes |
| On the leaderboard | no ("Make an account to join the leaderboard") | yes, unless hidden | yes, unless hidden |
| History graph, what is moving it | no | no (one line to `membershipFor('rating')`) | yes |

Events: `rating-sheet-opened`, `leaderboard-opened` (once a tab).

## The scale, v2

Shipped 2026-11-05 (Will: "Some people will never reach 2000 in chess"). Three changes, one
re-map: first moves graded off the charts ([What counts](#what-counts)), the scale redrawn
from the new calibration (1000 at 2.5%, 350 a halving; it was 4.5% and 700), and the
experience caps. The play behind every rating (`core`) carried over; only the numbers
derived from it changed.

- **Device**: `PERSIST_VERSION` 32 keeps `core` and clears the peak, the graph and today's
  start, which were numbers on the old scale.
- **Server**: `20261105010808_ratings_v2_scale.sql` works every board row out again from
  `rating_state.core` by the same rule as `ratingOf`, and resets the peak and this week's
  start to it.
- **The two new kinds** (`preflop-open`, `preflop-shove`) are new values the server must
  know before any client sends them, or the whole submission is refused as `bad-kind` and
  dropped.

**Order to ship it**, from `pip-web/`: deploy the function first
(`supabase functions deploy submit-rating`), then apply the migration
(`pnpm supabase:db:push:dry-run`, check it lists only `20261105010808_ratings_v2_scale.sql`,
then `pnpm supabase:db:push`), then push the app to main.

Done 2026-11-05 in that order: `submit-rating` version 2 deployed, the migration applied (the
three rows on the board then went from 1681 / 1590 / 1385 to 1043 / 998 / 896), then the app.

## To go live

For Will or the lead, in this order, from `pip-web/`:

1. Apply the migration: `pnpm supabase:db:push:dry-run`, check it lists only
   `20261104090000_ratings.sql`, then `pnpm supabase:db:push`.
2. Deploy the function: `supabase functions deploy submit-rating`. It needs no new secret
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided).
3. Check it answers: sign in on a test account in a preview, play a few hands, and see a row
   appear in `public.ratings`.
4. Turn the screens on: add the repo Variable `NEXT_PUBLIC_RATING=1`
   (`gh variable set NEXT_PUBLIC_RATING --body 1 -R playpip/pip-web`) and redeploy (push to
   main, or re-run "Build and Deploy to Cloudflare Pages").
5. Update the copy that still says there is no leaderboard: README.md, ROADMAP.md, docs/brand.md
   and `Landing.tsx` (the membership page already switches on the flag).
