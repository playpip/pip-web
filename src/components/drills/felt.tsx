'use client'

// The drill felt: the table, with a question on it.
//
// **It is the game screen** (Will, 2026-09-21: "make the drills match the poker
// table design like the session review does"). The drills used to be a form —
// a title, a row of cards in a padded column, bordered buttons, a result box —
// and a form is what they felt like. This is the same full-bleed screen the
// table and the review are: the same `AppBar`, the same board at board size,
// the hero's cards anchored bottom-centre, and the answers exactly where fold /
// check / raise sit. Dropping into a drill from the menu should feel like
// walking to another table, not like leaving the app for a quiz.
//
// **Why these are their own parts rather than `table/parts.tsx`.** Those take
// the engine's `Player` and `HandState`, which the review can supply because it
// rebuilds a real hand. A drill has no hand: no stacks, no blinds, no button,
// nobody to act. Faking a `HandState` to borrow the furniture would put
// invented chips on the screen and a lie in the type. So the geometry is
// shared, the components are not, and what they draw is only ever what a spot
// actually carries.

import { MotionConfig, motion } from 'framer-motion'
import { Check, Lock } from 'lucide-react'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { DrillStakes } from '@/lib/drills/types'
import { type Card, cardName } from '@/lib/poker/cards'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export const cardKey = (card: Card): string => `${card.rank}${card.suit}`

/**
 * How a card says it is one of the ones that count.
 *
 * **Drawn inside the card's own edge, and that is a constraint rather than a
 * preference** (Will, 2026-09-21: "boundaries of the cards touch too"). A ring
 * outside the card needs four pixels of clear air on each side, and the board
 * has none to give: five cards at 18vw each plus their gaps already fill a
 * phone, so an outside ring on two neighbours meets in the middle and the pair
 * reads as one long capsule. An inset ring costs nothing, so the cards stay
 * where they were and nothing has to move when a spot turns over.
 *
 * `ring-inset` has to be on the card itself rather than a wrapper: an inset
 * shadow paints on the element's own background and a child would cover it.
 * `PlayingCard` puts `className` on the card, which is what makes this work.
 */
const PLAYS_RING = (plays?: boolean): string | false =>
  Boolean(plays) && 'ring-2 ring-inset ring-emerald-500 transition'

/** The same, for a card the player has picked but has not been graded on. */
export const PICKED_RING = 'ring-2 ring-inset ring-primary'

/**
 * Motion, as the player asked for it.
 *
 * **A shared part cannot assume what it is mounted inside.** Every screen in
 * this folder declares `<MotionConfig reducedMotion="user">` at its root, and
 * these parts are inside one today — but a part that animates and relies on
 * somebody else having declared it is one move away from being mounted
 * somewhere that has not. Nesting it costs nothing and renders no DOM, which is
 * the same trade the drills' old shared header made, and
 * `tests/drillsMotion.test.ts` is what stops the next part skipping it.
 */
function Calm({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/**
 * The felt itself: whatever is across the table, the board, and the hero.
 *
 * `justify-evenly` rather than fixed gaps, for the reason the table's mobile
 * layout uses it: the slack between the three bands splits evenly, so a spot
 * with nobody across the table sits as comfortably as one with a seat there.
 */
export function Felt({
  across,
  board,
  hero,
}: {
  across?: React.ReactNode
  board: React.ReactNode
  hero?: React.ReactNode
}) {
  return (
    <Calm>
      {/* Three bands with the slack split between them, the way the table's own
          mobile layout does it. **With nobody across the table the slack is
          gathered instead of spread**: two bands pushed to the ends of a tall
          desktop screen is a gap rather than a table, and the eye has to travel
          it on every spot. */}
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col px-2 pb-1',
          across ? 'justify-evenly gap-3' : 'justify-center gap-10 sm:gap-14',
        )}
      >
        {across ? (
          // Wide apart on a desktop, because two holdings side by side with a
          // thumb's gap between them read as one row of four cards rather than
          // as two hands facing each other.
          <div className="flex items-start justify-center gap-6 sm:gap-16">{across}</div>
        ) : null}
        <div className="flex flex-col gap-2">{board}</div>
        {hero ? <div className="flex flex-col items-center gap-1.5">{hero}</div> : null}
      </div>
    </Calm>
  )
}

