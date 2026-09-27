'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { cardBackById } from '@/config/cardBacks'
import { CAST, type Character } from '@/config/cast'
import { BET_PACK_ID, type DrillKind } from '@/config/drills'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill, DrillLineStep } from '@/lib/drills/types'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { BetLesson, CallStrip } from './BetLesson'
import {
  ActionBar,
  Answer,
  Board,
  Felt,
  Holding,
  LockedAnswers,
  NextButton,
  TalkLine,
} from './felt'
import { PackProgress, PackSummary } from './pack'

/**
 * Bet or check, the river pack's mirror: a short lesson, then ten spots.
 *
 * **On the table, like the river pack**: the same felt, the board at board
 * size, your hand at the foot, one of the regulars across from you with what
 * happened on each street, and the two answers where check and bet live. Once
 * you answer, their face-down cards give way to what would have called: the
 * hands you beat and the hands that beat you, grouped the way you would name
 * them.
 *
 * **The face across is company, not a clue.** Every spot is only asked when its
 * answer holds from the tightest calling the bots were measured at to the
 * loosest (lib/drills/valueRange.ts), so the regulars drawn here are the ones
 * whose personality claims nothing about how tight they play.
 */

const OPPONENTS: readonly Character[] = (() => {
  const plain = CAST.filter(
    (ch) =>
      !ch.only &&
      ch.delta?.tightness === undefined &&
      ch.delta?.bluff === undefined &&
      ch.bands.some((band) => band === 'low' || band === 'mid'),
  )
  return plain.length > 0 ? plain : CAST.filter((ch) => !ch.only)
})()

const BET_LINES = [
  'Every one. You got paid, and you did not pay anybody off.',
  'Most of them. The ones you missed are worth a second look.',
  'Some of them. Betting for value is counting the other seat’s hands.',
  'Not many this time. The lesson is one tap away, and so is another ten.',
] as const

const betPlan = () => planPack<'bet' | 'check'>('bet', 'check', Math.random)

const opponentFor = (drill: Drill): Character => OPPONENTS[drill.seed % OPPONENTS.length]

type Phase = 'lesson' | 'spots' | 'done'

