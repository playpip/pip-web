# The Pip Rating

> **Status: live since 2026-11-04.** The migration is applied, `submit-rating` is deployed, and
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
   blinds. Bets and raises are not rated, for the reason the report gives (fold equity is a
   guess). Its **stake** is the pot plus the price, in big blinds, capped at 200.
2. **Recent play counts more.** `loss = Σ w·cost / Σ w·stake`, where each new decision
   multiplies every earlier one's weight by `1 − 1/300`. So it is the share of what was at
   stake that you gave away, over roughly your last 300 decisions. Weighting by stake is what
   stops a player who folds every hand rating well on hundreds of cheap, correct folds.
3. **The scale.** `rating = 1000 − 700 × log2(loss / 0.045)`, clamped to 100..3000. 1000
   gives away 4.5% of the stake; every halving of that is 700 points.
4. **New players** start at 1000: a prior worth 100 big blinds of stake (about twenty
   decisions) that fades like any old decision. **Provisional** until 50 rated decisions;
   the sheet says "Rated after N more hands" (N is the decisions left, an upper bound on
   hands for a player who calls or folds every hand).

### Where the numbers come from

`pnpm rating-calibrate --hands 300 --venue garage,ring-micro --hero <name>` seats a proxy at a
real table against that table's own AI and prices its decisions exactly as the store does.
First run, 2026-11-04, about 200 to 600 rated decisions each, so each line is ±100 or so:

| Hero | Share given away | Rating |
|---|---:|---:|
| Folds to any bet | 6.8% to 10.3% | 160 to 590 |
| Calls everything | 7.0% to 9.5% | 240 to 560 |
| Coin flip | 8.2% | 390 |
| Friends' Garage regulars | 4.9% | 910 |
| Proxy "casual" / "beginner" | 2.0% to 4.3% | 1040 to 1830 |
| Card Room / Casino regulars | 1.7% to 4.1% | 1090 to 1990 |
| Proxy "best" | 1.5% to 1.6% | 2030 to 2120 |
| Penthouse / Monte Carlo / Main Event regulars | 1.0% to 2.4% | 1620 to 2540 |

So a sound beginner sits near 1000, a careless one 500 to 800, and 2000+ is the strongest
play Pip has. The proxies decide with the same equity estimate that grades them, so they agree
with the grader more than a person would; real players will sit lower than their proxy. The
ladder's regulars do not rate in ladder order (their difficulty is partly aggression, which
this does not grade), which is why the bands are not named after venues.

**Bands** (`RATING_BANDS`): Learning (under 800), Steady (800), Solid (1200), Strong (1600),
Expert (2000), Master (2400). None reuses a Roll title from `config/ranks.ts`.

## What counts

Every Hold'em hand dealt through `store/game.ts` with a priced call or fold: the ladder, the
Rail, the Daily, the freeroll, Hold'em side tables and quick games that deal through the store.
Not other variants (the pricing is two-card equity), not drills, not multiplayer rooms (yet).

**Only what the player could see.** The cost comes from the `HeroDecision` snapshot, taken
when the player acted, and the hero's own hole cards. A format that hides a card from the
player (Mystery Card) must leave it out of the snapshot or mark the venue `unrated`.

## Storage

- On the device: `profile.rating` (persisted, synced; the side with more rated decisions wins
  the merge, like a drill rating) and a queue of unsent hands in `localStorage`
  `pip.ratingQueue` (signed in only, at most 200 hands).
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
- **Timing**: hands in order, at least 2 seconds apart, newer than the last hand counted (no
  hand counts twice), no more than 2 minutes in the future, no more than 14 days old.
- **Rate**: one submission per 15 seconds, at most 900 decisions an hour.
- **Max change**: once established, one submission moves the rating at most 60 points.
- **Flag**: after 200 decisions, giving away under 0.6% of the stake (about 2850, beyond
  anyone measured) flags the row off the board until a person clears it. Rejections are
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
