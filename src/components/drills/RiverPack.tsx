'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { cardBackById } from '@/config/cardBacks'
import type { Character } from '@/config/cast'
import { type DrillKind, RIVER_PACK_ID, membershipForDrill } from '@/config/drills'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/useMoney'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import {
  ActionBar,
  Answer,
  Board,
  Felt,
  Holding,
  LockedAnswers,
  NextButton,
  Pot,
  TalkLine,
} from './felt'
import { RangeStrip, RiverLesson } from './RiverLesson'
import { Opponent, opponentFor } from './riverSeat'
import { PackProgress, PackSummary } from './pack'

/**
 * Calling the river, the first practice pack: a short lesson, then ten spots.
 *
 * **It plays on the table** (Will, 2026-09-23: "it plays on the real poker
 * table used for games"). The same felt every drill uses — the board at board
 * size, your cards at the foot, the answers where fold and call live — with one
 * of the regulars across from you and what they did written under them. The
 * spot is a hand, not a worksheet.
 *
 * **Ten, and then a count**, because a pack is a thing you finish. Nothing is
 * metered: another ten is one tap, and the rating and the record are the kind's
 * own (see config/drills.ts on why this is a kind). The ten is a length, not an
 * allowance.
 *
 * **The opponent's face is company, not a clue.** The range is the same
 * whoever sits there — the generator only asks a spot whose answer holds from
 * the Garage's bluffing to the Main Event's (lib/drills/callingTheRiver.ts) —
 * so the regulars drawn here are the ones whose bios make no claim about
 * bluffing. Putting Frank ("bluffs constantly") across a spot graded as if he
 * were average would be the screen contradicting the answer key.
 */

/** What the end of a pack says, from every one right down to not many. */
const RIVER_LINES = [
  'Every one. The river is less of a stranger than it was.',
  'Most of them. The ones you missed are worth a second look.',
  'Some of them. This is the hard street; that is why it has a pack.',
  'Not many this time. The lesson is one tap away, and so is another ten.',
] as const

/**
 * Five calls and five folds, shuffled (see lib/drills/pack.ts for why a pack
 * fixes its split). `Math.random` is fine: the order is not a thing that has to
 * be reproducible, and each spot still carries its own seed.
 */
const riverPlan = () => planPack<'call' | 'fold'>('call', 'fold', Math.random)

type Phase = 'lesson' | 'spots' | 'done'

