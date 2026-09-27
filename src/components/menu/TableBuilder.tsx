'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUp, Check, Lock } from 'lucide-react'
import { SectionScreen } from './SectionScreen'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { type CastBand, type Character, homeRungFor } from '@/config/cast'
import { difficultyOf, difficultyRank } from '@/config/opponents'
import {
  CUSTOM_BUY_INS,
  CUSTOM_DEPTHS,
  CUSTOM_SEATS,
  CUSTOM_SPEEDS,
  DEFAULT_CUSTOM,
  type CustomTableSpec,
  customPrize,
  customVenue,
  invitableCast,
  maxBounty,
  raisesTable,
  refuseCustomTable,
  rungFor,
  standardFor,
} from '@/config/customTable'

/**
 * Build your own table.
 *
 * **Two questions, and the second one is the interesting half.** The shape —
 * seats, stakes, depth, speed, bounty — is a form, and it is laid out like one:
 * an inset grouped list with a segmented control per row, the iOS shape for
 * "small number of choices, pick one". Who sits down is not a form. It is a
 * casting decision, so the regulars are cards with a face, a bio, what they are
 * like to play and the room they bring with them — the thing pills could never
 * say, and the reason somebody would pick Celeste over Gus rather than tapping
 * whichever name they recognised (Will, 2026-09-22).
 *
 * **There is still no difficulty dial, and there is now a direction.** The
 * table's own opposition comes from the buy-in by the same ladder everybody
 * plays. A guest invited by name brings their home rung when it is the harder
 * one, so this screen can make a table harder than its price and has no way of
 * making one softer — the prize is buy-in × seats either way, so the only thing
 * a high roller at a cheap table buys you is a worse game for the same money.
 * The receipt says which of the two you have built, every time.
 */
