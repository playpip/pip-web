'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { type SeatFace, SceneTable } from '@/components/lessons/SceneTable'
import { CAST } from '@/config/cast'
import { type DrillKind, OPEN_PACK_ID } from '@/config/drills'
import { POSITION_LESSON_ID } from '@/config/lessons'
import type { SeatId } from '@/config/positions'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { OPEN_TO, foldsTo, playActions, sceneState } from '@/lib/lessons/scene'
import { haptics } from '@/lib/haptics'
import { cardToString } from '@/lib/poker/cards'
import { sound } from '@/lib/sound'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { ActionBar, Answer, LockedAnswers, NextButton, TalkLine } from './felt'
import { PackProgress, PackSummary } from './pack'

/**
 * Open or fold, the second practice pack: ten hands, then a count.
 *
 * **It plays on the table, a real hand at a time.** Each spot is dealt by the
 * engine (lib/lessons/scene.ts) — six seats, the blinds posted, everybody in
 * front of you folding in turn — so what you see is the table at the moment it
 * is your turn: the fold stamps on the seats before you, the two blinds with
 * their chips out, the button where it is, and your two cards. Answer, and the
 * table plays your move.
 *
 * **Graded by the chart the free guides print**, through the kind's generator
 * (lib/drills/openOrFold.ts), so a hand cannot be a raise here and a fold on
 * /learn/starting-hands. The lesson it follows is the Position lesson, one tap
 * away at the top, and the lesson hands you here at its end.
 *
 * **Five raises and five folds, shuffled** (lib/drills/pack.ts). Pressing
 * Raise every time scores five, and so does pressing Fold every time.
 */

/** What the end of a pack says, from every one right down to not many. */
const OPEN_LINES = [
  'Every one. You played the seat as well as the cards.',
  'Most of them. The ones you missed are worth a second look.',
  'Some of them. The chart takes a few hundred hands to become a habit.',
  'Not many this time. The lesson is one tap away, and so is another ten.',
] as const

/** Round the table: low-table regulars, so the seats read as a friendly game. */
const REGULARS = CAST.filter((ch) => !ch.only && ch.bands.includes('low'))

/** How the table puts it to you, seat by seat. */
const WHERE: Partial<Record<SeatId, string>> = {
  utg: 'You are first to act, under the gun.',
  mp: 'It folds to you in the middle seat.',
  co: 'It folds to you in the cutoff.',
  btn: 'It folds to you on the button.',
}

const openPlan = () => planPack<'raise' | 'fold'>('raise', 'fold', Math.random)

type Phase = 'spots' | 'done'

export function OpenPack({
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
  const router = useRouter()
  const record = useProfile((s) => s.drills[OPEN_PACK_ID])
  const progress = record ?? emptyDrillRecord()
  const [phase, setPhase] = useState<Phase>('spots')
  const [pack, setPack] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [plan, setPlan] = useState(openPlan)
  const [ratingAtStart, setRatingAtStart] = useState(progress.rating)
  const toLesson = useCallback(() => router.push(`/game/lessons/${POSITION_LESSON_ID}`), [router])

  const again = useCallback(() => {
    setResults([])
    setPlan(openPlan())
    setRatingAtStart(useProfile.getState().drills[OPEN_PACK_ID]?.rating ?? progress.rating)
    setPack((n) => n + 1)
    setPhase('spots')
    onRated(null)
  }, [progress.rating, onRated])

  return (
    <MotionConfig reducedMotion="user">
      {phase === 'done' ? (
        <PackSummary
          title={kind.title}
          lines={OPEN_LINES}
          results={results}
          ratingBefore={ratingAtStart}
          rating={progress.rating}
          onAgain={again}
          onLesson={toLesson}
          lessonLabel="The Position lesson"
        />
      ) : (
        <>
          {allowed && <PackProgress results={results} onLesson={toLesson} />}
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

/** The faces round the table for a spot, off its seed, so a spot keeps its company. */
function facesFor(drill: Drill): Partial<Record<SeatId, SeatFace>> {
  const faces: Partial<Record<SeatId, SeatFace>> = {}
  const seats = (['utg', 'mp', 'co', 'btn', 'sb', 'bb'] as const).filter((s) => s !== drill.seat)
  seats.forEach((seat, i) => {
    // Consecutive from a start the seed picks, so nobody sits down twice.
    const regular = REGULARS[(drill.seed + i) % REGULARS.length]
    faces[seat] = { name: regular.name, avatar: regular.avatar }
  })
  return faces
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
  /** Spots answered in this pack, counting the one on the screen once it is. */
  answered: number
  plan: readonly ('raise' | 'fold')[]
  run: number
  setRun: (run: number) => void
  onRated: (delta: number | null) => void
  onAnswered: (correct: boolean) => void
  onFinished: () => void
}) {
  const router = useRouter()
  const last = answered >= PACK_SIZE
  const record = useProfile((s) => s.drills[OPEN_PACK_ID])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()

  const aim = useCallback(
    () => aimFor(kindFloor(OPEN_PACK_ID), progress.rating, progress.answered),
    [progress.rating, progress.answered],
  )
  // Dealt in the state initialiser, on the client only, so the static export
  // never bakes a hand into its HTML. A tease on a gated screen has no plan.
  const [drill, setDrill] = useState<Drill>(() =>
    allowed
      ? dealPlanned(OPEN_PACK_ID, plan[answered] ?? 'raise', aim(), randomSeed)
      : nextDrill(OPEN_PACK_ID, randomSeed(), aim()),
  )
  const [picked, setPicked] = useState<string | null>(null)
  const grade = picked === null ? null : gradeDrill(drill, picked)

  const seat = (drill.seat ?? 'btn') as SeatId
  const scene = useMemo(() => {
    const hero = drill.hands?.[0].cards.map(cardToString) ?? []
    return { heroSeat: seat, hero: [hero[0], hero[1]] as const, actions: foldsTo(seat) }
  }, [drill, seat])
  const base = useMemo(() => sceneState(scene, drill.seed), [scene, drill.seed])
  // Once you have answered, the table plays what you did.
  const state = useMemo(
    () =>
      picked === null
        ? base
        : playActions(base, [
            picked === 'raise' ? { seat, type: 'raise', to: OPEN_TO } : { seat, type: 'fold' },
          ]),
    [base, picked, seat],
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
      recordDrill(OPEN_PACK_ID, result.correct, result.difficulty, next, drill.settledBy)
      onRated(useProfile.getState().drills[OPEN_PACK_ID].rating - was)
      onAnswered(result.correct)
      sound.play(choiceId === 'raise' ? 'raise' : 'fold')
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
    setDrill(dealPlanned(OPEN_PACK_ID, plan[answered] ?? 'raise', aim(), randomSeed))
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
      const byKey: Record<string, string> = { f: 'fold', '1': 'fold', r: 'raise', '2': 'raise' }
      const choice = byKey[key]
      if (choice) {
        event.preventDefault()
        pick(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, pick, onward, allowed])

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
                    {WHERE[seat]}{' '}
                    <span className="font-medium text-foreground">Raise or fold?</span>
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
          <NextButton
            label={last ? 'See how you did' : `Next hand · ${answered + 1} of ${PACK_SIZE}`}
            onClick={onward}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Answer label="Fold" shortcut="1" state="open" onPick={() => pick('fold')} />
            <Answer
              label={`Raise to ${OPEN_TO}`}
              spoken={`Raise to ${OPEN_TO} chips`}
              shortcut="2"
              state="open"
              onPick={() => pick('raise')}
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
