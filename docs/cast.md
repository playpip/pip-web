# The Cast

> **Status: built (v1).** The troupe lives in `src/config/cast.ts`; seating happens
> in `sitDown()` (`src/store/game.ts`); career records persist in the profile
> (`castRecords`, `PERSIST_VERSION` 10); table talk surfaces as one quiet line at
> the table with a Settings toggle.

## Concept

Opponents are **characters, not random names**. Pip has a fixed troupe of regulars —
each with a face, a one-line bio, a home range on the ladder, and a personality.
Doris plays the Garage and brings biscuits; Sable *is* the Vault. You get to know
them the way you know the people at a home game: by playing them, reading them, and
occasionally taking their last chip.

Charming games are charming because of *who's there*. The cast is the anchor for
the rest of Pip's charm layer — the shopkeeper, souvenirs and table moments all
hang off it.

## The shape

Each `Character` in `src/config/cast.ts`:

- **`id` / `name` / `bio`** — the bio is one line in the venue-tagline register:
  short, dry, affectionate. (*"Waits for aces. Sometimes gets them."*)
- **`avatar`** — a fixed `AvatarSpec` (DiceBear seed + swatch), same pipeline as
  player avatars. No new art system; faces are stable forever.
- **`bands`** — where they play: `low` / `mid` / `high`, derived from venue
  buy-ins (`bandFor`), so new venues get a roster automatically.
- **`only`** — pins a character to specific venues instead: Uncle Ray hosts the
  Kitchen Table; Sable is the Vault's boss; Bev, Dez and Winnie keep the member
  rooms; Maud keeps the Regulars' Table, which a 21-day streak opens (docs/daily-reward.md).
  Pinned characters never wander.
- **`delta`**: nudges (±0.2 max) over the venue's `AiProfile`
  (tightness / aggression / bluff). **The venue owns difficulty** — `skill` and
  `iterations` are never touched, so the ladder curve is exactly as tuned.
  Applied by `profileFor` per seat; validate big changes with `pnpm sim --cast`, and keep each band's mean delta near zero so the rung keeps its difficulty.
- **Tonight's form** scales the delta, and only the delta: each seating draws `quiet`,
  `usual` or `loud` per character (`formFor`, 25 / 50 / 25) and plays
  `clamp01(base + delta × FORM_SCALE[form])`, with `FORM_SCALE` 0.4 / 1 / 1.6. The weighted
  scale is exactly 1, so a band's mean delta, and with it the rung, is unchanged
  (`tests/castForm.test.ts` holds it, clamping included). The sign never flips: a quiet
  Frank still bluffs more than the room, just less than usual. A character with no delta
  has no form. `profileFor` defaults to `usual`, which is the delta as written, so lessons,
  drills and the builder read the baseline. Drawn once per seating and kept in the seat
  (`SeatMeta.form`), so a refresh resumes the same night; the Daily draws off the day's seed
  on its own stream (`dailyFormRng`), so everyone meets the same Frank; the welcome table
  and challenges play everybody `usual`. Check a change with `pnpm sim --cast` against
  `--cast --forms`.
- **`lines`** — table talk (below).

### The one exception: a guest brings their own rung

A character invited **by name** to a table the player built (`Venue.guests`, set
only by `customVenue`) plays the profile of `homeRungFor(them)` — the cheapest
room their hardest band covers — whenever that is harder than the table's own.
Never when it is softer: `profileFor` takes the harder of the two whole, so no
blended profile exists and no invitation can discount a table.

That is the whole of it, and it is what the builder is for: Celeste at a
100-chip table is the Penthouse's game for a 600-chip prize. Anybody who was
*drafted* rather than invited still plays the venue's own profile, so a built
table nobody was invited to is its ladder rung to the object.
`tests/customTable.test.ts` pins both directions.

Seating: `draftCast(venue, count, rng?)` seats `venue.guests` first — they are
not entered into the draw, because the point of naming somebody is that they
turn up — then shuffles the venue's roster for the chairs that are left (top-up
from the wider cast is a safety net, tested). Pass a seeded rng for a
reproducible table — the Daily Deal does.

## Career records

