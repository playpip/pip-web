'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AppBar } from '@/components/AppBar'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ActionBar, Answer, Dealing, LockedAnswers, NextButton } from '@/components/drills/felt'
import { drillHref } from '@/components/drills/exit'
import { characterById } from '@/config/cast'
import { BET_PACK_ID, OPEN_PACK_ID, RIVER_PACK_ID, SHOVE_PACK_ID, drillKind } from '@/config/drills'
import { type Lesson, canTakeLesson } from '@/config/lessons'
import { type SeatId, seatById } from '@/config/positions'
import {
  type Beat,
  NUMERIC_ASKS,
  type Question,
  SEAT_ASKS,
  isRight,
  questionFor,
} from '@/lib/lessons/beats'
import { playActions, sceneState } from '@/lib/lessons/scene'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { type SeatFace, SceneTable } from './SceneTable'

/**
 * A lesson with Webb, played on the table.
 *
 * **Beats, not pages** (Will, 2026-09-23: "everything happens on the real
 * poker table"). Each beat is a hand the engine deals: Webb sits in his seat,
 * says what is happening, and — when the beat asks — stops and waits for you to
 * answer with a real button or by tapping a seat on the felt. Then he answers,
 * and the table plays on to show it: the fold, the raise, the blinds giving up.
 * The next beat deals the next hand. Nothing is a slide with a picture on it.
 *
 * **Nothing is kept.** A lesson is not scored and leaves nothing on the
 * profile: there is no "complete", no streak and nothing to be behind on. The
 * practice it hands you into keeps a rating, because that is a drill kind and
 * the rating is the drills' mirror (lib/drills/rating.ts).
 *
 * **Locked, it still deals.** For somebody who is not a member it draws the
 * first beat — Webb in his chair, the cards, his opening line — played down,
 * with the answers replaced by the one line about the membership, exactly as a
 * locked drill does. A tap on it goes to /membership, which is the whole of the
 * sales surface (docs/membership.md: invited, never uninvited).
 */

/**
 * The regulars round the table besides Webb, in the order they fill the seats
 * he is not in. Low-table faces, so the table reads as a friendly game.
 */
const REGULARS = ['doris', 'ted', 'priya', 'gus', 'marge'] as const

/**
 * The practice packs: ten hands, then a summary. Every other drill kind deals
 * for as long as you like, so the hand-off names the pack's length only for these.
 */
const PACKS: readonly string[] = [OPEN_PACK_ID, RIVER_PACK_ID, BET_PACK_ID, SHOVE_PACK_ID]

/** How long between one thing happening at the table and the next, in ms. */
const PACE = 650

export function LessonScreen({ lesson }: { lesson: Lesson }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const member = useEntitlement()
  const settled = useMembership((state) => state.checked)
  // A lesson is the membership's, so it waits for a real answer before it
  // draws either screen, the way a paid drill kind does. `checked` is true at
  // once for anybody signed out.
  const known = !lesson.membersOnly || settled
  const allowed = canTakeLesson(lesson, member)

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden">
        <AppBar
          className="z-20"
          leading="back"
          backLabel="Learn"
          showWordmark={false}
          onBack={() => router.push('/learn')}
          title={
            <span className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground">{lesson.title}</span>
              <span className="text-2xs text-muted-foreground/60">Lessons with Webb</span>
            </span>
          }
        />
        {!hydrated || !known ? <Dealing slots={5} /> : <Beats lesson={lesson} allowed={allowed} />}
      </div>
    </MotionConfig>
  )
}

