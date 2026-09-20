'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, History } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { AwardChip } from '@/components/AwardChip'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { DealtCard, PlayingCard, type CardSize } from '@/components/PlayingCard'
import { CardBack } from '@/components/CardBack'
import { CountUp } from '@/components/CountUp'
import { ActionBar } from './ActionBar'
import { HandHistoryDialog } from './HandHistoryDialog'
import { HandsHelpDialog } from './HandsHelpDialog'
import { LeaveDialog } from './LeaveDialog'
import { PlayerDialog } from './PlayerDialog'
import { RunRecap } from './RunRecap'
import { useGame } from '@/store/game'
import { useProfile } from '@/store/profile'
import { potSize, type HandState, type Player } from '@/lib/poker/engine'
import { evaluateHand } from '@/lib/poker/handEval'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useMoney } from '@/lib/useMoney'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useFreerollOnOffer } from '@/lib/useSpendableRoll'
import { ordinal } from '@/lib/recap'
import { KITCHEN_TABLE, cashOutValue } from '@/config/venues'
import { nicknameFor } from '@/config/handNames'
import { tableFinishById } from '@/config/shop'
import { cardBackById } from '@/config/cardBacks'
import type { AvatarSpec } from '@/lib/avatar'

/** Positions for N opponents spread along the top arc of an ellipse (y grows down). */
function opponentPositions(n: number): { left: string; top: string }[] {
  const RX = 41
  const RY = 34
  const CY = 56 // arc centre sits below the table midline, matching the board
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / (n + 1) // 0..1 across the arc
    const deg = 180 + t * 180 // 180° (left) → 360° (right), over the top
    const rad = (deg * Math.PI) / 180
    return {
      left: `${50 + RX * Math.cos(rad)}%`,
      top: `${CY + RY * Math.sin(rad)}%`,
    }
  })
}

type Point = { left: string; top: string }

