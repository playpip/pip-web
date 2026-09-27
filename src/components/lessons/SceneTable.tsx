'use client'

import { useMemo } from 'react'
import { MotionConfig } from 'framer-motion'
import { Check } from 'lucide-react'
import { CountUp } from '@/components/CountUp'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { HeroCards, Seat, TableStyleContext } from '@/components/table/parts'
import { avatarRingById, dealerButtonById } from '@/config/cosmetics'
import { type SeatId, seatById } from '@/config/positions'
import type { AvatarSpec } from '@/lib/avatar'
import { type HandState, potSize } from '@/lib/poker/engine'
import { opponentPositions } from '@/lib/tableSeats'
import { useIsMobile, useMediaQuery } from '@/lib/useMediaQuery'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'

/**
 * The table, as a lesson or a practice pack deals it.
 *
 * **It is the table's furniture, not a drawing of it** — the same move the
 * session review made (see `components/review/ReviewTable.tsx`). The state is a
 * real `HandState` the engine dealt and played (lib/lessons/scene.ts), and the
 * seats, the dealer button, the fold stamps, the chips in front and your cards
 * are `Seat` and `HeroCards` from `components/table/parts`, worn with your own
 * ring and dealer button. The opponents sit on the live table's arc on a
 * desktop and in its row on a phone.
 *
 * What it adds is only what teaching needs, and all of it is additive: a
 * position badge on each seat when the beat is about the seats, a seat you can
 * tap when the answer is a seat, and the line where the table's talk goes.
 */

/** Who is in a seat that is not yours. */
export interface SeatFace {
  name: string
  avatar: AvatarSpec
}

/** A finished hand with the chips collected, for drawing. See the note in SceneTable. */
function swept(state: HandState): HandState {
  if (state.street !== 'complete') return state
  return { ...state, players: state.players.map((p) => ({ ...p, committedThisStreet: 0 })) }
}

/** The neutral face for a player with no avatar yet. */
const FALLBACK_AVATAR: AvatarSpec = { seed: 'pip', backgroundColor: 'e5e7eb' }