function Beats({ lesson, allowed }: { lesson: Lesson; allowed: boolean }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  // How far into the beat's `playOn` the table has played.
  const [played, setPlayed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const beat = lesson.beats[index]
  const last = index === lesson.beats.length - 1
  const base = useMemo(() => sceneState(beat.scene, lesson.seed), [beat, lesson.seed])
  const question = useMemo(() => questionFor(beat, base), [beat, base])
  const playOn = useMemo(() => beat.playOn ?? [], [beat])
  const state = useMemo(
    () => (played === 0 ? base : playActions(base, playOn.slice(0, played))),
    [base, playOn, played],
  )
  const faces = useMemo(() => facesFor(beat), [beat])
  const answered = picked !== null
  const waiting = question !== null && !answered
  const practice = lesson.practice ? drillKind(lesson.practice) : null

  // Timers are cancelled when the beat changes or the screen goes, and set only
  // by a tap: nothing here sets state from an effect.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
    }
  }, [])

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= lesson.beats.length) return
      for (const timer of timers.current) clearTimeout(timer)
      timers.current.length = 0
      const next = lesson.beats[to]
      const newCards = next.scene.hero.join() !== beat.scene.hero.join()
      setIndex(to)
      setPicked(null)
      setPlayed(0)
      sound.play(newCards ? 'deal' : 'tap')
      if (newCards) haptics.fire('deal')
    },
    [lesson.beats, beat],
  )

  const pick = useCallback(
    (choiceId: string) => {
      if (!question || answered || !allowed) return
      if (!question.choices.some((c) => c.id === choiceId)) return
      const right = isRight(question, choiceId)
      setPicked(choiceId)
      sound.play(right ? 'win' : 'fold')
      haptics.fire(right ? 'win' : 'bust')
      // Then the table plays on, one thing at a time, so you watch it happen.
      playOn.forEach((action, i) => {
        timers.current.push(
          setTimeout(
            () => {
              setPlayed(i + 1)
              sound.play(action.type)
            },
            PACE * (i + 1),
          ),
        )
      })
    },
    [question, answered, allowed, playOn],
  )

  // The keyboard: a digit answers, Enter or → goes on, ← goes back.
  useEffect(() => {
    if (!allowed) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key
      if (waiting && question) {
        const n = Number(key)
        const choice = Number.isInteger(n) ? question.choices[n - 1] : undefined
        if (choice) {
          event.preventDefault()
          pick(choice.id)
        }
        return
      }
      if ((key === 'Enter' || key === ' ' || key === 'ArrowRight') && !last) {
        event.preventDefault()
        go(index + 1)
      } else if (key === 'ArrowLeft') {
        event.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allowed, waiting, question, pick, go, index, last])

  // Whose avatar wears the ring: whoever just acted while the table plays on,
  // and otherwise Webb, who is talking.
  const actor = played > 0 ? playOn[played - 1]?.seat : null
  const speaking: SeatId = actor ?? beat.webb
  // Two kinds of question are answered by a player at the table: a seat, and a
  // regular. Both can be tapped on the felt, and both mark the seat once answered.
  const kind = beat.ask?.kind
  const bySeat = kind !== undefined && SEAT_ASKS.has(kind)
  const byRegular = kind === 'which-regular'
  const seatOf = (choiceId: string): SeatId | null =>
    bySeat
      ? (choiceId as SeatId)
      : byRegular
        ? ((Object.entries(beat.cast ?? {}).find(([, id]) => id === choiceId)?.[0] as SeatId) ??
          null)
        : null
  const marked = answered && question ? seatOf(question.answer) : null
  const pickSeat = (seat: SeatId) => {
    const choice = bySeat ? seat : byRegular ? beat.cast?.[seat] : undefined
    if (choice) pick(choice)
  }
  const numeric = kind !== undefined && NUMERIC_ASKS.has(kind)

  return (
    <>
      {allowed && <BeatProgress count={lesson.beats.length} at={index} />}

      <SceneTable
        state={state}
        faces={faces}
        labels={Boolean(beat.labels)}
        speaking={speaking}
        dim={!allowed}
        pickable={allowed && waiting && (bySeat || byRegular)}
        onPick={pickSeat}
        marked={marked}
        revealed={beat.reveal}
        talk={
          <WebbSays
            key={`${beat.id}:${answered ? 'after' : 'before'}`}
            beat={beat}
            question={allowed ? question : null}
            picked={picked}
          />
        }
      />

      <ActionBar>
        {!allowed ? (
          <LockedAnswers blurb={lesson.blurb} onJoin={() => router.push('/membership')} />
        ) : waiting && question ? (
          <div
            className={cn(
              'grid gap-2',
              question.choices.length === 4
                ? numeric
                  ? 'grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-4'
                : question.choices.length > 2
                  ? 'grid-cols-3'
                  : 'grid-cols-2',
            )}
          >
            {question.choices.map((choice, i) => (
              <Answer
                key={choice.id}
                label={labelFor(choice.id, choice.label, beat, faces)}
                spoken={choice.spoken ?? spokenFor(choice.id, choice.label, beat, faces)}
                shortcut={String(i + 1)}
                state="open"
                numeric={numeric}
                onPick={() => pick(choice.id)}
              />
            ))}
          </div>
        ) : last ? (
          <div className="flex flex-col gap-2">
            {/* Into the practice, or — for a lesson whose practice is not built
                yet — back to the shelf, which is then the only way on. */}
            {practice ? (
              <NextButton
                label={`${practice.title} · ${PACKS.includes(practice.id) ? 'ten hands' : 'practise'}`}
                onClick={() => {
                  sound.play('deal')
                  router.push(drillHref(practice.id, 'learn'))
                }}
              />
            ) : (
              <NextButton
                label="Back to the shelf"
                onClick={() => {
                  sound.play('tap')
                  router.push('/learn')
                }}
              />
            )}
            <div className="flex justify-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => go(0)}
                className="px-2 py-2 font-medium text-muted-foreground transition hover:text-foreground"
              >
                From the top
              </button>
              {practice && (
                <button
                  type="button"
                  onClick={() => router.push('/learn')}
                  className="px-2 py-2 font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Back to the shelf
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Back a beat"
                className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl border border-foreground/15 bg-foreground/[0.03] transition hover:bg-foreground/[0.06] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {index === 0 ? 'Deal me in' : 'Next'}
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </ActionBar>
    </>
  )
}

/**
 * Webb, and whoever else is round the table this beat: the friendly low-table
 * faces by default, and the beat's own `cast` where it is about who they are.
 */
function facesFor(beat: Beat): Partial<Record<SeatId, SeatFace>> {
  const webbSeat = beat.webb
  const faces: Partial<Record<SeatId, SeatFace>> = {}
  const webb = characterById('webb')
  if (webb) faces[webbSeat] = { name: webb.name, avatar: webb.avatar }
  const others = (['utg', 'mp', 'co', 'btn', 'sb', 'bb'] as const).filter((s) => s !== webbSeat)
  others.forEach((seat, i) => {
    const regular = characterById(beat.cast?.[seat] ?? REGULARS[i % REGULARS.length])
    if (regular) faces[seat] = { name: regular.name, avatar: regular.avatar }
  })
  return faces
}

/** A seat's button says who is in it where that is the question, and the seat otherwise. */
function labelFor(
  id: string,
  label: string,
  beat: Beat,
  faces: Partial<Record<SeatId, SeatFace>>,
): string {
  if (beat.ask?.kind !== 'acts-first') return label
  return id === beat.scene.heroSeat ? 'You' : (faces[id as SeatId]?.name ?? label)
}

function spokenFor(
  id: string,
  label: string,
  beat: Beat,
  faces: Partial<Record<SeatId, SeatFace>>,
): string {
  if (beat.ask?.kind === 'acts-last') return seatById(id as SeatId).name
  return labelFor(id, label, beat, faces)
}

/**
 * Webb's line, under the board where the table's talk goes: his face, what he
 * says, and the question in bold. Once you have answered, the same place gives
 * the verdict — right or not, the reason, and what the table then showed.
 */
function WebbSays({
  beat,
  question,
  picked,
}: {
  beat: Beat
  question: Question | null
  picked: string | null
}) {
  const webb = characterById('webb')
  const right = question && picked !== null ? isRight(question, picked) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="mx-auto flex w-full max-w-xl items-start gap-2.5 px-2"
      aria-live="polite"
    >
      {webb && <PlayerAvatar spec={webb.avatar} size={30} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-foreground/[0.05] px-3.5 py-2.5">
        <p className="text-2xs font-medium text-muted-foreground">Webb</p>
        {right === null ? (
          <>
            <p
              className={cn(
                'mt-0.5 text-sm leading-snug',
                beat.voice === 'webb' ? 'text-foreground' : 'text-foreground/90',
              )}
            >
              {beat.say}
            </p>
            {question && (
              <p className="mt-1.5 text-sm font-semibold leading-snug">{question.prompt}</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-0.5 text-sm leading-snug">
              <span className={cn('font-medium', right ? 'text-emerald-500' : 'text-primary')}>
                {right ? 'That’s it. ' : 'Not this time. '}
              </span>
              <span className="text-foreground/90">{question?.because}</span>
            </p>
            {beat.aside && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + (beat.playOn?.length ?? 0) * (PACE / 1000) }}
                className="mt-1.5 text-sm leading-snug text-muted-foreground"
              >
                {beat.aside}
              </motion.p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

/** Where you are in the lesson: a segment a beat, the stories bar again. */
function BeatProgress({ count, at }: { count: number; at: number }) {
  return (
    <ol
      className="mx-auto flex w-full max-w-2xl gap-1 px-4 pt-1"
      aria-label={`Beat ${at + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <motion.span
            className="block h-full rounded-full bg-foreground/50"
            initial={false}
            animate={{ width: i <= at ? '100%' : '0%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          />
        </li>
      ))}
    </ol>
  )
}
