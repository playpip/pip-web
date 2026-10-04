# Smoke test — the membership build

Everything added in the membership work, in the order that costs you the fewest membership
toggles. Roughly **25 minutes** for both passes.

Nothing here is covered by `pnpm test:all`: it is all screen, and there is no browser in CI.
Where I already suspect trouble, it says so — those are the items worth your attention even
if you skip the rest.

---

## Before you start: how to actually stop being a member

**Deleting the row is not enough on its own.** `store/entitlement.ts` caches the row in
`localStorage` under `pip.membership` and honours a cached row until the period it paid for
runs out — that is deliberate, so a member on a plane stays a member. It also means a stale
cache will keep you entitled after the row is gone.

Two ways round it, and the first is much cheaper:

**A. Sign out.** Signing out clears the cache and drops you to non-member instantly. Your
local profile, Roll and collection stay exactly where they are — Pip is local-first and the
account only carries a copy. **This is the toggle to use.** Sign back in to be a member again.

**B. Delete the row** (service role), then sign out and back in so the cache goes with it:

```sql
delete from public.memberships;
-- and to put it back
insert into public.memberships (user_id, status, current_period_end)
select id, 'active', now() + interval '1 year' from auth.users where email = '<your email>';
```

Use B if you want to check the *server* side of the gate rather than the client's cache. Use
A for everything else.

> If a screen seems not to notice you have changed state, it is almost always the cache.
> Clear `pip.membership` in devtools → Application → Local Storage.

---

## Pass 1 — as a member

Signed in, row present.

### 1. The lobby

`/game`. **Back to four tiles (five with a challenger)** — the width it shipped at before
the membership. The two tiles that made it six are gone: everything the membership adds is
a format twist, so it lives on the side tables.

- [ ] Four tiles: Daily · The Rail · Venues · Side Tables. **No Member Rooms, no Build a
      table.**
- [ ] With a challenger waiting: five, as before
- [ ] Does it look like it did before the membership work? It should

### 2. Side Tables ⚠️

`/game/side`. This is where the membership now lives, and the item most worth your eye.

- [ ] The free side tables are all still there and unchanged
- [ ] **Deep Stack** — one card, showing the 2,000 buy-in
- [ ] **The Big Pot** — one card, Omaha
- [ ] **Build your own** — the last tile, with a spanner
- [ ] ⚠️ **Ten tiles now on one shelf.** The grid is 2 / 3 / 4 columns by width. Does it
      still read, or is it a wall?
- [ ] Deep Stack and Big Pot have **no venue art**, so they fall back to geometric SVG.
      Acceptable, or obviously placeholder?

### 2b. The stake picker ⚠️ — the new bit

Tap **Deep Stack**.

- [ ] A **"Your stakes"** row above "The table": 750 · 2,000 · 5,000 · 15,000 · 40,000
- [ ] It opens on 2,000, selected
- [ ] **Tap another stake and everything below follows it** — starting stack, blinds,
      winner-takes, and the difficulty dots at the top. That is the whole feature
- [ ] The line underneath explains the stake picks the opposition
- [ ] **Tap a stake you cannot afford: the Play button must go dead** and read "Need X to
      buy in". This is the dead-click bug one dialog over, so it is worth actually trying
- [ ] Play at a stake you can afford → you sit with **three times** the buy-in
- [ ] Close, reopen: it is back on 2,000 rather than remembering your last tap

### 3. A member table, played

Sit at **Deep Stack, 2,000** (6,000 stack, 12 hands a level).

- [ ] You sit with **6,000**, not 2,000
- [ ] Blinds are slow — no escalation for 12 hands
- [ ] **Bev, Dez or Winnie are at the table.** They only appear at the member tables. Tap
      one: bio, avatar, reads
- [ ] Stand up mid-tournament → your Roll reflects `cashOutValue`, not the raw 6,000

### 4. Pot-Limit Omaha ⚠️⚠️

**The Big Pot** (5,000 buy-in). The highest-risk screen in the build — the engine is
thoroughly tested, the *rendering* of it has never been seen.

- [ ] **You are dealt four cards.** Do they fit, or do they overflow / overlap badly? Check
      the mobile layout too, where the hero's cards are fanned
- [ ] The label under your cards says "Hole cards" preflop, then a hand name postflop
- [ ] ⚠️ **On a flop, check the hand name is an Omaha reading.** If you hold four of one suit
      and only one lands on the board, it must **not** say Flush. This was wrong until just
      now and is the single most important check on this page
- [ ] **The raise slider maxes at the pot, not your stack.** Preflop three-handed at 25/50,
      first to act, the cap should be 175 — not 10,000
- [ ] Pot-fraction buttons clamp to that cap
- [ ] Play to a showdown: four opponent cards render face up, and the winner is right
- [ ] The live equity readout moves and looks sane (it is genuinely Omaha equity now)

### 5. Build a table

`/game/custom`.

- [ ] Every control changes the receipt: seats, buy-in, stacks, speed, bounty
- [ ] **Buy-in changes "the opposition"** — the hint names a venue, and picking 5,000 should
      say Downtown Casino
- [ ] Bounty options are None / half / max, and never duplicate at the lowest buy-in
- [ ] Guest chips: pick some, they cap at `seats − 1`; shrinking the table trims the list
- [ ] **Deal it** → you are at your table, with the seats and stacks you chose
- [ ] Come back later → the builder remembers your last table

