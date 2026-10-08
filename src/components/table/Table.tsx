'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { HelpCircle, History } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { AwardChip } from '@/components/AwardChip'
import { CountUp } from '@/components/CountUp'
import { ActionBar } from './ActionBar'
import { nextUp } from '@/lib/nextUp'
import { deviceId } from '@/lib/sync/client'
import { HeroCards, HeroPanel, TableStyleContext } from './parts'
import { FeltSeat } from './seat'
import { BoardCard, BoardSlot, ChipStack, TableFelt, TableRoom } from './surface'
import { useSeatActions } from './useSeatActions'
import { HandHistoryDialog } from './HandHistoryDialog'
import { HandsHelpDialog } from './HandsHelpDialog'
import { LeaveDialog } from './LeaveDialog'
import { PlayerDialog } from './PlayerDialog'
import { RunRecap } from './RunRecap'
import { useGame } from '@/store/game'
import { useProfile } from '@/store/profile'
import { potSize } from '@/lib/poker/engine'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useMoney } from '@/lib/useMoney'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useFreerollOnOffer } from '@/lib/useSpendableRoll'
import { ordinal } from '@/lib/recap'
import { KITCHEN_TABLE, cashOutValue, houseStack, prizeFor, reviewableVenue } from '@/config/venues'
import { avatarRingById, dealerButtonById } from '@/config/cosmetics'
import { cardBackById } from '@/config/cardBacks'
import { tableFinishById } from '@/config/shop'
import { FELT_COMPACT, FELT_WIDE, feltSeatPositions, towards } from '@/lib/tableSeats'

type Point = { left: string; top: string }

