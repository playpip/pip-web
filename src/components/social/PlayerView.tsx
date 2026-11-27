'use client'

// One player's card (docs/social.md): their table behind them, their face, name,
// handle and bio, one thing to do, and the numbers they chose to show. Used by
// the profile page and by the Friends page's right-hand side on a wide screen.
//
// The picture is the venue that matches their rank, and only when they show
// their rank: a hidden rank gets the multiplayer table, which says nothing.
// Removing, blocking and reporting wait behind "…", as they should.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Check, Flag, Loader2, MoreHorizontal, UserMinus, X } from 'lucide-react'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { VenueArt } from '@/components/menu/VenueArt'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { RANKS } from '@/config/ranks'
import { VENUES } from '@/config/venues'
import {
  answerFriend,
  blockPlayer,
  getPlayer,
  type Player,
  PROFILE_REPORT_REASONS,
  type ProfileReportReason,
  removeFriend,
  reportPlayer,
  requestFriend,
} from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useSocial } from '@/store/social'
import { BadgeChips, challengeHref, Face, RowButton, shownTiles } from './parts'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { GameList, gamesHref } from '@/components/games/GameList'

/** Each rank's table, climbing the ladder as the ranks do. */
const RANK_VENUE: Record<string, string> = {
  [RANKS[0].name]: 'garage',
  [RANKS[1].name]: 'pub',
  [RANKS[2].name]: 'cardroom',
  [RANKS[3].name]: 'casino',
  [RANKS[4].name]: 'montecarlo',
}

function Backdrop({ rank }: { rank: string | undefined }) {
  const venue = rank ? VENUES.find((v) => v.id === RANK_VENUE[rank]) : undefined
  return (
    <div className="relative h-36 overflow-hidden sm:h-44">
      {venue ? (
        <VenueArt id={venue.id} accent={venue.accent} className="absolute inset-0 size-full" />
      ) : (
        <CategoryArt id="multiplayer" accent="#F0B44C" className="absolute inset-0 size-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-card" />
    </div>
  )
}

/** Loads and shows one player. `onGone` runs after a block, when there is nothing left to show. */
export function PlayerView({ handle, onGone }: { handle: string; onGone?: () => void }) {
  const me = useSocial((s) => s.me)
  // Undefined: loading. Null: nobody to show.
  const [player, setPlayer] = useState<Player | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    void getPlayer(handle).then((r) => {
      setFailed(!r.ok)
      if (r.ok) setPlayer(r.value)
    })
  }, [handle])

  useEffect(() => {
    const first = setTimeout(load, 0)
    return () => clearTimeout(first)
  }, [load])

  if (player === null) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">That player isn’t here.</p>
    )
  }
  if (failed && !player) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Couldn’t reach Pip. Try again later.
      </p>
    )
  }
  if (!player) {
    return <div className="h-[28rem] animate-pulse rounded-[2rem] bg-foreground/[0.04]" aria-busy />
  }
  return <Card player={player} reload={load} needsProfile={me === null} onGone={onGone} />
}

