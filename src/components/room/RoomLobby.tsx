'use client'

// A private room before the deal: the table itself, with the chairs filling.
//
// Not a list of names. You sit at the near rail and the room's other chairs
// stand round the felt, empty ones drawn as an outline, and the code sits on
// the cloth where the board will be. Friends arrive into their chairs as they
// join, cameras on if they like, and the host deals when the table looks right.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Plus, Share2, SlidersHorizontal, X } from 'lucide-react'
import { AppBar, AppBarAction } from '@/components/AppBar'
import { TableStyleContext } from '@/components/table/parts'
import { TableFelt, TableRoom } from '@/components/table/surface'
import { avatarRingById, dealerButtonById } from '@/config/cosmetics'
import { tableFinishById } from '@/config/shop'
import { venueById } from '@/config/venues'
import { inviteLink } from '@/lib/multiplayer/client'
import type { RoomView, SeatView } from '@/lib/multiplayer/view'
import { sound } from '@/lib/sound'
import { feltFor, feltSeatPositions, TALL_PHONE } from '@/lib/tableSeats'
import { useCopied } from '@/lib/useCopied'
import { useIsMobile, useMediaQuery } from '@/lib/useMediaQuery'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { useMedia } from '@/store/media'
import { useProfile } from '@/store/profile'
import { useRoom } from '@/store/room'
import { PlayerSheet } from './PlayerSheet'
import { RoomRulesDialog } from './RoomSettings'
import {
  CameraToggle,
  FaceViewer,
  MediaControls,
  MediaProblem,
  MicToggle,
  SeatFace,
  TableAudio,
} from './live'