export function BetPack({
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
  const record = useProfile((s) => s.drills[BET_PACK_ID])
  const progress = record ?? emptyDrillRecord()
  // The lesson opens the pack the first time, and is one tap away after.
  const [phase, setPhase] = useState<Phase>(() =>
    allowed && progress.answered === 0 ? 'lesson' : 'spots',
  )
  const [pack, setPack] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [plan, setPlan] = useState(betPlan)
  const [ratingAtStart, setRatingAtStart] = useState(progress.rating)

  const again = useCallback(() => {
    setResults([])
    setPlan(betPlan())
    setRatingAtStart(useProfile.getState().drills[BET_PACK_ID]?.rating ?? progress.rating)
    setPack((n) => n + 1)
    setPhase('spots')
    onRated(null)
  }, [progress.rating, onRated])

  return (
    <MotionConfig reducedMotion="user">
      {phase === 'lesson' ? (
        <BetLesson onDone={results.length >= PACK_SIZE ? again : () => setPhase('spots')} />
      ) : phase === 'done' ? (
        <PackSummary
          title={kind.title}
          lines={BET_LINES}
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
  plan: readonly ('bet' | 'check')[]
  run: number
  setRun: (run: number) => void
  onRated: (delta: number | null) => void
  onAnswered: (correct: boolean) => void
  onFinished: () => void
}) {
  const router = useRouter()
  const last = answered >= PACK_SIZE
  const record = useProfile((s) => s.drills[BET_PACK_ID])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()
  const avatar = useProfile((s) => s.avatar)
  const cardBack = cardBackById(useProfile((s) => s.cardBack))

  const aim = useCallback(
    () => aimFor(kindFloor(BET_PACK_ID), progress.rating, progress.answered),
    [progress.rating, progress.answered],
  )
  // Dealt in the state initialiser, on the client only, so a static export
  // never bakes a spot into its HTML. A tease on a gated screen has no plan.
  const [drill, setDrill] = useState<Drill>(() =>
    allowed
      ? dealPlanned(BET_PACK_ID, plan[answered] ?? 'bet', aim(), randomSeed)
      : nextDrill(BET_PACK_ID, randomSeed(), aim()),
  )
  const [picked, setPicked] = useState<string | null>(null)
  const grade = picked === null ? null : gradeDrill(drill, picked)
  const opponent = useMemo(() => opponentFor(drill), [drill])
  const bet = drill.calling?.bet ?? 0
  const pot = drill.calling?.pot ?? 0

  const pick = useCallback(
    (choiceId: string) => {
      if (picked !== null || !allowed) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      const was = progress.rating
      setPicked(choiceId)
      setRun(next)
      recordDrill(BET_PACK_ID, result.correct, result.difficulty, next, drill.settledBy)
      onRated(useProfile.getState().drills[BET_PACK_ID].rating - was)
      onAnswered(result.correct)
      sound.play(choiceId === 'bet' ? 'bet' : 'check')
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
    setDrill(dealPlanned(BET_PACK_ID, plan[answered] ?? 'bet', aim(), randomSeed))
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
        c: 'check',
        x: 'check',
        '1': 'check',
        b: 'bet',
        '2': 'bet',
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
            grade && drill.calling ? (
              <Verdict character={opponent} drill={drill} />
            ) : (
              <Opponent
                character={opponent}
                line={drill.line ?? []}
                cardBack={cardBack}
                dim={!allowed}
              />
            )
          }
          board={
            <>
              <Board cards={drill.board} slots={5} dim={!allowed} />
              <div className="flex items-baseline justify-center gap-2 px-2">
                <span className="sr-only">{`Pot ${formatChips(pot)} chips.`}</span>
                <span
                  aria-hidden
                  className="text-2xs uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Pot
                </span>
                <span aria-hidden className="text-xl font-semibold tabular-nums">
                  {formatChips(pot)}
                </span>
              </div>
              {grade ? (
                <TalkLine tone={grade.correct ? 'right' : 'wrong'}>{grade.explanation}</TalkLine>
              ) : (
                <TalkLine>
                  {allowed
                    ? `${opponent.name} checks to you. Bet ${formatChips(bet)}, or check it back?`
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
            <Answer label="Check" shortcut="1" state="open" onPick={() => pick('check')} />
            <Answer
              label={`Bet ${formatChips(bet)}`}
              spoken={`Bet ${formatChips(bet)} chips`}
              shortcut="2"
              state="open"
              onPick={() => pick('bet')}
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

const STREET: Record<DrillLineStep['street'], string> = {
  flop: 'the flop',
  turn: 'the turn',
  river: 'the river',
}

/** "You bet 40 on the flop and they called, the turn went check-check, and they checked the river." */
function lineSentence(name: string, line: readonly DrillLineStep[]): string {
  const parts = line.map((step) =>
    step.street === 'river'
      ? `${name} checked the river to you`
      : step.action === 'bet'
        ? `you bet ${formatChips(step.amount ?? 0)} on ${STREET[step.street]} and ${name} called`
        : `${STREET[step.street]} was checked through`,
  )
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}.`
}

/**
 * Across the table: who you are up against, their cards face down, and the
 * hand so far, one street a step. Your bets they called are drawn as yours;
 * their check on the river, the one you are answering, is lit.
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
    <div
      className={cn(
        'flex flex-col items-center gap-2 transition-opacity sm:flex-row sm:gap-4',
        dim && 'opacity-45',
      )}
    >
      <span className="sr-only">{lineSentence(character.name, line)}</span>
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
                {facing
                  ? 'Checks to you'
                  : step.action === 'bet'
                    ? `You bet ${formatChips(step.amount ?? 0)}`
                    : 'Check, check'}
              </span>
              {!facing && step.action === 'bet' && (
                <span className="text-3xs text-muted-foreground">called</span>
              )}
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * The answer, drawn where they sat: what calls this bet, how much of it you
 * beat, and the half it is measured against. Then the calling hands by name,
 * strongest first, each with how many of them you beat.
 */
function Verdict({ character, drill }: { character: Character; drill: Drill }) {
  const calling = drill.calling
  if (!calling) return null
  return (
    <motion.div
      className="w-full max-w-md rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 pb-3 pt-2.5"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      <div className="flex items-center gap-2">
        <PlayerAvatar spec={character.avatar} size={20} />
        <span className="text-xs font-medium">
          What {character.name} calls {formatChips(calling.bet)} with
        </span>
      </div>
      <div className="mt-1">
        <CallStrip calls={calling.calls} callsBeaten={calling.callsBeaten} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {calling.groups
          .filter((group) => group.hands >= 0.5)
          .map((group, i) => {
            const all = Math.round(group.hands)
            const beaten = Math.round(group.beaten)
            const tone =
              beaten >= all ? 'win' : beaten === 0 ? 'lose' : ('split' as 'win' | 'lose' | 'split')
            return (
              <motion.li
                key={group.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26, delay: 0.2 + i * 0.05 }}
                className={cn(
                  'flex items-baseline gap-1.5 rounded-full px-2.5 py-1 text-2xs',
                  tone === 'win' && 'bg-emerald-500/12 text-foreground ring-1 ring-emerald-500/30',
                  tone === 'lose' && 'bg-foreground/[0.07] text-muted-foreground',
                  tone === 'split' &&
                    'bg-foreground/[0.05] text-foreground ring-1 ring-foreground/10',
                )}
              >
                <span className="font-medium">{group.label}</span>
                <span className="tabular-nums">
                  {tone === 'win'
                    ? `${all}, you beat all`
                    : tone === 'lose'
                      ? `${all}, all beat you`
                      : `you beat ${beaten} of ${all}`}
                </span>
              </motion.li>
            )
          })}
      </ul>
    </motion.div>
  )
}
