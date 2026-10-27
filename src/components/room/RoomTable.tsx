'use client'

// A multiplayer hand, on the same felt as every other table.
//
// Built from the live table's own parts (FeltSeat, HeroPanel, FeltStage,
// ActionBar) so a room looks and moves exactly like the ladder. What differs is
// where the hand comes from: the room server's view, in which every card that
// is not yours is missing until a showdown turns it over, and where your seat
// is wherever the server put you. The seats are turned so you are always at
// the near rail, the way you would sit at a real table.

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { HelpCircle, SlidersHorizontal, WifiOff } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { ActionBar } from '@/components/table/ActionBar'
import { ActionRow } from '@/components/table/ActionRow'
import { HandsHelpDialog } from '@/components/table/HandsHelpDialog'
import { HeroCards, HeroPanel, TableStyleContext } from '@/components/table/parts'
import { FeltSeat } from '@/components/table/seat'
import { FeltStage } from '@/components/table/stage'
import { TableFelt, TableRoom } from '@/components/table/surface'
import { useSeatActions } from '@/components/table/useSeatActions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cardBackById } from '@/config/cardBacks'
import { avatarRingById, dealerButtonById } from '@/config/cosmetics'
import { tableFinishById } from '@/config/shop'
import { venueById } from '@/config/venues'
import { heroEquity } from '@/lib/poker/heroEquity'
import type { RoomView } from '@/lib/multiplayer/view'
import { ordinal } from '@/lib/recap'
import { sound } from '@/lib/sound'
import { aroundFrom, feltFor, feltSeatPositions, TALL_PHONE, towards } from '@/lib/tableSeats'
import { useCopied } from '@/lib/useCopied'
import { useIsMobile, useMediaQuery } from '@/lib/useMediaQuery'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { useMedia } from '@/store/media'
import { useProfile } from '@/store/profile'
import { useRoom } from '@/store/room'
import {
  CameraToggle,
  FaceViewer,
  MediaControls,
  MediaProblem,
  MicToggle,
  SeatFace,
  TableAudio,
} from './live'
import { PlayerSheet } from './PlayerSheet'
import { PreActions } from './PreActions'
import { RoomRulesDialog } from './RoomSettings'
import { TurnClock } from './TurnClock'
import { useCatchUp } from './useCatchUp'
import { inQuiet } from '@/lib/multiplayer/slow'
import { timeLeft } from '@/lib/multiplayer/slowCard'

type Point = { left: string; top: string }