export function RiverPack({
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
  const record = useProfile((s) => s.drills[RIVER_PACK_ID])
  const progress = record ?? emptyDrillRecord()
  // The lesson opens the pack for anybody who has never answered a spot, and
  // is one tap away for everybody else. Read once, at mount: answering the
  // first spot must not send the screen back to the lesson.
  const [phase, setPhase] = useState<Phase>(() =>
    allowed && progress.answered === 0 ? 'lesson' : 'spots',
  )
  const [pack, setPack] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [plan, setPlan] = useState(riverPlan)
  const [ratingAtStart, setRatingAtStart] = useState(progress.rating)

  const startSpots = useCallback(() => setPhase('spots'), [])
  const again = useCallback(() => {
    setResults([])
    setPlan(riverPlan())
    setRatingAtStart(useProfile.getState().drills[RIVER_PACK_ID]?.rating ?? progress.rating)
    setPack((n) => n + 1)
    setPhase('spots')
    onRated(null)
  }, [progress.rating, onRated])

  return (
    <MotionConfig reducedMotion="user">
      {phase === 'lesson' ? (
        // Read from the end of a pack, the lesson leads into a fresh ten
        // rather than back into the one that is finished.
        <RiverLesson onDone={results.length >= PACK_SIZE ? again : startSpots} />
      ) : phase === 'done' ? (
        <PackSummary
          title={kind.title}
          lines={RIVER_LINES}
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
            // A fresh pack is a fresh run of spots, and nothing on the old
            // spot's screen should survive into it.
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

/**
 * One spot, and the next. Keyed per pack, so a new pack starts clean; the
 * spots inside it change in place, keyed by seed on the felt.
 */
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
  plan: readonly ('call' | 'fold')[]
  run: number
  setRun: (run: number) => void
  onRated: (delta: number | null) => void
  onAnswered: (correct: boolean) => void
  onFinished: () => void
}) {
  const router = useRouter()
  // Read after the answer is in, so the tenth answer is what makes it the last.
  const last = answered >= PACK_SIZE
  const record = useProfile((s) => s.drills[RIVER_PACK_ID])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()
  const avatar = useProfile((s) => s.avatar)
  const cardBack = cardBackById(useProfile((s) => s.cardBack))

  // Aimed like every kind: the bottom of the ladder for a newcomer, walking to
  // the rating over the first ten answers (see `aimFor`). Read when a spot is
  // dealt, never live, or answering would re-aim the spot on the screen.
  const aim = useCallback(
    () => aimFor(kindFloor(RIVER_PACK_ID), progress.rating, progress.answered),
    [progress.rating, progress.answered],
  )
  // Dealt in the state initialiser, on the client only (the runner mounts this
  // after hydration), so a static export never bakes a spot into its HTML.
  // About 8ms a spot on a desktop, two or three tries for the planned answer,
  // so there is nothing to deal ahead. A tease on a gated screen has no plan.
  const [drill, setDrill] = useState<Drill>(() =>
    allowed
      ? dealPlanned(RIVER_PACK_ID, plan[answered] ?? 'call', aim(), randomSeed)
      : nextDrill(RIVER_PACK_ID, randomSeed(), aim()),
  )
  const [picked, setPicked] = useState<string | null>(null)
  const grade = picked === null ? null : gradeDrill(drill, picked)
  const opponent = useMemo(() => opponentFor(drill), [drill])
  const line = drill.line ?? []
  const stakes = drill.stakes

  const pick = useCallback(
    (choiceId: string) => {
      if (picked !== null || !allowed) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      const was = progress.rating
      setPicked(choiceId)
      setRun(next)
      recordDrill(RIVER_PACK_ID, result.correct, result.difficulty, next, drill.settledBy)
      onRated(useProfile.getState().drills[RIVER_PACK_ID].rating - was)
      onAnswered(result.correct)
      // The chips first, then the verdict under your thumb.
      sound.play(choiceId === 'call' ? 'call' : 'fold')
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
    setDrill(dealPlanned(RIVER_PACK_ID, plan[answered] ?? 'call', aim(), randomSeed))
    sound.play('deal')
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
      const byKey: Record<string, string> = { f: 'fold', '1': 'fold', c: 'call', '2': 'call' }
      const choice = byKey[key]
      if (choice) {
        event.preventDefault()
        pick(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, pick, onward, allowed])

  const hero = drill.hands?.[0]

  return (
    <>
      <motion.div
        key={drill.seed}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Felt
          across={
            // Once you have answered, their two face-down cards give way to
            // what they could have been: the range, where the bettor sits.
            // Nothing is turned over, because there was never one hand.
            grade && drill.range && stakes ? (
              <Verdict
                character={opponent}
                drill={drill}
                required={stakes.toCall / (stakes.pot + stakes.toCall)}
              />
            ) : (
              <Opponent character={opponent} line={line} cardBack={cardBack} dim={!allowed} />
            )
          }
          board={
            <>
              <Board cards={drill.board} slots={5} dim={!allowed} />
              {stakes && <Pot stakes={stakes} />}
              {grade ? (
                <TalkLine tone={grade.correct ? 'right' : 'wrong'}>{grade.explanation}</TalkLine>
              ) : (
                <TalkLine>
                  {allowed
                    ? `${opponent.name} bets ${formatChips(stakes?.toCall ?? 0)}. Call or fold?`
                    : kind.question}
                </TalkLine>
              )}
            </>
          }
          hero={
            hero && (
              <Holding
                label="You"
                detail={hero.detail}
                cards={hero.cards}
                size="hero"
                avatar={avatar ?? undefined}
                layout="below"
                dim={!allowed}
              />
            )
          }
        />
      </motion.div>

      <ActionBar>
        {!allowed ? (
          <LockedAnswers
            blurb={kind.blurb}
            onJoin={() => router.push(membershipForDrill(kind.id))}
          />
        ) : grade ? (
          <NextButton
            label={last ? 'See how you did' : `Next spot · ${answered + 1} of ${PACK_SIZE}`}
            onClick={onward}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Answer label="Fold" shortcut="1" state="open" onPick={() => pick('fold')} />
            <Answer
              label={`Call ${formatChips(stakes?.toCall ?? 0)}`}
              spoken={`Call ${formatChips(stakes?.toCall ?? 0)} chips`}
              shortcut="2"
              state="open"
              onPick={() => pick('call')}
            />
          </div>
        )}
      </ActionBar>

      {/* The small print gives its line to the verdict once there is one. */}
      {allowed && !grade && (
        <p className="px-4 pb-2 text-center text-2xs text-muted-foreground/70">{kind.gradedBy}</p>
      )}
    </>
  )
}

/**
 * The answer, drawn where the bettor sat: what bets like this, how much of it
 * you beat, and the price as a line across it. The sentence on the felt says
 * the same two numbers; this is where you see why they are those numbers.
 */
function Verdict({
  character,
  drill,
  required,
}: {
  character: Character
  drill: Drill
  required: number
}) {
  const range = drill.range
  if (!range) return null
  const bluffs = Math.round(range.bluffs)
  return (
    <motion.div
      className="w-full max-w-md rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 pb-3 pt-2.5"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      <div className="flex items-center gap-2">
        <PlayerAvatar spec={character.avatar} size={20} />
        <span className="text-xs font-medium">What {character.name} bets like this</span>
      </div>
      <div className="mt-1">
        <RangeStrip
          value={range.value}
          valueBeaten={range.valueBeaten}
          bluffs={range.bluffs}
          bluffsBeaten={range.bluffsBeaten}
          required={required}
        />
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">
        {capitalise(range.weakestValue)} or better ({formatChips(range.value)}{' '}
        {range.value === 1 ? 'hand' : 'hands'})
        {bluffs > 0
          ? `, and about ${bluffs} ${bluffs === 1 ? 'hand' : 'hands'} that missed.`
          : ', and almost nothing that missed.'}
      </p>
    </motion.div>
  )
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1)
