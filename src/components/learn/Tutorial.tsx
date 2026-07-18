'use client'

// The tour, not a course: a swipeable pager over LESSONS. Skippable at every
// moment, dots-only progress (no "3/8" anxiety), replayable and stateless —
// landing on any page cold is fine. MotionConfig makes every spring inside
// degrade to calm fades under prefers-reduced-motion.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LESSONS } from './lessons'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

const SWIPE_DISTANCE = 70
const SWIPE_VELOCITY = 500

const variants = {
  enter: (dir: number) => ({ x: dir * 72, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -72, opacity: 0 }),
}

export function Tutorial() {
  const router = useRouter()
  const [[page, dir], setPage] = useState<[number, number]>([0, 0])
  const lesson = LESSONS[page]
  const last = page === LESSONS.length - 1

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(LESSONS.length - 1, next))
      if (clamped === page) return
      sound.play('tap')
      setPage([clamped, clamped > page ? 1 : -1])
    },
    [page],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(page + 1)
      else if (e.key === 'ArrowLeft') goTo(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, goTo])

  // Skip goes back where you came from: the onboarding offer → home;
  // anywhere else → back (or home, if this tab has nowhere to go back to).
  const leave = () => {
    sound.play('tap')
    const fromOnboarding = new URLSearchParams(window.location.search).get('from') === 'onboarding'
    if (fromOnboarding || window.history.length <= 1) router.push('/game')
    else router.back()
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col overflow-x-clip">
        {/* top bar — wordmark and a quiet Skip on every page */}
        <div className="flex items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-xl font-semibold lowercase tracking-tight text-muted-foreground transition hover:text-foreground"
          >
            pip
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={leave}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Skip
            </button>
          </div>
        </div>

        {/* the page */}
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={lesson.id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY)
                goTo(page + 1)
              else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY)
                goTo(page - 1)
            }}
            className="flex flex-1 cursor-grab flex-col items-center justify-center px-6 pb-10 active:cursor-grabbing"
          >
            {/* a constant-height stage so the title never jumps between pages */}
            <div className="flex h-72 w-full items-center justify-center sm:h-80">
              <lesson.Visual />
            </div>
            <div className="max-w-sm text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">
                {lesson.body}
              </p>
            </div>
            {last && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="pt-7"
              >
                <Link
                  href="/game"
                  onClick={() => sound.play('call')}
                  className="rounded-2xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  Take a seat
                </Link>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* dots (always) + arrows (desktop); swipe carries mobile */}
        <div className="flex items-center justify-center gap-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          <ArrowButton dir="left" disabled={page === 0} onClick={() => goTo(page - 1)} />
          <div className="flex items-center gap-2">
            {LESSONS.map((l, i) => (
              <button
                key={l.id}
                onClick={() => goTo(i)}
                aria-label={`Page ${i + 1} — ${l.title}`}
                aria-current={i === page || undefined}
                className={cn(
                  'size-2 rounded-full transition',
                  i === page
                    ? 'scale-125 bg-foreground/80'
                    : 'bg-foreground/20 hover:bg-foreground/40',
                )}
              />
            ))}
          </div>
          <ArrowButton dir="right" disabled={last} onClick={() => goTo(page + 1)} />
        </div>
      </div>
    </MotionConfig>
  )
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Previous page' : 'Next page'}
      className="hidden size-9 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground active:scale-90 disabled:opacity-30 sm:flex"
    >
      <Icon className="size-4" />
    </button>
  )
}
