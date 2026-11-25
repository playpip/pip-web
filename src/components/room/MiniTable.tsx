'use client'

// One slow game as a small table: the venue's room, the oval of cloth, the
// board and pot on it, the other players' faces round the far rail and your
// two cards at the near one. What chess.com's daily boards are to a game of
// chess, drawn as the felt the game is played on.
//
// Everything comes from the card your index keeps (`SlowCard`), which only
// ever holds what you may see.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PlayingCard } from '@/components/PlayingCard'
import { venueImage } from '@/components/menu/VenueArt'
import { ChipStack } from '@/components/table/surface'
import { venueById } from '@/config/venues'
import { opponents, ordinal, timeLeft, type SlowCard } from '@/lib/multiplayer/slowCard'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/**
 * Where the other seats sit round the far rail, by how many there are: all of
 * them above the board, so a name never lands on a card.
 */
const RAIL: Record<number, { left: string; top: string }[]> = {
  1: [{ left: '50%', top: '13%' }],
  2: [
    { left: '30%', top: '15%' },
    { left: '70%', top: '15%' },
  ],
  3: [
    { left: '20%', top: '19%' },
    { left: '50%', top: '12%' },
    { left: '80%', top: '19%' },
  ],
}

/** The time, ticking once a minute: enough for "3h 20m". */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function MiniTable({
  card,
  onOpen,
  className,
}: {
  card: SlowCard
  onOpen: () => void
  className?: string
}) {
  const now = useMinute()
  const money = useMoney()
  const venue = venueById(card.venueId)
  const accent = venue?.accent ?? '#7C8CF0'
  const image = venueImage(card.venueId)
  const others = card.seats.filter((s) => s.id !== card.you)
  const empty = Math.max(0, card.maxSeats - card.seats.length)
  const rail = RAIL[Math.min(3, Math.max(1, others.length + (card.phase === 'lobby' ? empty : 0)))]
  const toAct = card.seats.find((s) => s.id === card.toAct)
  const yourMove = card.yourTurn
  const finished = card.phase === 'finished'
  const lobby = card.phase === 'lobby'
  const unit = Math.max(1, Math.round(card.pot / 40))

  const status = yourMove
    ? card.dueAt !== null
      ? `Your move · ${timeLeft(card.dueAt - now)}`
      : 'Your move'
    : finished
      ? card.place === 1
        ? 'You won'
        : card.place
          ? `You finished ${ordinal(card.place)}`
          : 'Finished'
      : lobby
        ? card.seats.length < card.maxSeats
          ? 'Waiting for players'
          : card.isHost
            ? 'Ready to deal'
            : 'Waiting for the deal'
        : toAct
          ? `${toAct.name} to act`
          : 'Next hand'

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
      animate={{ y: yourMove ? -2 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      aria-label={`${opponents(card)}: ${status}`}
      className={cn(
        'group relative isolate block shrink-0 snap-start overflow-hidden rounded-3xl text-left ring-1 transition-shadow',
        yourMove
          ? 'shadow-2xl shadow-black/50 ring-primary/50'
          : 'shadow-lg shadow-black/30 ring-foreground/10',
        className,
      )}
    >
      {/* The room: the venue's painting, dim and soft, with its light over the table. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-background">
        {image && (
          <img
            src={image}
            alt=""
            decoding="async"
            loading="lazy"
            className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-xl saturate-[1.15]"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 60% at 50% 42%, color-mix(in oklab, ${accent} 22%, transparent), transparent 75%), linear-gradient(to bottom, transparent 55%, color-mix(in oklab, var(--background) 92%, transparent))`,
          }}
        />
      </div>

      <div className={cn('relative aspect-[4/3] w-full', !yourMove && !finished && 'opacity-90')}>
        {/* The oval: rail, then cloth. */}
        <div
          aria-hidden
          className="absolute inset-x-[7%] top-[24%] bottom-[17%] rounded-[50%]"
          style={{
            background:
              'linear-gradient(to bottom, var(--color-table-rail-edge), var(--color-table-rail) 30%, var(--color-table-shade))',
            boxShadow:
              '0 24px 40px -18px var(--color-table-shade), inset 0 1px 0 color-mix(in oklab, var(--foreground) 12%, transparent)',
          }}
        >
          <div
            className="absolute inset-[5px] rounded-[50%]"
            style={{
              background: `radial-gradient(75% 60% at 50% 30%, color-mix(in oklab, color-mix(in oklab, ${accent} 20%, var(--color-table-cloth)) 84%, var(--color-table-line)), color-mix(in oklab, ${accent} 20%, var(--color-table-cloth)) 55%, var(--color-table-shade) 120%)`,
              boxShadow:
                'inset 0 8px 22px color-mix(in oklab, var(--color-table-shade) 65%, transparent)',
            }}
          />
        </div>

        {/* The board and the pot, or the code while it waits for players. */}
        <div className="absolute inset-x-0 top-[51%] flex -translate-y-1/2 flex-col items-center gap-1.5">
          {lobby ? (
            <span className="font-mono text-lg font-semibold tracking-[0.3em] text-foreground/80">
              {card.code}
            </span>
          ) : (
            <>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) =>
                  card.board[i] ? (
                    <PlayingCard key={i} card={card.board[i]} size="xs" className="shadow-md" />
                  ) : (
                    <span
                      key={i}
                      aria-hidden
                      className="h-11 w-8 rounded-[5px] border border-table-line/[0.08] bg-table-shade/20"
                    />
                  ),
                )}
              </div>
              {card.pot > 0 && <ChipStack amount={card.pot} unit={unit} label={money(card.pot)} />}
            </>
          )}
        </div>

        {/* The other players, round the far rail. */}
        {rail.map((pos, i) => {
          const seat = others[i]
          return (
            <div
              key={seat?.id ?? `empty-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={pos}
            >
              {seat ? (
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'rounded-full ring-2 transition',
                      seat.id === card.toAct ? 'ring-primary' : 'ring-table-shade',
                    )}
                  >
                    <PlayerAvatar
                      spec={seat.avatar}
                      size={30}
                      dimmed={seat.folded || (seat.place !== null && !finished)}
                    />
                  </span>
                  <span
                    className={cn(
                      '-mt-1 truncate rounded-full bg-table-shade/80 px-1.5 py-px text-3xs font-medium tabular-nums',
                      rail.length === 3 ? 'max-w-[5rem]' : 'max-w-[6.5rem]',
                    )}
                  >
                    {lobby ? seat.name : `${seat.name} · ${money(seat.stack)}`}
                  </span>
                </div>
              ) : (
                <span
                  aria-hidden
                  className="block size-[30px] rounded-full border-2 border-dashed border-table-line/25"
                />
              )}
            </div>
          )
        })}

        {/* Your two cards, at the near rail. */}
        {card.hole.length > 0 && !finished && (
          <div className="absolute bottom-[5%] left-1/2 flex -translate-x-1/2">
            {card.hole.map((c, i) => (
              <PlayingCard
                key={i}
                card={c}
                size="xs"
                className={cn(
                  'shadow-lg shadow-black/40',
                  i === 0 ? '-rotate-6 translate-x-1' : 'rotate-6 -translate-x-1',
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-3.5 pt-1">
        <span className="min-w-0 truncate text-sm font-semibold">
          {others.length > 0 ? opponents(card) : `${card.moveHours}h a move`}
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums',
            yourMove ? 'text-foreground' : 'text-muted-foreground',
            finished && card.place === 1 && 'text-pip',
          )}
        >
          {yourMove && card.dueAt !== null && (
            <MoveRing left={card.dueAt - now} total={card.moveHours * 60 * 60 * 1000} />
          )}
          {status}
        </span>
      </div>
    </motion.button>
  )
}

const SIZE = 14
const STROKE = 2
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

/** How much of your move's clock is left, as a ring that empties. */
function MoveRing({ left, total }: { left: number; total: number }) {
  const share = Math.max(0, Math.min(1, left / total))
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className="-rotate-90"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-foreground/15"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - share)}
        className={share < 0.15 ? 'stroke-suit-red' : 'stroke-primary'}
      />
    </svg>
  )
}