### 6. Watching it out after you bust

Use a **custom table at 3 seats** — quickest and cheapest way to bust on purpose.

- [ ] Bust out. The overlay shows your place and recap as usual
- [ ] **"Watch it out"** appears under the primary button
- [ ] Tap it: the table keeps dealing, **every hand face up**, no action buttons
- [ ] ⚠️ **Is the pacing watchable?** There is a 2.2s pause between hands. Too fast to read,
      too slow to sit through, or about right?
- [ ] Tap a player still in → their cards and **"N% to win it"**
- [ ] It ends when one player is left, with "X takes it."
- [ ] **Leave** returns you home, and your Roll/place are unchanged from when you busted

### 7. Your report

`/stats` → **"Read the full report"** (or `/game/report`).

- [ ] ⚠️ **It needs 120 hands.** Under that it says so and tells you how many you have —
      that is the correct behaviour, not a bug. If you see that, the rest of this section
      needs a longer session first
- [ ] With enough hands: findings with a number, a sample, and advice
- [ ] "What is working" as well as "What is costing you"
- [ ] Nothing reads like a nag or a goal

### 8. Drills and cosmetics

- [ ] `/game/drills` — **all six kinds** open, no padlocks
- [ ] Each one deals on the felt: board at table size, your cards bottom-centre, answers in
      the action bar where fold / check / raise live
- [ ] "Which five play?" → tapping five cards grades on the fifth tap; a sixth swaps
- [ ] Pot odds → the **play-it-out** mode switch works, and the rating in the bar changes
      with the segment (the two modes keep separate records)
- [ ] Settings → Style → **four member card backs** (Lock-In, Back Room, Nightcap, Last
      Orders) unlocked and selectable. Their ids still name rooms that no longer exist,
      deliberately: renaming an id would orphan a player's saved choice for nothing

---

## Pass 2 — as a stranger

**Sign out now.** Everything below should change without a reload.

### 9. The locks

- [ ] Lobby: unchanged — there is nothing membership-shaped on it to lock
- [ ] `/game/side`: Deep Stack, The Big Pot and Build your own are **locked**, each reading
      **"Comes with the membership"** — *not* "Need 2,000". That distinction is the point: a
      money message would be a lie to someone whose Roll is fine
- [ ] The free side tables beside them are unaffected
- [ ] Open Deep Stack's dialog: the stake picker still works and the numbers still follow
      it — you can read what you would be buying — but Play is locked
- [ ] `/game/drills`: four kinds locked with a padlock and the member star, each showing **a
      real board** rather than card backs, reading "Comes with the membership"; tapping any
      of them goes to `/membership`
- [ ] Open a locked kind directly: it **deals a real spot**, dimmed, with one line where the
      answers go → `/membership`. Nothing there is gradeable and no rating moves
- [ ] Settings → Style: member backs locked; tapping one gives a hint, not a purchase
- [ ] `/game/custom`: you can still build and see the numbers, but **Deal it is disabled**,
      with a line above explaining why
- [ ] `/game/report`: locked panel that still shows **your** hand count
- [ ] Bust a tournament → **no "Watch it out"**

### 10. The deep links

Type these in. None should 404, all should turn you away somewhere useful.

- [ ] `/play/deepstack-2000` → bounces to **`/game/side`**, not the home screen
- [ ] `/play/deepstack-40000` → same (a stake with no card of its own still has a route)
- [ ] `/play/bigpot` → same
- [ ] `/play/custom` → bounces to **`/game/custom`**
- [ ] `/game/custom` still loads and explains itself
- [ ] `/game/member` is **gone** — a 404 here is correct

### 11. `/membership`

- [ ] Loads, back button works from inside the installed PWA
- [ ] "What you get today" lists seven things; "What is coming" lists only **multiplayer**
- [ ] The rank paragraph is there and reads as honest rather than defensive
- [ ] **"Can I join yet?" says no**, and says nobody has paid anything
- [ ] Share the URL somewhere that unfurls — the card should have an image and say
      "Pip Membership", not "Poker without the casino."

---

## The checkout

**There is nothing to test.** `checkoutReady()` is false in every build because
`NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `_ANNUAL` are unset, so:

- there is no join button anywhere in the app,
- `/membership` renders the "not yet" paragraph instead of a "how to join" one,
- and the only thing to verify is that **no surface offers to take money**, which is the
  check worth doing.

- [ ] Nothing anywhere in the app offers a purchase, a price button, or a card form

Everything after that — checkout, the webhook, the portal, the settings row, the four funnel
events, and cancelling the subscription when an account is deleted — is blocked on the Stripe
account. See [membership.md](./membership.md) → Still to build.

---

## What I already know I cannot see

Not on the list because they need you, and I would rather name them than have you assume
they were checked:

- **Ten tiles on the side-tables shelf.** Item 2 — the lobby problem may simply have moved
  one screen over, and I still cannot see it.
- **The stake picker.** Item 2b. New UI, never rendered.
- **Four hole cards on a table laid out for two.** Item 4, desktop and mobile.
- **Spectator pacing.** Item 6. The 2.2s pause is a guess.
- **Whether the member rooms' SVG fallback art is good enough to ship**, or whether they need
  real images before anyone pays for them.
- **The Big Pot's opponents.** Their equity is real Omaha; their personalities were tuned
  against two cards. Expect them to play Omaha slightly wrong — that is known and on the
  roadmap, not a bug you have found.
