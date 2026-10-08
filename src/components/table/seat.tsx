'use client'

// A seat on the live table's rail.
//
// **The live table's own, not `Seat` from ./parts.** That one is drawn for the
// review's and the lessons' arc, and both screens are tuned to its size. This
// is the same information with more presence, sat on the rail of a drawn table:
// a bigger face, a nameplate on the cloth, the cards they are holding tucked
// behind them, what they last did, and a ring that travels round whoever is to
// act. Like everything in ./parts it reads no store: what it shows is handed in.

import { useContext } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PlayingCard } from '@/components/PlayingCard'
import type { CardBackDesign } from '@/config/cardBacks'
import type { Player } from '@/lib/poker/engine'
import type { AvatarSpec } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { TableStyleContext } from './parts'

/** What a seat last did this street, as the table says it. */
export type SeatAction = 'Fold' | 'Check' | 'Call' | 'Bet' | 'Raise' | 'All in'

export function FeltSeat({
  player,
  name,
  avatarSpec,
  isDealer,
  isActive,
  reveal,
  action,
  back,
  compact,
  side,
  onSelect,
}: {
  player: Player
  name: string
  avatarSpec: AvatarSpec
  isDealer: boolean
  isActive: boolean
  reveal: boolean
  action?: SeatAction
  back: CardBackDesign
  compact: boolean
  /** Which half of the table the seat is on: its cards tuck toward the middle. */
  side: 'left' | 'right' | 'top'
  onSelect: () => void
}) {
  const money = useMoney()
  const button = useContext(TableStyleContext).button
  const folded = player.status === 'folded'
  const out = player.status === 'out'
  const holding = !folded && !out && player.hole.length > 0
  const size = compact ? 46 : 64
  const towardMiddle = side === 'right' ? 'left' : 'right'

  return (
    // The box is the avatar, so the caller's point is the centre of the face.
    <div className="relative" style={{ width: size, height: size }}>
      {/* Their cards, face down, tucked behind the face toward the table. */}
      {holding && !reveal && (
        <div
          aria-hidden
          className={cn(
            'absolute top-[-6%] flex',
            towardMiddle === 'right' ? 'left-[52%]' : 'right-[52%] flex-row-reverse',
          )}
        >
          {player.hole.slice(0, 4).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10, scale: 0.6 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                rotate: (towardMiddle === 'right' ? 1 : -1) * (8 + i * 9),
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 + i * 0.08 }}
              className={cn(i > 0 && (towardMiddle === 'right' ? '-ml-4' : '-mr-4'))}
              style={{ transformOrigin: 'bottom center' }}
            >
              <CardBack
                design={back}
                size="xs"
                className={cn('rounded-[5px]', compact ? 'h-8 w-6' : 'h-11 w-8')}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* The turn ring: a faint track with a bright arc travelling round it. */}
      {isActive && (
        <span
          aria-hidden
          className="absolute -inset-[5px] overflow-hidden rounded-full bg-foreground/15 shadow-[0_0_28px_-2px_color-mix(in_oklab,var(--foreground)_35%,transparent)]"
        >
          <span className="seat-turn absolute inset-0" />
        </span>
      )}

      <motion.button
        type="button"
        onClick={onSelect}
        aria-label={`About ${name}`}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'relative block rounded-full shadow-lg shadow-table-shade/70 ring-2 ring-table-shade transition-[filter] hover:brightness-110',
          (folded || out) && 'opacity-55',
        )}
      >
        <PlayerAvatar spec={avatarSpec} size={size} dimmed={folded || out} />
      </motion.button>

      {isDealer && !out && (
        <span
          className={cn(
            'absolute top-[78%] z-10 flex size-5 items-center justify-center rounded-full text-3xs font-bold shadow-md shadow-table-shade/60',
            towardMiddle === 'right'
              ? compact
                ? '-right-5'
                : '-right-7'
              : compact
                ? '-left-5'
                : '-left-7',
          )}
          style={{
            background: button.face,
            color: button.ink,
            boxShadow: button.edge ? `inset 0 0 0 1px ${button.edge}` : undefined,
          }}
        >
          D
        </span>
      )}

      {/* What they did. Pops on, sits there until the street moves on. Over
          the face, except at the head of the table, where over the face is
          under the bar on a short desktop window: there it sits beside the face,
          opposite the cards. (A phone's stage starts lower, and beside the face
          would land on the neighbour's label.) */}
      <div
        className={cn(
          'pointer-events-none absolute',
          side === 'top' && !compact
            ? 'right-full top-1/2 mr-2 -translate-y-1/2'
            : 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
        )}
      >
        <AnimatePresence mode="popLayout">
          {action && (
            <motion.span
              key={action}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              className={cn(
                'block whitespace-nowrap rounded-full px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider shadow-md shadow-table-shade/50',
                action === 'Bet' || action === 'Raise' || action === 'All in'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-table-shade/80 text-foreground/85',
              )}
            >
              {action}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Showdown: their hand, turned over where the backs were, so the
          nameplate (and the stack on it) stays readable. */}
      {reveal && player.hole.length >= 2 && (
        <div
          className={cn(
            'pointer-events-none absolute top-[-12%] z-10 flex',
            towardMiddle === 'right' ? 'left-[55%]' : 'right-[55%] flex-row-reverse',
            folded && 'grayscale brightness-95 contrast-90',
          )}
        >
          {player.hole.map((card, i) => (
            <motion.div
              key={`${card.rank}${card.suit}`}
              initial={{ opacity: 0, y: 10, scale: 0.7 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                rotate: (towardMiddle === 'right' ? 1 : -1) * (4 + i * 6),
              }}
              transition={{ type: 'spring', stiffness: 340, damping: 20, delay: 0.1 + i * 0.08 }}
              className={cn(i > 0 && (towardMiddle === 'right' ? '-ml-3' : '-mr-3'))}
              style={{ transformOrigin: 'bottom center' }}
            >
              <PlayingCard card={card} size={compact ? 'xs' : 'sm'} className="shadow-lg" />
            </motion.div>
          ))}
        </div>
      )}

      {/* The nameplate, on the cloth under the face. */}
      <div
        className={cn(
          'absolute left-1/2 top-full -mt-2 flex -translate-x-1/2 flex-col items-center rounded-xl bg-table-shade/75 shadow-lg shadow-table-shade/40 ring-1 ring-foreground/10',
          compact ? 'min-w-[3.75rem] px-2 py-0.5' : 'min-w-[5.5rem] px-3 py-1',
          (folded || out) && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'max-w-[6.5rem] truncate leading-tight text-muted-foreground',
            compact ? 'text-3xs' : 'text-xs',
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            'font-semibold leading-tight tabular-nums',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {out
            ? 'Out'
            : player.stack === 0 && player.status === 'allin'
              ? 'All in'
              : money(player.stack)}
        </span>
      </div>
    </div>
  )
}
