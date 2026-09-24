'use client'

import { MotionConfig, motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { PACK_SIZE } from '@/lib/drills/pack'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { NextButton } from './felt'
import { useDrillExit } from './exit'

// The furniture every practice pack shares: the bar that says where you are in
// the ten, and the count at the end. Lifted out of the river pack when the
// second pack arrived, so the two cannot drift into two ways of saying "7 of 10".

/**
 * Where you are in the ten: a segment each, filled as you answer, the current
 * one lit. iOS's stories bar, with the lesson one tap away at the end of it.
 */
export function PackProgress({
  results,
  onLesson,
}: {
  results: readonly boolean[]
  onLesson: () => void
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-1">
        <ol
          className="flex flex-1 gap-1"
          aria-label={`Spot ${Math.min(results.length + 1, PACK_SIZE)} of ${PACK_SIZE}`}
        >
          {Array.from({ length: PACK_SIZE }, (_, i) => {
            const answered = results[i]
            return (
              <li key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <motion.span
                  className={cn(
                    'block h-full rounded-full',
                    answered === true && 'bg-emerald-500',
                    answered === false && 'bg-foreground/45',
                    answered === undefined && i === results.length && 'bg-foreground/30',
                  )}
                  initial={false}
                  animate={{
                    width: answered !== undefined || i === results.length ? '100%' : '0%',
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                />
              </li>
            )
          })}
        </ol>
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            onLesson()
          }}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <BookOpen className="size-3.5" />
          Lesson
        </button>
      </div>
    </MotionConfig>
  )
}

/**
 * The end of a pack: how many, what it did to the rating, and the way on.
 *
 * One number and one line. It never grades the player as a person, and the
 * line for a bad pack is as flat as the line for a good one. `lines` is the
 * pack's own four, from every one right down to not many.
 */
export function PackSummary({
  title,
  lines,
  results,
  ratingBefore,
  rating,
  onAgain,
  onLesson,
  lessonLabel,
}: {
  title: string
  lines: readonly [string, string, string, string]
  results: readonly boolean[]
  ratingBefore: number
  rating: number
  onAgain: () => void
  onLesson: () => void
  lessonLabel: string
}) {
  const exit = useDrillExit()
  const right = results.filter(Boolean).length
  const delta = rating - ratingBefore
  const line =
    right === results.length
      ? lines[0]
      : right >= results.length * 0.7
        ? lines[1]
        : right >= results.length * 0.4
          ? lines[2]
          : lines[3]

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {title}
          </p>
          <p className="text-6xl font-semibold tabular-nums tracking-tight">
            {right}
            <span className="text-muted-foreground"> of {results.length}</span>
          </p>
          <ol className="flex gap-1.5" aria-hidden>
            {results.map((correct, i) => (
              <motion.li
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.2 + i * 0.05 }}
                className={cn(
                  'size-2.5 rounded-full',
                  correct ? 'bg-emerald-500' : 'bg-foreground/25',
                )}
              />
            ))}
          </ol>
          <p className="max-w-xs text-sm text-muted-foreground">{line}</p>
          <p className="text-sm tabular-nums">
            Rating {rating}
            {delta !== 0 && (
              <span
                className={cn('ml-1.5', delta > 0 ? 'text-emerald-500' : 'text-muted-foreground')}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            )}
          </p>
        </motion.div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <NextButton label="Another ten" onClick={onAgain} />
          <div className="flex flex-wrap justify-center gap-x-4 text-sm">
            <button
              type="button"
              onClick={onLesson}
              className="px-2 py-2 font-medium text-muted-foreground transition hover:text-foreground"
            >
              {lessonLabel}
            </button>
            <button
              type="button"
              onClick={exit.leave}
              className="px-2 py-2 font-medium text-muted-foreground transition hover:text-foreground"
            >
              Back to {exit.label.toLowerCase()}
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
