'use client'

// `/game/room?code=…`: a multiplayer table, from the invite to the last hand.
//
// The code is in the query string because the site is a static export: there
// is no server to render `/room/ABC123`, so the page is one file and the code
// is read here. The share link opens straight onto it, in a browser or the app.
//
// **Sitting down is a tap.** Even with a code in the link, nobody is seated by
// opening a page: they see whose room it is and the buy-in, and press Join.
// That tap is also what lets a phone play the table's voices, which no browser
// allows without one.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Spade, Users } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { AvatarEditor } from '@/components/profile/AvatarEditor'
import { HeroTable, riseDelay } from '@/components/marketing/HeroTable'
import { PlayButton } from '@/components/marketing/PlayButton'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { venueById } from '@/config/venues'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'
import { normaliseRoomCode } from '@/lib/multiplayer/code'
import {
  devMember,
  devSignedIn,
  peekRoom,
  roomsConfigured,
  type RoomPeek,
} from '@/lib/multiplayer/client'
import type { ServerError } from '@/lib/multiplayer/protocol'
import { hosted } from '@/lib/multiplayer/room'
import { appSupports, inApp } from '@/lib/nativeApp'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { mediaSupported, useMedia } from '@/store/media'
import { useProfile } from '@/store/profile'
import { useRoom } from '@/store/room'
import { useSlowGames } from '@/store/slowGames'
import { useSync } from '@/store/sync'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { RoomLobby } from './RoomLobby'
import { RoomTable } from './RoomTable'

const ERROR_COPY: Partial<Record<ServerError, string>> = {
  auth: 'Sign in again to sit down.',
  'members-only': 'This comes with the membership.',
  'no-room': 'There’s no room with that code. It may have finished, or the code is mistyped.',
  full: 'That table is full.',
  started: 'That game has already started. Only the players who sat down before the deal can join.',
  'not-invited': 'That table was matched for other players.',
  closed: 'That room has closed.',
  kicked: 'The host removed you from this room.',
  'too-many': 'You’re in ten slow games already. Finish one first.',
}

export function RoomScreen() {
  const params = useSearchParams()
  const code = normaliseRoomCode(params.get('code') ?? '')
  const router = useRouter()
  const roomCode = useRoom((s) => s.code)
  const connection = useRoom((s) => s.connection)
  const view = useRoom((s) => s.view)
  const error = useRoom((s) => s.error)
  const leave = useRoom((s) => s.leave)
  const exit = useRoom((s) => s.exit)
  const member = useEntitlement() || devMember()
  // Known not to be a member, so the end screen's "host your own" never flashes
  // past a member while the row loads.
  const notMember = useMembership((s) => s.checked && !s.member) && !devMember()

  const sitting = code !== null && roomCode === code
  const slow = view?.kind === 'slow'

  // Set the moment Back is pressed. Clearing the room drops this screen to
  // the join gate for a frame before the route changes, and the gate puts you
  // straight back in a slow game you hold a seat at.
  const [leaving, setLeaving] = useState(false)

  const goBack = () => {
    setLeaving(true)
    useMedia.getState().stop()
    // A slow game's seat stays yours with the screen closed: back is only back.
    if (slow) {
      exit()
      void useSlowGames.getState().refresh()
      router.push('/game')
      return
    }
    leave()
    router.push('/game/multiplayer')
  }
  /** Out of a finished fast game to another page: the end screen's host card. */
  const leaveTo = (href: string) => {
    setLeaving(true)
    useMedia.getState().stop()
    leave()
    router.push(href)
  }
  /** A slow game, given up on purpose: the seat is freed, or folded out once dealt. */
  const leaveGame = () => {
    setLeaving(true)
    leave()
    void useSlowGames.getState().refresh()
    router.push('/game')
  }

  /**
   * To this game's session review. A slow game keeps your seat, as Back does; a
   * fast one is over for you by now, so the seat goes. The hands are already
   * kept on this device (lib/multiplayer/review).
   */
  const review = () => {
    if (!code) return
    sound.play('tap')
    setLeaving(true)
    useMedia.getState().stop()
    if (slow) exit()
    else leave()
    router.push(`/game/review?room=${code}`)
  }

  if (leaving) return <Waiting label="Leaving the table" />
  if (!roomsConfigured()) return <Unavailable />
  if (!code) return <NoRoom message="That link doesn’t have a room code in it." />
  if (!sitting) return <JoinGate code={code} />

  if (connection === 'gone' || (!view && error)) {
    return <NoRoom message={(error && ERROR_COPY[error]) ?? 'The table closed.'} />
  }
  if (!view) return <Waiting label="Pulling up a chair" />

  // Camera and mic at the tables friends share by code: a private room or a
  // slow game. A room hosted without the membership has neither: its host
  // sees them locked in the lobby (a tap leads to the membership), and once
  // the cards are dealt nobody sees them, so the hands carry nothing about
  // buying. A view from a server older than the rule has no `media`.
  const canShow = hosted(view) && mediaSupported() && (!inApp() || appSupports('media'))
  const media = view.media !== false
  const live = canShow && media

  return (
    <>
      {live && <MeshLink />}
      {view.phase === 'lobby' ? (
        <RoomLobby
          view={view}
          live={live || (canShow && view.isHost)}
          onLeave={goBack}
          onLeaveGame={leaveGame}
        />
      ) : view.hand ? (
        <RoomTable
          view={view}
          live={live}
          onLeave={goBack}
          onLeaveGame={leaveGame}
          onReview={member ? review : undefined}
          onHostOwn={notMember && view.kind === 'private' && !view.isHost ? leaveTo : undefined}
        />
      ) : (
        <Waiting label="Dealing" />
      )}
    </>
  )
}

