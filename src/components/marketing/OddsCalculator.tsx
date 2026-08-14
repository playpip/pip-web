'use client'

import { useEffect, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import {
  type Card,
  type Rank,
  type Suit,
  RANKS,
  SUITS,
  SUIT_GLYPH,
  cardName,
  cardToString,
  isRed,
} from '@/lib/poker/cards'
import {
  MAX_OPPONENTS,
  type OddsInput,
  type OddsQuote,
  createOddsRunner,
  formatBand,
  formatQuoted,
} from '@/lib/poker/oddsQuote'
import { cn } from '@/lib/utils'

/**
 * The odds calculator itself. Pick two cards, add a board if there is one, say
 * how many people you are against.
 *
 * Every incumbent for this query does the picking with a pair of dropdowns,
 * which on a phone is the whole product and they get it wrong. This picks a
 * rank and then a suit: two taps, both of them a real target, and it fits on
 * the narrowest screen we support without a scroll.
 *
 * There is no mode and nothing to aim: a card goes in the first empty slot,
 * hole cards before the board. Tap a card you have already placed to take it
 * back out. Nothing is scored, nothing is generated and nothing is remembered
 * between visits, which is the line that keeps the free things free.
 *
 * All the arithmetic, and every claim the readout makes about it, is in
 * lib/poker/oddsQuote.ts and pinned by tests/oddsQuote.test.ts.
 */

/**
 * How long a sampled run may take before it settles for what it has.
 *
 * A slow phone runs out of time rather than out of target, and the answer it
 * stops at is honest: the band it prints is computed from the showdowns it
 * actually managed, so a slower device says a vaguer thing rather than a wrong
 * one. Four seconds of blocked main thread is a hang; four seconds of a number
 * visibly tightening is a calculator working.
 */
const TIME_BUDGET_MS = 6_000

/** Milliseconds between repaints while a run refines. */
const PAINT_EVERY_MS = 250

interface RunState {
  /** The spot this result belongs to, by identity. See `current` below. */
  input: OddsInput
  quote: OddsQuote | null
  progress: number
  settled: boolean
}

export function OddsCalculator() {
  const [hole, setHole] = useState<Card[]>([])
  const [board, setBoard] = useState<Card[]>([])
  const [opponents, setOpponents] = useState(1)
  const [rank, setRank] = useState<Rank | null>(null)
  const [run, setRun] = useState<RunState | null>(null)

  const chosen = useMemo(() => [...hole, ...board], [hole, board])
  const used = useMemo(() => new Set(chosen.map(cardToString)), [chosen])

  // A board is nothing, a flop, a turn or a river. One or two cards is a
  // half-dealt board, not a spot, so it gets a nudge rather than a number.
  const boardReady = board.length === 0 || board.length >= 3
  const ready = hole.length === 2 && boardReady

  const input = useMemo<OddsInput | null>(
    () => (ready ? { hole, community: board, opponents } : null),
    [ready, hole, board, opponents],
  )

  // Results are matched to the spot they were computed for by object identity
  // rather than cleared when the spot changes. Clearing would mean a setState
  // in an effect (the React 19 rule in docs/development.md); this way a stale
  // answer simply stops being current the moment a card moves.
  const current = run && run.input === input ? run : null

  useEffect(() => {
    if (!input) return

    const runner = createOddsRunner(input)
    const startedAt = performance.now()
    let cancelled = false
    let timer = 0
    let slice = 200
    let lastPaint = -PAINT_EVERY_MS

    const pump = () => {
      if (cancelled) return
      const before = performance.now()
      runner.step(slice)
      const spent = performance.now() - before
      // Aim at ~30ms of work per slice so a tap is never more than a frame or
      // two away, whatever the device turns out to be. The slicing is measured
      // rather than assumed, and it cannot change the answer: see the
      // chopping-into-slices test.
      slice = Math.max(40, Math.min(4_000, Math.round((slice * 30) / Math.max(spent, 1))))

      const elapsed = performance.now() - startedAt
      const settled = runner.finished || (!runner.exact && elapsed > TIME_BUDGET_MS)
      if (settled || elapsed - lastPaint >= PAINT_EVERY_MS) {
        lastPaint = elapsed
        setRun({ input, quote: runner.quote, progress: runner.done / runner.total, settled })
      }
      if (!settled) timer = window.setTimeout(pump, 0)
    }

    // Asynchronous by construction: the first slice runs in a timer, not in
    // the effect body, so nothing here sets state synchronously.
    timer = window.setTimeout(pump, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [input])

  const place = (card: Card) => {
    setRank(null)
    if (hole.length < 2) setHole([...hole, card])
    else if (board.length < 5) setBoard([...board, card])
  }

  const clearAll = () => {
    setHole([])
    setBoard([])
    setRank(null)
  }

  // Where the next card lands, so the slot can say so before it is tapped.
  const nextSlot: 'hole' | 'board' | null =
    hole.length < 2 ? 'hole' : board.length < 5 ? 'board' : null

  return (
    <section
      // Interactive: the Markdown mirror gets the prose under it, which says
      // what this does. Rendered into a mirror it would arrive as a column of
      // loose card glyphs. scripts/gen-llms.mjs drops anything marked this way.
      data-mirror="skip"
      className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <Slots
        label="Your cards"
        cards={hole}
        capacity={2}
        active={nextSlot === 'hole'}
        onRemove={(i) => setHole(hole.filter((_, at) => at !== i))}
      />

      <div className="mt-6">
        <Slots
          label="The board"
          hint="Leave it empty for preflop"
          cards={board}
          capacity={5}
          active={nextSlot === 'board'}
          onRemove={(i) => setBoard(board.filter((_, at) => at !== i))}
        />
      </div>

      <div className="mt-6">
        <Picker rank={rank} used={used} full={nextSlot === null} onRank={setRank} onCard={place} />
      </div>

      <div className="mt-6">
        <FieldLabel>Opponents</FieldLabel>
        <div className="mt-2 grid grid-cols-8 gap-1.5">
          {Array.from({ length: MAX_OPPONENTS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOpponents(n)}
              aria-pressed={opponents === n}
              className={cn(
                'rounded-lg border py-2 text-sm font-medium transition',
                opponents === n
                  ? 'border-foreground/25 bg-foreground/[0.08] text-foreground'
                  : 'border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-foreground/10 pt-5">
        <Readout ready={ready} hole={hole} board={board} run={current} />
      </div>

      {chosen.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Start again
        </button>
      )}
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/** A row of card slots: the ones that are filled, then the empty ones. */
function Slots({
  label,
  hint,
  cards,
  capacity,
  active,
  onRemove,
}: {
  label: string
  hint?: string
  cards: Card[]
  capacity: number
  /** True when the next card picked lands in this row. */
  active: boolean
  onRemove: (index: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <FieldLabel>{label}</FieldLabel>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cards.map((card, i) => (
          <button
            key={cardToString(card)}
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove the ${cardName(card)}`}
            className="rounded-lg transition hover:opacity-70 active:scale-[0.97]"
          >
            <PlayingCard card={card} size="sm" />
          </button>
        ))}
        {Array.from({ length: capacity - cards.length }, (_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden
            className={cn(
              'h-16 w-11 rounded-lg border border-dashed transition',
              active && i === 0
                ? 'border-foreground/40 bg-foreground/[0.04]'
                : 'border-foreground/15',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Rank, then suit. Ranks with all four cards already placed are dead, and so is
 * a suit whose exact card is on the table, so the picker can never build an
 * impossible spot.
 */
function Picker({
  rank,
  used,
  full,
  onRank,
  onCard,
}: {
  rank: Rank | null
  used: ReadonlySet<string>
  /** True when every slot is taken and there is nowhere for a card to go. */
  full: boolean
  onRank: (rank: Rank | null) => void
  onCard: (card: Card) => void
}) {
  const rankSpent = (r: Rank) => SUITS.every((suit) => used.has(cardToString({ rank: r, suit })))

  if (full) {
    return (
      <p className="text-md text-muted-foreground">
        That is two cards and a full board. Tap a card to take it back out.
      </p>
    )
  }

  return (
    <div>
      <FieldLabel>{rank ? 'And the suit' : 'Add a card'}</FieldLabel>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={rankSpent(r)}
            onClick={() => onRank(rank === r ? null : r)}
            aria-pressed={rank === r}
            className={cn(
              'rounded-lg border py-2.5 text-base font-semibold transition',
              rank === r
                ? 'border-foreground/30 bg-foreground/[0.1] text-foreground'
                : 'border-foreground/10 text-foreground/80 hover:border-foreground/25',
              rankSpent(r) && 'opacity-30',
            )}
          >
            {r === 'T' ? '10' : r}
          </button>
        ))}
      </div>

      {rank && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {SUITS.map((suit) => {
            const card: Card = { rank, suit }
            const taken = used.has(cardToString(card))
            return (
              <button
                key={suit}
                type="button"
                disabled={taken}
                onClick={() => onCard(card)}
                aria-label={cardName(card)}
                className={cn(
                  'rounded-lg border py-3 text-xl leading-none transition',
                  // The default deck's colours. A reader with the four-colour
                  // deck on sees it on the card faces, not on this control.
                  isRed(suit) ? 'text-suit-red' : 'text-foreground',
                  taken
                    ? 'border-foreground/10 opacity-30'
                    : 'border-foreground/15 hover:border-foreground/35 active:scale-[0.98]',
                )}
              >
                {SUIT_GLYPH[suit as Suit]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * The answer, at the precision the run behind it earns.
 *
 * "Exact" and "estimated" are different claims and they read differently on
 * purpose. We blurred that distinction once, over whether a hand was really
 * seeded, and got told about it.
 */
function Readout({
  ready,
  hole,
  board,
  run,
}: {
  ready: boolean
  hole: Card[]
  board: Card[]
  run: RunState | null
}) {
  if (!ready) {
    return (
      <p className="text-md text-muted-foreground">
        {hole.length < 2
          ? 'Pick your two cards and the number appears here.'
          : `A flop is three cards. Add ${3 - board.length} more, or take ${board.length === 1 ? 'it' : 'them'} back off to work it out preflop.`}
      </p>
    )
  }

  if (!run?.quote) {
    return (
      <p className="text-md text-muted-foreground" aria-live="polite">
        Dealing the hand out{run ? `, ${Math.round(run.progress * 100)}%` : ''}…
      </p>
    )
  }

  const { quote } = run
  const band = quote.band

  return (
    <div aria-live="polite">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {formatQuoted(quote.equity, band)} equity
      </p>
      <p className="mt-1 text-md text-muted-foreground tabular-nums">
        Wins {formatQuoted(quote.win, band)}, ties {formatQuoted(quote.tie, band)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {quote.exact ? (
          <>
            Exact. All {quote.showdowns.toLocaleString('en-GB')}{' '}
            {board.length === 5
              ? 'possible hands your opponent could hold'
              : 'possible ways the hand could finish'}
            .
          </>
        ) : (
          <>
            ±{formatBand(band)} points, from {quote.showdowns.toLocaleString('en-GB')} hands dealt
            {run.settled ? '' : '…'}
          </>
        )}
      </p>
    </div>
  )
}
