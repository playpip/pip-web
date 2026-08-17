'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { PlayingCard } from '@/components/PlayingCard'
import { type DrillKind, canPlayDrill } from '@/config/drills'
import { gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import type { Drill, DrillChoice } from '@/lib/drills/types'
import { type Card, cardName } from '@/lib/poker/cards'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { cn } from '@/lib/utils'

/**
 * A drill, played: one spot, one decision, the answer, the next spot.
 *
 * A screen in the app rather than a widget on a page of prose (Will, 14 Aug):
 * the same AppBar, the same card faces and the same sounds as the table, so
 * dropping into a drill from the menu feels like moving around one app and not
 * like leaving it. The rhythm is the point — answer, see why, next — so the
 * board is dealt at table size and the keyboard works: 1 / 2 pick a hand,
 * 3 says they split it, and space moves on.
 *
 * **There is a score, and it is a rating.** Will asked for something that keeps
 * a player coming back (15 Aug) and the honest version of that is a number
 * that only ever reflects how you actually read these spots: it goes up on a
 * hard one, down on an easy one missed, and sits exactly where you left it for
 * as long as you are away. The alternative, a daily streak, is the chess.com
 * behaviour this app is positioned against, so it is not here. See the note at
 * the top of lib/drills/rating.ts.
 *
 * The number is kept and the kind is still unmetered: those are different
 * things and the difference is the whole strategy (technology#38). Nothing
 * here counts down, locks, or interrupts. The run is React state and dies with
 * the screen; the rating, the best run and the accuracy live on the profile
 * (`PERSIST_VERSION` 15) and follow the account if there is one.
 *
 * **No spot is ever generated during a render that the build could run**, and
 * that is a rule rather than a preference. The app is a static export: the
 * first pass dealt the opening spot from a fixed seed so the prerender and the
 * hydrated screen could not disagree, and the cost was that every visit to the
 * screen opened on those same nine cards for the life of the build (Will,
 * 14 Aug: "it seems to always show me the same drill"). So the run mounts as a
 * client-only child and deals from `randomSeed()` in its state initialiser —
 * the repo's pattern for this, and not a `setState` in an effect. Until it
 * mounts the screen shows the backs, which reads as a deal.
 */
export function DrillRunner({ kind }: { kind: DrillKind }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const member = useEntitlement()
  const settled = useMembership((state) => state.checked)

  // A free kind never waits on anything. A kind that comes with the membership
  // waits for a real answer before it draws either screen, because the frame
  // where a member is told this is not theirs is worse than a frame of card
  // backs. `checked` is true immediately for anyone signed out, so the only
  // people who ever see the extra frame are the ones with an account.
  const known = !kind.membersOnly || settled
  const allowed = canPlayDrill(kind, member)

  return (
    <PageShell leading="back" backLabel="Drills" onBack={() => router.push('/game/drills')}>
      <div className="flex flex-1 flex-col">
        {!hydrated || !known ? (
          <Dealing kind={kind} />
        ) : allowed ? (
          <Run kind={kind} />
        ) : (
          <WithTheMembership kind={kind} />
        )}

        {/* Small print, at the foot of the screen where it belongs. Both halves
            are load-bearing: what settles the answer, and what happens to the
            number. Never a cap, never a countdown. */}
        {allowed && (
          <p className="mt-auto pt-8 text-center text-xs text-muted-foreground/80">
            {kind.gradedBy} Your rating is yours, it never expires, and there is no limit on how
            many you play.
          </p>
        )}
      </div>
    </PageShell>
  )
}

/**
 * What a kind that comes with the membership says to somebody it is not for.
 *
 * A plain line of text, at the same weight as any other sentence on the screen.
 * No prompt, no modal, no CTA styling, and nothing that follows you back to the
 * room: the landing page promises no pop-ups and no nagging, and this is the
 * surface where that promise is either kept or quietly broken. The honest
 * version is telling somebody what the thing is and letting them leave, which
 * the back arrow above already does.
 *
 * **The line gains a text link to /membership when that page exists**
 * (technology#52 item F), and the wording is the CMO's to set at that point.
 * There is no paid kind registered today, so nothing renders this yet.
 */
function WithTheMembership({ kind }: { kind: DrillKind }) {
  return (
    <div className="mt-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{kind.title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        {kind.blurb} This one comes with the membership.
      </p>
    </div>
  )
}

/**
 * The title and the score.
 *
 * One line of numbers under the title rather than a panel: a scoreboard that
 * takes a quarter of a phone screen is competing with the cards, and the cards
 * are the drill. The rating sits opposite the title where the eye lands on
 * arriving, and everything else is one muted line of facts.
 *
 * The delta is the reason the rating is worth showing at all. A number that
 * only ever appears in its settled state is furniture; a number you watch move
 * is the thing you came back for.
 */
function Header({
  title,
  rating,
  delta = null,
  run = 0,
  answered = 0,
  correct = 0,
  bestRun = 0,
}: {
  title: string
  rating?: number
  delta?: number | null
  run?: number
  answered?: number
  correct?: number
  bestRun?: number
}) {
  // Facts, in the order they change. Nothing is shown before it means
  // something: a first-timer gets a title and a rating to move, not a row of
  // zeros telling them how little they have done.
  const facts = [
    run > 1 ? `${run} in a row` : null,
    bestRun > 1 ? `best ${bestRun}` : null,
    answered > 0 ? `${Math.round((correct / answered) * 100)}% of ${answered}` : null,
  ].filter(Boolean)

  return (
    <div className="mb-6 flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {facts.length > 0 && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{facts.join(' · ')}</p>
        )}
      </div>

      {rating !== undefined && (
        <div className="flex shrink-0 items-baseline gap-1.5">
          {delta !== null && delta !== 0 && (
            <motion.span
              // Keyed by the value so a second answer worth the same as the
              // first still animates rather than sitting there.
              key={`${rating}-${delta}`}
              initial={{ opacity: 0, y: delta > 0 ? 6 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'text-sm font-medium tabular-nums',
                delta > 0 ? 'text-emerald-500' : 'text-muted-foreground',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </motion.span>
          )}
          <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-sm font-semibold tabular-nums">
            {rating}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The screen before the first spot lands: the shape of a drill, in card backs.
 * One frame on a real device, and the placeholders are the sizes of the real
 * cards so that the spot arriving is a deal rather than a jump.
 */
function Dealing({ kind }: { kind: DrillKind }) {
  return (
    <>
      <Header title={kind.title} />
      <p className="text-center text-sm text-muted-foreground">{kind.question}</p>
      <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <PlayingCard key={i} size="drill" />
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-foreground/10 p-3">
            <span className="flex gap-1.5">
              <PlayingCard size="md" />
              <PlayingCard size="md" />
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * The run itself. Mounted only on the client, so the state initialiser below is
 * the first spot of this visit and not a spot from build time.
 */
function Run({ kind }: { kind: DrillKind }) {
  const [drill, setDrill] = useState<Drill>(() => nextDrill(kind.id, randomSeed()))
  const [picked, setPicked] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  // Where the record stood before the answer on screen. The delta beside the
  // rating is then a subtraction rather than a second run of the same
  // arithmetic: one place moves the number (`recordDrill`) and this only reads
  // what it did.
  const [before, setBefore] = useState<{ rating: number; bestRun: number } | null>(null)

  const record = useProfile((s) => s.drills[kind.id])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()

  const grade = picked === null ? null : gradeDrill(drill, picked)
  const hands = drill.choices.filter((choice) => choice.cards.length > 0)
  const outcomes = drill.choices.filter((choice) => choice.cards.length === 0)
  // A personal best worth saying out loud: strictly beaten, and at least three.
  // "Best run yet" on your first correct answer is a participation trophy, and
  // equalling your best is not a best.
  const newBest = grade?.correct === true && run >= 3 && before !== null && run > before.bestRun

  const pick = useCallback(
    (choiceId: string) => {
      if (picked !== null) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      setPicked(choiceId)
      setRun(next)
      setBefore({ rating: progress.rating, bestRun: progress.bestRun })
      recordDrill(kind.id, result.correct, result.difficulty, next)
      sound.play(result.correct ? 'win' : 'fold')
      haptics.fire(result.correct ? 'win' : 'bust')
    },
    [drill, picked, run, progress.rating, progress.bestRun, recordDrill, kind.id],
  )

  const another = useCallback(() => {
    setPicked(null)
    setBefore(null)
    setDrill(nextDrill(kind.id, randomSeed()))
    sound.play('deal')
    haptics.fire('deal')
  }, [kind.id])

  // Desktop plays this with the keyboard or it does not have the rhythm: a
  // mouse round-trip to a button is what makes a drill feel like a form.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (picked !== null) {
        if (key === 'enter' || key === ' ') {
          event.preventDefault()
          another()
        }
        return
      }
      const answers = drill.choices.filter((choice) => choice.cards.length > 0)
      const split = drill.choices.find((choice) => choice.cards.length === 0)
      const index = key === '1' || key === 'a' ? 0 : key === '2' || key === 'b' ? 1 : -1
      if (index >= 0 && answers[index]) {
        event.preventDefault()
        pick(answers[index].id)
      } else if ((key === '3' || key === 's') && split) {
        event.preventDefault()
        pick(split.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drill, picked, pick, another])

  return (
    <>
      <Header
        title={kind.title}
        rating={progress.rating}
        delta={before === null ? null : progress.rating - before.rating}
        run={run}
        answered={progress.answered}
        correct={progress.correct}
        bestRun={progress.bestRun}
      />

      {/* The spot. Keyed by seed so a new one arrives rather than mutating
          the old one in place. */}
      <motion.div
        key={drill.seed}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <p className="text-center text-sm text-muted-foreground">{kind.question}</p>
        <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2">
          {drill.board.map((card) => (
            <PlayingCard key={cardKey(card)} card={card} size="drill" />
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {hands.map((choice, index) => (
            <HandChoice
              key={choice.id}
              choice={choice}
              shortcut={String(index + 1)}
              revealed={grade !== null}
              won={choice.winning}
              chosen={picked === choice.id}
              onPick={() => pick(choice.id)}
            />
          ))}
        </div>

        {outcomes.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => pick(choice.id)}
            disabled={grade !== null}
            className={cn(
              'mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
              grade !== null && choice.winning
                ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                : 'border-foreground/10 text-muted-foreground',
              grade === null &&
                'hover:border-foreground/25 hover:text-foreground active:scale-[0.99]',
              grade !== null && !choice.winning && picked === choice.id && 'opacity-60',
            )}
          >
            <span>{choice.label}</span>
            {grade !== null && choice.winning ? (
              <Check className="size-4 shrink-0 text-emerald-500" />
            ) : (
              grade === null && (
                <span className="hidden size-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-xs font-medium sm:grid">
                  3
                </span>
              )
            )}
          </button>
        ))}
      </motion.div>

      {grade && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
        >
          <p className="text-sm font-medium">
            {newBest ? 'Best run yet.' : grade.correct ? 'That’s it.' : 'Not this time.'}{' '}
            <span className="font-normal text-muted-foreground">{grade.explanation}</span>
          </p>
          <button
            type="button"
            onClick={another}
            className="mt-4 w-full rounded-2xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            Next hand
          </button>
        </motion.div>
      )}
    </>
  )
}

function HandChoice({
  choice,
  shortcut,
  revealed,
  won,
  chosen,
  onPick,
}: {
  choice: DrillChoice
  shortcut: string
  revealed: boolean
  won: boolean
  chosen: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={revealed}
      aria-pressed={chosen}
      // The cards are the control here, and "A♠" is read inconsistently or not
      // at all, so the button says what it holds.
      aria-label={`${choice.label}: ${choice.cards.map(cardName).join(' and ')}`}
      className={cn(
        'rounded-2xl border p-3 text-left transition',
        revealed && won ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-foreground/10',
        revealed && !won && 'opacity-60',
        !revealed && 'hover:border-foreground/25 active:scale-[0.99]',
      )}
    >
      <span className="flex items-center gap-3">
        <span className="flex gap-1.5">
          {choice.cards.map((card) => (
            <PlayingCard key={cardKey(card)} card={card} size="md" />
          ))}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="text-sm font-medium">{choice.label}</span>
          {revealed && won ? (
            <Check className="size-4 shrink-0 text-emerald-500" />
          ) : (
            // The keyboard shortcut, shown rather than documented. Hidden on
            // touch, where there is nothing to press.
            !revealed && (
              <span className="hidden size-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-xs font-medium text-muted-foreground sm:grid">
                {shortcut}
              </span>
            )
          )}
        </span>
      </span>

      {/* Which five actually play, once the answer is out. The hand the
          evaluator read, rather than a claim about it. */}
      {revealed && choice.plays && (
        <span className="mt-3 block border-t border-foreground/10 pt-2.5">
          <span className="text-xs text-muted-foreground">{choice.detail}</span>
          <span className="mt-1.5 flex gap-1">
            {choice.plays.map((card) => (
              <PlayingCard key={cardKey(card)} card={card} size="xs" />
            ))}
          </span>
        </span>
      )}
    </button>
  )
}

const cardKey = (card: Card): string => `${card.rank}${card.suit}`
