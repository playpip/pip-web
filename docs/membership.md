# The membership

> **Status: live.** Checkout, the webhook, the portal and the cancelling account delete run
> as Supabase Edge Functions — see [stripe.md](./stripe.md). The switch is the two price ids
> in the build: with them set, `checkoutReady()` is true and `/membership` sells. It sells
> through Ava Technologies' Stripe account, shared with Probus — stripe.md says what that
> changes.

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
spectating after you bust, **building your avatar feature by feature** (below), **Lessons with Webb** from Level 2 up (interactive lessons on the felt — see below), the members' shelf, and **multiplayer**: opening a private room for friends (camera and mic included) and quick match. Joining a member's room with a code needs only a free account (see below and [multiplayer.md](./multiplayer.md)).

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
3. **It is not pay-to-win**, which means buying an advantage over another player. There
   is no leaderboard and nobody to overtake. Member rooms *are* ranked and a member does
   reach a rank sooner for having more tables to win at — that is pace through
   single-player content. **Made again for multiplayer (2026-10-11):** nobody at a table
   can see anybody else's Roll or rank, so a member's rank is still private pace;
   everyone at a table sits with the same stack, sees the same things and has the same
   clock; and the membership changes nothing once the cards are dealt. A private room's
   host is the member only in that they could open it, and quick match is members against
   members and the cast. See `docs/brand.md` principle 1 and [multiplayer.md](./multiplayer.md).
   **The Pip Rating (2026-11-04):** Will ruled the Pip Rating public, with a leaderboard
   ([rating.md](./rating.md), live once `NEXT_PUBLIC_RATING` is set). It measures how close each
   call and fold is to the best play, so more tables, hands or chips cannot raise it, and nothing
   you can buy changes a hand. The number is free; members get the breakdown (the graph and
   what is moving it), which is coaching about their own play. The Roll stays private.
4. **Nothing free is metered, and nothing paid is sliced.** A thing is the membership's or it
   is free. The one third shape is **one whole member game a day** for a non-member (below):
   a whole table, never part of one, never a trial that ends mid-session,
   and never a meter on anything free. *Relaxed by Will on 2026-10-07*: it used to say
   "no sampling" outright, and in the first week on sale eleven tabs saw `/membership` and
   none opened checkout, because nothing paid could be tried before paying.

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

## Multiplayer: the host pays, friends join free (2026-10-11)

**Opening rooms whenever you like, slow games and quick match are the membership's. Joining a
room with its code needs a free account and nothing else** (Will, 2026-10-11). A member's game
should never be short of players because their friends have not paid, and every friend sat at a
member's table sees what the membership is.

