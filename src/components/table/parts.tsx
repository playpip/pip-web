'use client'

// The felt's furniture: a seat, the hero's cards, the hero's panel.
//
// **Lifted out of `Table.tsx` so the session review can render the same table
// rather than a drawing of it** (Will, 2026-09-21). Everything here takes the
// engine's own `Player` and `HandState` and nothing else — no store, no
// entitlement, no clock — which is what makes that possible: the review
// reconstructs a `HandState` for any step of a finished hand (see
// `lib/review/handState.ts`) and hands it to these, and what comes out is the
// table, because it is the table.
//
// Two props exist only for the review, and both are additive: `badge`, for the
// chance each seat has of taking it, and `defaultPage`, so the hero's panel can
// open on the odds rather than on the profile. Neither changes what a live
// table draws.

import { createContext, useContext, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { DealtCard, PlayingCard, type CardSize } from '@/components/PlayingCard'
import { evaluateHand } from '@/lib/poker/handEval'
import type { HandState, Player } from '@/lib/poker/engine'
import { nicknameFor } from '@/config/handNames'
import { dealerButtonById, type AvatarRing, type DealerButton } from '@/config/cosmetics'
import type { AvatarSpec } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/**
 * The player's own furniture — the ring on their avatar and the dealer button
 * on the table.
 *
 * **A context rather than props, and rather than a store read.** The rule at
 * the top of this file is that nothing here reaches for state, which is what
 * lets the review render the real table instead of a drawing of it; a
 * `useProfile` call in `Seat` would falsify that sentence for a cosmetic.
 * Threading two props instead would have touched eight call sites across two
 * screens, and a ninth added later would silently draw the house's button.
 *
 * So it is one value, provided once per screen by whoever already knows the
 * profile (`Table` and `ReviewTable`), with a default that is exactly what a
 * player who has bought nothing sees. Anything that renders these parts without
 * a provider — a test, a future screen — gets the free furniture and is right.
 */
export interface TableStyle {
  /** The player's own avatar ring, or nothing. Never worn by the cast. */
  ring?: AvatarRing
  /** The dealer button in play. Always one; the house's is free. */
  button: DealerButton
}

export const TableStyleContext = createContext<TableStyle>({
  button: dealerButtonById(undefined),
})

export function Seat({
  player,
  name,
  avatarSpec,
  isDealer,
  isActive,
  isThinking,
  reveal,
  cardsSide,
  onSelect,
  layout = 'arc',
  badge,
}: {
  player: Player
  name: string
  avatarSpec: AvatarSpec
  isDealer: boolean
  isActive: boolean
  isThinking: boolean
  reveal: boolean
  cardsSide: 'left' | 'right'
  onSelect: () => void
  layout?: 'arc' | 'row'
  /** Review only: their chance of taking it from here. Absent at a live table. */
  badge?: React.ReactNode
}) {
  const folded = player.status === 'folded'
  const money = useMoney()
  const button = useContext(TableStyleContext).button
  const row = layout === 'row'
  const avatarSize = row ? 48 : 52
  const dealerSide = row ? '-right-1' : cardsSide === 'right' ? '-left-1' : '-right-1'

  return (
    <div className={cn('flex flex-col items-center', row ? 'w-16 gap-0.5' : 'w-20 gap-1')}>
      <div className="relative">
        <motion.button
          onClick={onSelect}
          aria-label={`About ${name}`}
          animate={isActive ? { scale: 1.08 } : { scale: 1 }}
          className={cn(
            'rounded-full transition hover:brightness-110',
            isActive && 'ring-2 ring-foreground/80',
          )}
        >
          <PlayerAvatar spec={avatarSpec} size={avatarSize} dimmed={folded} />
        </motion.button>
        {isDealer && !folded && (
          <span
            className={cn(
              'absolute -top-1 flex size-4 items-center justify-center rounded-full text-[0.5625rem] font-bold',
              dealerSide,
            )}
            // The disc's own colours, from whichever button is in play. The
            // house's are the two theme tokens this used to hardcode, so a
            // player who has bought nothing sees exactly what they did before.
            style={{
              background: button.face,
              color: button.ink,
              boxShadow: button.edge ? `inset 0 0 0 1px ${button.edge}` : undefined,
            }}
          >
            D
          </span>
        )}
        {isThinking && (
          <span className="absolute -top-2.5 left-1/2 size-3 -translate-x-1/2">
            <span className="absolute inset-0 animate-ping rounded-full bg-pip/70" />
            <span className="absolute inset-0 rounded-full bg-pip ring-2 ring-background" />
          </span>
        )}

        {/* The review's chance-to-win badge, worn on the chin rather than hung
            under the stack.
            **It used to be a reserved row at the foot of the seat, and that row
            is what made the seats collide with the board on a short window**
            (Will, 2026-09-21). Both screens lay the felt out the same way —
            seats on an arc whose lowest point is 56% of the height, the board
            absolutely placed at 62% — so a seat that is eighteen pixels taller
            than the live table's reaches into the cards, and the badge, being
            last, is what disappears under them.
            Anchored to the avatar it costs no height at all, so the review's
            seat is exactly the live table's seat again, and nothing shifts when
            a badge appears or goes: the reserved slot existed to stop that
            shift and an absolute badge cannot cause one. */}
        {badge !== undefined && (
          <span className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2">{badge}</span>
        )}
        <AnimatePresence>
          {folded && (
            <motion.div
              initial={{ opacity: 0, scale: 1.9, rotate: -18 }}
              animate={{ opacity: 1, scale: 1, rotate: -9 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground backdrop-blur-[1px]">
                fold
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* arc: revealed cards fanned beside the avatar */}
        {!row && reveal && player.hole.length >= 2 && (
          <div
            className={cn(
              'absolute top-1/2 flex -translate-y-1/2 -space-x-1.5',
              cardsSide === 'right' ? 'left-[42px]' : 'right-[42px] flex-row-reverse',
              // A folded seat dims, and its cards go grey with it. They stay on
              // the table for the review — half of what a hand teaches is what
              // the player who got out was holding — but they are no longer
              // live and must not read as though they are.
              //
              // **Filters, not opacity.** A card at 40% is see-through, and
              // these sit on top of the avatar: you could read the face through
              // the face (Will, 2026-09-21). Greyscale drains the suit colour,
              // and a light touch of brightness takes the shine off — enough to
              // read as "out of the hand" without turning the card to slate.
              folded && 'grayscale brightness-95 contrast-90',
            )}
          >
            {player.hole.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.7, x: cardsSide === 'right' ? -18 : 18 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: i === 0 ? -7 : 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18, delay: 0.14 + i * 0.1 }}
              >
                <PlayingCard card={card} size="xs" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <span
        className={cn(
          'max-w-full truncate',
          row ? 'text-2xs' : 'text-xs',
          folded ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          row ? 'text-xs' : 'text-sm',
          folded && 'text-muted-foreground/50',
        )}
      >
        {money(player.stack)}
      </span>
      {/* Reserve the bet-chip slot always, so a bet appearing/clearing never
          changes the seat's height (which would nudge the board via the
          justify-evenly column on mobile). */}
      <span className="flex h-[18px] items-center justify-center">
        {player.committedThisStreet > 0 && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
            {money(player.committedThisStreet)}
          </span>
        )}
      </span>

      {/* row: revealed cards below the seat */}
      {row && reveal && player.hole.length >= 2 && (
        <div className={cn('mt-0.5 flex gap-0.5', folded && 'grayscale brightness-95 contrast-90')}>
          {player.hole.map((card, i) => (
            <PlayingCard key={i} card={card} size="xs" />
          ))}
        </div>
      )}
    </div>
  )
}

// --- hero bits --------------------------------------------------------------

export function HeroCards({
  hero,
  hand,
  size,
  fanned = false,
  discarding,
  marked,
  onToggle,
}: {
  hero: Player
  hand: HandState
  size: CardSize
  fanned?: boolean
  /** Five-Card Draw's discard round: the cards become buttons. */
  discarding?: boolean
  marked?: readonly number[]
  onToggle?: (index: number) => void
}) {
  const folded = hero.status === 'folded'
  const nickname = nicknameFor(hero.hole)
  return (
    <div className={cn('flex flex-col items-center gap-1.5', folded && 'opacity-40')}>
      {/* Not fanned while you are choosing: overlapping cards are lovely to
          look at and impossible to tap one of. */}
      <div className={cn('flex items-end', fanned && !discarding ? '-space-x-6' : 'gap-2')}>
        {hero.hole.map((card, i) => {
          const isMarked = discarding && marked?.includes(i)
          // Key by the card so a new deal re-mounts and replays the animation.
          const dealt = (
            <DealtCard
              key={`${card.rank}${card.suit}`}
              index={i}
              card={card}
              size={size}
              className={cn(
                fanned && !discarding && (i === 0 ? '-rotate-3' : 'translate-y-1 rotate-2'),
                // A dimmed (opacity-40) rounded card with a drop shadow renders a
                // bright halo along its bottom edge on iOS Safari — the shadow
                // inverts under fractional opacity. Folded cards don't need a
                // shadow anyway, so drop it and the artifact goes with it.
                folded && 'shadow-none dark:shadow-none',
                // Marked cards drop and fade: the gesture is "push it away",
                // and it has to read at a glance across five of them.
                isMarked && 'translate-y-3 opacity-40 saturate-50',
              )}
            />
          )
          if (!discarding) return dealt
          return (
            <button
              key={`${card.rank}${card.suit}`}
              type="button"
              onClick={() => onToggle?.(i)}
              aria-pressed={Boolean(isMarked)}
              aria-label={`${isMarked ? 'Keep' : 'Throw away'} the ${card.rank}${card.suit}`}
              className="rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
            >
              {dealt}
            </button>
          )
        })}
        <span className="sr-only">{hand.street}</span>
      </div>
      {nickname && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xs text-muted-foreground/70"
        >
          {nickname}
        </motion.span>
      )}
    </div>
  )
}

function useHandLabel(hero: Player, hand: HandState) {
  return useMemo(() => {
    if (hero.hole.length < 2) return null
    if (hero.hole.length + hand.community.length < 5) return nicknameFor(hero.hole) ?? 'Hole cards'
    try {
      // **The variant is not optional here.** Without it an Omaha hand is read
      // free-form, so four hearts in your hand and one on the board would put
      // "Flush" under your cards — a wrong claim, at the table, that the player
      // would act on. `nicknameFor` needs no such care: it returns null for
      // anything that is not exactly two cards.
      return evaluateHand(hero.hole, hand.community, hand.variant).name
    } catch {
      return null
    }
  }, [hero.hole, hand.community, hand.variant])
}

/** Mobile hero panel — swipe or tap the dots to flip between profile and odds. */
export function HeroPanel({
  hero,
  avatar,
  hand,
  equity,
  isButton,
  isActive,
  defaultPage = 0,
  oddsLabel = 'win',
}: {
  hero: Player
  avatar: AvatarSpec
  hand: HandState
  equity: number | null
  isButton: boolean
  isActive: boolean
  /** Review only: open on the odds instead of the profile. */
  defaultPage?: 0 | 1
  /** Review only: the words under the number. Carries the "≈", if there is one. */
  oddsLabel?: string
}) {
  const money = useMoney()
  const label = useHandLabel(hero, hand)
  const folded = hero.status === 'folded'
  // The one avatar in the app that is the player's own, so the one that wears
  // the ring. Every other face at the table belongs to somebody in the cast.
  const { ring, button } = useContext(TableStyleContext)
  const [page, setPage] = useState(defaultPage)

  return (
    <div className="relative flex min-h-[90px] min-w-0 flex-1 basis-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.04]">
      <motion.div
        className="flex size-full items-center justify-center pb-3"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -28) setPage(1)
          else if (info.offset.x > 28) setPage(0)
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {page === 0 ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center gap-0.5"
            >
              <div className="relative">
                <div className={cn('rounded-full', isActive && 'ring-2 ring-foreground/80')}>
                  <PlayerAvatar spec={avatar} size={36} dimmed={folded} ring={ring} />
                </div>
                {isButton && (
                  <span
                    className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[0.5625rem] font-bold"
                    style={{
                      background: button.face,
                      color: button.ink,
                      boxShadow: button.edge ? `inset 0 0 0 1px ${button.edge}` : undefined,
                    }}
                  >
                    D
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums">{money(hero.stack)}</span>
              {hero.committedThisStreet > 0 && (
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
                  {money(hero.committedThisStreet)}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="odds"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center"
            >
              <span className="text-2xs text-muted-foreground">{label ?? '—'}</span>
              {/* **Nothing shares this line with the number.** The panel is a
                  third of a phone's width, and an "about" mark beside a
                  two-digit percentage squeezed both against the edges. The
                  qualifier lives in the label underneath instead, where there
                  is room for it. */}
              <span className="whitespace-nowrap text-2xl font-semibold tabular-nums">
                {equity !== null ? `${Math.round(equity * 100)}%` : '—'}
              </span>
              <span className="whitespace-nowrap px-1 text-3xs uppercase tracking-wider text-muted-foreground">
                {oddsLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="absolute bottom-1.5 flex gap-1.5">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            aria-label={i === 0 ? 'Show profile' : 'Show odds'}
            className={cn(
              'size-1.5 rounded-full transition',
              page === i ? 'bg-foreground/70' : 'bg-foreground/25',
            )}
          />
        ))}
      </div>
    </div>
  )
}
