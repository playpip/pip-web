'use client'

// The frame every quick game shares (config/quickGames): the page, the start
// card and the end card. A game brings its own board; this brings the parts
// that have to agree from one game to the next: what Play says, when the free
// round is spent, the best, and the limit card once today's round is used.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { animate, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { LimitCard } from '@/components/membership/LimitCard'
import type { QuickGame } from '@/config/quickGames'
import { QUICK_EVENTS } from '@/lib/quick/events'
import type { QuickRoundView } from '@/lib/useQuickRound'
import { formatChips } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** A score as the game writes it: "412", or "1,280 chips". */
export function formatScore(game: QuickGame, score: number): string {
  return game.unit === 'chips' ? `${formatChips(score)} chips` : formatChips(score)
}

/**
 * The page: back to the side tables, and the game's name in the bar.
 */
export function QuickPage({
  game,
  onBack,
  children,
}: {
  game: QuickGame
  /** Asked before leaving, for a game that wants to confirm. Defaults to going back. */
  onBack?: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <PageShell
      leading="back"
      backLabel="Side Tables"
      title={<span className="text-sm font-semibold">{game.title}</span>}
      onBack={onBack ?? (() => router.push('/game/side'))}
    >
      {children}
    </PageShell>
  )
}

/** A button that starts a round. Spends today's free round on the tap, never before. */
export interface StartOption {
  label: string
  /** Called once the round may go ahead. */
  start: () => void
  /** The quieter of two buttons. */
  secondary?: boolean
}

/**
 * Before a round: the art, the name, the best, and the way in. Once a free
 * player's round today is used, the way in is the limit card.
 */
export function QuickIntro({
  game,
  view,
  options,
}: {
  game: QuickGame
  view: QuickRoundView
  options: readonly StartOption[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-md flex-col gap-5"
    >
      <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] shadow-xl shadow-black/30">
        <div className="relative aspect-[2/1] w-full">
          <CategoryArt id={game.id} accent={game.accent} className="absolute inset-0 size-full" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">{game.title}</h1>
            <p className="mt-1 text-muted-foreground">{game.short}</p>
            {view.best !== null && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                <Star className="size-3.5 fill-pip text-pip" />
                Best {formatScore(game, view.best)}
              </p>
            )}
          </div>
          {view.ready && view.canPlay && <StartButtons game={game} view={view} options={options} />}
        </div>
      </div>
      {view.ready && !view.canPlay && <LimitCard kind="round" narrow />}
    </motion.div>
  )
}

function StartButtons({
  game,
  view,
  options,
}: {
  game: QuickGame
  view: QuickRoundView
  options: readonly StartOption[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => {
            if (!view.begin()) return
            sound.play('call')
            QUICK_EVENTS[game.id]?.started()
            option.start()
          }}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-base font-semibold transition active:scale-[0.98]',
            option.secondary
              ? 'bg-foreground/[0.06] text-foreground ring-1 ring-foreground/10 hover:bg-foreground/[0.09]'
              : 'bg-primary text-primary-foreground shadow-lg shadow-black/20 hover:bg-primary/90',
          )}
        >
          {!view.member && !option.secondary ? `${option.label} free` : option.label}
          {!option.secondary && <ChevronRight className="size-4" />}
        </button>
      ))}
    </div>
  )
}

/**
 * After a round: the score counting up, the best, the game's own breakdown,
 * and Play again (or the limit card, for a free player whose round it was).
 */
export function QuickEnd({
  game,
  score,
  bestBefore,
  view,
  again,
  onBack,
  children,
}: {
  game: QuickGame
  score: number
  /** The best before this round, or null if this was the first. */
  bestBefore: number | null
  view: QuickRoundView
  /** How to play again: the same buttons the start card has. */
  again: readonly StartOption[]
  /** Leaving for the side tables, for a game with something to put away first. */
  onBack?: () => void
  children?: React.ReactNode
}) {
  const router = useRouter()
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    QUICK_EVENTS[game.id]?.finished()
  }, [game.id])
  const newBest = bestBefore === null || score > bestBefore
  const best = Math.max(score, bestBefore ?? 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="mx-auto flex w-full max-w-md flex-col gap-5"
    >
      <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 shadow-xl shadow-black/30">
        <div className="flex flex-col items-center gap-1 py-3 text-center">
          <span className="text-sm font-medium text-muted-foreground">{game.title}</span>
          <ScoreCount value={score} unit={game.unit} />
          {newBest && score > 0 ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, type: 'spring', stiffness: 400, damping: 18 }}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold"
            >
              <Star className="size-3.5 fill-pip text-pip" />
              New best
            </motion.span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
              <Star className="size-3.5 fill-pip text-pip" />
              Best {formatScore(game, best)}
            </span>
          )}
        </div>
        {children && <div className="mt-4">{children}</div>}
        {view.ready && view.canPlay && (
          <div className="mt-5">
            <StartButtons
              game={game}
              view={view}
              options={again.map((o, i) =>
                i === 0 ? { ...o, label: view.member ? 'Play again' : o.label } : o,
              )}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            if (onBack) onBack()
            else router.push('/game/side')
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to the side tables
        </button>
      </div>
      {view.ready && !view.canPlay && <LimitCard kind="round" narrow />}
    </motion.div>
  )
}

/** The score, counting up from nothing once. */
function ScoreCount({ value, unit }: { value: number; unit?: QuickGame['unit'] }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: Math.min(1.4, 0.5 + value / 1500),
      ease: 'easeOut',
      onUpdate: (v) => setShown(v),
    })
    return () => controls.stop()
  }, [value])
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-6xl font-semibold tabular-nums tracking-tight">
        {formatChips(shown)}
      </span>
      {unit === 'chips' && <span className="text-lg text-muted-foreground">chips</span>}
    </span>
  )
}