/**
 * The community cards, at table size, dealt in.
 *
 * `DealtCard` is the table's own arc-and-spring, and it is here for a reason
 * beyond looking nice: a spot that fades in reads as a screen changing, and a
 * spot that deals reads as a hand arriving. The stagger is what makes the
 * difference, and `MotionConfig` upstairs turns all of it into a calm fade for
 * anybody who asked for less motion.
 *
 * Face-down slots are drawn at the same size, so a board that fills in over
 * several streets never moves what is under it.
 */
export function Board({
  cards,
  slots = cards.length,
  dim = false,
  glow,
  renderCard,
}: {
  cards: readonly Card[]
  /** How many places to keep, where the board is still filling. */
  slots?: number
  /** Played down, so something else on the screen is the question. */
  dim?: boolean
  /**
   * Marks the cards that play, once a spot has been answered.
   *
   * On a kind about reading a hand this is the answer itself: the sentence can
   * list five cards, but a reader then has to find them on the board, and
   * finding them is the skill the drill is teaching. Ringing them where they
   * sit does the last step in the place it happened.
   */
  glow?: (card: Card) => boolean
  /** Swapped in where the cards are the controls — see PickFive. */
  renderCard?: (card: Card, index: number) => React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 transition-opacity sm:gap-2',
        dim && 'opacity-40',
      )}
    >
      {Array.from({ length: slots }, (_, i) => {
        const card = cards[i]
        if (!card) return <PlayingCard key={`slot-${i}`} size="board" />
        if (renderCard) return renderCard(card, i)
        const plays = glow?.(card)
        return (
          <DealtCard
            key={cardKey(card)}
            card={card}
            index={i}
            size="board"
            className={cn(PLAYS_RING(plays), glow && !plays && 'opacity-45')}
          />
        )
      })}
    </div>
  )
}

/**
 * The line under the board, where the table's talk goes.
 *
 * The question lives here rather than over the cards because that is where the
 * dealer's voice is on every other screen in this app, and a drill asking from
 * the same place is one app rather than two. Once the spot is answered the same
 * line becomes the answer — the review does exactly this with its commentary.
 */
export function TalkLine({
  children,
  tone = 'asking',
}: {
  children: React.ReactNode
  tone?: 'asking' | 'right' | 'wrong'
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'mx-auto max-w-prose px-3 text-center text-sm leading-snug',
        tone === 'asking' && 'text-muted-foreground',
        tone === 'right' && 'text-foreground',
        tone === 'wrong' && 'text-foreground',
      )}
    >
      {tone !== 'asking' && (
        <span className={cn('font-medium', tone === 'right' ? 'text-emerald-500' : 'text-primary')}>
          {tone === 'right' ? 'That’s it. ' : 'Not this time. '}
        </span>
      )}
      <span className={tone === 'asking' ? undefined : 'text-muted-foreground'}>{children}</span>
    </motion.p>
  )
}

/**
 * The pot and the price, on the right of the board where the table puts them.
 *
 * Nothing here is a hint: what the pot is charging as a percentage is the thing
 * being asked for on the kind that shows this, so it appears in the sentence
 * after the answer and never before it.
 */
export function Pot({ stakes }: { stakes: DrillStakes }) {
  const pot = formatChips(stakes.pot)
  const toCall = formatChips(stakes.toCall)
  return (
    <div className="flex items-baseline justify-center gap-2 px-2">
      <span className="sr-only">{`Pot ${pot} chips, ${toCall} to call.`}</span>
      <span aria-hidden className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
        Pot
      </span>
      <span aria-hidden className="text-xl font-semibold tabular-nums">
        {pot}
      </span>
      <span aria-hidden className="text-sm tabular-nums text-muted-foreground">
        · {toCall} to call
      </span>
    </div>
  )
}

/**
 * A holding on the felt: an avatar, a name, and two cards.
 *
 * The same three things a `Seat` at a real table is, minus everything a drill
 * has no honest answer for — no stack, no bet, no dealer button. `avatar` is
 * absent on a hand that belongs to nobody ("Hand A"), and then the name sits on
 * its own, which is what those spots are: two holdings, not two people.
 */
