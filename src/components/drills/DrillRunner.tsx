'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import { AppBar } from '@/components/AppBar'
import { DealtCard } from '@/components/PlayingCard'
import { type DrillKind, RIVER_PACK_ID, canPlayDrill } from '@/config/drills'
import { aimFor, gradeDrill, nextDrill, randomSeed } from '@/lib/drills'
import { kindFloor } from '@/lib/drills/standing'
import type { Drill, DrillChoice } from '@/lib/drills/types'
import { type Card, cardName } from '@/lib/poker/cards'
import {
  ActionBar,
  Answer,
  Board,
  Dealing,
  Felt,
  Holding,
  LockedAnswers,
  NextButton,
  Pot,
  RatingChip,
  TalkLine,
  cardKey,
  factsLine,
} from './felt'
import { PickCounter, usePickFive } from './PickFive'
import { PLAY_IT_OUT_KIND, PLAY_IT_OUT_MODE, PLAY_IT_OUT_RECORD, PlayItOut } from './PlayItOut'
import { RiverPack } from './RiverPack'
import { useDrillExit } from './exit'
import { haptics } from '@/lib/haptics'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { emptyDrillRecord, useProfile } from '@/store/profile'
import { cn } from '@/lib/utils'

/**
 * A drill, played: one spot, one decision, the answer, the next spot.
 *
 * **It is the table** (Will, 2026-09-21). Full-bleed, the shared `AppBar`, the
 * board at board size in the middle, the hero's cards anchored bottom-centre,
 * the answers exactly where fold / check / raise live, and the sentence that
 * explains it where the table's talk goes. It used to be a title over a padded
 * column of bordered buttons, and the session review had already proved the
 * other way round: a practice screen that looks like the game is part of the
 * game. See ./felt.tsx for why the furniture is its own rather than borrowed
 * from `table/parts.tsx`.
 *
 * **There is a score, and it is a rating.** Will asked for something that keeps
 * a player coming back (15 Aug) and the honest version of that is a number that
 * only ever reflects how you actually read these spots: it goes up on a hard
 * one, down on an easy one missed, and sits exactly where you left it for as
 * long as you are away. The alternative, a daily streak, is the chess.com
 * behaviour this app is positioned against, so it is not here. See the note at
 * the top of lib/drills/rating.ts.
 *
 * **The rating now chooses the spot as well as describing you** (see `aimFor`
 * and `nextDrill`). Until this screen passed an aim, every kind dealt the first
 * spot its filter accepted, so a beginner's second-ever hand could be a split
 * pot.
 *
 * The number is kept and the kind is still unmetered: those are different
 * things and the difference is the whole strategy (technology#38). Nothing here
 * counts down, locks, or interrupts. The run is React state and dies with the
 * screen; the rating, the best run and the accuracy live on the profile and
 * follow the account if there is one.
 *
 * **No spot is ever generated during a render that the build could run**, and
 * that is a rule rather than a preference. The app is a static export: a spot
 * generated while rendering is generated once, at build time, and every visit
 * opens on the same cards for the life of the build (Will, 14 Aug: "it seems to
 * always show me the same drill"). So the run mounts as a client-only child and
 * deals from `randomSeed()` in its state initialiser — the repo's pattern for
 * this, and not a `setState` in an effect.
 */
