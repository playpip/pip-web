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
  Kitchen Table; Sable is the Vault's boss. Pinned characters never wander.
- **`delta`** — small nudges (±0.12 max) over the venue's `AiProfile`
  (tightness / aggression / bluff). **The venue owns difficulty** — `skill` and
  `iterations` are never touched, so the ladder curve is exactly as tuned.
  Applied by `profileFor` per seat; validate big changes with `pnpm sim`.
- **`lines`** — table talk (below).

Seating: `draftCast(venue, count, rng?)` shuffles the venue's roster (top-up from
the wider cast is a safety net, tested). Pass a seeded rng for a reproducible
table — the Daily Deal does.

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

## Non-goals

- No character progression, moods, or grudges — tendencies are observed, not
  scripted arcs.
- No dialogue *at* the player mid-hand; talk never interrupts a decision.
- No paid or unlockable characters. The troupe is the world, not inventory.

## Where to make changes

| Want to change… | Edit |
|-----------------|------|
| Add/rewrite a character, bio, lines | `src/config/cast.ts` (+ `tests/cast.test.ts` coverage holds) |
| Where a character plays | `bands` / `only` on the character |
| Talk frequency / moments | `maybeTalk` + call sites in `src/store/game.ts` |
| The talk line's look | the table-talk block in `components/table/Table.tsx` |
| Career record shape | `store/profile.ts` (bump `PERSIST_VERSION`, add migration) |