The reads system (`docs/game-flow.md`, `lib/reads.ts`) now remembers. Each hand,
every character's observed tendencies are flushed into the profile
(`castRecords[id].stats` — same `SeatStats` shape), so the reads in the player
dialog are **career-long**: *"Frank's still bluffing too much"* survives a reload.
Knockouts you deal are counted per character (`kos`) and shown quietly in the
player dialog ("214 hands together · busted them 3×").

## Table talk

Each character has ~6 lines across three moments: **sitting down**, **winning a
big pot** (≥20 big blinds), **busting out**. Rationing is the design:

- At most one line every **4 hands** (`TALK_MIN_GAP_HANDS`), most moments pass in
  silence anyway (probability-gated per moment).
- Rendered as **one quiet italic line** under the top bar — no speech bubbles, no
  sound, cleared at the next deal.
- A **Settings toggle** (`tableTalk`, on by default) silences it entirely.

The writing bar is the feature: lines are dry, specific and short. If a line
wouldn't read well spoken by a bartender, cut it.

A quiet or loud night can open with its own line (`lines.quiet` / `lines.loud`, optional,
in place of `seat`): Frank promises to play it straight on a quiet one. A hint for whoever
is paying attention, never a label, so keep them as rare as the rest.

A fourth moment, **the read** (`lines.read`, optional): the table has learned the
player bets nearly every hand (`credibility` under 0.6 in `lib/poker/ai/memory`),
they took a hand to showdown, and this character beat them. It outranks the
big-pot line, under the same rationing.

## Habits

A few characters play a **habit** their bio already describes (`habit` on the
character, `Habit` in `lib/poker/ai/policy`): Mo barrels the turn, Rosa calls
down, Dmitri traps, Vivienne bets the pots she closes. It is personality, not
skill, so it holds at every table they sit at, and it is the thing a regular
would learn about them and use. Give a character a habit only when the bio says
it.

## The challenge line

A fourth line, `lines.challenge`, is the invitation a character waits with on the
home screen (see [venues.md](./venues.md) → challenge tables). **One line, not an
array**: the other three rotate because you sit at those tables repeatedly, while a
challenger appears once.

It is an **invitation, not a taunt**. A taunt on the home screen every time you open
the app is a nag with a face on it, which is the exact thing the no-decline, no-timer
design exists to avoid. No line names a stake, a venue or a reward, so tuning any of
those cannot make one stale.

Optional on the type, required by the gate: `tests/challenge.test.ts` fails if a
*challengeable* character lacks one. Ray, Pearl, Sable, Bev, Dez and Winnie are pinned to
a venue and can never be challenged, so requiring it on the type would mean writing
invitations nobody can ever accept.

## Non-goals

- No long-term progression or grudges — tendencies are observed, not scripted arcs.
  A nightly form changes how much, never which way.
- No dialogue *at* the player mid-hand; talk never interrupts a decision.
- **No character is inventory.** You cannot buy one, collect one, or unlock one
  individually, and there is no roster to complete.

  This used to read "no paid or unlockable characters", and three of them now live
  behind the membership — Bev, Dez and Winnie keep the member rooms. The line has been
  corrected rather than quietly reinterpreted. **The distinction that survives, and the
  one that matters:** what the membership sells is a *room*, and a room has regulars the
  way every other room does. Nobody is priced, listed or sold, and no free player's
  collection gets longer because they exist — they are pinned, so `challengeable`
  excludes them and the scalp shelf still reads `0 of 22`. `tests/challenge.test.ts`
  pins that number, and if a future member character is not pinned **the fix is to pin
  them, not to raise the 22**. See [membership.md](./membership.md).

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| Add/rewrite a character, bio, lines | `src/config/cast.ts` (+ `tests/cast.test.ts` and `tests/challenge.test.ts` coverage holds) |
| Where a character plays | `bands` / `only` on the character |
| A character's habit | `habit` on the character; sizes in `HABIT` (`config/aiGates.ts`) |
| How far a form leans, how often | `FORM_SCALE` / `FORM_WEIGHTS` in `src/config/cast.ts` (keep the weighted scale at 1; `tests/castForm.test.ts`) |
| Talk frequency / moments | `maybeTalk` + call sites in `src/store/game.ts` |
| The talk line's look | the table-talk block in `components/table/Table.tsx` |
| Career record shape | `store/profile.ts` (bump `PERSIST_VERSION`, add migration) |