function Card({
  player,
  reload,
  needsProfile,
  onGone,
}: {
  player: Player
  reload: () => void
  needsProfile: boolean
  onGone?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [more, setMore] = useState(false)
  const [safety, setSafety] = useState<'block' | 'report' | null>(null)
  const self = player.relation === 'self'
  const tiles = shownTiles(player.shown, player.card, player.rating)

  const act = async (run: () => Promise<{ ok: boolean; problem?: string }>, cue: 'tap' | 'win') => {
    sound.play(cue)
    setBusy(true)
    setProblem(null)
    const r = await run()
    setBusy(false)
    if (!r.ok) setProblem(r.problem ?? null)
    reload()
  }

  const primary = (() => {
    if (self) {
      return { label: 'Edit profile', run: () => setEditing(true), quiet: true }
    }
    if (needsProfile) {
      return { label: 'Make your profile to add friends', run: () => setEditing(true) }
    }
    switch (player.relation) {
      case 'friends':
        return { label: 'Challenge', run: () => router.push(challengeHref(player.handle)) }
      case 'received':
        return {
          label: 'Accept friend request',
          run: () => void act(() => answerFriend(player.handle, true), 'win'),
        }
      case 'sent':
        return { label: 'Requested', run: null }
      default:
        return {
          label: 'Add friend',
          run: () => void act(() => requestFriend(player.handle), 'tap'),
        }
    }
  })()

  return (
    <article className="overflow-hidden rounded-[2rem] border border-foreground/10 bg-card shadow-2xl shadow-black/40">
      <Backdrop rank={player.shown.includes('rank') ? player.card.rank : undefined} />

      <div className="relative -mt-16 flex flex-col items-center gap-3 px-6 pb-6 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="rounded-full ring-4 ring-card"
        >
          <Face avatar={player.avatar} ring={player.ring} size={112} />
        </motion.div>
        <div className="min-w-0 max-w-full">
          <h1 className="break-words text-3xl font-semibold tracking-tight">{player.name}</h1>
          {player.badges.length > 0 && (
            <span className="mt-2 block">
              <BadgeChips badges={player.badges} />
            </span>
          )}
          <p className="mt-0.5 break-all text-sm text-muted-foreground">
            @{player.handle}
            {player.relation === 'friends' && player.friendsSince && (
              <>
                {' · Friends since '}
                {new Date(player.friendsSince).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                })}
              </>
            )}
          </p>
        </div>
        {player.bio && (
          <p className="max-w-md whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-foreground/85">
            {player.bio}
          </p>
        )}

        <div className="mt-2 flex w-full max-w-sm items-center gap-2">
          <motion.button
            type="button"
            whileTap={primary.run ? { scale: 0.97 } : undefined}
            disabled={busy || !primary.run}
            onClick={() => {
              if (!primary.run) return
              sound.play('tap')
              primary.run()
            }}
            className={cn(
              'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition disabled:opacity-60',
              primary.quiet || !primary.run
                ? 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.12]'
                : 'bg-primary text-primary-foreground shadow-lg shadow-black/30 hover:bg-primary/90',
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : player.relation === 'sent' ? (
              <Check className="size-4" />
            ) : null}
            {primary.label}
          </motion.button>
          {!self && (
            <button
              type="button"
              aria-label="More"
              onClick={() => {
                sound.play('tap')
                setMore(true)
              }}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.08] text-foreground transition hover:bg-foreground/[0.12] active:scale-95"
            >
              <MoreHorizontal className="size-5" />
            </button>
          )}
        </div>
        <AnimatePresence>
          {problem && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-destructive"
            >
              {problem}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {tiles.length > 0 ? (
        // Cells grow to fill each row, so a short last row has no empty gaps; the
        // hairlines are each cell's own top and left edges.
        <dl className="-ml-px flex flex-wrap overflow-hidden border-t border-foreground/[0.08]">
          {tiles.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.04, duration: 0.3 }}
              className="-mt-px flex flex-1 basis-[8.5rem] flex-col items-center justify-center border-t border-l border-foreground/[0.08] px-3 py-5 text-center"
            >
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">{t.value}</dd>
              <dt className="mt-1 text-xs text-muted-foreground">
                {t.label}
                {t.detail && <span className="text-muted-foreground/70"> · {t.detail}</span>}
              </dt>
            </motion.div>
          ))}
        </dl>
      ) : (
        <p className="border-t border-foreground/[0.08] px-6 py-5 text-center text-sm text-muted-foreground">
          {self ? 'You’re not showing anything yet.' : 'Nothing shown.'}
        </p>
      )}

      {(self || player.shown.includes('games')) && (
        <section className="flex flex-col gap-3 border-t border-foreground/[0.08] px-4 py-5 sm:px-6">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-base font-semibold tracking-tight">Games</h2>
            <Link
              href={gamesHref(player.handle)}
              onClick={() => sound.play('tap')}
              className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              All games
            </Link>
          </div>
          <GameList handle={player.handle} limit={5} empty="No games yet." />
        </section>
      )}

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent title={player.name} onClose={() => setMore(false)}>
          <div className="flex flex-col gap-1 px-3 pb-4">
            {player.relation === 'friends' && (
              <SheetRow
                icon={UserMinus}
                label="Remove friend"
                onClick={() => {
                  setMore(false)
                  void act(() => removeFriend(player.handle), 'tap')
                }}
              />
            )}
            {player.relation === 'sent' && (
              <SheetRow
                icon={X}
                label="Cancel request"
                onClick={() => {
                  setMore(false)
                  void act(() => removeFriend(player.handle), 'tap')
                }}
              />
            )}
            {player.relation === 'received' && (
              <SheetRow
                icon={X}
                label="Decline request"
                onClick={() => {
                  setMore(false)
                  void act(() => answerFriend(player.handle, false), 'tap')
                }}
              />
            )}
            <SheetRow
              icon={Ban}
              label="Block"
              danger
              onClick={() => {
                setMore(false)
                setSafety('block')
              }}
            />
            <SheetRow
              icon={Flag}
              label="Report"
              danger
              onClick={() => {
                setMore(false)
                setSafety('report')
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <SafetyDialog
        player={player}
        step={safety}
        onClose={() => setSafety(null)}
        onBlocked={() => (onGone ? onGone() : router.push('/game/friends'))}
      />
      <ProfileDialog
        open={editing}
        onOpenChange={(o) => {
          setEditing(o)
          if (!o) reload()
        }}
      />
    </article>
  )
}