export function Holding({
  label,
  detail,
  cards,
  size = 'md',
  avatar,
  layout = 'above',
  dim = false,
  glow,
}: {
  label: string
  detail?: string
  cards: readonly Card[]
  size?: 'md' | 'hero'
  avatar?: React.ComponentProps<typeof PlayerAvatar>['spec']
  /** Where the name goes: over the cards (across the table) or under them. */
  layout?: 'above' | 'below'
  dim?: boolean
  /** Marks the cards that play, once a spot has been answered. */
  glow?: (card: Card) => boolean
}) {
  const name = (
    <div className="flex items-center gap-1.5">
      {avatar && <PlayerAvatar spec={avatar} size={22} />}
      <span className="text-xs font-medium">{label}</span>
      {detail && <span className="text-xs text-muted-foreground">· {detail}</span>}
    </div>
  )

  return (
    <div
      className={cn('flex flex-col items-center gap-1.5 transition-opacity', dim && 'opacity-45')}
    >
      <span className="sr-only">
        {`${label}: ${cards.map(cardName).join(' and ')}${detail ? `, ${detail}` : ''}`}
      </span>
      {layout === 'above' && name}
      <div className="flex gap-1.5" aria-hidden>
        {cards.map((card, i) => {
          const plays = glow?.(card)
          return (
            <DealtCard
              key={cardKey(card)}
              card={card}
              index={i}
              size={size}
              className={cn(PLAYS_RING(plays), glow && !plays && 'opacity-45')}
            />
          )
        })}
      </div>
      {layout === 'below' && name}
    </div>
  )
}

/**
 * The bar the answers sit in: the table's action strip, in the table's place.
 *
 * Fixed to the foot of the screen with the phone's safe area under it, because
 * the one thing a drill has in common with a hand is that the decision is made
 * with a thumb in the same spot every time. A rhythm — answer, read, next —
 * only exists if the buttons do not move.
 */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-1">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  )
}

/**
 * One answer.
 *
 * A single component for every kind's buttons, so a number, a word and a hand
 * are pressed with the same weight and revealed with the same colour. The press
 * state is the table's: a spring scale under the finger, off entirely for
 * anybody who asked for less motion.
 */
export function Answer({
  label,
  spoken,
  shortcut,
  state,
  wide = false,
  numeric = false,
  onPick,
  children,
}: {
  label: string
  spoken?: string
  shortcut?: string
  /** `open` before an answer, then what this one turned out to be. */
  state: 'open' | 'right' | 'wrong' | 'missed'
  wide?: boolean
  /**
   * A count rather than a phrase.
   *
   * It changes two things and both are about fit: a number is the control on
   * its kind so it is set large, and a phrase has to survive the width it is
   * given — "Three of a kind" at the number's size wraps to two lines and the
   * button grows a second storey (Will, 2026-09-21).
   */
  numeric?: boolean
  onPick: () => void
  children?: React.ReactNode
}) {
  const settled = state !== 'open'
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={settled}
      aria-label={spoken ?? label}
      className={cn(
        'relative flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-center font-semibold transition',
        wide ? 'w-full' : 'flex-1',
        state === 'open' &&
          'border-foreground/15 bg-foreground/[0.03] hover:border-foreground/30 hover:bg-foreground/[0.06] active:scale-[0.97]',
        // Right and missed wear the same green: the answer is the answer
        // whether or not it was the one pressed, and a player who got it wrong
        // is being shown what was true, not marked in red.
        (state === 'right' || state === 'missed') && 'border-emerald-500/50 bg-emerald-500/10',
        state === 'wrong' && 'border-foreground/10 opacity-50',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
      )}
    >
      {children ??
        (numeric ? (
          <span className="text-lg tabular-nums">{label}</span>
        ) : (
          // One line, always. The badge is absolutely positioned in the corner,
          // so the phrase keeps clear of it rather than flowing under it.
          <span className="whitespace-nowrap px-1 text-base font-semibold">{label}</span>
        ))}
      {state === 'right' || state === 'missed' ? (
        <Check className="absolute right-2.5 top-2.5 size-4 text-emerald-500" />
      ) : (
        state === 'open' &&
        shortcut && (
          <span className="absolute right-2 top-2 hidden size-5 place-items-center rounded-md bg-foreground/[0.06] text-[0.65rem] font-medium text-muted-foreground sm:grid">
            {shortcut}
          </span>
        )
      )}
    </button>
  )
}