/**
 * Keeps one camera-and-mic connection open to every other person in the room,
 * and closes them all when you leave. Renders nothing.
 */
function MeshLink() {
  const view = useRoom((s) => s.view)
  const media = useRoom((s) => s.media)
  const me = view?.you ?? null
  // The seats whose sockets are open, which is what `media` is keyed by.
  const peers = Object.keys(media)
    .filter((id) => id !== me)
    .sort()
    .join(',')
  const session = useRoom((s) => s.session)
  useEffect(() => {
    if (me) useMedia.getState().connect(me, peers ? peers.split(',') : [])
  }, [me, peers])
  // A new socket starts with your camera and mic marked off on the server.
  // If they are on here, say so again.
  useEffect(() => {
    const { camera, mic } = useMedia.getState()
    if (session > 0 && (camera || mic)) useRoom.getState().setMedia({ camera, mic })
  }, [session])
  useEffect(() => () => useMedia.getState().stop(), [])
  return null
}

/** Back from a room's own screens goes to multiplayer, not the lobby. */
function useToMultiplayer(): () => void {
  const router = useRouter()
  return () => router.push('/game/multiplayer')
}

function JoinGate({ code }: { code: string }) {
  const toMultiplayer = useToMultiplayer()
  const money = useMoney()
  const spendable = useSpendableRoll()
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const ready = useSync((s) => s.ready)
  const hasPlayer = useProfile((s) => s.created && Boolean(s.avatar))
  const enter = useRoom((s) => s.enter)
  const [peek, setPeek] = useState<RoomPeek | null | 'loading'>('loading')
  const [account, setAccount] = useState<AccountMode | null>(null)
  // A slow game you are already in (a notification, an email, a bookmark):
  // straight back to your seat, no Join to press.
  const mine = useSlowGames((s) => s.games.some((g) => g.code === code && g.phase !== 'closed'))
  useEffect(() => {
    if (mine && signedIn) enter(code)
  }, [mine, signedIn, code, enter])

  useEffect(() => {
    let live = true
    void peekRoom(code).then((p) => {
      if (live) setPeek(p)
    })
    return () => {
      live = false
    }
  }, [code])

  if (peek === 'loading' || !ready) return <Waiting label="Finding the room" />
  if (!peek || peek.phase === 'closed' || peek.phase === 'finished') {
    return signedIn ? <NoRoom message={ERROR_COPY['no-room']!} /> : <TableOver code={code} />
  }
  const venue = venueById(peek.venueId)
  // Coming back to a game already dealt is never refused for the Roll: the
  // buy-in went in on the deal.
  const short = peek.phase === 'lobby' && peek.forRoll !== false && spendable < peek.buyIn
  const full = peek.phase === 'lobby' && peek.seated >= peek.maxSeats
  // Signed out, nobody can be one of the players already dealt in.
  const shut = !signedIn && (full || peek.phase === 'playing')
  const openAccount = (mode: AccountMode) => {
    sound.play('tap')
    setAccount(mode)
  }

  return (
    <PageShell leading="back" backLabel="Multiplayer" onBack={toMultiplayer}>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        {hasPlayer || shut ? (
          <div className="grid size-14 place-items-center rounded-full bg-foreground/[0.06]">
            <Users className="size-6" />
          </div>
        ) : null}
        <div>
          <p className="text-2xs uppercase tracking-[0.25em] text-muted-foreground">Room {code}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {peek.kind === 'quick'
              ? 'Your quick match'
              : peek.host
                ? peek.kind === 'slow'
                  ? `${peek.host}’s slow game`
                  : `${peek.host}’s table`
                : 'A table'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {venue?.name ?? 'Ladder'} stakes ·{' '}
            {peek.kind === 'slow' && peek.moveHours ? `${peek.moveHours}h a move · ` : ''}
            {peek.forRoll === false ? 'For fun' : `${money(peek.buyIn)} buy-in`} · {peek.seated} of{' '}
            {peek.maxSeats} seated
          </p>
        </div>

        {shut ? (
          <>
            <p className="text-sm text-muted-foreground">
              {full ? ERROR_COPY.full : ERROR_COPY.started}
            </p>
            <Link
              href="/game?account=new"
              onClick={() => sound.play('call')}
              className={primaryButton}
            >
              Create a free account
            </Link>
            <button type="button" onClick={() => openAccount('signin')} className={quietButton}>
              Already have an account? Sign in
            </button>
          </>
        ) : !hasPlayer ? (
          <MakePlayer onSignIn={signedIn ? null : () => openAccount('signin')} />
        ) : !signedIn ? (
          <>
            <p className="text-sm text-muted-foreground">
              A free account is all a friend’s table needs.
            </p>
            <button type="button" onClick={() => openAccount('signup')} className={primaryButton}>
              Create a free account to join
            </button>
            <button type="button" onClick={() => openAccount('signin')} className={quietButton}>
              Already have an account? Sign in
            </button>
          </>
        ) : full ? (
          <p className="text-sm text-muted-foreground">{ERROR_COPY.full}</p>
        ) : short ? (
          <>
            <p className="text-sm text-muted-foreground">
              The buy-in is {money(peek.buyIn)} and your Roll has {money(spendable)}. Win a few
              hands on the ladder and come back.
            </p>
            <Link href="/game" className={secondaryButton}>
              Play the ladder
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              sound.play('call')
              enter(code)
            }}
            className={primaryButton}
          >
            {peek.phase === 'playing' ? 'Back to the table' : 'Join'}
          </button>
        )}
      </div>
      <AccountDialog
        open={account !== null}
        mode={account ?? 'signin'}
        onOpenChange={(o) => {
          if (!o) setAccount(null)
        }}
      />
    </PageShell>
  )
}