export function TableBuilder() {
  const ready = useRequireProfile()
  const router = useRouter()
  const money = useMoney()
  const member = useEntitlement()
  const spendable = useSpendableRoll()
  const saved = useProfile((s) => s.customTable)
  const setCustomTable = useProfile((s) => s.setCustomTable)
  const [spec, setSpec] = useState<CustomTableSpec>(saved ?? DEFAULT_CUSTOM)

  if (!ready) return <Splash />

  const set = (patch: Partial<CustomTableSpec>) => {
    const next = { ...spec, ...patch }
    // Changing the buy-in can put an existing bounty over what the new stakes
    // can fund, so it is clamped here rather than left to fail validation with
    // a message about a field the player did not touch.
    next.bounty = Math.min(next.bounty, maxBounty(next.buyIn))
    // Same for invitations when the table shrinks.
    next.castIds = next.castIds.slice(0, next.seats - 1)
    setSpec(next)
  }

  const refusal = refuseCustomTable(spec)
  const rung = rungFor(spec.buyIn)
  const standard = standardFor(spec)
  const raised = standard.id !== rung.id
  const affordable = spendable >= spec.buyIn
  const canDeal = member && !refusal && affordable
  const seatsLeft = spec.seats - 1 - spec.castIds.length

  const toggle = (ch: Character) => {
    const picked = spec.castIds.includes(ch.id)
    if (!picked && seatsLeft === 0) return
    sound.play('tap')
    set({
      castIds: picked ? spec.castIds.filter((id) => id !== ch.id) : [...spec.castIds, ch.id],
    })
  }

  const deal = () => {
    if (!canDeal) return
    sound.play('call')
    setCustomTable(spec)
    router.push(`/play/${customVenue(spec).id}`)
  }

  return (
    <SectionScreen
      title="Build a table"
      subtitle="Pick the shape, then pick the company. Deal it whenever you like."
    >
      {!member && (
        <div className="mb-6 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4" /> Building a table comes with the membership.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You can set one up and see what it would pay. Dealing it needs a membership.{' '}
            <Link href="/membership" className="underline underline-offset-2 hover:text-foreground">
              What that is
            </Link>
            .
          </p>
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* The shape. One inset card, one row per decision — the iOS grouped
              list, because these are five small closed choices and a heading
              above each would be five headings about nothing. */}
          <Group>
            {/* **The buy-in comes first, and it is in the box** (Will,
                2026-09-22). It used to sit under the card as its own section,
                which put the row that multiplies the buy-in above the row that
                sets it — you picked 2× of a number you had not chosen yet. It
                is also the one control here that is not a segmented pick: ten
                prices, each of them buying a standard of play.

                **No room names anywhere on this screen** (Will, 2026-09-22).
                "The Penthouse" under a price tells you how hard the game is
                only if you have already been there, and the whole point of the
                builder is that you can seat those players at any price you
                like. The word under the number is the difficulty, and every
                other difficulty on the screen is written in the same five
                words. */}
            <Field label="Buy-in" hint="Your stake, and how hard the table plays by default.">
              {/* `-my-1 py-1` is not spacing, it is headroom: a horizontal
                  scroller clips vertically too, so the selected chip's ring
                  loses its top edge against the container unless the padding
                  is there to hold it. The negative margin gives it back. */}
              <div className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-5 sm:px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CUSTOM_BUY_INS.map((n) => {
                  const picked = n === spec.buyIn
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        sound.play('tap')
                        set({ buyIn: n })
                      }}
                      aria-pressed={picked}
                      className={cn(
                        // One width for all ten, so the row is a rank of equal
                        // options rather than a bar chart of how long each
                        // number happens to be.
                        'w-32 shrink-0 rounded-2xl border px-4 py-2.5 text-left transition active:scale-[0.97]',
                        picked
                          ? 'border-transparent bg-background shadow-sm ring-2 ring-foreground/25 dark:bg-foreground/15'
                          : 'border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03]',
                        // Dimmed, never disabled: a price you cannot reach yet
                        // is still a table worth looking at the numbers for.
                        spendable < n && !picked && 'opacity-45',
                      )}
                    >
                      <span className="block font-semibold tabular-nums">{money(n)}</span>
                      <span className="mt-0.5 block text-2xs text-muted-foreground">
                        {difficultyOf(rungFor(n).ai)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Seats" hint="Including you.">
              <Segmented
                options={CUSTOM_SEATS.map((n) => ({ value: n, label: String(n) }))}
                value={spec.seats}
                onPick={(seats) => set({ seats })}
              />
            </Field>

            <Field label="Stacks" hint="How deep everybody sits, as a multiple of the buy-in.">
              <Segmented
                options={CUSTOM_DEPTHS.map((n) => ({
                  value: n,
                  label: `${n}×`,
                  sub: money(spec.buyIn * n),
                }))}
                value={spec.depth}
                onPick={(depth) => set({ depth })}
              />
            </Field>

            <Field label="Speed" hint="How long a blind level lasts.">
              <Segmented
                options={CUSTOM_SPEEDS.map((n) => ({
                  value: n,
                  label: SPEED_WORDS[n] ?? `${n}`,
                  sub: `${n} hands`,
                }))}
                value={spec.handsPerLevel}
                onPick={(handsPerLevel) => set({ handsPerLevel })}
              />
            </Field>

            <Field
              label="Bounty"
              hint="Paid the moment you knock somebody out. It comes out of the prize, never on top of it."
            >
              <Segmented
                // Deduped: at the lowest buy-in a quarter and an eighth round to
                // the same number, and two identical chips is a broken-looking
                // control rather than a choice.
                options={[
                  ...new Set([0, Math.floor(maxBounty(spec.buyIn) / 2), maxBounty(spec.buyIn)]),
                ]
                  .filter((n) => n >= 0)
                  .map((n) => ({
                    value: n,
                    label: n === 0 ? 'None' : money(n),
                    sub: n === 0 ? 'Winner takes it all' : 'A head',
                  }))}
                value={spec.bounty}
                onPick={(bounty) => set({ bounty })}
              />
            </Field>
          </Group>

          {/* Who sits down. The half of this screen that is worth a redesign. */}
          <section>
            <SectionHead
              title="Who sits down"
              hint="Invite anybody, at any price. A guest who plays harder than your stake brings that with them — never the other way round."
              aside={
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-2xs font-medium tabular-nums',
                    seatsLeft === 0
                      ? 'bg-primary/15 text-foreground'
                      : 'bg-foreground/[0.06] text-muted-foreground',
                  )}
                >
                  {spec.castIds.length} of {spec.seats - 1}
                </span>
              }
            />

            <p className="mb-3 text-sm text-muted-foreground">
              {spec.castIds.length === 0
                ? 'Nobody invited, so the regulars are drawn as usual.'
                : seatsLeft === 0
                  ? 'Every chair is spoken for.'
                  : `${seatsLeft} ${seatsLeft === 1 ? 'chair goes' : 'chairs go'} to the regulars.`}
            </p>

            <div className="flex flex-col gap-6">
              {BANDS.map(({ band, title, hint }) => {
                const people = invitableCast().filter((ch) => topBand(ch) === band)
                if (people.length === 0) return null
                return (
                  <div key={band}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                      <h3 className="text-sm font-semibold">{title}</h3>
                      <p className="truncate text-sm text-muted-foreground">{hint}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                      {people.map((ch) => (
                        <GuestCard
                          key={ch.id}
                          character={ch}
                          picked={spec.castIds.includes(ch.id)}
                          full={seatsLeft === 0}
                          lifts={raisesTable(ch, spec.buyIn)}
                          onToggle={() => toggle(ch)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* The receipt. Everything derived, nothing typed, so it cannot disagree
            with the table that gets dealt. Sticky on a desktop, because it is
            the answer to every control to the left of it. */}
        <aside className="lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
          <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5">
            <h2 className="text-sm font-semibold">Your table</h2>
            <SeatStrip spec={spec} />

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
              <Fact label="Buy-in" value={money(spec.buyIn)} />
              <Fact label="You sit with" value={money(spec.buyIn * spec.depth)} />
              <Fact label="Winner takes" value={money(customPrize(spec))} />
              <Fact label="Blinds" value={`${money(rung.smallBlind)} / ${money(rung.bigBlind)}`} />
            </dl>

            <div className="mt-4 border-t border-foreground/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Difficulty
                </p>
                <div className="flex items-center gap-2">
                  <Bars level={difficultyRank(standard.ai)} />
                  <p className="text-sm font-semibold">{difficultyOf(standard.ai)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {raised
                  ? `Harder than you are paying for: somebody you invited plays ${difficultyOf(standard.ai).toLowerCase()}, and they play it here. The prize is the same ${money(customPrize(spec))}.`
                  : `${difficultyOf(rung.ai)}, because that is what ${money(spec.buyIn)} buys. Invite somebody who plays harder and they will bring it with them.`}
              </p>
            </div>

            <button
              onClick={deal}
              disabled={!canDeal}
              className="mt-5 w-full rounded-2xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
              Deal it
            </button>
            {refusal ? (
              <p className="mt-2 text-sm text-muted-foreground">{refusal}</p>
            ) : !affordable ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You need {money(spec.buyIn)} to sit at this one.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </SectionScreen>
  )
}

/** Hands per level, in words. Falls back to the number for a speed added later. */
const SPEED_WORDS: Record<number, string> = {
  2: 'Hyper',
  5: 'Fast',
  9: 'Standard',
  14: 'Slow',
}

/**
 * The three shelves the cast is picked from.
 *
 * Grouped rather than listed, because "who should I invite" is answered by how
 * hard somebody plays before it is answered by anything else, and twenty faces
 * in one grid made that the one thing you could not see. The headings are the
 * standard each group plays to, in the same words as everything else on the
 * screen — not the rooms they play it in.
 */
const BANDS: readonly { band: CastBand; title: string; hint: string }[] = [
  { band: 'low', title: 'Easy company', hint: 'Friendly, whatever you are paying' },
  { band: 'mid', title: 'Harder company', hint: 'They know what they are doing' },
  {
    band: 'high',
    title: 'The hardest company',
    hint: 'Invite them anywhere and they play like this',
  },
]

/** Hardest band somebody plays — the one their card is filed under. */
function topBand(ch: Character): CastBand {
  return ch.bands.includes('high') ? 'high' : ch.bands.includes('mid') ? 'mid' : 'low'
}

/**
 * What this one is like, in a few words.
 *
 * Read off their `delta` and not off the profile they would sit down with.
 * The profile is mostly the table's — at any single buy-in `styleFor` calls
 * nearly the whole cast "Balanced", and a shelf of twenty cards that all say
 * Balanced has told you nothing about which of them to invite. The delta is
 * precisely the part that is *them*, so it is the part the card reports.
 */
function traitOf(ch: Character): string {
  const { tightness = 0, aggression = 0, bluff = 0 } = ch.delta ?? {}
  if (bluff >= 0.06) return 'Bluffs'
  if (tightness <= -0.06) return 'Plays anything'
  if (tightness >= 0.08) return 'Waits for it'
  if (aggression >= 0.08) return 'Comes at you'
  if (aggression <= -0.06) return 'Quiet'
  return 'Steady'
}

/**
 * One regular, as a card you would pick from.
 *
 * Face, name, how hard they play, what they are like at this table and their
 * one line. The style label is computed from the profile they would *actually*
 * sit down with, so it answers to the buy-in and to the room they bring rather
 * than describing a table nobody is building.
 */
function GuestCard({
  character,
  picked,
  full,
  lifts,
  onToggle,
}: {
  character: Character
  picked: boolean
  full: boolean
  lifts: boolean
  onToggle: () => void
}) {
  // How hard this one plays, wherever they are sitting: their own rung's
  // profile, which is what a guest brings to a table cheaper than it.
  const own = homeRungFor(character).ai
  const unavailable = full && !picked
  return (
    <button
      onClick={onToggle}
      aria-pressed={picked}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]',
        picked
          ? 'border-transparent bg-foreground/[0.06] ring-2 ring-foreground/30'
          : 'border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03]',
        unavailable && 'opacity-40',
      )}
    >
      {/* The face, and the tick that lands on it. A badge on the avatar is the
          iOS "this one is coming with you" and it keeps the card's top-right
          corner for the name rather than a second control. `self-start` is not
          cosmetic: a stretched flex child turns a round avatar into a pill. */}
      <span className="relative shrink-0 self-start">
        <PlayerAvatar spec={character.avatar} size={40} />
        <motion.span
          initial={false}
          animate={{ scale: picked ? 1 : 0, opacity: picked ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
        >
          <Check className="size-2.5" strokeWidth={4} />
        </motion.span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold leading-tight">
          {character.name}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground">
          {character.bio}
        </span>
        {/* One metadata line rather than a row of pills: what they are, and how
            they play. */}
        <span className="mt-2 block truncate text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          {difficultyOf(own)} · {traitOf(character)}
        </span>
        {/* And the thing pills could never say, on its own line because it is
            the sentence the whole screen turns on: this one makes the table
            harder than you are paying for. Only ever shown when it is true. */}
        {lifts && (
          <span className="mt-1 flex items-center gap-1 text-2xs font-medium">
            <ArrowUp className="size-3" strokeWidth={2.5} />
            {/* Not "raises it to very hard" — the line above already says very
                hard, and saying it twice on a card this size reads as two
                facts when it is one. */}
            Raises this table
          </span>
        )}
      </span>

      <Bars level={difficultyRank(own)} className="mt-0.5 self-start" />
    </button>
  )
}

/** Who is at the table: the faces you picked, then a chair each for the draw. */
function SeatStrip({ spec }: { spec: CustomTableSpec }) {
  const guests = invitableCast().filter((ch) => spec.castIds.includes(ch.id))
  const drawn = Math.max(0, spec.seats - 1 - guests.length)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {guests.map((ch) => (
        <motion.span
          key={ch.id}
          layout
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          title={ch.name}
        >
          <PlayerAvatar spec={ch.avatar} size={28} />
        </motion.span>
      ))}
      {/* An empty chair, drawn as one. Nothing inside it: a face you did not
          pick would be a promise about who turns up, and an icon repeated five
          times is a texture rather than information. */}
      {Array.from({ length: drawn }, (_, i) => (
        <span
          key={`drawn-${i}`}
          className="size-7 rounded-full border border-dashed border-foreground/20"
          title="Drawn from the regulars"
        />
      ))}
    </div>
  )
}

/** An inset grouped list — the rows share one card and a hairline between them. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-foreground/10 overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03]">
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{label}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function SectionHead({
  title,
  hint,
  aside,
}: {
  title: string
  hint: string
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-2 px-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

/**
 * The iOS segmented control: one track, one thumb that slides to what you
 * picked. The thumb is a single shared element (`layoutId`), so the movement is
 * the control answering rather than two buttons changing colour.
 */
function Segmented<T extends number>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string; sub?: string }[]
  value: T
  onPick: (value: T) => void
}) {
  const track = useId()
  return (
    <div className="flex gap-1 rounded-2xl bg-foreground/[0.06] p-1">
      {options.map((option) => {
        const picked = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => {
              sound.play('tap')
              onPick(option.value)
            }}
            aria-pressed={picked}
            className="relative flex-1 rounded-xl px-2 py-1.5 transition active:scale-[0.97]"
          >
            {picked && (
              <motion.span
                layoutId={track}
                // The thumb has to read as *raised off* the track in both
                // themes, and `foreground/<alpha>` alone cannot do that: the
                // track is already a foreground tint, so a second one lands
                // under it in the dark. White in light, a lighter grey in
                // dark — which is what the control it is imitating does.
                className="absolute inset-0 rounded-xl bg-background shadow-sm ring-1 ring-foreground/10 dark:bg-foreground/15 dark:ring-foreground/5"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative block">
              <span
                className={cn(
                  'block truncate text-sm tabular-nums',
                  picked ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </span>
              {option.sub && (
                <span className="mt-0.5 block truncate text-2xs tabular-nums text-muted-foreground">
                  {option.sub}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The difficulty meter: five rising bars, filled to `difficultyRank`.
 *
 * Five and not three, so it is the same scale as the five words and a card, a
 * price and the receipt can all be compared at a glance. Decorative — the word
 * beside it is the accessible answer, so this is `aria-hidden` rather than a
 * second thing for a screen reader to read out.
 */
const BAR_HEIGHTS = ['h-1', 'h-1.5', 'h-2', 'h-2.5', 'h-3'] as const

function Bars({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-end gap-px', className)} aria-hidden>
      {BAR_HEIGHTS.map((height, i) => (
        <span
          key={height}
          className={cn(
            'w-[3px] rounded-[1px] transition-colors',
            height,
            i < level ? 'bg-foreground/70' : 'bg-foreground/15',
          )}
        />
      ))}
    </span>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