export function DrillRunner({ kind }: { kind: DrillKind }) {
  const exit = useDrillExit()
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

  // Pot odds has a second way to ask the same question: one hand, played out
  // street by street against a range (RULED technology#86). It is a mode of
  // this screen rather than a kind of its own, so it lives behind a switch here
  // and behind the same `membersOnly` gate as everything else on the kind.
  const [playItOut, setPlayItOut] = useState(false)
  const hasMode = kind.id === PLAY_IT_OUT_KIND && allowed

  // The two things the bar says that the felt does not. They live up here
  // rather than in `Run` because the bar is up here: a run that reset itself
  // every time the spot changed would be a fact about one hand.
  const [delta, setDelta] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  // **Whose record the bar is showing follows the switch**, because the two
  // modes keep separate ratings (see PLAY_IT_OUT_RECORD) and a bar that kept
  // showing the kind's number while somebody played the mode would be putting
  // one mode's rating over the other's hand.
  const kept = playItOut ? PLAY_IT_OUT_RECORD : kind.id
  const record = useProfile((s) => s.drills[kept])
  const progress = record ?? emptyDrillRecord()
  const facts = factsLine({
    run,
    bestRun: progress.bestRun,
    answered: progress.answered,
    correct: progress.correct,
  })

  // Everything this screen animates sits inside, so the setting is honoured
  // once here rather than remembered at each `motion` element. Same wrapper
  // Tutorial.tsx uses. Tailwind's own motion is handled by the `motion-reduce`
  // variants on the classes that scale, which this cannot reach.
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden">
        <AppBar
          className="z-20"
          leading="back"
          backLabel={exit.label}
          showWordmark={false}
          onBack={exit.leave}
          title={
            // On a phone the rating chip and the bar's buttons leave no room
            // for a centred title, and the two drew over each other at 390px.
            // The kind's name gives way there; the question on the felt says
            // what the screen is.
            <span
              className={cn('flex flex-col items-center', hydrated && allowed && 'max-sm:hidden')}
            >
              <span className="text-sm font-medium text-muted-foreground">{kind.title}</span>
              {/* Only once there is something to say. A first-timer gets the
                  kind's name and nothing under it — the question is already on
                  the felt, and repeating it here reads as a stutter. */}
              {hydrated && facts && (
                <span className="text-2xs tabular-nums text-muted-foreground/60">{facts}</span>
              )}
            </span>
          }
          actions={
            hydrated && allowed ? <RatingChip rating={progress.rating} delta={delta} /> : undefined
          }
        />

        {hasMode && <ModeSwitch kind={kind} playItOut={playItOut} onPick={setPlayItOut} />}

        {!hydrated || !known ? (
          <Dealing slots={kind.boardCards} />
        ) : playItOut ? (
          <PlayItOut run={run} setRun={setRun} onRated={setDelta} />
        ) : kind.id === RIVER_PACK_ID ? (
          // The first practice pack: a lesson, then ten spots, on this felt.
          // Its own screen because a pack has a beginning and an end, which a
          // stream of spots does not; its grading and its record are the kind's.
          <RiverPack kind={kind} allowed={allowed} run={run} setRun={setRun} onRated={setDelta} />
        ) : (
          <Run kind={kind} allowed={allowed} run={run} setRun={setRun} onRated={setDelta} />
        )}
      </div>
    </MotionConfig>
  )
}

/**
 * The two ways pot odds asks its question.
 *
 * Two plain segments, the same weight as each other, under the bar.
 * **Discoverability, not persuasion**: nothing here is badged "new", the mode
 * is not preselected, and switching back is the same one press as switching in.
 * A player who never touches it loses nothing, which is the test every prompt
 * on this app has to pass.
 *
 * The two modes keep separate records, so the number in the bar changes with
 * the segment. That is deliberate and it is explained in the small print at the
 * foot of the screen (see PLAY_IT_OUT_RECORD).
 */
function ModeSwitch({
  kind,
  playItOut,
  onPick,
}: {
  kind: DrillKind
  playItOut: boolean
  onPick: (value: boolean) => void
}) {
  const segments: { label: string; value: boolean }[] = [
    { label: 'One spot', value: false },
    { label: PLAY_IT_OUT_MODE.label, value: true },
  ]
  return (
    <fieldset className="mx-auto mt-1 grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-foreground/[0.04] p-1">
      {/* `sr-only` is absolute, so the legend names the pair for a screen
          reader without taking a cell of the grid. */}
      <legend className="sr-only">{`How to play ${kind.title}`}</legend>
      {segments.map((segment) => (
        <button
          key={segment.label}
          type="button"
          onClick={() => onPick(segment.value)}
          aria-pressed={playItOut === segment.value}
          className={cn(
            'rounded-xl px-3 py-1.5 text-sm font-medium transition',
            playItOut === segment.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            'motion-reduce:transition-none',
          )}
        >
          {segment.label}
        </button>
      ))}
    </fieldset>
  )
}