export function SceneTable({
  state: dealt,
  faces,
  labels = false,
  speaking = null,
  talk,
  pickable = false,
  onPick,
  marked = null,
  revealed = [],
  dim = false,
}: {
  state: HandState
  /** Every seat but yours. */
  faces: Partial<Record<SeatId, SeatFace>>
  /** Show every seat's position. */
  labels?: boolean
  /** Whose turn it is to speak or act: their avatar wears the table's ring. */
  speaking?: SeatId | null
  /** What is said, under the board. */
  talk: React.ReactNode
  /** The seats are the answer: tapping one picks it. */
  pickable?: boolean
  onPick?: (seat: SeatId) => void
  /** A seat to mark as the answer, once there is one. */
  marked?: SeatId | null
  /** Seats playing face up, whose cards are shown the way a showdown shows them. */
  revealed?: readonly SeatId[]
  dim?: boolean
}) {
  const isMobile = useIsMobile()
  // **Compact is narrow *or* short.** The arc needs about 26rem of height to
  // keep the top seats clear of the board, and a lesson stacks Webb's talk and
  // your seat under it; on a laptop-height window (720–860px) there is no such
  // room and the hero zone ran under the answer bar (Will, 2026-09-24). The
  // phone layout — seats in a row, board, pot, talk — fits any height, so a
  // short window gets it too, held to a readable width. Your own seat still
  // follows width alone, like the live table's: on a wide screen the square
  // cards beside a fixed plate are no taller than the phone's half-and-half.
  const compact = useMediaQuery('(max-width: 820px), (max-height: 860px)')
  // **A short desktop window gets the drill's card size.** At 1280×720 the
  // phone column (seats, board, pot, talk) plus full-size cards and the
  // two-row answer grid came to more than the window, and the column spilled:
  // seats into the progress bar, words over your cards (2026-09-24). A notch
  // smaller on the board and in your hand is the cheapest room there is, and a
  // phone, which fits already, keeps its vw-sized cards.
  const shortDesk = compact && !isMobile
  const cardSize = shortDesk ? 'drill' : 'board'
  const money = useMoney()
  const avatar = useProfile((s) => s.avatar) ?? FALLBACK_AVATAR
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const dealerButton = dealerButtonById(useProfile((s) => s.dealerButton))
  const tableStyle = useMemo(() => ({ ring, button: dealerButton }), [ring, dealerButton])

  // Once a hand is over the engine has paid the pot into the winner's stack
  // but leaves each street's chips recorded in front of the seats. Drawn as it
  // stands, the winner would show the pot twice — in the stack and in front —
  // so a finished hand is drawn swept: nothing in front, nothing in the middle.
  const state = useMemo(() => swept(dealt), [dealt])
  const hero = state.players[0]
  const heroSeat = hero.id as SeatId
  const opponents = state.players.slice(1)
  const positions = opponentPositions(opponents.length)
  const buttonId = state.players[state.buttonIndex]?.id
  const pot = state.street === 'complete' ? 0 : potSize(state)

  const badge = (seat: SeatId) => {
    const isMarked = marked === seat
    if (!labels && !isMarked) return undefined
    return (
      <span
        className={cn(
          'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-3xs font-semibold tracking-wide shadow-sm ring-1',
          isMarked
            ? 'bg-emerald-500 text-background ring-emerald-500'
            : 'bg-background text-foreground ring-foreground/15',
        )}
      >
        {isMarked && <Check className="size-2.5" />}
        {seatById(seat).short}
      </span>
    )
  }

  const seat = (p: HandState['players'][number], layout: 'row' | 'arc', side: 'left' | 'right') => {
    const id = p.id as SeatId
    const face = faces[id] ?? { name: seatById(id).name, avatar: FALLBACK_AVATAR }
    return (
      <Seat
        layout={layout}
        player={p}
        name={face.name}
        avatarSpec={face.avatar}
        isDealer={buttonId === p.id}
        isActive={speaking === id}
        isThinking={false}
        reveal={revealed.includes(id) && p.status !== 'folded'}
        cardsSide={side}
        onSelect={() => pickable && onPick?.(id)}
        badge={badge(id)}
      />
    )
  }

  const board = (
    <div className="flex items-center justify-center gap-1 sm:gap-2 lg:gap-2.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const card = state.community[i]
        return card ? (
          <DealtCard key={`${card.rank}${card.suit}`} index={i} card={card} size={cardSize} />
        ) : (
          <PlayingCard key={`slot-${i}`} size={cardSize} />
        )
      })}
    </div>
  )

  const potLine = (
    <div className="flex shrink-0 items-baseline gap-2">
      <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Pot</span>
      <CountUp
        value={pot}
        format={money}
        className={cn('font-semibold tabular-nums', isMobile ? 'text-xl' : 'text-2xl')}
      />
    </div>
  )

  return (
    <MotionConfig reducedMotion="user">
      <TableStyleContext.Provider value={tableStyle}>
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col transition-opacity',
            dim && 'opacity-45',
          )}
        >
          {compact ? (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-evenly gap-2 px-2 pb-1">
              <div className="flex items-start justify-evenly">
                {opponents.map((p) => (
                  <div key={p.id}>{seat(p, 'row', 'right')}</div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {board}
                <div className="flex justify-center">{potLine}</div>
              </div>
              {/* The talk gives way before anything else does. A long answer
                  and its aside on a laptop-height window used to be taller than
                  the room left for it, and the column, centred, spilled both
                  ways: seats up into the progress bar, words down over your
                  cards. Now it keeps its floor and scrolls past it. */}
              <div className="min-h-[4.5rem] overflow-y-auto overscroll-contain">{talk}</div>
            </div>
          ) : (
            // The arc holds the board and the pot and nothing else, at the live
            // table's own height (top-[62%], Table.tsx). Webb's talk used to be
            // in the same centred block, and a three-line speech made it tall
            // enough that centring it pushed the board up into the top seat on
            // a short window (Will, 2026-09-24). It sits under the arc now, in
            // the flow, where no length of speech can reach a seat.
            <>
              <div className="relative min-h-[22rem] flex-1">
                {opponents.map((p, i) => (
                  <div
                    key={p.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={positions[i]}
                  >
                    {seat(p, 'arc', Number.parseFloat(positions[i].left) > 50 ? 'left' : 'right')}
                  </div>
                ))}
                <div className="absolute left-1/2 top-[62%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4">
                  {board}
                  {potLine}
                </div>
              </div>
              <div className="mx-auto min-h-[6.5rem] w-full max-w-xl px-6 pb-2">{talk}</div>
            </>
          )}

          {/* You: your cards and your plate, laid out exactly as the live table
              lays out its hero zone (components/table/Table.tsx), because this
              is meant to be that table. On a phone the two split the row in
              half, cards fanned; on a desktop the cards sit square at board
              size beside a fixed-width plate. The first version fanned the
              board-size cards beside a plate of no fixed width, and the second
              card landed on top of it (Will, 2026-09-24). */}
          {isMobile ? (
            <div className="z-10 flex w-full items-stretch gap-3 px-3 pt-3 pb-3">
              <div className="flex flex-1 basis-0 items-end justify-start pl-2">
                <HeroCards hero={hero} hand={state} size="hero" fanned />
              </div>
              <div className="flex flex-1 basis-0">
                <HeroPlate
                  avatar={avatar}
                  stack={money(hero.stack)}
                  chips={hero.committedThisStreet > 0 ? money(hero.committedThisStreet) : null}
                  isButton={buttonId === hero.id}
                  folded={hero.status === 'folded'}
                  badge={badge(heroSeat)}
                  active={speaking === heroSeat}
                  pickable={pickable}
                  onPick={() => onPick?.(heroSeat)}
                />
              </div>
            </div>
          ) : (
            <div
              className={cn('z-10 flex flex-col items-center px-6', shortDesk ? 'pb-3' : 'pb-6')}
            >
              <div className="flex items-stretch gap-6">
                <HeroCards hero={hero} hand={state} size={cardSize} />
                <div className="flex w-44">
                  <HeroPlate
                    avatar={avatar}
                    stack={money(hero.stack)}
                    chips={hero.committedThisStreet > 0 ? money(hero.committedThisStreet) : null}
                    isButton={buttonId === hero.id}
                    folded={hero.status === 'folded'}
                    badge={badge(heroSeat)}
                    active={speaking === heroSeat}
                    pickable={pickable}
                    onPick={() => onPick?.(heroSeat)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </TableStyleContext.Provider>
    </MotionConfig>
  )
}

/**
 * Your seat's plate: your face with your ring, the dealer button when it is
 * yours, your stack and your chips in front. The live table's hero panel pages
 * between this and the odds; a lesson has no odds to show, so it is the one page.
 */
function HeroPlate({
  avatar,
  stack,
  chips,
  isButton,
  folded,
  badge,
  active,
  pickable,
  onPick,
}: {
  avatar: AvatarSpec
  stack: string
  chips: string | null
  isButton: boolean
  folded: boolean
  badge?: React.ReactNode
  active: boolean
  pickable: boolean
  onPick: () => void
}) {
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const button = dealerButtonById(useProfile((s) => s.dealerButton))
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!pickable}
      aria-label="Your seat"
      className={cn(
        // The live table's HeroPanel sizing: it fills whatever the row gives it.
        'relative flex min-h-[90px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-foreground/[0.04] px-4 py-2.5 transition',
        pickable && 'hover:bg-foreground/[0.08] active:scale-[0.97]',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
      )}
    >
      <span className="relative">
        <span className={cn('block rounded-full', active && 'ring-2 ring-foreground/80')}>
          <PlayerAvatar spec={avatar} size={36} dimmed={folded} ring={ring} />
        </span>
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
        {badge && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">{badge}</span>}
      </span>
      <span className="mt-1 text-2xs text-muted-foreground">You</span>
      <span className="text-xs font-semibold tabular-nums">{stack}</span>
      <span className="flex h-[18px] items-center">
        {chips && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
            {chips}
          </span>
        )}
      </span>
    </button>
  )
}
