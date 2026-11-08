'use client'

// Poker Solitaire (config/quickGames, rules in lib/quick/solitaire).
//
// One thumb: the next card sits under the grid, a tap on an empty cell sends
// it there, and it stays. A row or column that fills with a hand glows and
// says what it scored. At 25 cards the round is over and the end card reads
// every line.
//
// Puzzle (lib/quick/solitairePuzzle) has no luck in it: all 25 cards start
// on the grid face up, a tap picks one up and a tap on another swaps them.
// Making the target solves it, and the round ends there; Finish stops early
// with the stars made so far. The Daily puzzle is the same one for everybody.

import { useRef, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { Info, Star } from 'lucide-react'
import { Splash } from '@/components/Splash'
import { useRequireProfile } from '@/components/menu/useRequireProfile'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { quickGame } from '@/config/quickGames'
import { type Card, cardToString, isRed, SUIT_GLYPH, type Suit } from '@/lib/poker/cards'
import { cryptoRng } from '@/lib/cryptoRng'
import { dailyDateKey } from '@/lib/daily'
import {
  CELLS,
  dealSolitaire,
  emptyGrid,
  type Grid,
  type LineScore,
  linesThrough,
  place,
  SOLITAIRE_POINTS,
  scoreGrid,
  scoreLine,
} from '@/lib/quick/solitaire'
import {
  dailyPuzzle,
  dealPuzzle,
  type Puzzle,
  puzzleStars,
  starAt,
} from '@/lib/quick/solitairePuzzle'
import { useQuickRound } from '@/lib/useQuickRound'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { QuickEnd, QuickIntro, QuickPage, type StartOption } from './QuickScreen'

const GAME_ID = 'solitaire'

type Round = {
  deck: Card[]
  grid: (Card | null)[]
  /** Cells of the line(s) the last card filled with a hand, for the glow. */
  glow: { cells: number[]; key: number } | null
  /** A Puzzle round: its target, and the card picked up to swap. */
  puzzle?: { target: number; picked: number | null; swaps: number }
}

type Done = {
  total: number
  lines: LineScore[]
  bestBefore: number | null
  /** A Puzzle round's target. A puzzle keeps no best: every deal's target is its own. */
  target?: number
}

export function Solitaire() {
  const ready = useRequireProfile()
  const game = quickGame(GAME_ID)
  const view = useQuickRound(GAME_ID)
  const [round, setRound] = useState<Round | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const finishing = useRef(false)

  const start = (deck: Card[]) => {
    finishing.current = false
    setDone(null)
    setRound({ deck, grid: emptyGrid(), glow: null })
  }
  const startPuzzle = (puzzle: Puzzle) => {
    finishing.current = false
    setDone(null)
    setRound({
      deck: puzzle.cards,
      grid: puzzle.cards.slice(),
      glow: null,
      puzzle: { target: puzzle.target, picked: null, swaps: 0 },
    })
  }
  const play: StartOption = { label: 'Play', start: () => start(dealSolitaire(cryptoRng)) }
  const puzzle: StartOption = {
    label: 'Puzzle',
    secondary: true,
    start: () => startPuzzle(dealPuzzle(cryptoRng)),
  }
  const daily: StartOption = {
    label: 'Daily puzzle',
    secondary: true,
    start: () => startPuzzle(dailyPuzzle(dailyDateKey())),
  }
  const options = [play, puzzle, daily]
  // After a puzzle, another puzzle is the big button.
  const again = done?.target
    ? [{ ...puzzle, secondary: false }, { ...play, secondary: true }, daily]
    : options

  const finishPuzzle = (grid: Grid, target: number, delay: number) => {
    finishing.current = true
    const { total, lines } = scoreGrid(grid)
    setTimeout(() => {
      sound.play(total >= target ? 'win' : 'deal')
      setDone({ total, lines, bestBefore: null, target })
      setRound(null)
    }, delay)
  }

  /** Puzzle: pick a card up, put it back, or swap it with the one tapped. */
  const tapCard = (cell: number) => {
    if (!round?.puzzle || finishing.current) return
    const { picked, target } = round.puzzle
    if (picked === null || picked === cell) {
      sound.play('tap')
      setRound({ ...round, puzzle: { ...round.puzzle, picked: picked === null ? cell : null } })
      return
    }
    const before = scoreGrid(round.grid).lines
    const grid = round.grid.slice()
    ;[grid[picked], grid[cell]] = [grid[cell], grid[picked]]
    const after = scoreGrid(grid)
    // Glow the lines the swap made better.
    const better = after.lines.filter((s, i) => s.points > 0 && s.points > (before[i]?.points ?? 0))
    sound.play(better.length > 0 ? 'turn' : 'deal')
    const swaps = round.puzzle.swaps + 1
    setRound({
      ...round,
      grid,
      glow: better.length ? { cells: better.flatMap((s) => s.line.cells), key: swaps } : null,
      puzzle: { ...round.puzzle, picked: null, swaps },
    })
    if (after.total >= target) finishPuzzle(grid, target, 1300)
  }

  const placeAt = (cell: number) => {
    if (!round || finishing.current) return
    const placed = round.grid.filter(Boolean).length
    const card = round.deck[placed]
    const grid = card ? place(round.grid, cell, card) : null
    if (!card || !grid) return
    const scored = linesThrough(cell)
      .map((line) => scoreLine(grid, line))
      .filter((s): s is LineScore => !!s && s.points > 0)
    sound.play(scored.length > 0 ? 'turn' : 'deal')
    setRound({
      ...round,
      grid,
      glow: scored.length ? { cells: scored.flatMap((s) => s.line.cells), key: placed } : null,
    })
    if (placed + 1 === CELLS) {
      finishing.current = true
      const { total, lines } = scoreGrid(grid)
      const bestBefore = useProfile.getState().recordQuickScore(GAME_ID, total)
      // A beat on the full grid before the end card: the last glow is the
      // last card's, and it should be seen.
      setTimeout(() => {
        sound.play('win')
        setDone({ total, lines, bestBefore })
        setRound(null)
      }, 1100)
    }
  }

  if (!ready) return <Splash />

  return (
    <QuickPage game={game}>
      {done ? (
        <QuickEnd
          game={game}
          score={done.total}
          bestBefore={done.bestBefore}
          view={view}
          again={again}
          result={
            done.target ? <PuzzleResult score={done.total} target={done.target} /> : undefined
          }
        >
          <Breakdown lines={done.lines} />
        </QuickEnd>
      ) : round ? (
        <Board
          round={round}
          onPlace={placeAt}
          onTap={tapCard}
          onFinish={() => {
            if (!round.puzzle || finishing.current) return
            sound.play('tap')
            finishPuzzle(round.grid, round.puzzle.target, 0)
          }}
          onRules={() => setRulesOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <QuickIntro game={game} view={view} options={options} />
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              setRulesOpen(true)
            }}
            className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Info className="size-4" />
            How it scores
          </button>
        </div>
      )}
      <Sheet open={rulesOpen} onOpenChange={setRulesOpen}>
        <SheetContent title="How it scores" onClose={() => setRulesOpen(false)}>
          <ScoreTable />
        </SheetContent>
      </Sheet>
    </QuickPage>
  )
}