/**
 * Keys bound to the choice they name, for the kinds that have one: a and b are
 * the two hands, s is the split, c and f are the call and the fold. A key whose
 * choice this kind does not deal does nothing, which is why they are ids rather
 * than positions — the digits already cover positions.
 */
const LETTERS: Record<string, string> = { a: 'a', b: 'b', s: 'split', c: 'call', f: 'fold' }

/** The kind whose answer is the cards themselves rather than a button. */
const PICK_FIVE = 'which-five-play'

/**
 * The run itself. Mounted only on the client, so the state initialiser below is
 * the first spot of this visit and not a spot from build time.
 *
 * **A locked kind runs too, and that is the change of 2026-09-21.** It deals a
 * real spot and dims it, with the answers replaced by one line about the
 * membership — because a paid kind that shows an empty screen is asking
 * somebody to buy a thing they have not seen. Nothing is gradeable: the spot is
 * a window, not a sample, and there is no counter anywhere near it (see
 * docs/membership.md on what a gated surface may be).
 */
function Run({
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
  const record = useProfile((s) => s.drills[kind.id])
  const recordDrill = useProfile((s) => s.recordDrill)
  const progress = record ?? emptyDrillRecord()
  const avatar = useProfile((s) => s.avatar)

  // Where to aim the next spot. Read once per spot from the record as it stood
  // when that spot was dealt — not live, or answering would re-aim the spot
  // already on the screen.
  const aim = useCallback(
    () => aimFor(kindFloor(kind.id), progress.rating, progress.answered),
    [kind.id, progress.rating, progress.answered],
  )

  const [drill, setDrill] = useState<Drill>(() => nextDrill(kind.id, randomSeed(), aim()))
  const [picked, setPicked] = useState<string | null>(null)

  const grade = picked === null ? null : gradeDrill(drill, picked)
  const settled = grade !== null

  const isPickFive = kind.id === PICK_FIVE
  // Choices that are hands you pick ("which hand wins") against choices that
  // are an outcome or a number ("count your outs"). Read off the choice rather
  // than off the kind, so a kind that mixes them needs no change here.
  //
  // **Except the picking kind**, whose choices are single cards already drawn
  // on the felt. Without this it renders its seven cards a second time as seven
  // holdings across the top of the table.
  const handChoices = isPickFive ? [] : drill.choices.filter((c) => c.cards.length > 0)
  const outcomes = isPickFive ? [] : drill.choices.filter((c) => c.cards.length === 0)
  // Counts against phrases, read off the labels rather than off the kind, so a
  // kind that asks for a number needs nothing added here to be laid out like
  // one. See the note on `Answer`'s `numeric`.
  const numeric = outcomes.length > 0 && outcomes.every((c) => /^\d+$/.test(c.label))
  // Holdings the spot shows without asking about. The first is always the
  // hero's where there is one (see `faceUpHands`), and it sits where the hero
  // sits; anybody else is across the table.
  const shown = drill.hands ?? []
  const hero = shown[0]
  const across = shown.slice(1)

  const shortcutOf = (id: string) => String(drill.choices.findIndex((c) => c.id === id) + 1)
  // A personal best worth saying out loud: strictly beaten, and at least three.
  // "Best run yet" on your first correct answer is a participation trophy, and
  // equalling your best is not a best.
  const [bestBefore, setBestBefore] = useState<number | null>(null)
  const newBest = grade?.correct === true && run >= 3 && bestBefore !== null && run > bestBefore

  const pick = useCallback(
    (choiceId: string) => {
      if (picked !== null || !allowed) return
      const result = gradeDrill(drill, choiceId)
      const next = result.correct ? run + 1 : 0
      const was = progress.rating
      setPicked(choiceId)
      setRun(next)
      setBestBefore(progress.bestRun)
      // `drill.settledBy` rather than anything derived from the grade: the spot
      // has carried its own shape since generation, and it is the same reading
      // that set the answer and the difficulty.
      recordDrill(kind.id, result.correct, result.difficulty, next, drill.settledBy)
      onRated(useProfile.getState().drills[kind.id].rating - was)
      sound.play(result.correct ? 'win' : 'fold')
      haptics.fire(result.correct ? 'win' : 'bust')
    },
    [
      drill,
      picked,
      run,
      setRun,
      allowed,
      progress.rating,
      progress.bestRun,
      recordDrill,
      kind.id,
      onRated,
    ],
  )

  const another = useCallback(() => {
    setPicked(null)
    setBestBefore(null)
    onRated(null)
    setDrill(nextDrill(kind.id, randomSeed(), aim()))
    sound.play('deal')
    haptics.fire('deal')
  }, [kind.id, aim, onRated])

  const five = usePickFive({ drill, settled: settled || !allowed, onFive: pick })

  // Desktop plays this with the keyboard or it does not have the rhythm: a
  // mouse round-trip to a button is what makes a drill feel like a form. The
  // picking kind binds its own digits (see usePickFive), so this only takes the
  // key that moves on.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !allowed) return
      const key = event.key.toLowerCase()
      if (picked !== null) {
        if (key === 'enter' || key === ' ') {
          event.preventDefault()
          another()
        }
        return
      }
      if (isPickFive) return
      // A digit picks the nth choice, which is what the badge on the button
      // says. The letters stay bound to choice ids rather than to positions, so
      // each one does nothing at all on a kind that has no choice by that name.
      const digit = Number(key)
      const byLetter = LETTERS[key] ?? null
      const choice =
        Number.isInteger(digit) && digit >= 1 && digit <= drill.choices.length
          ? drill.choices[digit - 1]
          : drill.choices.find((c) => c.id === byLetter)
      if (choice) {
        event.preventDefault()
        pick(choice.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drill, picked, pick, another, isPickFive, allowed])

  // The five that play, once it is over, so the felt can ring them where they
  // sit. Read off the right answer's `plays` — the generator put them there out
  // of the same evaluation that set the answer, so this is not a second reading
  // of the hand. Empty on a kind that does not carry them, and nothing glows.
  const playing = useMemo(() => {
    const winner = drill.choices.find((c) => c.winning)
    return new Set((winner?.plays ?? []).map(cardKey))
  }, [drill])
  const glow = settled && playing.size > 0 ? (card: Card) => playing.has(cardKey(card)) : undefined

  return (
    <>
      <motion.div
        // Keyed by seed so a new spot arrives rather than mutating the old one
        // in place: the cards deal, they do not cross-fade.
        key={drill.seed}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Felt
          across={
            handChoices.length > 0
              ? // Two holdings, face to face. Tappable, because on these kinds
                // the hand *is* the answer, and a showdown you point at reads
                // better than two buttons underneath a picture of one.
                handChoices.map((choice) => (
                  <HandSeat
                    key={choice.id}
                    choice={choice}
                    shortcut={shortcutOf(choice.id)}
                    settled={settled}
                    chosen={picked === choice.id}
                    onPick={() => pick(choice.id)}
                  />
                ))
              : across.length > 0
                ? across.map((hand) => (
                    <Holding
                      key={hand.label}
                      label={hand.label}
                      detail={hand.detail}
                      cards={hand.cards}
                      dim={!allowed}
                    />
                  ))
                : undefined
          }
          board={
            <>
              <Board
                cards={drill.board}
                slots={kind.boardCards}
                dim={!allowed}
                glow={glow}
                renderCard={isPickFive && allowed ? five.renderBoardCard : undefined}
              />
              {drill.stakes && <Pot stakes={drill.stakes} />}
              {settled ? (
                <TalkLine tone={grade.correct ? 'right' : 'wrong'}>
                  {newBest ? `Best run yet — ${grade.explanation}` : grade.explanation}
                </TalkLine>
              ) : (
                // The question, locked or not: on a kind nobody has paid for it
                // is the clearest possible statement of what the thing is. The
                // line in the bar below says the rest, and says it differently.
                <TalkLine>{kind.question}</TalkLine>
              )}
            </>
          }
          hero={
            hero ? (
              isPickFive && allowed ? (
                five.heroCards
              ) : (
                <Holding
                  label={hero.label}
                  detail={hero.detail}
                  cards={hero.cards}
                  size="hero"
                  avatar={avatar ?? undefined}
                  layout="below"
                  dim={!allowed}
                  glow={glow}
                />
              )
            ) : undefined
          }
        />
      </motion.div>

      <ActionBar>
        {!allowed ? (
          <LockedAnswers blurb={kind.blurb} onJoin={() => router.push('/membership')} />
        ) : settled ? (
          <NextButton label="Next hand" onClick={another} />
        ) : isPickFive ? (
          <PickCounter left={five.left} />
        ) : outcomes.length > 0 ? (
          // **Numbers keep their row; phrases go two across.** Four answers in
          // one row leaves each about a quarter of the bar, which is plenty for
          // "8" and not enough for "Three of a kind" — that one wrapped to two
          // lines and the button grew a second storey. Two columns give a phrase
          // the width it needs at every screen size.
          <div
            className={cn(
              'grid gap-2',
              numeric && outcomes.length > 2 ? 'grid-cols-4' : 'grid-cols-2',
            )}
          >
            {outcomes.map((choice) => (
              <Answer
                key={choice.id}
                label={choice.label}
                spoken={choice.spoken}
                shortcut={shortcutOf(choice.id)}
                numeric={numeric}
                state="open"
                onPick={() => pick(choice.id)}
              />
            ))}
          </div>
        ) : (
          // Every choice is a hand, so the felt is the answer sheet and the bar
          // says so rather than sitting empty.
          <p className="py-4 text-center text-sm text-muted-foreground">Tap a hand to answer.</p>
        )}
      </ActionBar>

      {/* What settles the answer, at the foot where small print belongs. The
          reassurance that used to follow it — the rating being yours, nothing
          expiring, no limit on how many you play — is gone: the room's subtitle
          says it once on the way in, and a screen that repeats it under every
          spot is protesting. Nothing here counts anything, which is the version
          of that promise worth keeping. */}
      {allowed && (
        <p className="px-4 pb-2 text-center text-2xs text-muted-foreground/70">{kind.gradedBy}</p>
      )}
    </>
  )
}

/**
 * One of two holdings you can point at.
 *
 * The cards are the control, so the whole thing is the button and the label
 * rides under it — the opposite of the bordered panel this used to be, where
 * the button was a box and the cards were decoration inside it. Green at the
 * reveal marks the hand that won whether or not it was the one pressed: a
 * player who got it wrong is being shown what was true, not marked in red.
 */
function HandSeat({
  choice,
  shortcut,
  settled,
  chosen,
  onPick,
}: {
  choice: DrillChoice
  shortcut: string
  settled: boolean
  chosen: boolean
  onPick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onPick}
      disabled={settled}
      aria-pressed={chosen}
      // The cards are the control here, and "A♠" is read inconsistently or not
      // at all, so the button says what it holds.
      aria-label={`${choice.label}: ${choice.cards.map(cardName).join(' and ')}`}
      animate={{ y: chosen && !settled ? -6 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl px-2 py-1.5 transition',
        !settled && 'hover:bg-foreground/[0.04] active:scale-[0.97]',
        settled && !choice.winning && 'opacity-45',
        'motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100',
      )}
    >
      <span
        className={cn(
          'flex gap-1.5 rounded-xl transition',
          settled &&
            choice.winning &&
            'ring-2 ring-emerald-500/70 ring-offset-4 ring-offset-background',
        )}
        aria-hidden
      >
        {choice.cards.map((card, i) => (
          <DealtCard key={cardKey(card)} card={card} index={i} size="md" />
        ))}
      </span>
      <span className="flex items-baseline gap-1.5" aria-hidden>
        <span className="text-xs font-medium">{choice.label}</span>
        {settled && choice.detail ? (
          <span className="text-xs text-muted-foreground">{choice.detail}</span>
        ) : (
          !settled && (
            <span className="hidden size-4 place-items-center rounded bg-foreground/[0.06] text-[0.6rem] font-medium text-muted-foreground sm:grid">
              {shortcut}
            </span>
          )
        )}
      </span>
    </motion.button>
  )
}
