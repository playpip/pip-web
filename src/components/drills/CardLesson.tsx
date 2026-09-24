'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, type PanInfo, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'

/**
 * The short lesson a practice pack opens with: a few cards, one idea, paged.
 * Swipe, arrow keys, or the buttons.
 *
 * Lifted out of the river pack when the bet-or-check and shove-or-fold packs
 * arrived, so three packs page their lessons the same way and cannot drift.
 *
 * **Skippable from the first card**, because the second visit is not the first
 * and a lesson you have to sit through again is a toll, not a lesson.
 */
export interface LessonCard {
  title: string
  body: () => React.ReactNode
}

export function CardLesson({
  name,
  cards,
  onDone,
}: {
  /** The pack's name, over each card's title. */
  name: string
  cards: readonly LessonCard[]
  onDone: () => void
}) {
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(1)
  const last = page === cards.length - 1

  const go = useCallback(
    (to: number) => {
      if (to < 0) return
      if (to >= cards.length) {
        sound.play('deal')
        haptics.fire('deal')
        onDone()
        return
      }
      setDirection(to > page ? 1 : -1)
      setPage(to)
      sound.play('tap')
    },
    [page, onDone, cards.length],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        go(page + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(page - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, page])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(page + 1)
    else if (info.offset.x > 60 || info.velocity.x > 400) go(page - 1)
  }

  const Body = cards[page].body
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-3">
        <div className="relative w-full max-w-md flex-1">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.section
              key={page}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d * 60, opacity: 0 }),
                centre: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="centre"
              exit="exit"
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={onDragEnd}
              aria-roledescription="slide"
              aria-label={`${page + 1} of ${cards.length}: ${cards[page].title}`}
              className="flex cursor-grab touch-pan-y flex-col gap-5 rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 shadow-sm active:cursor-grabbing sm:p-7"
            >
              <header className="space-y-1">
                <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {name} · {page + 1} of {cards.length}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">{cards[page].title}</h2>
              </header>
              <Body />
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {cards.map((card, i) => (
            <motion.span
              key={card.title}
              className="h-1.5 rounded-full bg-foreground"
              animate={{ width: i === page ? 20 : 6, opacity: i === page ? 0.9 : 0.2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          ))}
        </div>
      </div>

      <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          {page === 0 ? (
            <button
              type="button"
              onClick={() => go(cards.length)}
              className="rounded-2xl px-4 py-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Skip
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(page - 1)}
              aria-label="Back"
              className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl border border-foreground/15 bg-foreground/[0.03] transition hover:bg-foreground/[0.06] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => go(page + 1)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {last ? 'Deal the spots' : 'Next'}
            {!last && <ChevronRight className="size-4" />}
          </button>
        </div>
      </div>
    </MotionConfig>
  )
}

/** A lesson card's paragraphs, in the reading size. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 text-[0.9375rem] leading-relaxed text-foreground/90 [&_strong]:font-semibold [&_strong]:text-foreground">
      {children}
    </div>
  )
}