/**
 * Somebody opening an invite with no player on this device makes one here, the
 * same face and name as the welcome flow's first step, and stays on the room.
 * The account comes next, on the same screen.
 */
function MakePlayer({ onSignIn }: { onSignIn: (() => void) | null }) {
  const createProfile = useProfile((s) => s.createProfile)
  const [spec, setSpec] = useState<AvatarSpec>(() => ({
    seed: freshSeed(),
    backgroundColor: AVATAR_BG_SWATCHES[1],
  }))
  const [name, setName] = useState('')

  const make = () => {
    if (!name.trim()) return
    sound.play('call')
    createProfile(name, spec)
  }

  return (
    <>
      <div className="w-full rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <p className="mb-4 font-semibold">Make your player</p>
        <AvatarEditor
          spec={spec}
          name={name}
          onSpecChange={setSpec}
          onNameChange={setName}
          onSubmit={make}
          avatarSize={96}
          compact
        />
      </div>
      <button type="button" onClick={make} disabled={!name.trim()} className={primaryButton}>
        Next
      </button>
      {onSignIn && (
        <button type="button" onClick={onSignIn} className={quietButton}>
          Already have an account? Sign in
        </button>
      )}
    </>
  )
}

/**
 * A finished table's link, opened by someone signed out: most likely a friend
 * of a friend who has never played. The game is gone, so the screen sells the
 * one that never closes: the homepage's recorded hand and its Play button,
 * which takes a newcomer through the welcome flow to their first table.
 */
function TableOver({ code }: { code: string }) {
  const toMultiplayer = useToMultiplayer()
  const created = useProfile((s) => s.created)
  return (
    <PageShell leading="back" backLabel="Multiplayer" onBack={toMultiplayer}>
      <div className="grid flex-1 grid-cols-1 items-center gap-10 py-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-14">
        <div className="max-w-xl">
          <span
            style={riseDelay(0)}
            className="rise-in inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Spade className="size-3.5 fill-current text-pip" />
            Room {code} has closed
          </span>
          <h1
            style={riseDelay(1)}
            className="rise-in mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-5xl"
          >
            That game’s over.
            <br />
            The next one’s on Pip.
          </h1>
          <p
            style={riseDelay(2)}
            className="rise-in mt-5 text-lg leading-relaxed text-muted-foreground text-pretty"
          >
            Texas Hold’em against a cast of AI regulars, free in your browser. Press Play and you’re
            dealt in. Your odds sit beside your cards while you learn.
          </p>
          <div style={riseDelay(3)} className="rise-in mt-8">
            <PlayButton size="lg" />
          </div>
          {!created && (
            <p style={riseDelay(4)} className="rise-in mt-4 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/game?account=signin"
                className="font-medium text-foreground underline-offset-2 transition hover:text-pip hover:underline"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
        <HeroTable />
      </div>
    </PageShell>
  )
}

const primaryButton =
  'flex w-full items-center justify-center rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30'
const secondaryButton =
  'rounded-2xl bg-foreground/[0.08] px-6 py-3 font-semibold transition hover:bg-foreground/[0.14]'
const quietButton =
  '-mt-3 flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground transition hover:text-foreground'

function Waiting({ label }: { label: string }) {
  return (
    <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

function NoRoom({ message }: { message: string }) {
  const toMultiplayer = useToMultiplayer()
  return (
    <PageShell leading="back" backLabel="Multiplayer" onBack={toMultiplayer}>
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <p className="text-muted-foreground">{message}</p>
        <Link href="/game/multiplayer" className={secondaryButton}>
          Multiplayer
        </Link>
      </div>
    </PageShell>
  )
}

function Unavailable() {
  return <NoRoom message="Multiplayer isn’t switched on in this version of Pip." />
}