export function RoomTable({
  view,
  live,
  onLeave,
  onLeaveGame,
}: {
  view: RoomView
  /** Camera and mic are on offer: a private room, in a browser or app that can. */
  live: boolean
  /** Back. At a slow game the seat stays yours. */
  onLeave: () => void
  /** A slow game: stand up on purpose. */
  onLeaveGame?: () => void
}) {
  const slow = view.kind === 'slow'
  // At a slow game, what you missed plays first; until it has, the felt shows it.
  const catchUp = useCatchUp(view)
  const catching = catchUp.frame !== null
  const hand = catchUp.frame?.hand ?? view.hand!
  const handIndex = catchUp.frame?.index ?? view.handIndex
  const act = useRoom((s) => s.act)
  const setPre = useRoom((s) => s.setPre)
  const pending = useRoom((s) => s.pending)
  const connection = useRoom((s) => s.connection)
  const clockOffset = useRoom((s) => s.clockOffset)
  const media = useRoom((s) => s.media)
  const won = useRoom((s) => s.won)
  const remote = useMedia((s) => s.remote)
  const local = useMedia((s) => s.local)
  const localVoice = useMedia((s) => s.localVoice)
  const isMobile = useIsMobile()
  const tallPhone = useMediaQuery(TALL_PHONE)
  const cardBack = cardBackById(useProfile((s) => s.cardBack))
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const dealerButton = dealerButtonById(useProfile((s) => s.dealerButton))
  const showOdds = useProfile((s) => s.showOdds)
  const tableStyle = useMemo(() => ({ ring, button: dealerButton }), [ring, dealerButton])
  const seatActions = useSeatActions(hand, handIndex)
  const [helpOpen, setHelpOpen] = useState(false)
  const [codeCopied, markCodeCopied] = useCopied()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const now = useMinuteClock(slow)
  const [watching, setWatching] = useState(false)
  const [marked, setMarked] = useState<number[]>([])
  /** The seat whose camera is open large, if any. */
  const [big, setBig] = useState<string | null>(null)
  /** The seat the host has tapped, for its menu. */
  const [menu, setMenu] = useState<string | null>(null)
  const muted = useMedia((s) => s.muted)
  const hidden = useMedia((s) => s.hidden)

  const venue = venueById(view.venueId)
  const accent = venue?.accent ?? '#7C8CF0'
  const meta = new Map(view.players.map((p) => [p.id, p]))
  const me = view.you ? meta.get(view.you) : undefined
  const hero = hand.players.find((p) => p.id === view.you)

  // You at the near rail, everybody else round the table in seat order from
  // your left. Out of the hand (busted), you watch with every seat on the arc.
  const opponents = aroundFrom(hand.players, view.you)

  const g = feltFor(isMobile, opponents.length, tallPhone)
  const crowded = isMobile && opponents.length >= 6
  const positions = feltSeatPositions(opponents.length, g)
  const seatAt = new Map<string, Point>(opponents.map((p, i) => [p.id, positions[i]]))
  const seatPoint = (id: string): Point => (id === view.you ? g.hero : (seatAt.get(id) ?? g.pot))
  const betPoint = (id: string): Point => {
    if (id === view.you) return g.heroBet
    const seat = seatPoint(id)
    const plate = { left: seat.left, top: `${Number.parseFloat(seat.top) + g.plateDrop}%` }
    return towards(plate, g.focus, g.betReach)
  }

  const settled = hand.result !== null
  const buttonId = hand.players[hand.buttonIndex]?.id
  const activeId = settled ? undefined : hand.players[hand.toActIndex]?.id
  const potWinners = hand.result
    ? Array.from(new Set(hand.result.potsAwarded.flatMap((p) => p.winners)))
    : []
  const shown = hand.result?.showdown === true
  const result = settled ? describe(hand, view) : null

  const finished = view.phase === 'finished'
  const out = me?.place !== null && me?.place !== undefined
  const showEnd = (finished || out) && !watching && !catching
  // Who is talking and who is on camera, drawn in the seat. A seat with
  // neither keeps the table's own avatar (FeltSeat draws it when `face` is
  // undefined), so the room looks like the ladder until somebody turns
  // something on.
  // What you have muted or hidden is left out here, for you only.
  const videoOf = (id: string) =>
    media[id]?.camera && !hidden[id] ? (id === view.you ? local : remote[id]) : null
  const voiceOf = (id: string) =>
    media[id]?.mic && !muted[id] ? (id === view.you ? localVoice : remote[id]) : null
  const face = (id: string, size: number, dimmed: boolean, expand?: () => void) => {
    const video = videoOf(id)
    const voice = voiceOf(id)
    const seat = meta.get(id)
    if ((!video && !voice) || !seat) return undefined
    return (
      <SeatFace
        video={video}
        voice={voice}
        avatar={seat.avatar}
        ring={id === view.you ? ring : undefined}
        size={size}
        mirrored={id === view.you}
        dimmed={dimmed}
        onExpand={video ? expand : undefined}
      />
    )
  }
  const bigVideo = big ? videoOf(big) : null

  const seatsOnRail = opponents.map((p, i) => {
    const seat = meta.get(p.id)
    if (!seat) return null
    const x = Number.parseFloat(positions[i].left)
    // At a slow table being offline is normal; asleep is worth saying.
    const asleep = slow && !seat.left && inQuiet(now, seat.quiet)
    const away = !seat.bot && (seat.left || (!slow && !seat.connected) || asleep)
    const dim = p.status === 'folded' || p.status === 'out'
    return (
      <div
        key={p.id}
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={positions[i]}
      >
        <FeltSeat
          player={p}
          name={seat.name}
          avatarSpec={seat.avatar}
          isDealer={p.id === buttonId}
          isActive={activeId === p.id}
          reveal={shown && !dim && p.hole.length > 0}
          action={seatActions[p.id]}
          back={cardBack}
          compact={isMobile}
          crowded={crowded}
          actionBeside={crowded && (i === 0 || i === opponents.length - 1)}
          side={x < 42 ? 'left' : x > 58 ? 'right' : 'top'}
          onSelect={() => {
            sound.play('tap')
            // A person opens their sheet (camera, mute, report, block, and
            // remove for the host). The cast and AI seats have nothing to open.
            if (!seat.bot) setMenu(p.id)
          }}
          held={view.held[p.id]}
          // A stranger filling a quick-match seat is a computer, and says so.
          // (The cast in a private room are characters the host chose.)
          tag={seat.bot && !seat.characterId ? 'AI' : undefined}
          face={face(p.id, isMobile ? (crowded ? 40 : 46) : 64, dim)}
        />
        {away && (
          <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-table-shade/85 px-2 py-0.5 text-3xs font-medium text-muted-foreground">
            {seat.left ? 'Left' : asleep ? 'Asleep' : 'Away'}
          </span>
        )}
      </div>
    )
  })

  const myTurn = !catching && !settled && activeId === view.you && hero !== undefined
  // Your chance to win, worked out here from your own cards, the board and the
  // chips in, so it needs nobody else’s cards, which the view never holds. Only on
  // your turn, as at the ladder, so it is the number for the decision in front
  // of you.
  const equity = useMemo(
    () => (myTurn ? heroEquity(hand, view.you!) : null),
    [myTurn, hand, view.you],
  )
  const turnMs = slow
    ? (view.settings.moveHours ?? 12) * 60 * 60 * 1000
    : view.settings.turnSeconds * 1000
  const clock =
    myTurn && view.dueAt !== null && view.dueKind === 'turn' ? (
      <TurnClock dueAt={view.dueAt - clockOffset} totalMs={turnMs} slow={slow} />
    ) : undefined
  // A slow move's time left, in words, under the code: "11h 20m left".
  const moveLeft =
    slow && myTurn && view.dueAt !== null && view.dueKind === 'turn'
      ? `${timeLeft(view.dueAt - clockOffset - now)} left`
      : null
  // Whose move it is, in words, over the buttons. The early-move row under it
  // has a Check in it, and to somebody new to poker that reads as their turn.
  const actor = activeId ? hand.players.find((p) => p.id === activeId) : undefined
  const theirLeft =
    slow && !myTurn && view.dueAt !== null && view.dueKind === 'turn'
      ? timeLeft(view.dueAt - clockOffset - now)
      : null
  const turnLine =
    hero && actor && !catching ? (
      myTurn ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          Your move
        </span>
      ) : (
        <span className="text-muted-foreground">
          Waiting for {actor.name}
          {theirLeft && ` · ${theirLeft} to move`}
        </span>
      )
    ) : null
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

  return (
    <TableStyleContext.Provider value={tableStyle}>
      <MotionConfig reducedMotion="user">
        <div data-felt className="relative isolate flex h-dvh w-full flex-col overflow-hidden">
          <TableRoom venueId={view.venueId} accent={accent} />
          {live && <TableAudio media={media} />}

          <AppBar
            className="z-20"
            leading="back"
            showWordmark={false}
            // Everybody at a table is signed in, and a phone's bar needs the room.
            account={false}
            backLabel={slow ? 'Back' : 'Leave'}
            onBack={() => (slow || finished || out ? onLeave() : setLeaveOpen(true))}
            title={
              <>
                {view.kind !== 'quick' ? (
                  <button
                    onClick={async () => {
                      sound.play('tap')
                      try {
                        await navigator.clipboard.writeText(view.code)
                        markCodeCopied()
                      } catch {
                        // No clipboard: the code is there to read out.
                      }
                    }}
                    aria-label={`Copy room code ${view.code}`}
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    {codeCopied ? 'Copied' : isMobile ? view.code : `Room ${view.code}`}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    {venue?.name ?? 'Quick match'}
                  </span>
                )}
                {/* On your move at a slow table, the time you have; a phone's bar has room for one line. */}
                {moveLeft && isMobile ? (
                  <span className="text-2xs tabular-nums text-foreground/80">{moveLeft}</span>
                ) : (
                  <span className="text-2xs tabular-nums text-muted-foreground/60">
                    Blinds {view.smallBlind.toLocaleString()}/{view.bigBlind.toLocaleString()}
                    {view.blindLevel > 0 && ` · L${view.blindLevel + 1}`}
                    {moveLeft && <span className="text-foreground/80"> · {moveLeft}</span>}
                  </span>
                )}
              </>
            }
            actions={
              <>
                {/* On a phone, camera and mic live in the corners of your own
                    panel, by your thumb; help moves up here into their room. */}
                {live && !isMobile && <MediaControls bar />}
                {slow && (
                  <AppBarAction
                    label="Table rules"
                    onClick={() => {
                      sound.play('tap')
                      setRulesOpen(true)
                    }}
                  >
                    <SlidersHorizontal className="size-4" />
                  </AppBarAction>
                )}
                {helpButton}
              </>
            }
          />

          {connection === 'reconnecting' && (
            <div className="relative z-30 mx-auto mt-1 flex items-center gap-2 rounded-full bg-table-shade/85 px-3 py-1 text-2xs text-muted-foreground">
              <WifiOff className="size-3" /> Reconnecting. Your seat is kept.
            </div>
          )}

          <div
            className={cn(
              'relative min-h-0 flex-1',
              isMobile ? 'mx-0.5 mt-1' : 'mx-auto mt-2 w-full max-w-6xl',
            )}
          >
            <TableFelt geometry={g} swatch={finish?.swatch} accent={accent} compact={isMobile} />
            <FeltStage
              hand={hand}
              handIndex={handIndex}
              geometry={g}
              seatPoint={seatPoint}
              betPoint={betPoint}
              back={cardBack}
              compact={isMobile}
              potWinners={potWinners}
            />
            {seatsOnRail}
            {live && (
              <div className="absolute right-2 top-2 z-30 md:right-4 md:top-4">
                <MediaProblem />
              </div>
            )}
          </div>

          {hero && me && (
            <div
              className={cn(
                'relative z-20 flex items-stretch',
                isMobile ? 'gap-3 px-3' : 'justify-center gap-6 px-6',
              )}
            >
              <div
                className={cn('flex items-end justify-center', isMobile && 'flex-1 basis-0 pl-2')}
              >
                <HeroCards
                  hero={hero}
                  hand={hand}
                  size={isMobile ? 'hero' : 'board'}
                  fanned={isMobile}
                  tactile
                  discarding={false}
                  marked={marked}
                  onToggle={(i) =>
                    setMarked((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))
                  }
                />
              </div>
              <div className={cn('flex', isMobile ? 'flex-1 basis-0' : 'w-44')}>
                <HeroPanel
                  hero={hero}
                  avatar={me.avatar}
                  hand={hand}
                  equity={equity}
                  hideOdds={!showOdds}
                  isButton={hero.id === buttonId}
                  isActive={activeId === hero.id}
                  corners={{
                    ...(isMobile && live ? { left: <CameraToggle />, right: <MicToggle /> } : {}),
                    bottomLeft: clock,
                  }}
                  face={face(hero.id, 36, hero.status === 'folded', () => setBig(hero.id))}
                />
              </div>
            </div>
          )}

          <ActionRow
            compact={isMobile}
            line={
              // One height, held (empty) while catching up too, so nothing jumps as the turn moves.
              hero && (
                <p
                  aria-live="polite"
                  className="mb-2 flex min-h-5 items-center justify-center text-center text-xs"
                >
                  {turnLine}
                </p>
              )
            }
          >
            {/* While your move is on its way (`pending`) the row stays empty. */}
            {catching ? (
              // What you missed, playing: the way back to the live table.
              <div className="flex w-full items-center justify-between gap-3 self-stretch rounded-2xl bg-foreground/[0.04] px-4 py-2 ring-1 ring-foreground/10">
                <span className="text-sm text-muted-foreground tabular-nums">
                  Catching up · hand {handIndex}
                </span>
                <button
                  onClick={catchUp.skip}
                  className="shrink-0 whitespace-nowrap rounded-full bg-foreground/[0.08] px-4 py-2 text-sm font-semibold transition hover:bg-foreground/[0.14] active:scale-[0.97]"
                >
                  Skip
                </button>
              </div>
            ) : hero && pending ? null : hero && !myTurn && !settled && view.you ? (
              <PreActions
                hand={hand}
                handIndex={view.handIndex}
                heroId={view.you}
                pre={view.pre}
                onSet={setPre}
              />
            ) : hero ? (
              <ActionBar
                hand={hand}
                viewerId={view.you ?? undefined}
                onAct={act}
                marked={marked}
                onDrawn={() => setMarked([])}
              />
            ) : (
              <div className="flex w-full items-center justify-between gap-3 self-stretch rounded-2xl bg-foreground/[0.03] px-4 py-2 ring-1 ring-foreground/10 ring-inset">
                <span className="text-sm text-muted-foreground">
                  {me?.place ? `You finished ${ordinal(me.place)}. Watching it out.` : 'Watching.'}
                </span>
                <button
                  onClick={onLeave}
                  className="shrink-0 text-sm font-medium underline underline-offset-4 transition hover:text-foreground"
                >
                  Leave
                </button>
              </div>
            )}
          </ActionRow>

          <AnimatePresence>
            {result && !showEnd && (
              <motion.div
                key={`r-${handIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-none absolute inset-x-0 top-[54%] z-30 flex justify-center px-3"
              >
                <span className="rounded-3xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-2xl">
                  {result}
                </span>
              </motion.div>
            )}
            {showEnd && me && (
              <EndCard
                key="end"
                won={me.place === 1}
                place={me.place}
                prize={
                  won || me.place === 1
                    ? Math.floor(
                        view.prize / Math.max(1, view.players.filter((p) => p.place === 1).length),
                      )
                    : 0
                }
                leaveLabel={slow ? 'Done' : 'Back to multiplayer'}
                onLeave={onLeave}
                onWatch={finished ? undefined : () => setWatching(true)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {big && bigVideo && (
              <FaceViewer
                key={big}
                video={bigVideo}
                voice={voiceOf(big)}
                name={big === view.you ? 'You' : (meta.get(big)?.name ?? '')}
                mirrored={big === view.you}
                onClose={() => setBig(null)}
              />
            )}
          </AnimatePresence>
          <PlayerSheet
            seat={menu ? (meta.get(menu) ?? null) : null}
            onClose={() => setMenu(null)}
            isHost={view.isHost && !meta.get(menu ?? '')?.standing}
            blocked={menu ? view.blocked.includes(menu) : false}
            cameraOn={menu ? Boolean(media[menu]?.camera) : false}
            micOn={menu ? Boolean(media[menu]?.mic) : false}
            onShowCamera={() => menu && setBig(menu)}
            removeNote="They’re folded out after this hand and can’t rejoin."
          />
          <HandsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
          {slow && (
            <RoomRulesDialog
              open={rulesOpen}
              onOpenChange={setRulesOpen}
              settings={view.settings}
              buyIn={view.buyIn}
              slow
            >
              {onLeaveGame && !finished && !out && (
                <button
                  onClick={() => {
                    sound.play('tap')
                    setRulesOpen(false)
                    setLeaveOpen(true)
                  }}
                  className="mt-1 w-full rounded-2xl bg-foreground/[0.06] py-3 text-sm font-semibold text-suit-red transition hover:bg-foreground/[0.1]"
                >
                  Leave this game
                </button>
              )}
            </RoomRulesDialog>
          )}
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{slow ? 'Leave this game?' : 'Leave the table?'}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {slow
                  ? 'Your hands are folded for you until you’re out. Open the game again before then and you can carry on.'
                  : 'Your chips stay in the game and your hands are folded for you until you are out. Come back with the same code before then and you can carry on.'}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setLeaveOpen(false)}
                  className="flex-1 rounded-2xl bg-foreground/[0.08] py-3 font-semibold transition hover:bg-foreground/[0.14]"
                >
                  Stay
                </button>
                <button
                  onClick={() => {
                    setLeaveOpen(false)
                    if (slow && onLeaveGame) onLeaveGame()
                    else onLeave()
                  }}
                  className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Leave
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </MotionConfig>
    </TableStyleContext.Provider>
  )
}

/** The time, every 30 seconds, for slow tables (asleep seats, hours left); still otherwise. */
function useMinuteClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [on])
  return now
}

/** "Sam wins 1,200 with a flush", the way the single-player table says it. */
function describe(hand: RoomView['hand'], view: RoomView): string | null {
  const win = hand?.result?.potsAwarded[0]
  if (!hand?.result || !win) return null
  const names = win.winners
    .map((id) => (id === view.you ? 'You' : (view.players.find((p) => p.id === id)?.name ?? '')))
    .join(' & ')
  const verb = win.winners.length === 1 && win.winners[0] === view.you ? 'win' : 'wins'
  const handName = hand.result.showdown ? hand.result.evaluations?.[win.winners[0]]?.name : null
  return `${names} ${verb} ${win.amount.toLocaleString()}${handName ? ` with ${handName.toLowerCase()}` : ''}`
}

function EndCard({
  won,
  place,
  prize,
  leaveLabel,
  onLeave,
  onWatch,
}: {
  won: boolean
  place: number | null
  prize: number
  leaveLabel: string
  onLeave: () => void
  onWatch?: () => void
}) {
  const money = useMoney()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 overflow-y-auto bg-black/85 backdrop-blur-sm"
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        >
          {/* The overlay is always dark, so text is white regardless of theme. */}
          <h2
            className={cn(
              'text-5xl font-semibold tracking-tight sm:text-6xl',
              won ? 'text-pip' : 'text-white',
            )}
          >
            {won ? 'Champion' : 'Knocked out'}
          </h2>
          <p className="mt-3 text-white/60">
            {won
              ? prize > 0
                ? `You took it down. +${money(prize)} to your Roll`
                : 'You took it down.'
              : place
                ? `You finished ${ordinal(place)}`
                : 'Out of the game'}
          </p>
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onLeave}
            className="rounded-2xl bg-white px-8 py-3.5 font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
          >
            {leaveLabel}
          </button>
          {onWatch && (
            <button
              onClick={onWatch}
              className="text-sm text-white/75 underline underline-offset-4 transition hover:text-white"
            >
              Watch it out
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
