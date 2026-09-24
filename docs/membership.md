# The membership

> **Status: built, and unsellable.** Everything below is live behind the entitlement
> check. There is no Stripe account, no checkout and no way to pay, so nobody is a
> member and nobody has given us any money. That is the whole of the state, and
> `/membership` says so on the page.

The commercial layer, in one document: what is gated, what deliberately is not, where the
answer comes from, and which rules are enforced by tests rather than by agreement.

## The shape, in one line

**The core game is free to play and always will be. The membership adds the side tables,
the games that are not Hold'em, and the tools beside them — and never takes anything away
from the core.**

Free, permanently: the whole ten-venue ladder, the Rail's cash games, the challenge tables,
the Daily Deal, the Chip Shop economy, the Kitchen Table freeroll, the read on every hand as
you finish it, the end-of-run card, the two drills a beginner starts on — *What have you
got?* and *Which hand wins?* — every written guide, the odds calculator, and sync.

Behind the check: **every side table**, every game that is not Hold'em (Pot-Limit Omaha,
Short Deck, Omaha Hi-Lo, Five-Card Draw and blackjack), build-your-own-table, eight more
drill kinds (including the practice packs *Open or fold*, *Calling the river*, *Bet or check* and *Shove or fold*) plus the play-it-out mode, the across-sessions play report, the session review,
spectating after you bust, **Lessons with Webb** from Level 2 up (interactive lessons on the felt — see below), and the members' shelf. Not built: multiplayer.

**The free half of the drills is where a beginner learns to read a hand, and the paid half
is where they learn to price one** (Will, 2026-09-21). That is the line the two sides fall
on rather than a count: naming what you are holding is free forever, and so is reading two
finished hands against each other. Everything that asks what a hand is *worth* — which five
of the seven play, how many cards win it, what the pot is charging — is the membership.

## The four rules

1. **The core game is free forever.** The ten-venue ladder, the Rail's cash games, the Daily
   and the Kitchen Table freeroll. You can never be chip-blocked, timer-blocked or
   ad-blocked out of any of it, and no part of it may ever acquire the flag —
   `tests/sitDown.test.ts` fails the build if one does.
2. **Nothing you can buy changes a hand** — not the cards, the odds, what you are shown, or
   a rebuy. This one holds with no asterisk, in every case.
3. **It is not pay-to-win**, which means buying an advantage over another player. Pip is
   single-player with no leaderboard and nobody to overtake. Member rooms *are* ranked and a
   member does reach a rank sooner for having more tables to win at — that is pace through
   single-player content. ⚠️ **This argument has to be made again the day multiplayer
   ships.** See `docs/brand.md` principle 1 and `cto/drafts/build-multiplayer.md`.
4. **Nothing is metered.** A thing is the membership's or it is free, and there is no third
   shape: no sampling, no "three a week", no trial that ends mid-session. What we sell is
   another whole kind, never a slice of a free one.

### A built table can be made harder, and only harder (2026-09-22)

The builder's invite list used to be flavour: you picked faces, `customVenue` dropped them
on the floor, and nobody you chose was at the table. It now seats them — and a guest whose
home room is dearer than the table plays **their** rung, not its (`Venue.guests` →
`profileFor`). That is the feature: the Penthouse's regulars, at a price you can afford to
lose.

It is not a difficulty dial, because a dial turns both ways and this does not:

- **The prize is `buyIn × seats` whatever you build**, so a table full of players better
  than its price pays exactly the same for a worse game. The failure the old rule guarded
  against — the Garage's opponents at the Main Event's price — runs the other way, and
  remains impossible: `profileFor` takes the *harder* of the two profiles and cannot return
  the softer one.
- **Nothing you can buy still changes a hand** (rule 2). Who sits down is not the cards, the
  odds, or what you are shown — and choosing to play better opponents is the one purchase
  that cannot be an advantage.
- **Invite nobody and it is exactly its rung**, to the object. Drafted seats never bring
  anything; only a name does.

`tests/customTable.test.ts` checks every rung against every invitable character in both
directions, and that a guest's profile is a shipped rung's rather than two averaged.

### Rule 1 was rewritten on 2026-09-20, and here is the honest account of it

It used to read **"anything that shipped free is free forever"**, and it named every side
table in the free list. The seven free side tables are now behind the check, so that
sentence would be false if it stayed. It has been narrowed rather than quietly edited:

