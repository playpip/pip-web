'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { PlayingCard } from '@/components/PlayingCard'
import {
  ITERATIONS,
  type PlayedHand,
  type StreetId,
  afterStreet,
  gradeDrill,
  nextPlayedHand,
  randomSeed,
} from '@/lib/drills'
import type { DrillKindId } from '@/lib/drills/types'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { Header, ShownHand, Stakes, cardKey } from './parts'

/**
 * Pot odds, played out: one hand, dealt once, priced street by street against a
 * range instead of against two cards you can see.
 *
 * **A mode of the pot odds kind, not a fifth kind** (RULED technology#86). It
 * registers nothing, so it inherits `membersOnly` from that kind's entry and
 * rule #8's free-forever exposure never comes up. The engine, and the whole of
 * the argument about grading off a sampled number, is lib/drills/playItOut.ts.
 *
 * **The hand runs while you call, and folding ends it.** That is `afterStreet`
 * in the engine rather than a rule written here, because the script prices
 * every later street off a pot both bets went into.
 *
 * **Nothing is turned over at the end.** The opponent is a range and not a
 * hand, so there is no second holding to show: dealing one out of the range to
 * finish on would be a picture of a hand nobody was ever holding, and it would
 * read as the answer. The price was the question and the sentence after each
 * decision is the answer.
 *
 * **A hand costs about a second to deal**, which is why this screen deals ahead
 * (see `useDealer`) and the four face-up kinds do not: they generate in a
 * `useState` initialiser in a few milliseconds, and a hand here is three
 * equity simulations at {@link ITERATIONS}.
 */

/** The kind this is a mode of. The one place that fact is written down. */
export const PLAY_IT_OUT_KIND: DrillKindId = 'pot-odds'

/**
 * Where the mode's answers are kept, and **it is deliberately not the kind's
 * own record.**
 *
 * The rating is an average over a fair sample of what a kind deals (RULED
 * technology#76), and this mode deals a different sample of the same question:
 * the price is read against a range rather than against a hand you can see, and
 * the accept margin is wider, so the thinnest prices the face-up kind asks
 * cannot be asked here at all. Folded into one number the rating would mean two
 * things at once and would fall when a player switched modes, having measured
 * nothing about them.
 *
 * `drills` is keyed by string and merged key by key (lib/sync/merge), so a
 * second key costs no migration and syncs like any other. /stats reads the
 * registry rather than the record's keys, so nothing there renders a row for a
 * mode with no title.
 */
export const PLAY_IT_OUT_RECORD = 'pot-odds:play-it-out'

/** What the switch calls it, and what the small print says settles it. */
export const PLAY_IT_OUT_MODE = {
  label: 'Play it out',
  gradedBy:
    `Settled by running the hand out ${ITERATIONS.toLocaleString('en-GB')} times against the ` +
    'hands they keep betting, so every number here says "about". This mode keeps its own ' +
    'rating: same question, but the hand you are up against is a range rather than two cards ' +
    'you can see.',
}

/** The board a finished hand shows. Backs stand in for the cards still to come. */
const BOARD_CARDS = 5

/** What each street is called when the button offers to show it. */
const STREET_LABEL: Record<StreetId, string> = {
  flop: 'the flop',
  turn: 'the turn',
  river: 'the river',
}

/**
 * A hand on the table, and the next one being dealt behind it.
 *
 * The four face-up kinds deal in a `useState` initialiser because a spot is 44
 * or 990 showdowns and lands in milliseconds. A played-out hand is three
 * `estimateEquity` calls and costs about a second on a 2-core runner
 * (n=60 seeds, 2026-09-08), all of it on the thread the screen is drawn on, so
 * the same pattern would freeze the screen on arrival and again after every
 * hand.
 *
 * So: the first hand is dealt off the render path and the screen shows card
 * backs until it lands, and the next hand is dealt while the player is reading
 * the answer to this one. `ready` is a ref rather than state because a hand
 * nobody can see yet must not paint anything.
 *
 * The `setState` is inside a timeout rather than in the effect body, which is
 * the rule (docs/development.md): nothing here sets state synchronously while
 * React is committing.
 */
