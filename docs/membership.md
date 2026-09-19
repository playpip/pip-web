# The membership

> **Status: built, and unsellable.** Everything below is live behind the entitlement
> check. There is no Stripe account, no checkout and no way to pay, so nobody is a
> member and nobody has given us any money. That is the whole of the state, and
> `/membership` says so on the page.

The commercial layer, in one document: what is gated, what deliberately is not, where the
answer comes from, and which rules are enforced by tests rather than by agreement.

## The shape, in one line

**Pip is free to play and most of the game is open to everybody. The membership adds rooms
and tools beside it, and never takes anything away from it.**

Free, permanently: the whole ten-venue ladder, every side table, the Rail's cash games, the
challenge tables, the Daily Deal, the Chip Shop economy, the Kitchen Table freeroll, the
read on every hand as you finish it, the end-of-run card, the drill called *Which hand
wins?*, every written guide, the odds calculator, and sync.

Behind the check: three more drill kinds plus the play-it-out mode, five member rooms
(including Pot-Limit Omaha), build-your-own-table, the across-sessions play report,
spectating after you bust, and four member card backs. Not built: multiplayer.

## The four rules

1. **Anything that shipped free is free forever.** You can never be chip-blocked,
   timer-blocked or ad-blocked out of the game that exists today.
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

## Where the answer comes from

Three files, and the separation between them is the design.

| | |
|---|---|
| `src/lib/membership/entitlement.ts` | **What counts as a member.** Pure, storage-free. Reads a `memberships` row and decides. `active` and `trialing` entitle; `past_due` deliberately does not. |
| `src/store/entitlement.ts` | **The client seam, and the only one.** One store, one hook, one boolean: `useEntitlement()`. Caches the row per user so a member offline is still a member, honoured only until the period they paid for runs out. |
| `src/config/membership.ts` | **What a membership is and what comes with it.** The price, the Stripe price ids, the feature list, and the `MembersOnly` / `included()` gate. Never grants anything. |

**The price is written down once.** A price living in the page, the settings row, the prompt
and the Terms section is four numbers that agree until one of them is edited.

**Entitlement is a table the client cannot write.** `profiles` is written by the client under
an own-row-only policy, so a `member: true` in the profile blob would be settable by editing
localStorage — not a weak lock, no lock. `supabase/migrations/…_memberships.sql` grants
`select` on your own row and **nothing else**; the Stripe webhook writes it with the service
role. `tests/entitlement.test.ts` fails the build if a mutation against that table ever
appears in the client, or if the migration grows an insert/update/delete policy.

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

So a locked drill tile, member room card or card back shows with a padlock, a plain line
saying what it is, and **one text link** to `/membership`. Not a prompt, not a button, no CTA
styling, nothing that appears over what the player was doing or comes back after being
closed. The landing page ships *"No forced pop-ups, no pay-to-win, no nagging. Ever."* and
every one of these screens is inside that sentence.

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

Member card backs sit in `ALL_CARD_BACKS` and appear locked in the Style picker, which is a
strip with no denominator. They carry no chip price, ever: no Chip Shop price is payable in
cash, and allowing both would invent an exchange rate between the two economies
(`docs/shop.md` rule 3).

## What is deliberately not gated

Worth listing, because each was considered:

- **The read on every hand as you finish it.** The hand is free, the player is paid
  (Will, 2026-07-30). `lib/coach.ts` stays `HandRecord → HandRead | null` and must never grow
  a paid branch inside it; `lib/deepCoach.ts` is the paid module and neither imports the
  other.
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
| `tests/customTable.test.ts` | A built table being easier than the ladder at the same price |
| `tests/spectate.test.ts` | The spectator view answering while a hand is live |
| `tests/challenge.test.ts` | Member content enlarging a free player's denominator |
| `tests/roadmapDrills.test.ts` | The public roadmap going stale about which drills are paid |

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
| The page copy | `src/app/membership/page.tsx`; the billing section is in `/terms` |