- **What changed.** The promise is now about the *core game* — the ladder, the Rail, the
  Daily, the freeroll — rather than about every screen that happened to exist on a given
  day. The side tables and every game that is not Hold'em are the membership.
- **Why it was allowed.** There is no Stripe account and never has been. Nobody has paid
  for anything, nobody has been charged, and nobody chose Pip on the strength of a free
  side table they are now losing. The promise was broken before it could be relied on,
  which is the only circumstance in which breaking it costs a player nothing.
- **Why it is narrower rather than deleted.** A membership with no free-forever commitment
  at all is a membership that can eat the ladder next year. The commitment is now smaller
  and it is exact, which makes it enforceable: rule 1 names four things and
  `tests/sitDown.test.ts` fails the build if any of them gains `membersOnly`.
- **What this costs us.** The right to say "we have never moved a free thing behind the
  paywall". We have, once, before anyone could pay. Anybody who asks should be told that.

⚠️ **This is the one time.** After the first payment clears, rule 1 is absolute again and
narrowing it further is not a thing this document can authorise — that would need a player
to be told before it happened, not after.

## Where the answer comes from

Three files, and the separation between them is the design.

| | |
|---|---|
| `src/lib/membership/entitlement.ts` | **What counts as a member.** Pure, storage-free. Reads a `memberships` row and decides. `active` and `trialing` entitle; `past_due` deliberately does not. |
| `src/store/entitlement.ts` | **The client seam, and the only one.** One store, one hook, one boolean: `useEntitlement()`. Caches the row per user so a member offline is still a member, honoured only until the period they paid for runs out. |
| `src/config/membership.ts` | **What a membership is and what comes with it.** The price in every currency (`MEMBERSHIP_PRICES`), the Stripe price ids, the feature list, and the `MembersOnly` / `included()` gate. Never grants anything. |

**The price is written down once.** A price living in the page, the settings row, the prompt
and the Terms section is four numbers that agree until one of them is edited.

**Entitlement is a table the client cannot write.** `profiles` is written by the client under
an own-row-only policy, so a `member: true` in the profile blob would be settable by editing
localStorage — not a weak lock, no lock. `supabase/migrations/…_memberships.sql` grants
`select` on your own row and **nothing else**; the Stripe webhook writes it with the service
role. `tests/entitlement.test.ts` fails the build if a mutation against that table ever
appears in the client, or if the migration grows an insert/update/delete policy.

## Lessons with Webb (2026-09-23)

An interactive course in Webb's Learn area, played on the real felt: Webb deals a hand, stops
to ask, you act with the real buttons, he explains, and the lesson ends in a practice pack.
Five levels (`COURSE` in `src/config/lessons.ts`).

- **Level 1 (first hands) is free, and so is every written guide.** Level 1 is the tour and
  the two free drills; charging somebody to learn what a flush is would be the meanest page
  on the site and the one most often shared. Rule 4 allows a whole level to be free — it
  forbids a free *slice* of a paid thing, which this is not.
- **Levels 2–5 are the membership**, lesson by lesson, each carrying `membersOnly` in the
  commit that registers it.
- **Only built lessons are sold.** The shelf lists the rest as "Not built yet" with no link,
  and the `lessons` entry in `MEMBERSHIP_FEATURES` names exactly what is shipped.
- **Shipped (2026-09-24): the whole course.** Eight lessons — Starting hands and Position
  (Level 2), Outs and Pot odds (Level 3), Stack sizes (Level 4), Ranges, Bluffing and The
  regulars (Level 5) — and four practice packs: *Open or fold* (graded by the same
  `opensHand` chart the free guides teach from), *Calling the river*, *Bet or check* (calling
  shares measured from the bots) and *Shove or fold* (multiway Nash push/fold, verified to
  0.05 bb). Nothing on the course is "Not built yet".
- **The Regulars lesson is pinned to the cast.** Every claim about a character comes from
  their `delta` in `config/cast.ts`, checked by simulation; `tests/lessons.test.ts` fails if a
  retune makes a sentence false.

## Currencies (2026-09-23)

**One membership, four fixed prices**: £5.99/£49, $7.99/$66, €6.99/€57, ¥58/¥470
(`MEMBERSHIP_PRICES`). Will: "convert to nearest rounded currency for each region".

- **Fixed, not converted.** Each currency is its own amount on the one Stripe price
  (`currency_options`), so the number on the page is the number on the statement.
  Adaptive Pricing stays off for the reason cmo#71 gave: a rate with a fee built in.
