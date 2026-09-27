'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { type SeatFace, SceneTable } from '@/components/lessons/SceneTable'
import { CAST } from '@/config/cast'
import { type DrillKind, SHOVE_PACK_ID } from '@/config/drills'
import { pct } from '@/config/potOdds'
import type { SeatId } from '@/config/positions'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { SHOVE_BLINDS, SHOVE_WHERE, playShove, shoveTable } from '@/lib/drills/shoveOrFold'
import { BLINDS, type ShoveSeat } from '@/lib/drills/shoveRange'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { ActionBar, Answer, LockedAnswers, NextButton, TalkLine } from './felt'
import { PackProgress, PackSummary } from './pack'
import { ShoveLesson } from './ShoveLesson'

/**
 * Shove or fold, the short-stack pack: a short lesson, then ten hands.
 *
 * **On the real table, a real hand at a time**, the way open-or-fold plays: six
 * seats dealt by the engine at a hundred chips to the big blind, the blinds
 * posted, everybody before you folded, your short stack on your plate and
 * everybody else's covering it (lib/drills/shoveOrFold.ts, `shoveTable`).
 * Answer, and the table plays it: your chips go in, or your cards go away.
 *
 * **Then the arithmetic, where the talk goes**: how often everybody behind
 * folds, how often you win when somebody calls, and what the shove was worth
 * against folding — the same three numbers the grade came from.
 *
 * **Five shoves and five folds, shuffled** (lib/drills/pack.ts), so pressing
 * the same button every time scores five.
 */

const SHOVE_LINES = [
  'Every one. Short stacks are less frightening than they were.',
  'Most of them. The ones you missed are worth a second look.',
  'Some of them. The stack and the seat move the line more than the cards do.',
  'Not many this time. The lesson is one tap away, and so is another ten.',
] as const

/** Round the table: regulars of the low and middle tables, so the faces are a tournament's. */
const REGULARS = CAST.filter((ch) => !ch.only && ch.bands.some((b) => b === 'low' || b === 'mid'))

const shovePlan = () => planPack<'shove' | 'fold'>('shove', 'fold', Math.random)

/** The faces round the table, off the seed, so a spot keeps its company. */
function facesFor(drill: Drill): Partial<Record<SeatId, SeatFace>> {
  const faces: Partial<Record<SeatId, SeatFace>> = {}
  const seats = (['utg', 'mp', 'co', 'btn', 'sb', 'bb'] as const).filter((s) => s !== drill.seat)
  seats.forEach((seat, i) => {
    const regular = REGULARS[(drill.seed + i) % REGULARS.length]
    faces[seat] = { name: regular.name, avatar: regular.avatar }
  })
  return faces
}

type Phase = 'lesson' | 'spots' | 'done'

export function ShovePack({
  kind,
  allowed,
  run,
  setRun,
  onRated,
}: {
  kind: DrillKind
  allowed: boolean
  run: number
  setRun: (run: number) => void
  onRated: (delta: number | null) => void
}) {
  const record = useProfile((s) => s.drills[SHOVE_PACK_ID])
  const progress = record ?? emptyDrillRecord()
  const [phase, setPhase] = useState<Phase>(() =>
    allowed && progress.answered === 0 ? 'lesson' : 'spots',
  )
  const [pack, setPack] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [plan, setPlan] = useState(shovePlan)
  const [ratingAtStart, setRatingAtStart] = useState(progress.rating)

  const again = useCallback(() => {
    setResults([])
    setPlan(shovePlan())
    setRatingAtStart(useProfile.getState().drills[SHOVE_PACK_ID]?.rating ?? progress.rating)
    setPack((n) => n + 1)
    setPhase('spots')
    onRated(null)
  }, [progress.rating, onRated])

  return (
    <MotionConfig reducedMotion="user">
      {phase === 'lesson' ? (
        <ShoveLesson onDone={results.length >= PACK_SIZE ? again : () => setPhase('spots')} />
      ) : phase === 'done' ? (
        <PackSummary
          title={kind.title}
          lines={SHOVE_LINES}
          results={results}
          ratingBefore={ratingAtStart}
          rating={progress.rating}
          onAgain={again}
          onLesson={() => setPhase('lesson')}
          lessonLabel="Read the lesson again"
        />
      ) : (
        <>
          {allowed && <PackProgress results={results} onLesson={() => setPhase('lesson')} />}
          <Spot
            key={pack}
            kind={kind}
            allowed={allowed}
            answered={results.length}
            plan={plan}
            run={run}
            setRun={setRun}
            onRated={onRated}
            onAnswered={(correct) => setResults((r) => [...r, correct])}
            onFinished={() => {
              sound.play('turn')
              setPhase('done')
            }}
          />
        </>
      )}
    </MotionConfig>
  )
}

