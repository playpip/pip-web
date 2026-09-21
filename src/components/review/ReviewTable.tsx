'use client'

/**
 * The session review: the table you played at, with arrows where the buttons
 * were.
 *
 * **It is the game screen** (Will, 2026-09-21). Same full-bleed felt, same
 * AppBar with the venue and the blinds, same `Seat` / `HeroCards` /
 * `HeroPanel` from `components/table/parts.tsx`, same arc from
 * `lib/tableSeats`. The state they render is a real `HandState`, rebuilt from
 * the record a step at a time (`lib/review/handState.ts`) — so this cannot
 * drift from the live table, because it *is* the live table's furniture.
 *
 * Three things are different, and only three:
 *
 * 1. **Every hand is face up**, including the ones that folded and mucked, with
 *    each seat's exact chance of taking it from right there. The hand is over
 *    and nothing here can be acted on — the same argument that lets a busted
 *    player watch a tournament out.
 * 2. **Arrows instead of Fold / Check / Raise.** Same place on the screen.
 * 3. **A line of commentary** under the board, where the table talk goes: what
 *    just happened, and — when it was your call — what the price said about it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, List } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { CardBack } from '@/components/CardBack'
import { CountUp } from '@/components/CountUp'
import { DealtCard } from '@/components/PlayingCard'
import { HeroCards, HeroPanel, Seat } from '@/components/table/parts'
import { MoveChip } from './GradeChip'
import { HandPicker, type HandFilter } from './HandPicker'
import type { Card } from '@/lib/poker/cards'
import { showdownOdds } from '@/lib/poker/equity'
import { HERO_ID, handStateAt, liveHands } from '@/lib/review/handState'
import { commentaryAt } from '@/lib/review/commentary'
import type { ReviewSession } from '@/lib/review/session'
import { opponentPositions } from '@/lib/tableSeats'
import { cardBackById } from '@/config/cardBacks'
import { useProfile } from '@/store/profile'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function ReviewTable({ session }: { session: ReviewSession }) {
  const router = useRouter()
  const money = useMoney()
  const isMobile = useIsMobile()
  const cardBack = cardBackById(useProfile((s) => s.cardBack))

  // Where you are: which hand, and how far into it. **One piece of state, not
  // two**, because stepping off the end of a hand moves both — the forward
  // arrow runs the session end to end rather than offering to replay the hand
  // you have just watched (Will, 2026-09-21).
  const [at, setAt] = useState({ hand: 0, step: 0 })
  const atRef = useRef(at)
  const [picking, setPicking] = useState(false)
  const [filter, setFilter] = useState<HandFilter>('all')

  const { hand: handIndex, step } = at
  const reviewHand = session.hands[handIndex]
  const record = reviewHand?.record
  const total = record?.events.length ?? 0

  const frame = useMemo(() => (record ? handStateAt(record, step) : null), [record, step])

  /**
   * Who is ahead, worked out once per board.
   *
   * A step draws a badge on every seat *and* grades the move that was just
   * made, and both want the same few-hundred-showdown answer. It only changes
   * when the board or the set of live hands does, so it is cached on that —
   * without which holding the arrow key recomputed the lot twice per press and
   * the screen crawled.
   */
  const solved = useRef(new Map<string, ReturnType<typeof showdownOdds>>())
  const solve = useCallback(
    (hands: readonly { id: string; hole: readonly Card[] }[], board: readonly Card[]) => {
      // Sorted, because the same question arrives in two orders: the badges
      // ask in seat order and the grader asks with whoever acted first. Without
      // this the two miss each other's answers and every step pays twice.
      const key = `${board.map((c) => `${c.rank}${c.suit}`).join('')}|${hands
        .map((h) => `${h.id}:${h.hole.map((c) => `${c.rank}${c.suit}`).join('')}`)
        .sort()
        .join(',')}`
      const hit = solved.current.get(key)
      if (hit) return hit
      const fresh = showdownOdds(hands, board)
      solved.current.set(key, fresh)
      return fresh
    },
    [],
  )

  const odds = useMemo(() => {
    if (!frame) return null
    const live = liveHands(frame.hand)
    return live.length > 1 ? solve(live, frame.hand.community) : null
  }, [frame, solve])

  const commentary = useMemo(
    () => (reviewHand && frame ? commentaryAt(reviewHand, frame, money, solve) : null),
    [reviewHand, frame, money, solve],
  )

  const go = (next: { hand: number; step: number }) => {
    atRef.current = next
    setAt(next)
  }

  const goHand = (index: number) => {
    if (index < 0 || index >= session.hands.length) return
    sound.play('tap')
    go({ hand: index, step: 0 })
  }

  /**
   * A step either way, across hand boundaries.
   *
   * Reads and writes a ref alongside the state so a burst of key presses in one
   * frame all land: each sees where the one before it went, rather than where
   * React last rendered.
   */
  const moveStep = (delta: number) => {
    const { hand, step } = atRef.current
    const events = session.hands[hand]?.record.events ?? []
    let nextHand = hand
    let nextStep = step + delta

    if (nextStep > events.length) {
      if (hand >= session.hands.length - 1) return
      nextHand = hand + 1
      nextStep = 0
    } else if (nextStep < 0) {
      if (hand === 0) return
      nextHand = hand - 1
      nextStep = session.hands[nextHand].record.events.length
    }

    const event = session.hands[nextHand]?.record.events[nextStep - 1]
    sound.play(
      nextHand !== hand ? 'deal' : event?.kind === 'board' ? 'deal' : (event?.type ?? 'tap'),
    )
    go({ hand: nextHand, step: nextStep })
  }

  const goStep = (to: number) => {
    sound.play('tap')
    go({ hand: atRef.current.hand, step: Math.max(0, Math.min(total, to)) })
  }

  /** Nothing left to step to. */
  const atSessionEnd = handIndex >= session.hands.length - 1 && step >= total
  const atSessionStart = handIndex === 0 && step === 0

  // ← → walk the hand; ↑ ↓ (and j/k) change hand; Home and End are its ends.
  //
  // The handlers are held in a ref and the listener is registered once: reading
  // `step` out of the closure would re-bind the listener on every move, and
  // depending on the handlers themselves would re-bind it on every render.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'ArrowRight' || e.key === ' ') moveStep(1)
    else if (e.key === 'ArrowLeft') moveStep(-1)
    else if (e.key === 'ArrowDown' || e.key === 'j') goHand(handIndex + 1)
    else if (e.key === 'ArrowUp' || e.key === 'k') goHand(handIndex - 1)
    else if (e.key === 'Home') goStep(0)
    else if (e.key === 'End') goStep(total)
    else return
    e.preventDefault()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!frame || !record) {
    return (
      <div className="flex h-dvh items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">This session has no completed hands in it.</p>
      </div>
    )
  }

  const { hand } = frame
  const hero = hand.players.find((p) => p.id === HERO_ID)
  const heroSeat = frame.seats.find((s) => s.id === HERO_ID)
  const opponents = hand.players.filter((p) => p.id !== HERO_ID)
  const positions = opponentPositions(opponents.length)
  const share = (id: string) => odds?.share[id]

  /**
   * What a seat wears under its stack: its chance of taking it from here.
   *
   * **One label, not two.** The rating for the move that was just made lives in
   * the line by the board, which names whoever made it — stacking a second chip
   * on the seat said the same thing twice (Will, 2026-09-21).
   */
  const seatBadge = (id: string) => {
    const value = share(id)
    if (value === undefined) return null
    return (
      <span
        // Opaque, because it is worn on the avatar's chin now rather than hung
        // in a row under the stack (see `Seat`), and a translucent pill over a
        // face reads as a smudge on the face.
        className={cn(
          'rounded-full px-1.5 py-0.5 text-3xs font-semibold tabular-nums shadow-sm ring-1',
          value >= 0.5
            ? 'bg-background text-emerald-500 ring-emerald-500/40'
            : 'bg-background text-muted-foreground ring-foreground/15',
        )}
      >
        {odds?.exact ? '' : '≈'}
        {Math.round(value * 100)}%
      </span>
    )
  }

  const board = (
    <div className="flex items-center justify-center gap-1 sm:gap-2 lg:gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const card = hand.community[i]
        return card ? (
          <DealtCard key={i} index={i} card={card} size="board" />
        ) : (
          <CardBack key={i} design={cardBack} size="board" />
        )
      })}
    </div>
  )

  const potLine = frame.pot !== null && (
    <div className="flex shrink-0 items-baseline gap-2">
      <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Pot</span>
      <CountUp
        value={frame.pot}
        format={money}
        className={cn('font-semibold tabular-nums', isMobile ? 'text-2xl' : 'text-3xl')}
      />
    </div>
  )

  // Where Fold / Check / Raise sit while a hand is live.
  const controls = (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5">
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setPicking(true)
        }}
        className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium transition hover:bg-foreground/[0.06]"
      >
        <List className="size-4 shrink-0" />
        <span className="truncate">
          Hand {handIndex + 1} of {session.hands.length}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <StepArrow onClick={() => moveStep(-1)} disabled={atSessionStart} label="Back a move">
          <ChevronLeft className="size-5" />
        </StepArrow>
        <span className="w-16 text-center text-2xs tabular-nums text-muted-foreground">
          {step} / {total}
        </span>
        {/* Forward runs on into the next hand. The end of one is not somewhere
            to stop and be offered a replay of what you just watched. */}
        <StepArrow
          onClick={() => moveStep(1)}
          disabled={atSessionEnd}
          label={step >= total ? 'Next hand' : 'Forward a move'}
          primary
        >
          <ChevronRight className="size-5" />
        </StepArrow>
      </div>
    </div>
  )

  // A keyed `motion.div`, and deliberately not an `AnimatePresence` with
  // `mode="wait"`: that held the first line on screen for the whole hand,
  // waiting on an exit that never finished, while everything around it updated.
  // Remounting on the key is the same effect and cannot get stuck.
  // **A fixed height, not a minimum.** Two lines' worth, with the verdict
  // clamped to fit: a `min-h` still grew the moment a sentence wrapped, and the
  // board, the seats and the cards all shifted with it on every other step.
  const commentaryLine = commentary && (
    <motion.div
      key={`${handIndex}:${step}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="h-[3.25rem] min-w-0 overflow-hidden"
    >
      {/* The rating leads, and **every** move has one — a step that showed
          nothing read as a step where the feature had failed. "Fine" is a
          verdict too: it means the chips did not care either way. */}
      <p className="flex items-center gap-2 text-sm font-medium">
        {commentary.move && <MoveChip verdict={commentary.move.verdict} />}
        <span className="truncate">{commentary.said}</span>
      </p>
      {commentary.verdict && (
        <p
          className={cn(
            'mt-0.5 text-2xs leading-snug sm:text-xs',
            commentary.tone === 'good'
              ? 'text-emerald-500'
              : commentary.tone === 'bad'
                ? 'text-suit-red'
                : 'text-muted-foreground',
          )}
        >
          {commentary.verdict}
        </p>
      )}
    </motion.div>
  )

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      <AppBar
        className="z-20"
        leading="back"
        backLabel="Menu"
        showWordmark={false}
        onBack={() => router.push('/game')}
        title={
          <>
            <span className="text-sm font-medium text-muted-foreground">{session.venueName}</span>
            <span className="text-2xs tabular-nums text-muted-foreground/60">
              Hand #{record.handNo} · Blinds {record.smallBlind.toLocaleString()}/
              {record.bigBlind.toLocaleString()}
            </span>
          </>
        }
        actions={
          <AppBarAction label="Jump to a hand" onClick={() => setPicking(true)}>
            <List className="size-4" />
          </AppBarAction>
        }
      />

      {isMobile ? (
        <div className="relative flex min-h-0 flex-1 flex-col justify-evenly px-2 pb-2">
          <div className="flex items-start justify-evenly">
            {opponents.map((p) => {
              const seat = frame.seats.find((s) => s.id === p.id)
              if (!seat) return null
              return (
                <Seat
                  key={p.id}
                  layout="row"
                  player={p}
                  name={seat.name}
                  avatarSpec={seat.avatar}
                  isDealer={hand.players[hand.buttonIndex]?.id === p.id}
                  isActive={frame.last?.playerId === p.id}
                  isThinking={false}
                  reveal
                  cardsSide="right"
                  onSelect={() => {}}
                  badge={seatBadge(p.id)}
                />
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            {board}
            <div className="flex items-end justify-between gap-3 px-2">
              <div className="min-w-0 flex-1">{commentaryLine}</div>
              {potLine}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1">
          {opponents.map((p, i) => {
            const seat = frame.seats.find((s) => s.id === p.id)
            if (!seat) return null
            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={positions[i]}
              >
                <Seat
                  player={p}
                  name={seat.name}
                  avatarSpec={seat.avatar}
                  isDealer={hand.players[hand.buttonIndex]?.id === p.id}
                  isActive={frame.last?.playerId === p.id}
                  isThinking={false}
                  reveal
                  cardsSide={Number.parseFloat(positions[i].left) > 50 ? 'left' : 'right'}
                  onSelect={() => {}}
                  badge={seatBadge(p.id)}
                />
              </div>
            )
          })}

          <div className="absolute left-1/2 top-[62%] flex w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 px-6">
            {board}
            <div className="flex w-full items-end justify-between gap-6">
              <div className="min-w-0 flex-1">{commentaryLine}</div>
              {potLine}
            </div>
          </div>
        </div>
      )}

      {/* hero zone — cards, panel, and the controls where the actions were */}
      {hero && heroSeat && (
        <div
          className={cn(
            'z-20 mx-auto flex w-full max-w-xl flex-col items-center gap-3',
            isMobile ? 'px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2' : 'px-6 pb-8',
          )}
        >
          {/* **The panel is a flex child in its own right**, exactly as the
              live table renders it. Wrapped in a plain `div`, its own
              `flex-1 basis-0` applied inside the wrapper instead of against the
              row, so it sized to its content and ran off the side of a phone
              (Will, 2026-09-21). */}
          <div className={cn('flex w-full items-stretch', isMobile ? 'gap-3' : 'gap-6')}>
            <div className="flex flex-1 basis-0 items-end justify-start pl-2">
              <HeroCards
                hero={hero}
                hand={hand}
                size={isMobile ? 'hero' : 'board'}
                fanned={isMobile}
              />
            </div>
            <HeroPanel
              hero={hero}
              avatar={heroSeat.avatar}
              hand={hand}
              equity={share(HERO_ID) ?? null}
              isButton={hand.players[hand.buttonIndex]?.id === HERO_ID}
              isActive={frame.last?.playerId === HERO_ID}
              defaultPage={1}
              oddsLabel={odds?.exact === false ? '≈ to win' : 'to win'}
            />
          </div>

          <div className="w-full max-w-xl">{controls}</div>
        </div>
      )}

      <HandPicker
        open={picking}
        onOpenChange={setPicking}
        session={session}
        selected={handIndex}
        filter={filter}
        onFilter={setFilter}
        onPick={goHand}
      />
    </div>
  )
}

function StepArrow({
  children,
  onClick,
  disabled,
  label,
  primary = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-30',
        primary
          ? 'bg-primary text-primary-foreground shadow-lg shadow-black/10 hover:bg-primary/90 dark:shadow-black/40'
          : 'border border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/10',
      )}
    >
      {children}
    </button>
  )
}