export function Table() {
  const router = useRouter()
  const {
    hand,
    seats,
    venue,
    status,
    message,
    place,
    heroEquity,
    smallBlind,
    bigBlind,
    blindLevel,
    newAwards,
    lastBounty,
    lastRead,
    seatStats,
    recap,
    talk,
    cashInvested,
    member,
    nextHand,
    rebuy,
    watchItOut,
    leave,
  } = useGame()
  const cardBack = cardBackById(useProfile((s) => s.cardBack))
  const roll = useProfile((s) => s.roll)
  const venueRecords = useProfile((s) => s.venueRecords)
  // The freeroll offer opens a table, so it is decided on the spendable Roll by
  // the same function the route uses (lib/sitDown). The rebuy below is not: it
  // spends `roll` at a table already open here and reclaims nothing.
  const freerollOffered = useFreerollOnOffer()
  // The player's own furniture, handed to the felt in one value (see
  // `TableStyleContext` in ./parts). Selected field by field rather than as an
  // object so that a re-render of the profile for any other reason — the Roll
  // moving, a hand being recorded — does not rebuild this on every action.
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const dealerButton = dealerButtonById(useProfile((s) => s.dealerButton))
  const tableStyle = useMemo(() => ({ ring, button: dealerButton }), [ring, dealerButton])
  const adjustRoll = useProfile((s) => s.adjustRoll)
  const money = useMoney()
  const isMobile = useIsMobile()
  const [helpOpen, setHelpOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  // The end card set aside to look at the hand that ended the run
  // (pip-web#198). Held as the hand it was set aside on, not a flag, so a rebuy
  // that busts again brings the card back without an effect to reset it.
  const [peekedAt, setPeekedAt] = useState<number | null>(null)
  const hasHistory = useGame((s) => s.lastHand !== null)
  const spectatorEquity = useGame((s) => s.spectatorEquity)
  const handIndex = useGame((s) => s.handIndex)
  // The table finish in play is the cloth. Absent, the plain table: graphite
  // lit in the venue's colour (see `TableFelt`).
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const calm = useReducedMotion() === true
  const seatActions = useSeatActions(hand, handIndex)

  // The spectator's peek at an open seat, memoised on the hand rather than
  // recomputed per render: the equity is several Monte Carlo estimates and the
  // table re-renders on every animation frame. Both are null unless the player
  // is genuinely watching a tournament they are out of — the store decides
  // that, not this component.
  const spectatorHole = useMemo(() => {
    if (status !== 'watching' || !viewId || !hand) return null
    const p = hand.players.find((pl) => pl.id === viewId)
    if (!p || p.status === 'folded' || p.status === 'out' || p.hole.length < 2) return null
    return p.hole
  }, [status, viewId, hand])

  // Keyed on the three things the estimate actually reads — the board, their
  // cards, and how many players are still live — rather than on the hand. Keyed
  // on the hand it re-ran 800 simulations on every check and fold; keyed on
  // this it re-runs when the answer can have changed. The selectivity nudge
  // does drift with betting inside a street, which is a rounding point on a
  // spectator's readout and not worth a sim per action.
  const spectatorKey =
    hand && viewId
      ? [
          hand.community.map((c) => `${c.rank}${c.suit}`).join(''),
          hand.players
            .find((p) => p.id === viewId)
            ?.hole.map((c) => `${c.rank}${c.suit}`)
            .join('') ?? '',
          hand.players.filter((p) => p.status !== 'folded' && p.status !== 'out').length,
        ].join('|')
      : ''

  const spectatorWin = useMemo(
    () => (status === 'watching' && viewId && spectatorKey ? spectatorEquity(viewId) : null),
    [status, viewId, spectatorEquity, spectatorKey],
  )

  const metaById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])

  // Five-Card Draw: which of your own cards you have marked to throw away.
  //
  // Up here with the other hooks because everything below the early return is
  // conditional, and a `useState` after it is the rules-of-hooks violation
  // biome catches. Cleared by `ActionBar` on the way out rather than by an
  // effect watching the street: `set-state-in-effect` is ruled out
  // (docs/development.md), and a fresh deal re-mounts the cards regardless.
  const [marked, setMarked] = useState<number[]>([])
  const toggleMark = (i: number) =>
    setMarked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))

  if (!hand || !venue) return <div className="min-h-dvh" />

  const buttonPlayerId = hand.players[hand.buttonIndex]?.id
  const activeId = hand.players[hand.toActIndex]?.id
  const hero = hand.players.find((p) => p.id === 'hero')
  // Up or down on the session, the same sum the stand-up dialog shows. A
  // freeroll or the Daily has none: the stack is the house's.
  const sessionResult =
    hero && !houseStack(venue)
      ? cashOutValue(venue, hero.stack) - (venue.cash ? cashInvested : venue.buyIn)
      : null
  const opponents = hand.players.filter((p) => p.id !== 'hero')
  const pot = potSize(hand)
  const heroMeta = hero ? metaById.get(hero.id) : undefined
  // Offered only when there is something left to watch: at a heads-up table
  // busting and the table being down to one are the same moment, and a button
  // that ends the tournament it offered to show you is worse than no button.
  const canWatch = member && !venue.cash && seats.filter((s) => s.stack > 0).length > 1
  const showdownReveal = hand.result?.showdown === true
  // Spectating after busting: the cards are face up because there is nothing
  // left to protect. The player is out, the run is recorded, and nothing they
  // learn here can be played — which is the whole reason this is allowed to
  // exist next to "nothing you can buy changes a hand" (pip-web#120).
  const spectating = status === 'watching'
  const revealAll = showdownReveal || spectating
  const peeking = (status === 'busted' || status === 'won') && peekedAt === handIndex
  const peek = () => {
    sound.play('tap')
    setPeekedAt(handIndex)
  }

  // Winners of the just-finished hand — for the pot → winner chip animation.
  const potWinners =
    status !== 'playing' && hand.result
      ? Array.from(new Set(hand.result.potsAwarded.flatMap((p) => p.winners)))
      : []

  const goHome = () => {
    leave()
    router.push('/game')
  }
  // The end-of-run card's main button. The Welcome Table carries on into the
  // welcome flow; any other tournament sits you down at the table the lobby's
  // Next up card would pick (lib/nextUp), read after the prize has landed.
  const finished = status === 'won' || (status === 'busted' && !venue.cash)
  const next =
    finished && !venue.welcome
      ? nextUp({ ...useProfile.getState(), roll, venueRecords }, deviceId())
      : null
  const endPrimary: { label: string; go: () => void } | null = venue.welcome
    ? {
        label: 'Continue',
        go: () => {
          sound.play('call')
          leave()
          router.push('/welcome?step=save')
        },
      }
    : next
      ? {
          label: `Play ${next.venue.name}`,
          go: () => {
            sound.play('call')
            leave()
            // Same table again: the route would not re-run on a push to itself.
            if (next.venue.id === venue.id) window.location.assign(`/play/${next.venue.id}`)
            else router.push(`/play/${next.venue.id}`)
          },
        }
      : null
  const cashOutAndLeave = () => {
    // `cashOutValue` handles the freeroll (the stack is the house's, so it pays
    // nothing) and the two venues whose table stack isn't the buy-in.
    if (hero) adjustRoll(cashOutValue(venue, hero.stack))
    useProfile.getState().recordRollPoint()
    goHome()
  }
  // Offered only where there is a session to read and only to somebody it is
  // for — `member` was handed in at sit-down, exactly as "Watch it out" gets
  // it, so nothing here looks up entitlement and nothing about buying reaches
  // the game loop (tests/membershipSurfaces.test.ts).
  const canReview = member && reviewableVenue(venue)
  const goReview = () => {
    sound.play('tap')
    leave()
    router.push('/game/review')
  }
  const cashOutAndReview = () => {
    if (hero) adjustRoll(cashOutValue(venue, hero.stack))
    useProfile.getState().recordRollPoint()
    goReview()
  }
  const selectSeat = (id: string) => {
    sound.play('tap')
    setViewId(id)
  }

  // Where everything sits on the cloth (lib/tableSeats → the live table's
  // geometry). Every point is a percentage of the stage, so the bets, the pot
  // and the chips in flight can slide between them with nothing measured.
  const g = isMobile ? FELT_COMPACT : FELT_WIDE
  const positions = feltSeatPositions(opponents.length, g)
  const seatAt = new Map<string, Point>(opponents.map((p, i) => [p.id, positions[i]]))
  const seatPoint = (id: string): Point => (id === 'hero' ? g.hero : (seatAt.get(id) ?? g.pot))
  const betPoint = (id: string): Point => {
    if (id === 'hero') return g.heroBet
    const seat = seatPoint(id)
    const plate = { left: seat.left, top: `${Number.parseFloat(seat.top) + g.plateDrop}%` }
    return towards(plate, g.focus, g.betReach)
  }
  // Chips are counted in small blinds, so a stack reads the same at any stake.
  const unit = hand.smallBlind
  const inFront = hand.players.reduce((sum, p) => sum + p.committedThisStreet, 0)
  // What has already gone into the middle. The rest is still in front of seats.
  const collected = pot - inFront
  const settled = hand.result !== null
  const spring = calm ? { duration: 0 } : ({ type: 'spring', stiffness: 260, damping: 28 } as const)

  // **Five-Card Draw has no board, so it gets no board places.** At a draw
  // table nothing is ever coming, and drawing places for it promised a flop
  // that never arrives. Every other game gets five outlined places on the
  // cloth, which fill as the cards are dealt.
  const communityCards =
    hand.variant === 'draw' ? null : (
      <div
        className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[1.25vw] sm:gap-2 lg:gap-2.5"
        style={g.board}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const card = hand.community[i]
          return card ? (
            <BoardCard key={`${card.rank}${card.suit}`} index={i} card={card} back={cardBack} />
          ) : (
            <BoardSlot key={`slot-${i}`} />
          )
        })}
      </div>
    )

  // Bets in front of each seat. Keyed by the street, so when the street moves
  // on each stack leaves for the middle rather than lingering.
  const bets = (
    <AnimatePresence>
      {!settled &&
        hand.players
          .filter((p) => p.committedThisStreet > 0)
          .map((p) => {
            const from = seatPoint(p.id)
            const at = betPoint(p.id)
            return (
              <motion.div
                key={`${handIndex}-${hand.street}-${p.id}`}
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                initial={{ left: from.left, top: from.top, opacity: 0 }}
                animate={{ left: at.left, top: at.top, opacity: 1 }}
                exit={{
                  left: g.pot.left,
                  top: g.pot.top,
                  opacity: 0,
                  transition: calm
                    ? { duration: 0 }
                    : {
                        duration: 0.42,
                        ease: [0.4, 0, 0.2, 1],
                        opacity: { duration: 0.12, delay: 0.32 },
                      },
                }}
                transition={spring}
              >
                <ChipStack
                  amount={p.committedThisStreet}
                  unit={unit}
                  label={money(p.committedThisStreet)}
                />
              </motion.div>
            )
          })}
    </AnimatePresence>
  )

  // The pot: the chips already in the middle, and the number. At the end of a
  // hand the stack goes to whoever took it (below), so it leaves the middle.
  const potArea = (
    <div
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
      style={g.pot}
    >
      <div className="flex w-[22px] justify-center">
        <AnimatePresence>
          {collected > 0 && !settled && (
            <motion.div
              key={`pot-${handIndex}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2, delay: calm ? 0 : 0.4 } }}
            >
              <ChipStack amount={collected} unit={unit} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-baseline gap-2 rounded-full bg-table-shade/45 px-3 py-0.5">
        <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Pot</span>
        <CountUp
          value={pot}
          format={money}
          className={cn('font-semibold tabular-nums', isMobile ? 'text-lg' : 'text-2xl')}
        />
      </div>
      {/* Balances the stack on the left, so the number sits on the centre line. */}
      <div className="w-[22px]" aria-hidden />
    </div>
  )

  // Showdown: the pot slides to the winner (or splits between them).
  const winnings = settled
    ? potWinners.map((id) => {
        const to = seatPoint(id)
        return (
          <motion.div
            key={`win-${handIndex}-${id}`}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
            initial={{ left: g.pot.left, top: g.pot.top, opacity: 0 }}
            animate={{ left: to.left, top: to.top, opacity: [0, 1, 1, 0] }}
            transition={
              calm
                ? { duration: 0 }
                : {
                    left: { duration: 0.75, delay: 0.5, ease: [0.3, 0, 0.2, 1] },
                    top: { duration: 0.75, delay: 0.5, ease: [0.3, 0, 0.2, 1] },
                    opacity: { duration: 1.4, delay: 0.35, times: [0, 0.1, 0.8, 1] },
                  }
            }
          >
            <ChipStack amount={hand.result?.payouts[id] ?? pot} unit={unit} />
          </motion.div>
        )
      })
    : null

  const seatsOnRail = opponents.map((p, i) => {
    const meta = metaById.get(p.id)
    if (!meta) return null
    const x = Number.parseFloat(positions[i].left)
    return (
      <div
        key={p.id}
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={positions[i]}
      >
        <FeltSeat
          player={p}
          name={meta.name}
          avatarSpec={meta.avatar}
          isDealer={p.id === buttonPlayerId}
          isActive={activeId === p.id && !settled}
          reveal={revealAll && p.status !== 'folded' && p.status !== 'out'}
          action={seatActions[p.id]}
          back={cardBack}
          compact={isMobile}
          side={x < 42 ? 'left' : x > 58 ? 'right' : 'top'}
          onSelect={() => selectSeat(p.id)}
        />
      </div>
    )
  })

  const drawing = hand.street === 'draw' && hand.players[hand.toActIndex]?.id === 'hero'

  const actionArea = peeking ? (
    // The final hand, face up where it was dealt, with the line that says who
    // took it. The way back is to the end card, which holds every way out.
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <span className="text-sm text-muted-foreground">{message ?? 'The last hand.'}</span>
      <button
        onClick={() => setPeekedAt(null)}
        className="shrink-0 text-sm font-medium underline underline-offset-4 transition hover:text-foreground"
      >
        Back
      </button>
    </div>
  ) : spectating ? (
    // No buttons: there is nobody to press them. What sits here instead is the
    // one line that says why the table is still dealing, and the way out.
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <span className="text-sm text-muted-foreground">
        {message ?? `Watching it out. You finished ${place ? ordinal(place) : 'out'}.`}
      </span>
      <button
        onClick={goHome}
        className="shrink-0 text-sm font-medium underline underline-offset-4 transition hover:text-foreground"
      >
        Leave
      </button>
    </div>
  ) : status === 'handover' ? (
    // Entrance transform lives on the wrapper; the button keeps its own CSS
    // `transition` for hover/press. Animating `y` on the same element that
    // has `transition-property: transform` makes the two fight → jitter (iOS).
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <button
        onClick={nextHand}
        className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
      >
        Next hand
      </button>
    </motion.div>
  ) : (
    <ActionBar hand={hand} marked={marked} onDrawn={() => setMarked([])} />
  )

  // Table talk lives with the pot, just under it, in the middle of the cloth
  // where table chatter belongs.
  const talkLine = (
    <AnimatePresence>
      {talk && (
        <motion.span
          key={talk}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-2xs italic leading-snug text-muted-foreground/80"
        >
          {talk}
        </motion.span>
      )}
    </AnimatePresence>
  )

  // Help + last-hand controls. On desktop they sit in the AppBar; on mobile
  // they move down to just above the community cards (see below).
  const historyButton = hasHistory && (
    <AppBarAction
      label="Last hand"
      onClick={() => {
        sound.play('tap')
        setHistoryOpen(true)
      }}
    >
      <History className="size-4" />
    </AppBarAction>
  )
  const helpButton = (
    <AppBarAction
      label="Hand rankings"
      onClick={() => {
        sound.play('tap')
        setHelpOpen(true)
      }}
    >
      <HelpCircle className="size-4" />
    </AppBarAction>
  )
  // On a phone the bar has no room for these, so they sit in the corners of
  // your own panel: help on the left, where it never moves, last hand on the
  // right once there is one.
  const phoneCorners = { left: helpButton, right: historyButton || undefined }
  const tableControls = (
    <>
      {historyButton}
      {helpButton}
    </>
  )

  return (
    <TableStyleContext.Provider value={tableStyle}>
      <MotionConfig reducedMotion="user">
        <div data-felt className="relative isolate flex h-dvh w-full flex-col overflow-hidden">
          <TableRoom venueId={venue.id} accent={venue.accent} />

          {/* top bar — the shared AppBar; back confirms via the leave dialog */}
          <AppBar
            className="z-20"
            leading="back"
            backLabel="Venues"
            showWordmark={false}
            onBack={() => setLeaveOpen(true)}
            title={
              <>
                <span className="text-sm font-medium text-muted-foreground">{venue.name}</span>
                <span className="text-2xs tabular-nums text-muted-foreground/60">
                  Blinds {smallBlind.toLocaleString()}/{bigBlind.toLocaleString()}
                  {blindLevel > 0 && ` · L${blindLevel + 1}`}
                </span>
              </>
            }
            actions={isMobile ? undefined : tableControls}
          />

          {/* the stage: the table, the seats on its rail, and what is on the cloth */}
          <div
            className={cn(
              'relative min-h-0 flex-1',
              isMobile ? 'mx-0.5 mt-1' : 'mx-auto mt-2 w-full max-w-6xl',
            )}
          >
            <TableFelt
              geometry={g}
              swatch={finish?.swatch}
              accent={venue.accent}
              compact={isMobile}
            />

            {communityCards}
            {potArea}
            {bets}
            {seatsOnRail}
            {winnings}

            {/* Table talk, quietly, under the pot. */}
            <div
              className="absolute z-10 w-[min(26rem,80%)] -translate-x-1/2 text-center"
              style={{ left: g.pot.left, top: `calc(${g.pot.top} + 1.5rem)` }}
            >
              {talkLine}
            </div>
          </div>

          {/* the hero, at the near rail */}
          {hero &&
            heroMeta &&
            (isMobile ? (
              hand.variant === 'draw' ? (
                /* **Five cards do not fit beside the panel on a phone.** The row
               below splits the width in two, which works at two hole cards
               and just about at four; at five they run off the screen and
               under the panel. So a draw table stacks instead: the cards get
               the whole width on their own line — which they need anyway,
               because during the draw round they are buttons you have to be
               able to hit — and the panel sits under them. */
                <div className="relative z-20 flex flex-col gap-2 px-3 pt-1">
                  <div className="flex justify-center">
                    <HeroCards
                      hero={hero}
                      hand={hand}
                      size="drill"
                      discarding={drawing}
                      marked={marked}
                      onToggle={toggleMark}
                    />
                  </div>
                  <div className="flex items-stretch">
                    <HeroPanel
                      hero={hero}
                      avatar={heroMeta.avatar}
                      hand={hand}
                      equity={heroEquity}
                      isButton={hero.id === buttonPlayerId}
                      isActive={activeId === hero.id}
                      result={sessionResult}
                      corners={phoneCorners}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative z-20 flex items-stretch gap-3 px-3">
                  {/* cards and panel each get exactly half the row (pl offsets
                  the first card's tilt so its corner doesn't poke past) */}
                  <div className="flex flex-1 basis-0 items-end justify-center pl-2">
                    <HeroCards
                      hero={hero}
                      hand={hand}
                      size="hero"
                      fanned
                      tactile
                      discarding={drawing}
                      marked={marked}
                      onToggle={toggleMark}
                    />
                  </div>
                  <HeroPanel
                    hero={hero}
                    avatar={heroMeta.avatar}
                    hand={hand}
                    equity={heroEquity}
                    isButton={hero.id === buttonPlayerId}
                    isActive={activeId === hero.id}
                    result={sessionResult}
                    corners={phoneCorners}
                  />
                </div>
              )
            ) : (
              <div className="relative z-20 flex items-stretch justify-center gap-6 px-6">
                <HeroCards
                  hero={hero}
                  hand={hand}
                  size="board"
                  tactile
                  discarding={drawing}
                  marked={marked}
                  onToggle={toggleMark}
                />
                <div className="flex w-44">
                  <HeroPanel
                    hero={hero}
                    avatar={heroMeta.avatar}
                    hand={hand}
                    equity={heroEquity}
                    isButton={hero.id === buttonPlayerId}
                    isActive={activeId === hero.id}
                    result={sessionResult}
                  />
                </div>
              </div>
            ))}

          {/* actions, under the thumb */}
          <div
            className={cn(
              'relative z-20 w-full',
              isMobile
                ? 'px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'
                : 'mx-auto max-w-xl px-6 pt-4 pb-7',
            )}
          >
            {actionArea}
          </div>
          <HandsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
          <HandHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
          <LeaveDialog
            open={leaveOpen}
            onOpenChange={setLeaveOpen}
            buyIn={venue.cash ? cashInvested : venue.buyIn}
            stack={hero?.stack ?? 0}
            cashOut={cashOutValue(venue, hero?.stack ?? 0)}
            freeroll={venue.freeroll === true}
            daily={venue.daily === true}
            cash={venue.cash === true}
            onConfirm={cashOutAndLeave}
            onReview={canReview ? cashOutAndReview : undefined}
          />
          <PlayerDialog
            hole={spectatorHole}
            equity={spectatorWin}
            open={viewId !== null}
            onOpenChange={(o) => !o && setViewId(null)}
            seat={viewId ? (metaById.get(viewId) ?? null) : null}
            stack={hand.players.find((p) => p.id === viewId)?.stack ?? 0}
            stats={viewId ? seatStats[viewId] : undefined}
          />

          {/* overlays */}
          <AnimatePresence>
            {status === 'handover' && message && (
              <Banner key="ho">
                {/* Three separate things, so three blocks: the result (the bounty
                belongs to it), the read, and any chips won. Tight inside a
                block, loose between them. One flat gap ran all three together
                into a single paragraph. */}
                <span className="flex flex-col items-center gap-0.5">
                  <span>{message}</span>
                  {lastBounty > 0 && (
                    <span className="text-xs font-medium opacity-95">
                      Bounty +{money(lastBounty)}
                    </span>
                  )}
                </span>
                {/* The post-hand read (lib/coach). Most hands have none, so this is
                usually absent. Width-capped because it is the only line here
                that runs to a sentence, and the banner sits over the felt. */}
                {lastRead && (
                  <span className="max-w-[min(26rem,78vw)] text-balance text-center text-xs font-medium leading-snug opacity-95">
                    {lastRead.text}
                  </span>
                )}
                {newAwards.length > 0 && (
                  <span className="flex flex-col items-center gap-1.5">
                    {newAwards.map((a) => (
                      <span
                        key={a.id}
                        className="flex items-center gap-1.5 text-xs font-medium opacity-95"
                      >
                        <AwardChip award={a} earned size={18} />
                        New chip — {a.name}
                      </span>
                    ))}
                  </span>
                )}
              </Banner>
            )}
            {status === 'busted' &&
              !peeking &&
              (venue.cash ? (
                // Cash tables: busting isn't the end. Rebuy from your Roll and sit
                // straight back down, drop to the freeroll if you can't afford it,
                // or just stand up. No "you finished Nth" — there's no tournament.
                <EndOverlay
                  key="bust-cash"
                  title="Out of chips"
                  subtitle="The table’s still running — buy back in, or call it a session."
                  onPeek={peek}
                  onHome={goHome}
                  onReview={canReview ? goReview : undefined}
                  primaryLabel={
                    freerollOffered
                      ? 'Play the freeroll'
                      : roll >= venue.buyIn
                        ? `Rebuy — ${money(venue.buyIn)}`
                        : undefined
                  }
                  onPrimary={
                    freerollOffered
                      ? () => {
                          sound.play('call')
                          leave()
                          router.push(`/play/${KITCHEN_TABLE.id}`)
                        }
                      : roll >= venue.buyIn
                        ? () => {
                            sound.play('call')
                            rebuy()
                          }
                        : undefined
                  }
                />
              ) : (
                <EndOverlay
                  key="bust"
                  title="Knocked out"
                  subtitle={
                    place
                      ? prizeFor(venue, place) > 0
                        ? `You finished ${ordinal(place)} — +${money(prizeFor(venue, place))} to your Roll`
                        : `You finished ${ordinal(place)}`
                      : 'Out of the tournament'
                  }
                  detail={
                    recap && (
                      <RunRecap recap={recap} member={member} accountOffer={!venue.welcome} />
                    )
                  }
                  onPeek={peek}
                  onHome={venue.welcome ? undefined : goHome}
                  onReview={canReview ? goReview : undefined}
                  secondaryLabel={canWatch ? 'Watch it out' : undefined}
                  onSecondary={
                    canWatch
                      ? () => {
                          sound.play('tap')
                          watchItOut()
                        }
                      : undefined
                  }
                  primaryLabel={
                    freerollOffered && !venue.welcome ? 'Play the freeroll' : endPrimary?.label
                  }
                  onPrimary={
                    freerollOffered && !venue.welcome
                      ? () => {
                          sound.play('call')
                          if (venue.freeroll && heroMeta) {
                            // Already on the freeroll route — navigation would no-op
                            // and blank the table. Re-seat in place instead.
                            useGame.getState().sitDown(KITCHEN_TABLE, {
                              name: heroMeta.name,
                              avatar: heroMeta.avatar,
                              member,
                            })
                          } else {
                            leave()
                            router.push(`/play/${KITCHEN_TABLE.id}`)
                          }
                        }
                      : endPrimary?.go
                  }
                />
              ))}
            {status === 'won' && !peeking && (
              <EndOverlay
                key="won"
                title="Champion"
                subtitle={`You took it down — +${money(venue.prize + lastBounty)} to your Roll`}
                detail={
                  <>
                    {newAwards.length > 0 && (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        {newAwards.map((a) => (
                          <span
                            key={a.id}
                            className="flex items-center gap-2 text-sm text-white/80"
                          >
                            <AwardChip award={a} earned size={22} />
                            New chip — {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {recap && (
                      <RunRecap recap={recap} member={member} accountOffer={!venue.welcome} />
                    )}
                  </>
                }
                onPeek={peek}
                onHome={venue.welcome ? undefined : goHome}
                onReview={canReview ? goReview : undefined}
                primaryLabel={endPrimary?.label}
                onPrimary={endPrimary?.go}
                celebrate
              />
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </TableStyleContext.Provider>
  )
}

// --- seat -------------------------------------------------------------------

// --- chrome -----------------------------------------------------------------

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      // Under the board, not over it: the board is the thing a showdown is
      // about, and the banner used to sit on it. Here it covers the pot (which
      // it states) and the top of your own cards, which you already know.
      className="pointer-events-none absolute inset-x-0 top-[54%] z-30 flex justify-center px-3"
    >
      {/* The gap is between *blocks*, not lines: with a read and a chip win on
          screen the banner is three separate statements and it has to look like
          it. Callers keep related lines in a nested span with their own tight
          gap. A one-line banner (most hands) is unaffected. */}
      <span className="flex flex-col items-center gap-3 rounded-3xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-2xl">
        {children}
      </span>
    </motion.div>
  )
}

function EndOverlay({
  title,
  subtitle,
  detail,
  onPeek,
  onHome,
  celebrate = false,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onReview,
}: {
  title: string
  subtitle: string
  detail?: React.ReactNode
  /**
   * Set the card aside to see the hand that ended the run: who showed what,
   * and the board (pip-web#198). Under the subtitle, because it answers the
   * question the subtitle raises.
   */
  onPeek?: () => void
  /** "Back to venues". Absent on the Welcome Table, which only carries on. */
  onHome?: () => void
  celebrate?: boolean
  primaryLabel?: string
  onPrimary?: () => void
  /**
   * A third way out, under the primary and above "Home".
   *
   * Exists for "Watch it out", which must not compete with the freeroll offer:
   * a busted player who cannot afford the ladder needs the freeroll more than
   * they need to spectate, so the ranking is deliberate rather than visual.
   */
  secondaryLabel?: string
  onSecondary?: () => void
  /**
   * Open the session review.
   *
   * Sits with the recap card rather than in the stack of buttons below,
   * because it belongs to the account of how the run went rather than to the
   * decision about what to do next. Absent unless the table is one the review
   * covers and the player is one it is for — decided by the caller from what
   * the store was handed at sit-down, never by asking here.
   */
  onReview?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 overflow-y-auto bg-black/85 backdrop-blur-sm"
    >
      {/* Centred while it fits, scrollable when it doesn't. The recap card put
          real content in here, and a centred box with no way to scroll runs
          off the top *and* the bottom at 200% text (docs/design.md). */}
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          className="w-full max-w-md text-center"
        >
          {/* The overlay is always dark, so text is white regardless of theme. */}
          <h2
            className={cn(
              'text-5xl font-semibold tracking-tight sm:text-6xl',
              celebrate ? 'text-pip' : 'text-white',
            )}
          >
            {title}
          </h2>
          <p className="mt-3 text-white/60">{subtitle}</p>
          {onPeek && (
            <button
              onClick={onPeek}
              className="mt-2 text-sm text-white/60 underline underline-offset-4 transition hover:text-white"
            >
              See the last hand
            </button>
          )}
          {detail}
          {onReview && (
            <button
              onClick={onReview}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 active:scale-[0.98]"
            >
              <History className="size-4" />
              Review the session
            </button>
          )}
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          {primaryLabel && onPrimary && (
            <button
              onClick={onPrimary}
              className="rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className={cn(
                primaryLabel
                  ? 'text-sm text-white/75 underline underline-offset-4 transition hover:text-white'
                  : 'rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]',
              )}
            >
              {secondaryLabel}
            </button>
          )}
          {onHome && (
            <button
              onClick={onHome}
              className={cn(
                primaryLabel || secondaryLabel
                  ? 'text-sm text-white/60 transition hover:text-white'
                  : 'rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]',
              )}
            >
              Back to venues
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