- **The rounding rule is the pound's shape**: monthly to the nearest .99, yearly to the
  nearest whole unit; yuan in whole yuan both ways. Each price records the rate it was set
  from, and `tests/currency.test.ts` fails if a price drifts more than a unit from the pound
  converted at that rate, or if yearly stops being a saving in any currency.
- **Which one a visitor sees first** is `detectCurrency` (`src/lib/membership/currency.ts`):
  the browser's language region, then its time zone, then dollars. Only after hydration —
  the static page and the markdown mirror are in pounds. The picker beside the prices always
  overrules the guess.
- **Checkout must be handed the currency the player was looking at**, not left to Stripe to
  re-guess. When the `checkout` Edge Function is written, it takes the currency as an input.
- **Every price is tax-inclusive**, US dollars included. That is unusual in the US, where
  tax is normally added at checkout; it keeps "the number shown is the number charged" true.
  Confirm with Stripe Tax before launch.
- **China** mostly pays by Alipay and WeChat Pay rather than card. A yuan price without those
  payment methods switched on is mostly decorative — check the Stripe account can offer them
  before relying on the CNY price.

## The gate

One flag and one function, used by every gated surface so they cannot disagree:

```ts
interface MembersOnly { membersOnly?: boolean }
included(thing, member) // → member || !thing.membersOnly
```

Carried by drill kinds (`config/drills.ts`), venues (`config/venues.ts`), card backs
(`config/cardBacks.ts`, inside `unlock`), and built tables. **Absent means free forever** and
that is not a default anyone may change later — a thing that ships without the flag has
given itself away.

Two places do more than call it:

- **`lib/sitDown.ts`** takes `member` as a **required fourth argument**, so a caller that
  forgets it fails to compile rather than seating a stranger. It refuses for the membership
  *before* it refuses for money, because "you cannot afford it" is a lie told to somebody
  whose Roll is fine — and the worst kind, because they can act on it.
- **`store/game.ts`** is *handed* `member` at sit-down, like it is handed the venue, and
  never looks it up. See the next section.

## What a gated surface looks like

**It renders. It does not vanish.** Hiding a paid surface is worse product — you cannot buy
what you cannot see — and slightly dishonest by omission. It also means the app silently
rearranges itself the day somebody joins.

So a locked drill tile, member room card or card back shows with a padlock and a plain line
saying what it is. Not a prompt, nothing that appears over what the player was doing, and
nothing that comes back after being closed. The landing page ships *"No forced pop-ups, no
pay-to-win, no nagging. Ever."* and every one of these screens is inside that sentence.