function Spot({
  kind,
  allowed,
  answered,
  plan,
  run,
  setRun,
  onRated,
  onAnswered,
  onFinished,
}: {
  kind: DrillKind
  allowed: boolean
  answered: number
  plan: readonly ('shove' | 'fold')[]
  run: number
  setRun: (run: number) => void
  onRated: (delta: number | null) => void
  onAnswered: (correct: boolean) => void
  onFinished: () => void
}) {
  const router = useRouter()
  const last = answered >= PACK_SIZE
  const record = useProfile((s) => s.drills[SHOVE_PACK_ID])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()

  const aim = useCallback(
    () => aimFor(kindFloor(SHOVE_PACK_ID), progress.rating, progress.answered),
    [progress.rating, progress.answered],
  )
  // Dealt in the state initialiser, on the client only (see DrillRunner).
  const [drill, setDrill] = useState<Drill>(() =>
    allowed
      ? dealPlanned(SHOVE_PACK_ID, plan[answered] ?? 'shove', aim(), randomSeed)
      : nextDrill(SHOVE_PACK_ID, randomSeed(), aim()),
  )
  const [picked, setPicked] = useState<string | null>(null)
  const grade = picked === null ? null : gradeDrill(drill, picked)

  const seat = (drill.seat ?? 'btn') as ShoveSeat
  const stack = drill.shove?.stack ?? 10
  const base = useMemo(
    () => shoveTable(drill.hands?.[0].cards ?? [], seat, stack, drill.seed),
    [drill, seat, stack],
  )
  // Once you have answered, the table plays what you did.
  const state = useMemo(
    () => (picked === null ? base : playShove(base, picked === 'shove' ? 'shove' : 'fold')),
    [base, picked],
  )
  const faces = useMemo(() => facesFor(drill), [drill])

  const pick = useCallback(
    (choiceId: string) => {
      if (picked !== null || !allowed) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      const was = progress.rating
      setPicked(choiceId)
      setRun(next)
      recordDrill(SHOVE_PACK_ID, result.correct, result.difficulty, next, drill.settledBy)
      onRated(useProfile.getState().drills[SHOVE_PACK_ID].rating - was)
      onAnswered(result.correct)
      sound.play(choiceId === 'shove' ? 'allin' : 'fold')
      haptics.fire(result.correct ? 'win' : 'bust')
    },
    [drill, picked, allowed, run, setRun, progress.rating, recordDrill, onRated, onAnswered],
  )

  const onward = useCallback(() => {
    if (last) {
      onFinished()
      return
    }
    setPicked(null)
    onRated(null)
    setDrill(dealPlanned(SHOVE_PACK_ID, plan[answered] ?? 'shove', aim(), randomSeed))
    sound.play('deal')
    haptics.fire('deal')
  }, [last, onFinished, onRated, aim, plan, answered])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !allowed) return
      const key = event.key.toLowerCase()
      if (picked !== null) {
        if (key === 'enter' || key === ' ') {
          event.preventDefault()
          onward()
        }
        return
      }
      const byKey: Record<string, string> = {
        f: 'fold',
        '1': 'fold',
        a: 'shove',
        s: 'shove',
        '2': 'shove',
      }
      const choice = byKey[key]
      if (choice) {
        event.preventDefault()
        pick(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, pick, onward, allowed])

  const chips = stack * SHOVE_BLINDS.big

  return (
    <>
      <motion.div
        key={drill.seed}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <SceneTable
          state={state}
          faces={faces}
          speaking={picked === null ? seat : null}
          dim={!allowed}
          talk={
            grade ? (
              <TalkLine tone={grade.correct ? 'right' : 'wrong'}>{grade.explanation}</TalkLine>
            ) : (
              <TalkLine>
                {allowed ? (
                  <>
                    {seat === 'utg' ? 'You are first to act' : 'It folds to you'}{' '}
                    {SHOVE_WHERE[seat]} with{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {stack} big blinds
                    </span>
                    .{' '}
                    <span className="whitespace-nowrap font-medium text-foreground">
                      All in, or fold?
                    </span>
                  </>
                ) : (
                  kind.question
                )}
              </TalkLine>
            )
          }
        />
      </motion.div>

      <ActionBar>
        {!allowed ? (
          <LockedAnswers blurb={kind.blurb} onJoin={() => router.push('/membership')} />
        ) : grade ? (
          // The arithmetic sits on the bar rather than on the felt: the felt
          // is already full at a laptop's height, and the numbers belong next
          // to the button that moves on from them.
          <div className="flex flex-col gap-2">
            <Breakdown drill={drill} />
            <NextButton
              label={last ? 'See how you did' : `Next hand · ${answered + 1} of ${PACK_SIZE}`}
              onClick={onward}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Answer label="Fold" shortcut="1" state="open" onPick={() => pick('fold')} />
            <Answer
              label={`All in ${formatChips(chips)}`}
              spoken={`All in, ${formatChips(chips)} chips`}
              shortcut="2"
              state="open"
              onPick={() => pick('shove')}
            />
          </div>
        )}
      </ActionBar>

      {allowed && !grade && (
        <p className="px-4 pb-2 text-center text-2xs text-muted-foreground/70">{kind.gradedBy}</p>
      )}
    </>
  )
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`

/**
 * The shove, as arithmetic: how often it takes the blinds uncontested, how
 * often it is called and what it wins then, and the total against folding.
 * The three numbers the sentence above says, drawn so the two halves of a
 * shove can be seen side by side.
 *
 * On a laptop-height window it drops to the three numbers alone: the bar and
 * the notes under them repeat the sentence above, and the felt needs the room.
 */
function Breakdown({ drill }: { drill: Drill }) {
  const shove = drill.shove
  if (!shove) return null
  const called = 1 - shove.foldAll
  const good = shove.ev > 0
  return (
    <motion.div
      className="mx-auto w-full max-w-md rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-2.5"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full bg-foreground/[0.06] [@media(max-height:800px)]:hidden"
        aria-hidden
      >
        <motion.span
          className="h-full bg-emerald-500"
          initial={{ width: '0%' }}
          animate={{ width: `${shove.foldAll * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.span
          className="h-full border-l border-background bg-foreground/25"
          initial={{ width: '0%' }}
          animate={{ width: `${called * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.05 }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 items-end gap-2 text-center [@media(max-height:800px)]:mt-0">
        <Stat
          label="All fold"
          value={`${pct(shove.foldAll)}%`}
          note={`+${BLINDS} blinds`}
          tone="win"
        />
        <Stat
          label="You are called"
          value={`${pct(called)}%`}
          note={`you win ${pct(shove.equityCalled)}%`}
        />
        <Stat
          label="Shove vs fold"
          value={`${signed(shove.ev)} bb`}
          note="against folding"
          tone={good ? 'win' : 'lose'}
          big
        />
      </div>
    </motion.div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
  big = false,
}: {
  label: string
  value: string
  note: string
  tone?: 'win' | 'lose'
  big?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'font-semibold tabular-nums tracking-tight',
          big ? 'text-xl' : 'text-base',
          tone === 'win' && 'text-emerald-500',
          tone === 'lose' && 'text-foreground/70',
        )}
      >
        {value}
      </span>
      <span className="text-3xs text-muted-foreground [@media(max-height:800px)]:hidden">
        {note}
      </span>
    </div>
  )
}