export function RoomLobby({
  view,
  live,
  onLeave,
}: {
  view: RoomView
  live: boolean
  onLeave: () => void
}) {
  const money = useMoney()
  const isMobile = useIsMobile()
  const tallPhone = useMediaQuery(TALL_PHONE)
  const start = useRoom((s) => s.start)
  const addBots = useRoom((s) => s.addBots)
  const removeBot = useRoom((s) => s.removeBot)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sheet, setSheet] = useState<SeatView | null>(null)
  const muted = useMedia((s) => s.muted)
  const hidden = useMedia((s) => s.hidden)
  const media = useRoom((s) => s.media)
  const remote = useMedia((s) => s.remote)
  const local = useMedia((s) => s.local)
  const localVoice = useMedia((s) => s.localVoice)
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  const ring = avatarRingById(useProfile((s) => s.avatarRing))
  const dealerButton = dealerButtonById(useProfile((s) => s.dealerButton))
  const tableStyle = useMemo(() => ({ ring, button: dealerButton }), [ring, dealerButton])
  const [copied, markCopied] = useCopied()
  /** The seat whose camera is open large, if any. */
  const [big, setBig] = useState<string | null>(null)

  const venue = venueById(view.venueId)
  const accent = venue?.accent ?? '#7C8CF0'
  const me = view.players.find((p) => p.id === view.you)
  const others = view.players.filter((p) => p.id !== view.you)
  const chairs = view.maxSeats - 1
  const g = feltFor(isMobile, chairs, tallPhone)
  const positions = feltSeatPositions(chairs, g)
  const host = view.players.find((p) => p.host)
  const canDeal = view.isHost && view.players.length >= 2
  const full = view.players.length >= view.maxSeats
  // A full ring's chairs draw smaller on a phone, as its seats do (`FeltSeat` `crowded`).
  const size = isMobile ? (chairs >= 6 ? 40 : 46) : 64

  // What you have muted or hidden is left out here, for you only.
  const videoOf = (id: string) =>
    media[id]?.camera && !hidden[id] ? (id === view.you ? local : remote[id]) : null
  const voiceOf = (id: string) =>
    media[id]?.mic && !muted[id] ? (id === view.you ? localVoice : remote[id]) : null
  const faceFor = (seat: SeatView, px: number) => (
    <SeatFace
      video={videoOf(seat.id)}
      voice={voiceOf(seat.id)}
      avatar={seat.avatar}
      ring={seat.id === view.you ? ring : undefined}
      size={px}
      mirrored={seat.id === view.you}
      dimmed={!seat.bot && !seat.connected}
      // Your own camera opens large. Anybody else's face opens their sheet
      // (the wrapper below), which has the camera in it too.
      onExpand={seat.id === view.you ? () => setBig(seat.id) : undefined}
    />
  )
  const bigVideo = big ? videoOf(big) : null

  const [codeCopied, markCodeCopied] = useCopied()
  const copyCode = async () => {
    sound.play('tap')
    try {
      await navigator.clipboard.writeText(view.code)
      markCodeCopied()
    } catch {
      // No clipboard: the code is there to read out.
    }
  }

  const link = inviteLink(view.code)
  const share = async () => {
    sound.play('tap')
    const text = `Pull up a chair: room ${view.code} on Pip.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pip', text, url: link })
        return
      } catch {
        // Cancelled, or not allowed here: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      markCopied()
    } catch {
      // No clipboard either: the code is on the felt to read out.
    }
  }

  return (
    <TableStyleContext.Provider value={tableStyle}>
      <div data-felt className="relative isolate flex h-dvh w-full flex-col overflow-hidden">
        <TableRoom venueId={view.venueId} accent={accent} />
        {live && <TableAudio media={media} />}
        <AppBar
          className="z-20"
          leading="back"
          backLabel="Leave"
          showWordmark={false}
          onBack={onLeave}
          actions={
            <>
              {live && !isMobile && <MediaControls bar />}
              <AppBarAction
                label="Table rules"
                onClick={() => {
                  sound.play('tap')
                  setRulesOpen(true)
                }}
              >
                <SlidersHorizontal className="size-4" />
              </AppBarAction>
            </>
          }
          account={false}
          // On a phone the bar is full of buttons, and the code is on the felt.
          title={
            isMobile ? undefined : (
              <span className="text-sm font-medium text-muted-foreground">
                {host ? `${host.id === view.you ? 'Your' : `${host.name}’s`} room` : 'A room'}
              </span>
            )
          }
        />

        <div
          className={cn(
            'relative min-h-0 flex-1',
            isMobile ? 'mx-0.5 mt-1' : 'mx-auto mt-2 w-full max-w-6xl',
          )}
        >
          <TableFelt geometry={g} swatch={finish?.swatch} accent={accent} compact={isMobile} />

          {/* The code, on the cloth where the cards will land. */}
          <div
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center"
            style={g.board}
          >
            <span className="text-2xs uppercase tracking-[0.25em] text-muted-foreground">
              {codeCopied ? 'Copied' : 'Room code'}
            </span>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => void copyCode()}
              aria-label={`Copy room code ${view.code}`}
              className="rounded-xl px-2 font-mono text-3xl font-semibold tracking-[0.3em] transition hover:bg-foreground/5 md:text-5xl"
            >
              {view.code}
            </motion.button>
            <button
              onClick={() => void share()}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-table-shade/70 px-4 py-2 text-sm font-medium ring-1 ring-foreground/10 transition hover:bg-table-shade active:scale-[0.97]"
            >
              {copied ? (
                <>
                  <Check className="size-4" /> Link copied
                </>
              ) : typeof navigator !== 'undefined' && 'share' in navigator ? (
                <>
                  <Share2 className="size-4" /> Invite friends
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy invite link
                </>
              )}
            </button>
          </div>

          {/* The chairs. Filled in the order people sat down. */}
          {positions.map((pos, i) => {
            const seat = others[i]
            return (
              <div
                key={seat?.id ?? `empty-${i}`}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={pos}
              >
                {seat ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                    className="relative"
                    style={{ width: size, height: size }}
                  >
                    <div className="rounded-full shadow-lg shadow-table-shade/70 ring-2 ring-table-shade">
                      {seat.bot ? (
                        faceFor(seat, size)
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            sound.play('tap')
                            setSheet(seat)
                          }}
                          aria-label={`About ${seat.name}`}
                          className="block rounded-full"
                        >
                          {faceFor(seat, size)}
                        </button>
                      )}
                    </div>
                    {view.isHost && seat.bot && (
                      <button
                        onClick={() => {
                          sound.play('tap')
                          removeBot(seat.id)
                        }}
                        aria-label={`Send ${seat.name} home`}
                        className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-table-shade text-muted-foreground ring-1 ring-foreground/15 transition hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                    <div
                      className={cn(
                        'absolute left-1/2 top-full -mt-2 flex -translate-x-1/2 flex-col items-center rounded-xl bg-table-shade/75 shadow-lg ring-1 ring-foreground/10',
                        isMobile ? 'min-w-[3.75rem] px-2 py-0.5' : 'min-w-[5.5rem] px-3 py-1',
                      )}
                    >
                      <span
                        className={cn(
                          'max-w-[6.5rem] truncate leading-tight',
                          isMobile ? 'text-3xs' : 'text-xs',
                        )}
                      >
                        {seat.name}
                      </span>
                      <span className="text-3xs leading-tight text-muted-foreground">
                        {seat.bot
                          ? 'Regular'
                          : seat.host
                            ? 'Host'
                            : seat.connected
                              ? 'Here'
                              : 'Away'}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <div
                    aria-hidden
                    className="grid place-items-center rounded-full border-2 border-dashed border-table-line/25 bg-table-shade/20 text-2xs text-muted-foreground/60"
                    style={{ width: size, height: size }}
                  >
                    Empty
                  </div>
                )}
              </div>
            )
          })}

          {live && (
            <div className="absolute right-2 top-2 z-30 md:right-4 md:top-4">
              <MediaProblem />
            </div>
          )}
        </div>

        {/* You, at the near rail, and what happens next. */}
        <div
          className={cn(
            'relative z-20 mx-auto flex w-full flex-col items-center gap-3',
            isMobile
              ? 'px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'
              : 'max-w-xl px-6 pt-3 pb-7',
          )}
        >
          {me && (
            <div className="flex w-full items-center justify-center gap-3">
              {faceFor(me, 40)}
              <div className="text-left">
                <p className="text-sm font-semibold">{me.name}</p>
                <p className="text-2xs text-muted-foreground">
                  {view.settings.forRoll ? `${money(view.buyIn)} buy-in` : 'For fun'}
                </p>
              </div>
              {/* On a phone, camera and mic sit beside you, by your thumb. */}
              {live && isMobile && (
                <div className="ml-auto flex items-center gap-1">
                  <CameraToggle />
                  <MicToggle />
                </div>
              )}
            </div>
          )}

          {view.isHost ? (
            <div className="flex w-full gap-2">
              <button
                onClick={() => {
                  sound.play('tap')
                  addBots(1)
                }}
                disabled={full}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-foreground/[0.08] py-4 text-base font-semibold transition hover:bg-foreground/[0.14] active:scale-[0.97] disabled:opacity-40"
              >
                <Plus className="size-4" /> Add a regular
              </button>
              <button
                onClick={() => {
                  sound.play('call')
                  start()
                }}
                disabled={!canDeal}
                className="flex-1 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
              >
                Deal
              </button>
            </div>
          ) : (
            <p className="w-full rounded-2xl bg-foreground/[0.04] px-4 py-3 text-center text-sm text-muted-foreground">
              {host ? `Waiting for ${host.name} to deal.` : 'Waiting for the deal.'}
            </p>
          )}
        </div>
        <RoomRulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          settings={view.settings}
          buyIn={view.buyIn}
        />
        <PlayerSheet
          seat={sheet}
          onClose={() => setSheet(null)}
          isHost={view.isHost}
          blocked={sheet ? view.blocked.includes(sheet.id) : false}
          cameraOn={sheet ? Boolean(media[sheet.id]?.camera) : false}
          micOn={sheet ? Boolean(media[sheet.id]?.mic) : false}
          onShowCamera={() => sheet && setBig(sheet.id)}
          removeNote="They lose their seat and can’t rejoin this room."
        />
        <AnimatePresence>
          {big && bigVideo && (
            <FaceViewer
              key={big}
              video={bigVideo}
              voice={voiceOf(big)}
              name={big === view.you ? 'You' : (view.players.find((p) => p.id === big)?.name ?? '')}
              mirrored={big === view.you}
              onClose={() => setBig(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </TableStyleContext.Provider>
  )
}