**And it shows the thing, not a picture of a locked door** (Will, 2026-09-21: "we shouldn't
hide drills we don't have access to, we should tease the membership, like side tables
does"). A locked drill tile used to draw card backs where the spot goes, on the argument
that dealing a real board behind a lock was showing the thing while refusing it. That
argument is now retired everywhere: a locked drill tile deals a real board, and opening a
locked kind deals a real spot on the felt and dims it, with the answers replaced by one line
about the membership. Nothing on those screens is gradeable and nothing counts — the spot is
a window, not a sample.

**A locked card now answers a tap by going to `/membership`** (Will, 2026-09-20; the drills
index followed on 2026-09-21), which is a change from "one text link, never a button" and is
worth saying why. That rule was written
when the shelf was mostly free and a locked card was the exception: a tap opened the info
dialog, which described the table and then said you could not play it. Now that every side
table is behind the check, that dialog is a dead end on every card on the shelf — it spends
a screen explaining a thing and offers no way to get it.

The line this stays on is **invited versus uninvited**. Nothing here interrupts, nothing
appears over anything, nothing returns once dismissed, and nothing is styled as a sales
button — the card still wears a padlock and still says *Comes with the membership*. What
changed is only what a deliberate tap on a locked thing does, and sending somebody to the
page that answers their question is the least we owe them for asking. If this ever grows
into something that appears without being asked for, it has stopped being this and the rule
above is what it has broken.

**Nothing about buying appears in the game loop.** `tests/membershipSurfaces.test.ts` fails
the build if anything under `src/components/table/` or `src/store/game.ts` links to
`/membership`, imports `config/membership`, or calls `useEntitlement`. A player mid-hand is
the one place a line about money would be exactly the thing we promise never happens. That
is why the table is told what it is at sit-down instead of asking.

## The cosmetics denominator

**Member cosmetics count in their own collection and never in the main shelf's `X of N`**
(Will, 2026-08-14). A free player's collection reading permanently incomplete because of
items they cannot earn is the thing that *reads* as a dark pattern even though it is not.

It currently holds by construction rather than by luck: the three member regulars are pinned
to their rooms, so `challengeable` excludes them and the scalp shelf still reads `0 of 22`.
`tests/challenge.test.ts` pins that number — if a future member character is not pinned, that
test fails, and **the fix is to pin them, not to raise the 22.**

Member cosmetics sit in the same registries as everything else and appear locked in the Style
picker, which is six strips with no denominator between them. Nothing here reaches the
`X of N` shelves in `ChipsDialog`, and that is still the rule.

**Some of them now carry a chip price, and `docs/shop.md` rule 3 was rewritten on 2026-09-21
to allow it** (Will). The membership opens the right to buy; chips you won still buy it. What
rule 3 was actually protecting — that no price in the Chip Shop is ever payable in money — is
untouched, and the thing that would make it dishonest is forbidden outright: **bought is
bought**, so a member-shelf item survives a cancelled membership forever. `cardBackUnlocked`
and `cosmeticUnlocked` both check `price` before `membersOnly` so that holds by construction,
and `tests/shop.test.ts` fails the build if a lapse ever repossesses something chips paid for.
The full account, including what it costs us, is in `docs/shop.md`.

## What is deliberately not gated

Worth listing, because each was considered:

- **The read on every hand as you finish it.** The hand is free, the player is paid
  (Will, 2026-07-30). `lib/coach.ts` stays `HandRecord → HandRead | null` and must never grow
  a paid branch inside it.

  **This used to end "and neither imports the other", which was a proxy for the rule rather
  than the rule** (2026-09-21). `lib/deepCoach.ts` now takes the `PricedStreet` *type* from
  `lib/coach.ts`, and `lib/review/` takes `scoreDecisions` from it, because there is one set
  of four streets and one piece of pricing arithmetic and two spellings of either would be
  worse. What is actually being protected is that **`lib/coach.ts` never behaves differently
  for a member**, and that holds by there being nothing in the file to gate: no entitlement
  import, no membership import, no branch. `tests/deepCoach.test.ts` enforces that directly —
  the free module may import no paid one, and a paid module may take a type from it and
  nothing else. See [review.md](./review.md).
- **The end-of-run card.** It reads one run and stores nothing.
- **The odds calculator.** It generates nothing, grades nobody and remembers nothing.
- **The whole free ladder, the Rail, the Daily and the freeroll.** Rule 1.
- **Every `/learn` guide.**

## The tests that hold it up

| File | What it stops |
|---|---|
| `tests/entitlement.test.ts` | The client writing the entitlement table; a paid drill shipping without saying it is paid |
| `tests/membership.test.ts` | The page advertising a feature that does not exist; the price disagreeing with itself |
| `tests/membershipSurfaces.test.ts` | Anything about buying reaching the game loop; a dead `/membership` link |
| `tests/sitDown.test.ts` | A free table moving behind the membership; a member room paying better than a free one |
| `tests/customTable.test.ts` | A built table being easier than the ladder at the same price; an invited guest not turning up |
| `tests/spectate.test.ts` | The spectator view answering while a hand is live |
| `tests/challenge.test.ts` | Member content enlarging a free player's denominator |
| `tests/roadmapDrills.test.ts` | The public roadmap going stale about which drills are paid |
| `tests/review.test.ts` | A free table being kept for review; the grading reaching for a card the player could not see |

## Still to build

Everything server-side, all of it blocked on one thing: **there is no Stripe account**
(`technology#52` item C). What is waiting on it — three Supabase Edge Functions (`checkout`,
`stripe-webhook`, `portal`), the settings row and join flow, the four funnel events, and
account deletion cancelling the subscription, which **must** land before anything takes a
payment or a player can delete their account and keep being billed.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| The price, or what the page lists | `src/config/membership.ts` (+ `tests/membership.test.ts`) |
| What counts as an entitling subscription | `src/lib/membership/entitlement.ts` |
| Gate a new thing | add `membersOnly` to its config entry, in the commit that adds it |
| A new member room | `MEMBER_TABLES` in `config/venues.ts` — see [venues.md](./venues.md) |
| Which tables the session review keeps | `reviewableVenue` in `config/venues.ts` — see [review.md](./review.md) |
| The page copy | `src/app/membership/page.tsx`; the billing section is in `/terms` |