export function Table() {
  const router = useRouter()
  const {
    hand,
    seats,
    venue,
    aiThinkingId,
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
  // The freeroll offer opens a table, so it is decided on the spendable Roll by
  // the same function the route uses (lib/sitDown). The rebuy below is not: it
  // spends `roll` at a table already open here and reclaims nothing.
  const freerollOffered = useFreerollOnOffer()
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const { resolvedTheme } = useTheme()
  const adjustRoll = useProfile((s) => s.adjustRoll)
  const money = useMoney()
  const isMobile = useIsMobile()
  const [helpOpen, setHelpOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const hasHistory = useGame((s) => s.lastHand !== null)
  const spectatorEquity = useGame((s) => s.spectatorEquity)

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
  const opponents = hand.players.filter((p) => p.id !== 'hero')
  const positions = opponentPositions(opponents.length)
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

  // Winners of the just-finished hand — for the pot → winner chip animation.
  const potWinners =
    status !== 'playing' && hand.result
      ? Array.from(new Set(hand.result.potsAwarded.flatMap((p) => p.winners)))
      : []

  const goHome = () => {
    leave()
    router.push('/game')
  }
  const cashOutAndLeave = () => {
    // `cashOutValue` handles the freeroll (the stack is the house's, so it pays
    // nothing) and the two venues whose table stack isn't the buy-in.
    if (hero) adjustRoll(cashOutValue(venue, hero.stack))
    useProfile.getState().recordRollPoint()
    goHome()
  }
  const selectSeat = (id: string) => {
    sound.play('tap')
    setViewId(id)
  }

  const chipsTo = (id: string, to: Point) =>
    Array.from({ length: 6 }).map((_, k) => (
      <motion.span
        key={`chip-${id}-${k}`}
        className="pointer-events-none absolute z-30 -ml-[7px] -mt-[7px] size-3.5 rounded-full bg-amber-400 shadow-md shadow-black/30 ring-1 ring-amber-200/60"
        initial={{ left: '50%', top: '48%', opacity: 0, scale: 0.5 }}
        animate={{ left: to.left, top: to.top, opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.85] }}
        transition={{ duration: 0.8, delay: 0.15 + k * 0.05, ease: 'easeOut' }}
      />
    ))

  // **Five-Card Draw has no board, so it gets no board slots.** The five card
  // backs are placeholders for cards that are coming; at a draw table nothing
  // is ever coming, and rendering them promised a flop that never arrives. The
  // space collapses instead, which is also what puts the pot and the hands
  // where a draw table actually wants them.
  const communityCards =
    hand.variant === 'draw' ? null : (
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

  const drawing = hand.street === 'draw' && hand.players[hand.toActIndex]?.id === 'hero'

  const actionArea = spectating ? (
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

  // Table talk lives with the board — under the community cards, across from
  // the pot, where table chatter belongs.
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

  // An owned table finish recolours the felt — flat, no texture, ever. The two
  // themes need different physics: on dark, translucent colour glows over the
  // near-black background; on light, translucency makes a muddy stain that
  // kills text contrast, so we mix an OPAQUE pastel toward white instead — a
  // pale, designed surface that dark ink still reads on.
  const finishStyle = finish
    ? resolvedTheme === 'light'
      ? {
          background: `radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, ${finish.swatch} 26%, white), color-mix(in srgb, ${finish.swatch} 12%, white) 78%)`,
        }
      : {
          background: `radial-gradient(120% 90% at 50% 42%, ${finish.swatch}66, ${finish.swatch}24 78%), linear-gradient(${finish.swatch}1a, ${finish.swatch}1a)`,
        }
    : undefined

  // Help + last-hand controls. On desktop they sit in the AppBar; on mobile
  // they move down to just above the community cards (see below).
  const tableControls = (
    <>
      {hasHistory && (
        <AppBarAction
          label="Last hand"
          onClick={() => {
            sound.play('tap')
            setHistoryOpen(true)
          }}
        >
          <History className="size-4" />
        </AppBarAction>
      )}
      <AppBarAction
        label="Hand rankings"
        onClick={() => {
          sound.play('tap')
          setHelpOpen(true)
        }}
      >
        <HelpCircle className="size-4" />
      </AppBarAction>
    </>
  )

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden" style={finishStyle}>
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

      {isMobile ? (
        /* ------------------------------ MOBILE ------------------------------ */
        <>
          {/* opponents + board drift toward the centre — slack splits evenly
              above, between, and below them */}
          <div className="relative flex min-h-0 flex-1 flex-col justify-evenly px-2 pb-2">
            <div className="flex items-start justify-evenly">
              {opponents.map((p) => {
                const meta = metaById.get(p.id)
                if (!meta) return null
                return (
                  <Seat
                    key={p.id}
                    layout="row"
                    player={p}
                    name={meta.name}
                    avatarSpec={meta.avatar}
                    isDealer={p.id === buttonPlayerId}
                    isActive={activeId === p.id}
                    isThinking={aiThinkingId === p.id}
                    reveal={revealAll && p.status !== 'folded' && p.status !== 'out'}
                    cardsSide="right"
                    onSelect={() => selectSeat(p.id)}
                  />
                )
              })}
            </div>

            {/* board in the middle; talk on the left, pot on the right.
                Help + last-hand sit just above the board, aligned left. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 px-2 text-muted-foreground">
                {tableControls}
              </div>
              {communityCards}
              <div className="flex items-end justify-between gap-3 px-2">
                <div className="min-w-0 flex-1">{talkLine}</div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                    Pot
                  </span>
                  <CountUp
                    value={pot}
                    format={money}
                    className="text-2xl font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            {potWinners.map((id) =>
              chipsTo(
                id,
                id === 'hero' ? { left: '50%', top: '150%' } : { left: '50%', top: '10%' },
              ),
            )}
          </div>

          {/* actions */}
          <div className="px-3">{actionArea}</div>

          {/* hero: big fanned hole cards + a swipeable profile / odds panel */}
          {hero &&
            heroMeta &&
            (hand.variant === 'draw' ? (
              /* **Five cards do not fit beside the panel on a phone.** The row
                 below splits the width in two, which works at two hole cards
                 and just about at four; at five they run off the screen and
                 under the panel. So a draw table stacks instead: the cards get
                 the whole width on their own line — which they need anyway,
                 because during the draw round they are buttons you have to be
                 able to hit — and the panel sits under them. */
              <div className="flex flex-col gap-2 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+2.75rem)]">
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
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-stretch gap-3 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+2.75rem)]">
                {/* cards and panel each get exactly half the row; cards align
                    with the left edge of the action buttons (pl offsets the
                    first card's tilt so its corner doesn't poke past) */}
                <div className="flex flex-1 basis-0 items-end justify-start pl-2">
                  <HeroCards
                    hero={hero}
                    hand={hand}
                    size="hero"
                    fanned
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
                />
              </div>
            ))}
        </>
      ) : (
        /* ------------------------------ DESKTOP ----------------------------- */
        <>
          {/* table surface + seats */}
          <div className="relative flex-1">
            {opponents.map((p, i) => {
              const meta = metaById.get(p.id)
              if (!meta) return null
              return (
                <div
                  key={p.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={positions[i]}
                >
                  <Seat
                    player={p}
                    name={meta.name}
                    avatarSpec={meta.avatar}
                    isDealer={p.id === buttonPlayerId}
                    isActive={activeId === p.id}
                    isThinking={aiThinkingId === p.id}
                    reveal={revealAll && p.status !== 'folded' && p.status !== 'out'}
                    cardsSide={parseFloat(positions[i].left) > 50 ? 'left' : 'right'}
                    onSelect={() => selectSeat(p.id)}
                  />
                </div>
              )
            })}

            <div className="absolute left-1/2 top-[62%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4">
              {communityCards}
              <div className="flex w-full items-end justify-between gap-6">
                <div className="min-w-0 flex-1">{talkLine}</div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                    Pot
                  </span>
                  <CountUp
                    value={pot}
                    format={money}
                    className="text-3xl font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            {potWinners.map((id) => {
              const idx = opponents.findIndex((p) => p.id === id)
              const to: Point =
                id === 'hero'
                  ? { left: '50%', top: '118%' }
                  : idx >= 0
                    ? positions[idx]
                    : { left: '50%', top: '50%' }
              return chipsTo(id, to)
            })}
          </div>

          {/* hero zone */}
          {hero && heroMeta && (
            <div className="z-20 flex flex-col items-center gap-4 px-6 pb-8">
              <div className="flex items-stretch gap-6">
                <HeroCards
                  hero={hero}
                  hand={hand}
                  size="board"
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
                  />
                </div>
              </div>

              <div className="w-full max-w-xl">{actionArea}</div>
            </div>
          )}
        </>
      )}

      <HandsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <HandHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        buyIn={venue.cash ? cashInvested : venue.buyIn}
        stack={hero?.stack ?? 0}
        cashOut={cashOutValue(venue, hero?.stack ?? 0)}
        freeroll={venue.freeroll === true}
        cash={venue.cash === true}
        onConfirm={cashOutAndLeave}
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
                <span className="text-xs font-medium opacity-95">Bounty +{money(lastBounty)}</span>
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
          (venue.cash ? (
            // Cash tables: busting isn't the end. Rebuy from your Roll and sit
            // straight back down, drop to the freeroll if you can't afford it,
            // or just stand up. No "you finished Nth" — there's no tournament.
            <EndOverlay
              key="bust-cash"
              title="Out of chips"
              subtitle="The table’s still running — buy back in, or call it a session."
              onHome={goHome}
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
              subtitle={place ? `You finished ${ordinal(place)}` : 'Out of the tournament'}
              detail={recap && <RunRecap recap={recap} />}
              onHome={goHome}
              secondaryLabel={canWatch ? 'Watch it out' : undefined}
              onSecondary={
                canWatch
                  ? () => {
                      sound.play('tap')
                      watchItOut()
                    }
                  : undefined
              }
              primaryLabel={freerollOffered ? 'Play the freeroll' : undefined}
              onPrimary={
                freerollOffered
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
                  : undefined
              }
            />
          ))}
        {status === 'won' && (
          <EndOverlay
            key="won"
            title="Champion"
            subtitle={`You took it down — +${money(venue.prize + lastBounty)} to your Roll`}
            detail={
              <>
                {newAwards.length > 0 && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    {newAwards.map((a) => (
                      <span key={a.id} className="flex items-center gap-2 text-sm text-white/80">
                        <AwardChip award={a} earned size={22} />
                        New chip — {a.name}
                      </span>
                    ))}
                  </div>
                )}
                {recap && <RunRecap recap={recap} />}
              </>
            }
            onHome={goHome}
            celebrate
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// --- seat -------------------------------------------------------------------

function Seat({
  player,
  name,
  avatarSpec,
  isDealer,
  isActive,
  isThinking,
  reveal,
  cardsSide,
  onSelect,
  layout = 'arc',
}: {
  player: Player
  name: string
  avatarSpec: AvatarSpec
  isDealer: boolean
  isActive: boolean
  isThinking: boolean
  reveal: boolean
  cardsSide: 'left' | 'right'
  onSelect: () => void
  layout?: 'arc' | 'row'
}) {
  const folded = player.status === 'folded'
  const money = useMoney()
  const row = layout === 'row'
  const avatarSize = row ? 48 : 52
  const dealerSide = row ? '-right-1' : cardsSide === 'right' ? '-left-1' : '-right-1'

  return (
    <div className={cn('flex flex-col items-center', row ? 'w-16 gap-0.5' : 'w-20 gap-1')}>
      <div className="relative">
        <motion.button
          onClick={onSelect}
          aria-label={`About ${name}`}
          animate={isActive ? { scale: 1.08 } : { scale: 1 }}
          className={cn(
            'rounded-full transition hover:brightness-110',
            isActive && 'ring-2 ring-foreground/80',
          )}
        >
          <PlayerAvatar spec={avatarSpec} size={avatarSize} dimmed={folded} />
        </motion.button>
        {isDealer && !folded && (
          <span
            className={cn(
              'absolute -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-bold text-primary-foreground',
              dealerSide,
            )}
          >
            D
          </span>
        )}
        {isThinking && (
          <span className="absolute -top-2.5 left-1/2 size-3 -translate-x-1/2">
            <span className="absolute inset-0 animate-ping rounded-full bg-pip/70" />
            <span className="absolute inset-0 rounded-full bg-pip ring-2 ring-background" />
          </span>
        )}
        <AnimatePresence>
          {folded && (
            <motion.div
              initial={{ opacity: 0, scale: 1.9, rotate: -18 }}
              animate={{ opacity: 1, scale: 1, rotate: -9 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground backdrop-blur-[1px]">
                fold
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* arc: revealed cards fanned beside the avatar */}
        {!row && reveal && player.hole.length >= 2 && (
          <div
            className={cn(
              'absolute top-1/2 flex -translate-y-1/2 -space-x-1.5',
              cardsSide === 'right' ? 'left-[42px]' : 'right-[42px] flex-row-reverse',
            )}
          >
            {player.hole.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.7, x: cardsSide === 'right' ? -18 : 18 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: i === 0 ? -7 : 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18, delay: 0.14 + i * 0.1 }}
              >
                <PlayingCard card={card} size="xs" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <span
        className={cn(
          'max-w-full truncate',
          row ? 'text-2xs' : 'text-xs',
          folded ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          row ? 'text-xs' : 'text-sm',
          folded && 'text-muted-foreground/50',
        )}
      >
        {money(player.stack)}
      </span>
      {/* Reserve the bet-chip slot always, so a bet appearing/clearing never
          changes the seat's height (which would nudge the board via the
          justify-evenly column on mobile). */}
      <span className="flex h-[18px] items-center justify-center">
        {player.committedThisStreet > 0 && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
            {money(player.committedThisStreet)}
          </span>
        )}
      </span>

      {/* row: revealed cards below the seat */}
      {row && reveal && player.hole.length >= 2 && (
        <div className="mt-0.5 flex gap-0.5">
          {player.hole.map((card, i) => (
            <PlayingCard key={i} card={card} size="xs" />
          ))}
        </div>
      )}
    </div>
  )
}

// --- hero bits --------------------------------------------------------------

function HeroCards({
  hero,
  hand,
  size,
  fanned = false,
  discarding,
  marked,
  onToggle,
}: {
  hero: Player
  hand: HandState
  size: CardSize
  fanned?: boolean
  /** Five-Card Draw's discard round: the cards become buttons. */
  discarding?: boolean
  marked?: readonly number[]
  onToggle?: (index: number) => void
}) {
  const folded = hero.status === 'folded'
  const nickname = nicknameFor(hero.hole)
  return (
    <div className={cn('flex flex-col items-center gap-1.5', folded && 'opacity-40')}>
      {/* Not fanned while you are choosing: overlapping cards are lovely to
          look at and impossible to tap one of. */}
      <div className={cn('flex items-end', fanned && !discarding ? '-space-x-6' : 'gap-2')}>
        {hero.hole.map((card, i) => {
          const isMarked = discarding && marked?.includes(i)
          // Key by the card so a new deal re-mounts and replays the animation.
          const dealt = (
            <DealtCard
              key={`${card.rank}${card.suit}`}
              index={i}
              card={card}
              size={size}
              className={cn(
                fanned && !discarding && (i === 0 ? '-rotate-3' : 'translate-y-1 rotate-2'),
                // A dimmed (opacity-40) rounded card with a drop shadow renders a
                // bright halo along its bottom edge on iOS Safari — the shadow
                // inverts under fractional opacity. Folded cards don't need a
                // shadow anyway, so drop it and the artifact goes with it.
                folded && 'shadow-none dark:shadow-none',
                // Marked cards drop and fade: the gesture is "push it away",
                // and it has to read at a glance across five of them.
                isMarked && 'translate-y-3 opacity-40 saturate-50',
              )}
            />
          )
          if (!discarding) return dealt
          return (
            <button
              key={`${card.rank}${card.suit}`}
              type="button"
              onClick={() => onToggle?.(i)}
              aria-pressed={Boolean(isMarked)}
              aria-label={`${isMarked ? 'Keep' : 'Throw away'} the ${card.rank}${card.suit}`}
              className="rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
            >
              {dealt}
            </button>
          )
        })}
        <span className="sr-only">{hand.street}</span>
      </div>
      {nickname && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xs text-muted-foreground/70"
        >
          {nickname}
        </motion.span>
      )}
    </div>
  )
}

function useHandLabel(hero: Player, hand: HandState) {
  return useMemo(() => {
    if (hero.hole.length < 2) return null
    if (hero.hole.length + hand.community.length < 5) return nicknameFor(hero.hole) ?? 'Hole cards'
    try {
      // **The variant is not optional here.** Without it an Omaha hand is read
      // free-form, so four hearts in your hand and one on the board would put
      // "Flush" under your cards — a wrong claim, at the table, that the player
      // would act on. `nicknameFor` needs no such care: it returns null for
      // anything that is not exactly two cards.
      return evaluateHand(hero.hole, hand.community, hand.variant).name
    } catch {
      return null
    }
  }, [hero.hole, hand.community, hand.variant])
}

/** Mobile hero panel — swipe or tap the dots to flip between profile and odds. */
function HeroPanel({
  hero,
  avatar,
  hand,
  equity,
  isButton,
  isActive,
}: {
  hero: Player
  avatar: AvatarSpec
  hand: HandState
  equity: number | null
  isButton: boolean
  isActive: boolean
}) {
  const money = useMoney()
  const label = useHandLabel(hero, hand)
  const folded = hero.status === 'folded'
  const [page, setPage] = useState(0)

  return (
    <div className="relative flex min-h-[90px] min-w-0 flex-1 basis-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.04]">
      <motion.div
        className="flex size-full items-center justify-center pb-3"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -28) setPage(1)
          else if (info.offset.x > 28) setPage(0)
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {page === 0 ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center gap-0.5"
            >
              <div className="relative">
                <div className={cn('rounded-full', isActive && 'ring-2 ring-foreground/80')}>
                  <PlayerAvatar spec={avatar} size={36} dimmed={folded} />
                </div>
                {isButton && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-bold text-primary-foreground">
                    D
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums">{money(hero.stack)}</span>
              {hero.committedThisStreet > 0 && (
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-3xs font-medium tabular-nums">
                  {money(hero.committedThisStreet)}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="odds"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none flex flex-col items-center"
            >
              <span className="text-2xs text-muted-foreground">{label ?? '—'}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {equity !== null ? `${Math.round(equity * 100)}%` : '—'}
              </span>
              <span className="text-3xs uppercase tracking-wider text-muted-foreground">win</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="absolute bottom-1.5 flex gap-1.5">
        {[0, 1].map((i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            aria-label={i === 0 ? 'Show profile' : 'Show odds'}
            className={cn(
              'size-1.5 rounded-full transition',
              page === i ? 'bg-foreground/70' : 'bg-foreground/25',
            )}
          />
        ))}
      </div>
    </div>
  )
}

// --- chrome -----------------------------------------------------------------

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center"
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
  onHome,
  celebrate = false,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string
  subtitle: string
  detail?: React.ReactNode
  onHome: () => void
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
          {detail}
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
        </div>
      </div>
    </motion.div>
  )
}