function useDealer(): { hand: PlayedHand | null; deal: () => void; dealAhead: () => void } {
  const [hand, setHand] = useState<PlayedHand | null>(null)
  const ready = useRef<PlayedHand | null>(null)
  // Set once the player has answered something on the hand in front of them,
  // which is the moment the second or so of arithmetic below is free: they are
  // reading a sentence rather than waiting on a button.
  const [ahead, setAhead] = useState(false)

  useEffect(() => {
    const dealing = hand === null
    if (!dealing && (!ahead || ready.current !== null)) return
    let live = true
    const timer = window.setTimeout(() => {
      if (!live) return
      const dealt = nextPlayedHand(randomSeed())
      if (dealing) setHand(dealt)
      else ready.current = dealt
    }, 0)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [hand, ahead])

  const deal = useCallback(() => {
    // The hand dealt ahead, if it got there. If it did not, the screen goes
    // back to card backs and deals one, which is the second the first hand of a
    // visit costs and not a new failure.
    const next = ready.current
    ready.current = null
    setAhead(false)
    setHand(next)
  }, [])

  return { hand, deal, dealAhead: useCallback(() => setAhead(true), []) }
}

export function PlayItOut({ title }: { title: string }) {
  const { hand, deal, dealAhead } = useDealer()
  // The run belongs to the visit rather than to the hand, which is why it is
  // held here and not inside `Hand`: a hand carries 1.41 decisions on average
  // and never more than three (n=27, 2026-09-07), so a run reset at every deal
  // could not reach the three answers that make it worth saying, and the best
  // run on the profile would be a fact about how long a hand was.
  const [run, setRun] = useState(0)
  if (hand === null) return <Dealing title={title} />
  return (
    <Hand
      key={hand.seed}
      hand={hand}
      title={title}
      deal={deal}
      dealAhead={dealAhead}
      run={run}
      setRun={setRun}
    />
  )
}

/**
 * The screen before the first hand lands: the shape of it, in card backs.
 *
 * A second of this on arrival, against four of a frozen screen if the hand were
 * dealt during render. The placeholders are the sizes of the real cards so that
 * the hand arriving is a deal rather than a jump.
 */
function Dealing({ title }: { title: string }) {
  return (
    <>
      <Header title={title} />
      <p className="text-center text-sm text-muted-foreground">Dealing.</p>
      <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2" aria-hidden>
        {Array.from({ length: BOARD_CARDS }, (_, i) => (
          <PlayingCard key={i} size="drill" />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-foreground/10 p-3" aria-hidden>
        <span className="flex gap-1.5">
          <PlayingCard size="md" />
          <PlayingCard size="md" />
        </span>
      </div>
    </>
  )
}

/**
 * One hand, played. Mounted per hand (keyed by seed), so a new hand arrives
 * with the street and the answer fresh rather than reset by hand in three
 * places. The run outlives it and is passed in.
 */
function Hand({
  hand,
  title,
  deal,
  dealAhead,
  run,
  setRun,
}: {
  hand: PlayedHand
  title: string
  deal: () => void
  dealAhead: () => void
  run: number
  setRun: (run: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [before, setBefore] = useState<{ rating: number } | null>(null)

  const record = useProfile((s) => s.drills[PLAY_IT_OUT_RECORD])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()

  const street = hand.streets[index]
  const drill = street.drill
  const grade = drill === null || picked === null ? null : gradeDrill(drill, picked)
  // Where the hand goes once this street is settled. Read before the player has
  // answered too, so the button that ends the hand can say so.
  const step = afterStreet(hand, index, drill === null ? null : picked)

  const pick = useCallback(
    (choiceId: string) => {
      if (drill === null || picked !== null) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      setPicked(choiceId)
      setRun(next)
      setBefore({ rating: progress.rating })
      recordDrill(PLAY_IT_OUT_RECORD, result.correct, result.difficulty, next, drill.settledBy)
      sound.play(result.correct ? 'win' : 'fold')
      haptics.fire(result.correct ? 'win' : 'bust')
      // The next hand costs a second of the main thread, and this is the moment
      // it is free: the player is reading a sentence rather than waiting on a
      // button.
      dealAhead()
    },
    [drill, picked, run, setRun, progress.rating, recordDrill, dealAhead],
  )

  const onward = useCallback(() => {
    if (step === 'over') {
      deal()
      return
    }
    setIndex(step)
    setPicked(null)
    setBefore(null)
    sound.play('deal')
    haptics.fire('deal')
  }, [step, deal])

  // The same keys the face-up kinds use, so the two modes play the same on a
  // desktop: c and f are the two answers, 1 and 2 are the same two by position,
  // and space moves the hand on.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const settled = drill === null || picked !== null
      if (settled) {
        if (key === 'enter' || key === ' ') {
          event.preventDefault()
          onward()
        }
        return
      }
      const byKey: Record<string, string> = { c: 'call', '1': 'call', f: 'fold', '2': 'fold' }
      const choice = byKey[key]
      if (choice) {
        event.preventDefault()
        pick(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drill, picked, pick, onward])

  // Everything here animates inside the screen's own wrapper, and this file is
  // mounted by one screen today. Declared anyway: a part that animates and
  // relies on somebody else honouring the motion setting is one move away from
  // being mounted somewhere that does not.
  return (
    <MotionConfig reducedMotion="user">
      <Header
        title={title}
        rating={progress.rating}
        delta={before === null ? null : progress.rating - before.rating}
        run={run}
        answered={progress.answered}
        correct={progress.correct}
        bestRun={progress.bestRun}
      />

      <motion.div
        // Keyed by the street so each card arriving reads as a card arriving.
        key={street.street}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <p className="text-center text-sm text-muted-foreground">
          {drill === null ? 'They check.' : 'Call or fold?'}
        </p>
        {drill?.stakes && <Stakes stakes={drill.stakes} />}

        {/* The board at its finished width from the first street, with backs
            where the cards still to come will go. A board that grows from three
            cards to five moves everything under it twice a hand. */}
        <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2">
          {Array.from({ length: BOARD_CARDS }, (_, i) =>
            street.board[i] ? (
              <PlayingCard key={cardKey(street.board[i])} card={street.board[i]} size="drill" />
            ) : (
              <PlayingCard key={`back-${i}`} size="drill" />
            ),
          )}
        </div>

        <div className="mt-6">
          <ShownHand hand={{ label: 'You', cards: hand.hole, detail: street.detail }} />
        </div>

        {drill !== null && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {drill.choices.map((choice, i) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => pick(choice.id)}
                disabled={picked !== null}
                aria-pressed={picked === choice.id}
                className={cn(
                  'relative rounded-2xl border py-4 text-center text-lg font-semibold transition',
                  picked !== null && choice.winning
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : 'border-foreground/10',
                  picked !== null && !choice.winning && 'opacity-60',
                  picked === null && 'hover:border-foreground/25 active:scale-[0.99]',
                  'motion-reduce:transition-none motion-reduce:active:scale-100',
                )}
              >
                {choice.label}
                {picked === null && (
                  <span className="absolute right-2 top-2 hidden size-5 place-items-center rounded-md bg-foreground/[0.06] text-[0.65rem] font-medium text-muted-foreground sm:grid">
                    {i + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {(grade !== null || drill === null) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
        >
          <p className="text-sm font-medium">
            {grade === null ? (
              // A street nobody could be asked about. Saying why is the whole
              // difference between a hand playing out and a question missing:
              // no bet this pot could make is a fair question here, so there is
              // nothing to answer and the hand moves on.
              <span className="font-normal text-muted-foreground">
                No bet they could make here is a close question. They check it through.
              </span>
            ) : (
              <>
                {grade.correct ? 'That’s it.' : 'Not this time.'}{' '}
                <span className="font-normal text-muted-foreground">
                  {grade.explanation}
                  {picked === 'fold' && ' You fold, and that is the hand.'}
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onward}
            className="mt-4 w-full rounded-2xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {step === 'over' ? 'Next hand' : `See ${STREET_LABEL[hand.streets[step].street]}`}
          </button>
        </motion.div>
      )}
    </MotionConfig>
  )
}
