'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { CardBack } from '@/components/CardBack'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { cardBackById } from '@/config/cardBacks'
import { CAST, type Character } from '@/config/cast'
import { type DrillKind, RIVER_PACK_ID } from '@/config/drills'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill, DrillLineStep } from '@/lib/drills/types'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
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
import { useDrillExit } from './exit'

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

/** How many spots a pack deals before it stops to show you how it went. */
const PACK_SIZE = 10

/**
 * Who can sit across the table: regulars of the low and middle tables, not
 * pinned to a room, and with no bluffing claimed in their personality.
 */
const OPPONENTS: readonly Character[] = CAST.filter(
  (ch) =>
    !ch.only &&
    ch.delta?.bluff === undefined &&
    ch.bands.some((band) => band === 'low' || band === 'mid'),
)

/**
 * The answers a pack will have, in a shuffled order: exactly half calls.
 *
 * **Why the pack fixes the split rather than trusting the stream.** Every
 * generated spot is a coin toss between call and fold, but the aim picks spots
 * by rung and the rungs lean (see `RiverShape`), so ten aimed spots can lean
 * too — the first playthrough of this screen scored nine in ten by pressing
 * Call every time. Five and five means no single button beats a coin. Which
 * spots answer which way is still the generator's, graded exactly as ever; the
 * pack only chooses which of the dealt spots to keep. `Math.random` is fine
 * here: the order is not a thing that has to be reproducible, and each spot
 * still carries its own seed.
 */
function planPack(): ('call' | 'fold')[] {
  const plan = Array.from({ length: PACK_SIZE }, (_, i): 'call' | 'fold' =>
    i % 2 === 0 ? 'call' : 'fold',
  )
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  return plan
}

/** How many dealt spots to look through for the answer the plan wants. */
const PLAN_TRIES = 6

/**
 * The next spot, aimed, with the answer the plan asked for. Each try is an
 * ordinary aimed deal from a fresh seed; a spot of the wrong answer is simply
 * not shown, the way the generator drops a spot that is not a fair question.
 * The fallback after {@link PLAN_TRIES} is the last spot dealt, so the screen
 * never waits on a lean stream.
 */
function dealFor(want: 'call' | 'fold', aim: number): Drill {
  let drill = nextDrill(RIVER_PACK_ID, randomSeed(), aim)
  for (let i = 1; i < PLAN_TRIES && drill.answer !== want; i++) {
    drill = nextDrill(RIVER_PACK_ID, randomSeed(), aim)
  }
  return drill
}

/** The seat for a spot, off its seed, so the same spot always has the same face. */
const opponentFor = (drill: Drill): Character => OPPONENTS[drill.seed % OPPONENTS.length]

const STREET: Record<DrillLineStep['street'], string> = {
  flop: 'the flop',
  turn: 'the turn',
  river: 'the river',
}

/** What they did, as one sentence: "checked the flop, bet 40 into 80 on the turn, …". */
function lineSentence(line: readonly DrillLineStep[]): string {
  const parts = line.map((step) =>
    step.action === 'check'
      ? `checked ${STREET[step.street]}`
      : `bet ${formatChips(step.amount ?? 0)} into ${formatChips(step.potBefore)} on ${STREET[step.street]}`,
  )
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

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
  const [plan, setPlan] = useState(planPack)
  const [ratingAtStart, setRatingAtStart] = useState(progress.rating)

  const startSpots = useCallback(() => setPhase('spots'), [])
  const again = useCallback(() => {
    setResults([])
    setPlan(planPack())
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
        <Summary
          results={results}
          ratingBefore={ratingAtStart}
          rating={progress.rating}
          onAgain={again}
          onLesson={() => setPhase('lesson')}
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
 * Where you are in the ten: a segment each, filled as you answer, the current
 * one lit. iOS's stories bar, with the lesson one tap away at the end of it.
 */
function PackProgress({ results, onLesson }: { results: boolean[]; onLesson: () => void }) {
  return (
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
                animate={{ width: answered !== undefined || i === results.length ? '100%' : '0%' }}
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
      ? dealFor(plan[answered] ?? 'call', aim())
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
    setDrill(dealFor(plan[answered] ?? 'call', aim()))
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
          <LockedAnswers blurb={kind.blurb} onJoin={() => router.push('/membership')} />
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
 * Across the table: who bet, their two cards face down, and what they did on
 * each street. The line is the question as much as the cards are, so it is set
 * as three steps you can read at a glance, with the river's bet — the one you
 * are facing — lit.
 */
function Opponent({
  character,
  line,
  cardBack,
  dim,
}: {
  character: Character
  line: readonly DrillLineStep[]
  cardBack: ReturnType<typeof cardBackById>
  dim: boolean
}) {
  return (
    // One column on a phone, where height is cheap and width is not; one row
    // on a desktop, where the verdict needs the height the column would take.
    <div
      className={cn(
        'flex flex-col items-center gap-2 transition-opacity sm:flex-row sm:gap-4',
        dim && 'opacity-45',
      )}
    >
      <span className="sr-only">{`${character.name} ${lineSentence(line)}.`}</span>
      <div className="flex items-center gap-2" aria-hidden>
        <PlayerAvatar spec={character.avatar} size={28} />
        <span className="text-sm font-medium">{character.name}</span>
        <span className="flex gap-0.5">
          <CardBack design={cardBack} size="xs" className="-rotate-6" />
          <CardBack design={cardBack} size="xs" className="rotate-6" />
        </span>
      </div>
      <ol className="flex items-stretch gap-1.5" aria-hidden>
        {line.map((step, i) => {
          const facing = step.street === 'river'
          return (
            <motion.li
              key={step.street}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.25 + i * 0.12 }}
              className={cn(
                'flex min-w-[4.75rem] flex-col items-center rounded-xl px-2.5 py-1.5',
                facing ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.05]',
              )}
            >
              <span
                className={cn(
                  'text-3xs font-medium uppercase tracking-[0.18em]',
                  facing ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {step.street}
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {step.action === 'check' ? 'Check' : `Bet ${formatChips(step.amount ?? 0)}`}
              </span>
              {step.action === 'bet' && (
                <span
                  className={cn(
                    'text-3xs tabular-nums',
                    facing ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  into {formatChips(step.potBefore)}
                </span>
              )}
            </motion.li>
          )
        })}
      </ol>
    </div>
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

/**
 * The end of a pack: how many, what it did to the rating, and the way on.
 *
 * One number and one line. It never grades the player as a person, and the
 * line for a bad pack is as flat as the line for a good one.
 */
function Summary({
  results,
  ratingBefore,
  rating,
  onAgain,
  onLesson,
}: {
  results: boolean[]
  ratingBefore: number
  rating: number
  onAgain: () => void
  onLesson: () => void
}) {
  const exit = useDrillExit()
  const right = results.filter(Boolean).length
  const delta = rating - ratingBefore
  const line =
    right === results.length
      ? 'Every one. The river is less of a stranger than it was.'
      : right >= results.length * 0.7
        ? 'Most of them. The ones you missed are worth a second look.'
        : right >= results.length * 0.4
          ? 'Some of them. This is the hard street; that is why it has a pack.'
          : 'Not many this time. The lesson is one tap away, and so is another ten.'

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="flex flex-col items-center gap-3"
      >
        <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Calling the river
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
        <div className="flex justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={onLesson}
            className="px-2 py-2 font-medium text-muted-foreground transition hover:text-foreground"
          >
            Read the lesson again
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
  )
}