**Anyone with a free account can open one live private room a day** (Will, 2026-10-23, cmo#220),
with regulars, and nothing at the table says who paid. **A room hosted without the membership has
at most four seats and no camera or voice** (Will, 2026-11-02): since the free room shipped, taps
on the multiplayer membership link went to zero, and bigger tables with faces and voices are the
reason to join. The room server holds it (`freeHost` on the room, `FREE_ROOM_SEATS`,
`mediaAllowed()` in `lib/multiplayer/room.ts`); the hub shows seats past four locked and the room
shows the host a locked camera and mic, each a tap to `membershipFor('multiplayer')`. Rooms opened
before the rule keep what they were opened with. **And one quick match a day, and one slow game they host open at a time** (Will,
2026-10-25), to get more people playing other people. A slow game runs for days, so it is counted
by what is open, not by day. Joining a friend's slow game was always free. Signed out, you cannot
host.

- **The gate is on the room server**, not the browser (`rooms/src/auth.ts`): creating a room
  and joining a queue read the `memberships` row with the service role. `useEntitlement()`
  only decides which buttons the hub shows.
- **The free ones are counted on the room server too.** The decision is
  `hostingAllowance()` in `lib/multiplayer/freeRoom.ts`; the account's `Player` object keeps the
  UTC day the free room and the free quick match were last spent. The room is claimed when it is
  created and handed back if creation fails; the quick match is claimed on joining the queue and
  handed back if they leave it unmatched. The slow game is counted from the same object's index
  of their slow games (the ones they host, lobby or playing). A table costs us money and seats
  other people, so a browser count would not do.
- **They are not the daily free game.** The free room, quick match, slow game and the free member
  table (`taste.ts`) are separate allowances; spending one never spends another.
- **Only for sale where it exists.** The `multiplayer` feature is `needs: 'rooms'`:
  `sellableFeatures()` leaves it out of any build without `NEXT_PUBLIC_ROOMS_URL`, so a page
  never sells tables the build cannot reach.

## One free member game a day (2026-10-07)

A non-member gets **one member game per UTC day**: a seat at any one poker table on the side
tables shelf (Omaha, Short Deck, Hi-Lo, Draw, and the twists). Blackjack and the table builder
are left out: neither is one game you sit down to and finish. **Lessons are left out too**
(Will, 2026-10-07): eight lessons at one a day is the whole course given away in a week. The sentence the page, README and roadmap say is `DAILY_FREE_GAME`
(`config/membership.ts`).

- **The rules are pure**, in `lib/membership/taste.ts` (`tests/taste.test.ts`). The record is
  `profile.taste` — `{ date, kind, id }`, persisted (v23), and merged on sync so a spent game
  stays spent (`mergeTaste`: the later day wins; on the same day the local record stands).
- **It is spent where it is used.** A table spends it at sit-down in `PlayClient`, after
  `refuseSitDown` is asked with `member || tasting` — never on a page view.
- **A refresh is not a second one, and does not kick anybody out.** At a table, the snapshot
  resume in `PlayClient` runs before any gate, so a tournament in progress comes back without
  asking. The gap is the Daily's: a refresh between sitting down and the first deal loses that game.
- **It is not membership.** The table is handed `member: false`, so no session review and no
  watching it out. The record is client-written, so editing it gets you a free game you could
  have had tomorrow; it can never make anybody a member.
- **What the cards say.** While unspent, the side-tables card reads *Free today* and opens
  like a member's, and the dialog says it is today's one. Once spent, the normal lock, with *Your free
  game today is used. Join for every table.* Copy lives in `TASTE_COPY`.

## Quick games (2026-11-04)

**Short single-player games with a score, in their own row at the top of the side tables**
(Will, 2026-11-04: "Quick, fast, toilet games essentially, a lot of fun", "only gonna be in the
membership"). The registry is `QUICK_GAMES` in `config/quickGames.ts`; every entry carries
`membersOnly` and is sold as the one `quick-games` entry in `MEMBERSHIP_FEATURES`, whose blurb
names each game. That entry is `shipped` exactly while the registry has a game in it
(`tests/quickGames.test.ts`).

- **One free round of each, every UTC day**, for a player without the membership. The rules
  are pure, in `lib/quick/rounds.ts` (`tests/quickRounds.test.ts`): `profile.quickRounds`
  maps a game's id to the day its free round was spent, persisted (v30) and merged on sync
  per game, the later day winning, so a spent round stays spent. One game's round never
  spends another's, and none of them is the free member table, room or quick match.
- **It is spent at the tap** that starts the round (`useQuickRound().begin()`), never on a
  page view. Once used, the game's page shows `LimitCard kind="round"` ("You’ve had today’s
  free round. Members play as much as they like.") in place of the Play button, on the start
  card and on the end card.
- **A score is private and play money.** A round never takes from or pays into the Roll, so
  it cannot be farmed, and nobody sees anybody else's. The only number kept is the player's
  own best, `profile.quickBests` (merged on sync as the higher one), shown on the shelf card
  and the end card. No leaderboard.
- **Every card on the row opens the game's page**, locked or not: the page shows the best
  and, when the round is used, the limit card with when it comes back.
- Shared parts: `components/quick/QuickScreen.tsx` (`QuickPage`, `QuickIntro`, `QuickEnd`).
- **Poker Solitaire** (`lib/quick/solitaire.ts`, `tests/solitaire.test.ts`) scores on the
  American Poker Squares table; its Daily deal is seeded by the UTC day. **Ten Hands** is the
  real table: `TEN_HANDS` in `config/venues.ts`, a cash table with `scoreHands: 10`, buy-in 0
  and a house stack (`houseStack`, so standing up cashes for nothing; `tests/tenHands.test.ts`).
  The game store stops it with `status: 'scored'` and the page shows the end card over the felt.

| Event | Sent when |
|---|---|
| `quick-<id>-started` | a round of that game was started (`QUICK_EVENTS` in `lib/quick/events.ts`) |
| `quick-<id>-finished` | a round of it reached its end card |
| `limit-card-seen-round` / `limit-card-tapped-round` | a quick game's free round today is used: the card shown / its button tapped |

## One free report (2026-11-02)

Every player who is not a member gets **their own full report once** (Will, 2026-11-02). It
was the locked thing tapped most by far in the week to 1 November (14 of about 22 locked
taps), and nobody tapping it had seen their own. Will ruled out a free trial; this is the
free member table's shape applied to the report: one whole thing, never a slice.

- **The rules are pure**, in `lib/membership/freeReport.ts` (`tests/freeReport.test.ts`). The
  record is `profile.freeReport`, `{ date }`, persisted (v29) and merged on sync
  (`mergeFreeReport`: the earlier day wins, so a second device can neither hand it back nor
  stretch it).
- **It is ready when the report has something to say**, not at a hand count picked for
  marketing: past `DEEP_MIN_HANDS` (120, under which `deepRead` says nothing at all) and with a
  finding or a priced cost. Spending the one free look on an empty page would be no gift.
- **It is opened by a tap** on `/game/report` ("Open my free report"), never by a page view,
  and stays open until midnight UTC so a refresh or "See the hands" is not a second one. After
  that day it locks like before.
- **It is the report itself**, from `deepRead` over their own hands. Nothing is written for it.
- **The end-of-run card** offers it while it is ready or open ("Your report is ready", a real
  button to `/game/report`); once used, the same button goes to `/membership?for=coaching`.
- Copy lives in `FREE_REPORT_COPY`.

## The page and the welcome step (2026-11-02)

In the week to 1 November `/membership` had 28 tabs, 2 scrolled to Join and none pressed it;
the welcome flow's membership step was seen 69 times and tapped through twice. So:

- **`/membership`** is now the headline with the plans and Join beside it, then what was
  tapped (`TappedFor`), then two pillars (`MEMBERSHIP_PILLARS`: "Get better" and "Play with
  friends, no limits"), every other feature as one compact list, free against member row by
  row (`lib/membership/compare.ts`, counted from the configs), and the questions. Each feature
  is said once. The funnel events are unchanged.
- **The welcome step** is two cards of equal size: the membership with its price and three
  lines (`MEMBER_LINES`, the report first), and Free with what stays free. Free starts picked,
  as before; nothing is hidden behind either.

## The plans sheet in the welcome flow (2026-11-04)

"See membership plans" on the welcome flow's last step used to go to `/membership`, which took
the player out of onboarding (2 of 69 in the week to 1 November tapped it). It now opens
`MembershipSheet` over the step: the two pillars, Yearly or Monthly at the page's prices (the
store's in the app), and the page's own till. The plan picker and the till (`PlanPicker`,
`Till`, `Join`, `StoreJoin`) live in `components/membership/Join.tsx`, shared by the page and
the sheet, so joining from either asks the same things, says the same 14-day refund, terms and
statement lines, and goes account first and then straight on to checkout. "Everything in the
membership" links to `/membership?from=welcome`. Closing the sheet (tap outside, the close
button, Escape or dragging the handle down; `components/ui/sheet.tsx`) leaves the step as it
was, and "Continue for free" still finishes the flow. Free stays the card picked to start with.

## Double daily rewards (2026-10-25)

Members get **double the chips** from the daily reward (docs/daily-reward.md), every day: six
buy-ins at their table a day once the first week is done, against three. This
is the first perk paid in chips, and it needed a ruling (Will, 2026-10-25): chips buy style and
seats, never edge at a table, so doubling a gift of them is not pay-to-win. The streak items
are the same for everybody, and nothing about the reward is sold for money. `daily-reward` is
its entry in `MEMBERSHIP_FEATURES`.

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
role (and `revenuecat-webhook` for the stores). `tests/entitlement.test.ts` fails the build if a mutation against that table ever
appears in the client, or if the migration grows an insert/update/delete policy.

## Bought in the app (2026-10-09)

The iOS and Android apps (`mobile/`, EXPO-PLAN.md) can't send anyone to Stripe: Apple and
Google require their own billing for a membership bought in the app, and reject a link out
to any other. So there are two ways in, and **one row**.

| | Web | App |
|---|---|---|
| Pays through | Stripe Checkout | The App Store / Google Play, via RevenueCat |
| Written by | `stripe-webhook` | `revenuecat-webhook` |
| `memberships.source` | `stripe` | `app_store` / `play_store` |
| Managed and cancelled in | The Stripe portal (Settings → Manage) | The store's subscription settings |

- **The client didn't change its idea of a member.** `useEntitlement()` reads the same row
  either way. `source` only decides where Manage points, and the entitlement store reads
  around it on a database from before the column (`42703`), so a missing migration can't
  cost anyone their membership.
- **The RevenueCat app user id is the Supabase user id.** Buying in the app needs a signed-in
  player, same as the web.
- **Neither webhook overwrites a live membership from the other side** with one that isn't
  live.
- **In the app**, nothing leads to Stripe: the membership page shows the store's price, a
  Join button, Restore purchases and the renewal terms Apple asks for; Settings → Manage
  opens the store; a web member sees their status and no Manage. An app build without the
  store set up shows "Joining in the app is coming soon" (`appSupports('purchase')`).
- **Deleting the account doesn't cancel a store membership** (only the player can), so the
  delete confirmation says so and links to the store.
- Refunds for store memberships happen in the store, never in Stripe.

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

**Nothing about buying appears in the game loop, bar one line once the run is over.**
`tests/membershipSurfaces.test.ts` fails the build if anything under `src/components/table/`
or `src/store/game.ts` links to `/membership`, imports `config/membership`, or calls
`useEntitlement`. A player mid-hand is the one place a line about money would be exactly the
thing we promise never happens. That is why the table is told what it is at sit-down instead
of asking.

The exception, relaxed by Will on 2026-10-07, is **the end-of-run card** (`RunRecap.tsx`):
for a non-member whose report has a finding, it shows that finding's title and sample and a
link, *See your full report*, to `/membership?for=coaching`. The line is the report's own top
leak (`lib/review/teaser.ts` over `deepRead`), never written for the card, and absent when the
report has nothing to say. The test names `RunRecap.tsx` as the only file allowed, and checks
it still takes `member` from the table rather than asking. Since 2026-11-02 the link is a button,
and while the player's one free report is ready or open it reads *Your report is ready* and goes
to `/game/report` instead (see "One free report").

## Building your own face

**Everybody gets a face; members choose theirs one feature at a time** (pip-web#259,
2026-10-23). Edit player has Shuffle for everyone and a **Customise** button beside it.
For a member it opens `AvatarCustomiser`: hair (or a hat), eyes, brows, mouth, nose,
glasses, beard, top and hands — the list is `AVATAR_PARTS` in `lib/avatarParts.ts`. For
anyone else the button shows a lock and a link to `membershipFor('avatar')`, which opens
`/membership` on its own card (the `avatar` entry in `MEMBERSHIP_FEATURES`).

- **Nothing is taken from a non-member.** A shuffled face is unchanged, and an
  `AvatarSpec` with no `features` draws exactly as it did before this existed.
- **A lapsed member keeps the face they built.** The picks are stored on the spec and
  keep drawing; only the Customise picker locks again. Same rule as anything chips
  bought: the membership never repossesses a look.
- **It is a look, not an edge.** Picked parts ride through rooms (checked by the
  protocol with `parseFeatures`), review links, sync and the QR transfer, and change
  nothing about a hand.

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
- **The end-of-run card.** It reads one run and stores nothing. Since 2026-10-07 it can also
  carry one line of a non-member's report (see the game-loop exception above); the card
  itself is still free and the line is a pointer, not the report.
- **The odds calculator.** It generates nothing, grades nobody and remembers nothing.
- **The whole free ladder, the Rail, the Daily and the freeroll.** Rule 1.
- **Every `/learn` guide.**

## The tests that hold it up

| File | What it stops |
|---|---|
| `tests/entitlement.test.ts` | The client writing the entitlement table; a paid drill shipping without saying it is paid |
| `tests/membership.test.ts` | The page advertising a feature that does not exist; the price disagreeing with itself |
| `tests/membershipSurfaces.test.ts` | Anything about buying reaching the game loop beyond the end-of-run report line; a dead `/membership` link |
| `tests/taste.test.ts` | A second free member game in one UTC day; a refresh spending one; a sync handing one back |
| `tests/quickRounds.test.ts` | A second free round of a quick game in one UTC day; a sync handing one back; a best going down |
| `tests/quickGames.test.ts` | A quick game shipping free, unnamed on the roadmap or the page, or without its events |
| `tests/freeReport.test.ts` | The free report offered before the report has anything to say; a second one; a sync handing it back |
| `tests/reportTeaser.test.ts` | The end-of-run line saying something the report does not, or naming the wrong unit |
| `tests/sitDown.test.ts` | A free table moving behind the membership; a member room paying better than a free one |
| `tests/customTable.test.ts` | A built table being easier than the ladder at the same price; an invited guest not turning up |
| `tests/spectate.test.ts` | The spectator view answering while a hand is live |
| `tests/challenge.test.ts` | Member content enlarging a free player's denominator |
| `tests/roadmapDrills.test.ts` | The public roadmap going stale about which drills are paid, or dropping the daily free game |
| `tests/rating.test.ts` | The ratings tables gaining a client write; the rating taking an impossible value |
| `tests/review.test.ts` | A free table being kept for review; the grading reaching for a card the player could not see |

## Counting the funnel

Four anonymous Umami events, each sent at most once per tab (`trackOnce`), so a funnel report
over them counts tabs rather than clicks:

| Event | Sent when | Where |
|---|---|---|
| `membership-viewed` | `/membership` renders | `MembershipScreen` |
| `checkout-opened` | the `checkout` function hands back a Stripe URL, just before the redirect; in the store app, just before the store's sheet opens | `lib/membership/billing.ts`, `lib/membership/store.ts` |
| `checkout-completed` | the player lands back on `/membership?joined=1`, Stripe's success URL; in the store app, the store reports the payment | `MemberWelcome`, `lib/membership/store.ts` |
| `membership-active` | `awaitMembership()` sees the row a webhook wrote | `MemberWelcome`, `lib/membership/store.ts` |

Two more sit beside the four, for the account step a signed-out tab meets before checkout:
`membership-viewed-signed-out` (the page settled on signed out, not on the way back from Stripe)
and `membership-signup-tapped` ("Create a free account to join" tapped). Both are in `Join`
(`components/membership/Join.tsx`).
Two more sit between the page view and checkout: `membership-join-seen` (half of the till, the
box with the Join button, scrolled into view; members and signed-out tabs count too) and
`membership-join-tapped` (a signed-in player pressed Join, or was carried on to checkout after
making an account from the Join box, so `membership-join-tapped` minus `checkout-opened` is the
tabs the till stopped; until 2026-11-02 a required refund-waiver box sat in between). Both are in `Till` and `Join` (`components/membership/Join.tsx`); in the store app, `membership-join-tapped` fires when Join opens the store's sheet (from 2026-11-06; before then it did not, so an app sale read as a checkout nobody tapped).
The till is the same in the welcome flow's plans sheet, so these count joins from the sheet
too. The sheet's own event is `welcome-plans-opened` ("See membership plans" tapped on the
welcome flow's last step, which opens the sheet); a sheet tab has no `membership-viewed`, so
the welcome funnel is `welcome-plans-opened`, then the till's events, then `checkout-opened`.
Signed-in views are `membership-viewed` minus the signed-out ones; a tab that signs in on the page
counts as signed out, which is the point.

**The limit cards and the host card (2026-11-02).** When a free player's free one for the day
is used, the quiet tile is replaced by one card saying so, with a button to the page opened on
the feature and how long until the free one is back (`LimitCard`, in
`components/membership`). The member table's card sits above the side-table shelves; the room's
and quick match's sit on the multiplayer hub in place of the locked button. A guest without the
membership at a friend's private room sees `HostOwnCard` on the room's end screen, after their
last hand, with "Open a room" (to the hub) and the page opened on multiplayer. Each sends its own
event, at most once per tab:

| Event | Sent when |
|---|---|
| `limit-card-seen-table` / `limit-card-tapped-table` | today's free member table is spent: the card on Side Tables shown / its button tapped |
| `limit-card-seen-room` / `limit-card-tapped-room` | today's free private room is spent: the card on the hub shown / tapped |
| `limit-card-seen-quick` / `limit-card-tapped-quick` | today's free quick match is spent: the card on the hub shown / tapped |
| `host-card-seen` | a friend's guest without the membership reached the room's end screen |
| `host-card-open-tapped` | they tapped "Open a room" on it |
| `host-card-membership-tapped` | they tapped "See the membership" on it |
| `room-full-seen` | someone was refused a room as full (any host; free hosts seat four since 2 Nov) |

**The free report card (2026-11-04).** Above the lobby's MembershipCard, a non-member sees how
close their one free report is (`FreeReportCard`, in `components/menu`; the rule is
`freeReportProgress` in `lib/membership/freeReport`): "62 of 120 hands" with a dial while
waiting, "A few more hands" once past 120 with nothing to say yet, and "Your report is ready"
once it is. The count is `tendencies.handsDealt`, the number `deepRead` waits on. Nothing before
the first hand, nothing for members, nothing once it is open or used. It links to the report page.

| Event | Sent when |
|---|---|
| `free-report-progress-seen` | the free report card was shown on the lobby |
| `free-report-progress-tapped` | it was tapped |

Tapped over seen is the card's own rate; `checkout-opened` in the same tabs is what it led to.

**The Android install row (2026-11-04).** Not a sale, but the same funnel's first step: a
player who comes back. On Android Chrome, from the second visit, a slim row at the top of the
lobby and reading pages offers to add Pip to the home screen (`InstallBanner`; rules in
`lib/installBanner.ts`, see [data-and-offline.md](./data-and-offline.md#the-android-install-row)).

| Event | Sent when |
|---|---|
| `install-banner-seen` | the install row was shown |
| `install-banner-tapped` | its Install button was tapped (Chrome's own dialog opens) |
| `app-installed` | Chrome reported Pip installed, from the row or from Chrome's own menu |

Umami events here are names only, so the feature is in the name rather than in event data.

They are counts, not grants: nothing reads them back. Stripe's dashboard stays the count of
money. Where the funnel undercounts: a blocked Umami tag reports nothing, a player who pays in
one tab and comes back in another is a new tab, and a webhook slower than ~15 seconds means
`membership-active` never fires for that player even though the membership is real. Adding or
renaming one is a `/privacy` change too (`tests/analyticsClaims.test.ts`).

## Still to build

The payment path is built and on sale (see [stripe.md](./stripe.md)).

Account deletion now cancels the subscription before it deletes (`delete-account`), which was
the thing that had to land before anything took a payment.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| The price, or what the page lists | `src/config/membership.ts` (+ `tests/membership.test.ts`) |
| What counts as an entitling subscription | `src/lib/membership/entitlement.ts` |
| Gate a new thing | add `membersOnly` to its config entry, in the commit that adds it |
| A new member room | `MEMBER_TABLES` in `config/venues.ts` — see [venues.md](./venues.md) |
| Which tables the session review keeps | `reviewableVenue` in `config/venues.ts` — see [review.md](./review.md) |
| The page copy | `src/app/membership/page.tsx`; the billing section is in `/terms` |
| Checkout, the webhook, the portal | `supabase/functions/` — see [stripe.md](./stripe.md) |