function SheetRow({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Ban
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sound.play('tap')
        onClick()
      }}
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left font-medium transition hover:bg-foreground/[0.06]',
        danger && 'text-destructive',
      )}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </button>
  )
}

function SafetyDialog({
  player,
  step,
  onClose,
  onBlocked,
}: {
  player: Player
  step: 'block' | 'report' | null
  onClose: () => void
  onBlocked: () => void
}) {
  return (
    <Dialog open={step !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {step === 'block' && <BlockBody player={player} onClose={onClose} onBlocked={onBlocked} />}
        {step === 'report' && <ReportBody key={player.handle} player={player} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function BlockBody({
  player,
  onClose,
  onBlocked,
}: {
  player: Player
  onClose: () => void
  onBlocked: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const block = async () => {
    sound.play('tap')
    setBusy(true)
    const r = await blockPlayer(player.handle)
    setBusy(false)
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    onClose()
    onBlocked()
  }
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Block {player.name}?</DialogTitle>
      </DialogHeader>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>You won’t be friends.</li>
        <li>Neither of you can find or see the other’s profile.</li>
        <li>No camera or voice between you, and they can’t join rooms you host.</li>
      </ul>
      <p className="text-sm text-muted-foreground">They aren’t told. You can unblock in Friends.</p>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <RowButton onClick={onClose}>Cancel</RowButton>
        <button
          type="button"
          disabled={busy}
          onClick={() => void block()}
          className="flex min-h-9 items-center gap-2 rounded-xl bg-destructive/15 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/25 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Block
        </button>
      </div>
    </div>
  )
}

function ReportBody({ player, onClose }: { player: Player; onClose: () => void }) {
  const [reason, setReason] = useState<ProfileReportReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const send = async () => {
    if (!reason) return
    sound.play('tap')
    setBusy(true)
    const r = await reportPlayer(player.handle, reason, note)
    setBusy(false)
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Thanks for telling us</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          We’ll look at it. You can also block {player.name}.
        </p>
        <div className="flex justify-end">
          <RowButton primary onClick={onClose}>
            Done
          </RowButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Report {player.name}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {PROFILE_REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={reason === r.id}
            onClick={() => {
              sound.play('tap')
              setReason(r.id)
            }}
            className={cn(
              'min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition',
              reason === r.id
                ? 'border-primary bg-primary/15'
                : 'border-foreground/15 hover:bg-foreground/[0.05]',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Anything we should know (optional)"
        aria-label="Anything we should know"
        className="resize-none rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
      />
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <RowButton onClick={onClose}>Cancel</RowButton>
        <RowButton primary disabled={!reason || busy} onClick={() => void send()}>
          Send report
        </RowButton>
      </div>
    </div>
  )
}