/** The grid, the line scores beside it, and the next card under it. */
function Board({
  round,
  onPlace,
  onTap,
  onFinish,
  onRules,
}: {
  round: Round
  onPlace: (cell: number) => void
  onTap: (cell: number) => void
  onFinish: () => void
  onRules: () => void
}) {
  const { puzzle } = round
  const placed = round.grid.filter(Boolean).length
  const next = round.deck[placed] ?? null
  const { total } = scoreGrid(round.grid)
  const glowing = new Set(round.glow?.cells ?? [])

  return (
    <LayoutGroup>
      {/* Sized to the screen's height too, so the next card is never below the fold. */}
      <div
        className="mx-auto flex w-full flex-col gap-3"
        style={{ maxWidth: 'min(26rem, max(17rem, calc((100dvh - 18rem) / 1.42)))' }}
      >
        <div className="flex items-center justify-between px-0.5 text-sm">
          {puzzle ? (
            <span className="tabular-nums text-muted-foreground">Target {puzzle.target}</span>
          ) : (
            <span className="tabular-nums text-muted-foreground">
              Card {Math.min(placed + 1, CELLS)} of {CELLS}
            </span>
          )}
          <span className="font-semibold tabular-nums">
            Score <motion.span key={total}>{total}</motion.span>
          </span>
          <button
            type="button"
            onClick={() => {
              sound.play('tap')
              onRules()
            }}
            aria-label="How it scores"
            className="-mr-1.5 grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <Info className="size-4" />
          </button>
        </div>

        {/* Five cards and a score across, five rows and a row of scores down. */}
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_1.9rem] gap-1.5 sm:gap-2">
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => {
              if (r < 5 && c < 5) {
                const cell = r * 5 + c
                return (
                  <Cell
                    key={cell}
                    card={round.grid[cell]}
                    glowKey={glowing.has(cell) ? round.glow?.key : undefined}
                    canPlace={!!next}
                    onPlace={() => onPlace(cell)}
                    picked={puzzle?.picked === cell}
                    onTap={puzzle ? () => onTap(cell) : undefined}
                  />
                )
              }
              if (r === 5 && c === 5) return <span key="corner" />
              const line = r === 5 ? 5 + c : r
              return <LineBadge key={`l${line}`} grid={round.grid} line={line} side={r === 5} />
            }),
          )}
        </div>

        {puzzle ? (
          <PuzzleFooter score={total} target={puzzle.target} onFinish={onFinish} />
        ) : (
          /* The next card, and the deck it came off. */
          <div className="flex items-center justify-center gap-5 pt-1">
            <div className="w-[4.75rem] sm:w-20">
              {next ? (
                <motion.div
                  key={cardToString(next)}
                  layoutId={cardToString(next)}
                  initial={{ opacity: 0, y: 24, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                >
                  <Face card={next} />
                </motion.div>
              ) : (
                <div className="aspect-[5/7]" />
              )}
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{next ? 'Tap a space' : 'Done'}</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {CELLS - placed - (next ? 1 : 0)} more after this
              </span>
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  )
}

/** One space on the grid: empty and tappable, or a card that is there for good. */
function Cell({
  card,
  glowKey,
  canPlace,
  onPlace,
  picked,
  onTap,
}: {
  card: Card | null
  glowKey?: number
  canPlace: boolean
  onPlace: () => void
  /** Puzzle: this card is picked up, waiting for the card to swap with. */
  picked?: boolean
  /** Puzzle: every card can be tapped. */
  onTap?: () => void
}) {
  if (!card) {
    return (
      <button
        type="button"
        onClick={onPlace}
        disabled={!canPlace}
        aria-label="Place the card here"
        className="aspect-[5/7] w-full rounded-[14%] border border-dashed border-foreground/15 bg-foreground/[0.03] transition hover:border-foreground/30 hover:bg-foreground/[0.07] active:scale-95"
      />
    )
  }
  return (
    <motion.div
      layoutId={cardToString(card)}
      animate={{ y: picked ? -6 : 0, scale: picked ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      className={cn('relative', picked && 'z-10')}
    >
      {onTap ? (
        <button
          type="button"
          onClick={onTap}
          aria-label={picked ? 'Put the card back' : 'Pick up or swap this card'}
          aria-pressed={picked}
          className="block w-full transition active:scale-95"
        >
          <Face card={card} />
        </button>
      ) : (
        <Face card={card} />
      )}
      {picked && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-[16%] ring-2 ring-pip shadow-lg shadow-black/50"
        />
      )}
      {glowKey !== undefined && (
        <motion.div
          key={glowKey}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.3, times: [0, 0.2, 1], delay: 0.15 }}
          className="pointer-events-none absolute -inset-[3px] rounded-[16%] ring-2 ring-pip shadow-[0_0_18px_2px_color-mix(in_oklch,var(--color-pip)_55%,transparent)]"
        />
      )}
    </motion.div>
  )
}

/** Puzzle: the stars on the way to the target, and Finish. */
function PuzzleFooter({
  score,
  target,
  onFinish,
}: {
  score: number
  target: number
  onFinish: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <div className="flex flex-col gap-1">
        <Stars score={score} target={target} />
        <span className="text-sm text-muted-foreground">Tap two cards to swap them</span>
      </div>
      <button
        type="button"
        onClick={onFinish}
        className="rounded-2xl bg-foreground/[0.06] px-4 py-2.5 text-sm font-semibold ring-1 ring-foreground/10 transition hover:bg-foreground/[0.09] active:scale-[0.98]"
      >
        Finish
      </button>
    </div>
  )
}

/** Three stars, lit as the score reaches each, with the score each needs. */
function Stars({ score, target, big }: { score: number; target: number; big?: boolean }) {
  const lit = puzzleStars(score, target)
  return (
    <div className={cn('flex items-center', big ? 'gap-4' : 'gap-2.5')}>
      {([1, 2, 3] as const).map((n) => (
        <div key={n} className="flex items-center gap-1">
          <motion.span
            key={n <= lit ? 'on' : 'off'}
            initial={n <= lit ? { scale: 0.4 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          >
            <Star
              className={cn(
                big ? 'size-7' : 'size-4',
                n <= lit ? 'fill-pip text-pip' : 'text-foreground/25',
              )}
            />
          </motion.span>
          <span
            className={cn(
              'tabular-nums',
              big ? 'text-sm' : 'text-xs',
              n <= lit ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {starAt(n, target)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** The end of a puzzle: solved or not, and its stars. */
function PuzzleResult({ score, target }: { score: number; target: number }) {
  return (
    <div className="mt-1 flex flex-col items-center gap-2">
      <span className="text-sm font-semibold">
        {score >= target ? 'Solved' : `Target ${target}`}
      </span>
      <Stars score={score} target={target} big />
    </div>
  )
}

/** A line's score once it is full: its points, or a quiet nought. */
function LineBadge({ grid, line, side }: { grid: Grid; line: number; side: boolean }) {
  const score = scoreLineAt(grid, line)
  return (
    <div className={cn('flex items-center justify-center', side ? 'h-7' : 'w-full')}>
      {score && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.15 }}
          className={cn(
            'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
            score.points > 0 ? 'bg-primary/20 text-foreground' : 'text-muted-foreground/60',
          )}
        >
          {score.points}
        </motion.span>
      )}
    </div>
  )
}

function scoreLineAt(grid: Grid, line: number): LineScore | null {
  const all = scoreGrid(grid).lines
  return all.find((s) => (s.line.kind === 'row' ? s.line.index : 5 + s.line.index) === line) ?? null
}

/** A card face that fills its space, with type in proportion to it. */
function Face({ card }: { card: Card }) {
  const deckFace = useProfile((s) => s.deckFace)
  return (
    <div className="@container relative aspect-[5/7] w-full select-none rounded-[14%] bg-cardface shadow-md shadow-black/40">
      <div className={cn('absolute inset-0 leading-none', ink(card.suit, deckFace))}>
        <span className="absolute left-[11%] top-[7%] font-semibold" style={{ fontSize: '38cqw' }}>
          {card.rank === 'T' ? '10' : card.rank}
        </span>
        <span className="absolute bottom-[6%] right-[10%]" style={{ fontSize: '44cqw' }}>
          {SUIT_GLYPH[card.suit]}
        </span>
      </div>
    </div>
  )
}

const FOUR_COLOUR: Record<Suit, string> = {
  h: 'text-suit-red',
  s: 'text-cardface-ink',
  d: 'text-suit-blue',
  c: 'text-suit-green',
}

function ink(suit: Suit, deckFace: string): string {
  if (deckFace === 'face-fourcolor') return FOUR_COLOUR[suit]
  return isRed(suit) ? 'text-suit-red' : 'text-cardface-ink'
}

/** Every line, as the end card reads them: rows, then columns. */
function Breakdown({ lines }: { lines: LineScore[] }) {
  const groups = [
    { name: 'Rows', lines: lines.filter((l) => l.line.kind === 'row') },
    { name: 'Columns', lines: lines.filter((l) => l.line.kind === 'column') },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.name}>
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.name}
          </h3>
          <ul className="divide-y divide-foreground/[0.06] rounded-2xl bg-foreground/[0.03] ring-1 ring-foreground/10">
            {group.lines.map((l, i) => (
              <motion.li
                key={`${l.line.kind}${l.line.index}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm"
              >
                <span className={cn(!l.hand && 'text-muted-foreground')}>
                  {l.hand ?? 'No hand'}
                </span>
                <span className="font-semibold tabular-nums">{l.points}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** The points table, best hand first. */
function ScoreTable() {
  return (
    <div className="flex flex-col gap-3 pb-2">
      <p className="text-muted-foreground">
        Each row and each column is a poker hand. A high card scores nothing.
      </p>
      <ul className="divide-y divide-foreground/[0.06] rounded-2xl bg-foreground/[0.03] ring-1 ring-foreground/10">
        {SOLITAIRE_POINTS.map((row) => (
          <li key={row.hand} className="flex items-center justify-between px-4 py-2.5">
            <span>{row.hand}</span>
            <span className="font-semibold tabular-nums">{row.points}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