/**
 * The button that deals the next one. The table's own primary, in the table's
 * own place, so the rhythm of a drill is the rhythm of a hand.
 */
export function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Calm>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClick}
        className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {label}
      </motion.button>
    </Calm>
  )
}

/**
 * The rating, in the bar.
 *
 * Up here rather than over the cards because the felt is for the hand. The
 * delta is the reason it is worth showing at all: a number that only ever
 * appears settled is furniture, and a number you watch move is the thing you
 * came back for.
 */
export function RatingChip({ rating, delta }: { rating: number; delta: number | null }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      {delta !== null && delta !== 0 && (
        <Calm>
          <motion.span
            // Keyed by the value so a second answer worth the same as the first
            // still animates rather than sitting there.
            key={`${rating}-${delta}`}
            initial={{ opacity: 0, y: delta > 0 ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'text-xs font-medium tabular-nums',
              delta > 0 ? 'text-emerald-500' : 'text-muted-foreground',
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </motion.span>
        </Calm>
      )}
      <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums">
        {rating}
      </span>
    </span>
  )
}

/** What the bar says under the kind's name: the facts, in the order they move. */
export function factsLine({
  run,
  bestRun,
  answered,
  correct,
}: {
  run: number
  bestRun: number
  answered: number
  correct: number
}): string | null {
  const facts = [
    run > 1 ? `${run} in a row` : null,
    bestRun > 1 ? `best ${bestRun}` : null,
    answered > 0 ? `${Math.round((correct / answered) * 100)}% of ${answered}` : null,
  ].filter(Boolean)
  return facts.length > 0 ? facts.join(' · ') : null
}

/**
 * The screen before the first spot lands: the shape of a drill, in card backs.
 *
 * One frame on a real device. The placeholders are the sizes of the real cards,
 * so the spot arriving is a deal rather than a jump — the same reason the table
 * draws backs while a hand is being dealt.
 */
export function Dealing({ slots }: { slots: number }) {
  return (
    <Felt
      board={
        <div className="flex items-center justify-center gap-1 sm:gap-2" aria-hidden>
          {Array.from({ length: slots }, (_, i) => (
            <PlayingCard key={i} size="board" />
          ))}
        </div>
      }
      hero={
        <div className="flex gap-1.5" aria-hidden>
          <PlayingCard size="hero" />
          <PlayingCard size="hero" />
        </div>
      }
    />
  )
}

/**
 * What a kind that comes with the membership says to somebody it is not for.
 *
 * **It shows the spot** (Will, 2026-09-21: "we should tease the membership,
 * like side tables does"). This used to be a title and a sentence on an empty
 * screen, which told a reader nothing about what they were being offered — and
 * a locked tile in the room showed card backs for the same reason, on an
 * argument that dealing a real board behind a lock was showing the thing while
 * refusing it. The side tables settled that question the other way on
 * 2026-09-20 and this follows them: you cannot buy what you cannot see, so the
 * felt is dealt, dimmed, with the answers behind the padlock.
 *
 * It stays inside the line the landing page draws. Nothing appears over what
 * anybody was doing, nothing comes back after being dismissed, nothing is
 * styled as a sales button, and you had to open this kind to be here at all.
 * See docs/membership.md.
 */
export function LockedAnswers({ blurb, onJoin }: { blurb: string; onJoin: () => void }) {
  return (
    <button
      type="button"
      onClick={onJoin}
      className="flex w-full items-center gap-3 rounded-2xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3.5 text-left transition hover:border-foreground/30 hover:bg-foreground/[0.06] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Comes with the membership</span>
        <span className="block truncate text-xs text-muted-foreground">{blurb}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">What that is →</span>
    </button>
  )
}
