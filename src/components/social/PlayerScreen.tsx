'use client'

// `/game/player?h=handle`: one player's public profile (docs/social.md). Their
// face, name, handle and bio, and only what they chose to show. From here:
// add them, challenge them, block them or report them.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Ban, Flag, Loader2 } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  socialEnabled,
} from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'
import { ChallengeDialog } from './ChallengeDialog'
import { Face, RowButton, shownTiles, Tiles } from './parts'
import { ProfileEditor } from './ProfileEditor'

export function PlayerScreen() {
  const router = useRouter()
  const handle = useSearchParams().get('h') ?? ''
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in')
  const ready = useSync((s) => s.ready)
  const me = useSocial((s) => s.me)
  // Undefined: loading. Null: nobody to show.
  const [player, setPlayer] = useState<Player | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [challenging, setChallenging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<'block' | 'report' | null>(null)

  const load = useCallback(() => {
    if (!handle) return
    void getPlayer(handle).then((r) => {
      setFailed(!r.ok)
      if (r.ok) setPlayer(r.value)
    })
  }, [handle])

  const live = socialEnabled() && hydrated && ready && signedIn
  useEffect(() => {
    if (!live) return
    const first = setTimeout(load, 0)
    return () => clearTimeout(first)
  }, [live, load])

  const act = async (run: () => Promise<{ ok: boolean; problem?: string }>) => {
    sound.play('tap')
    setBusy(true)
    setProblem(null)
    const r = await run()
    setBusy(false)
    if (!r.ok) setProblem(r.problem ?? null)
    load()
  }

  const body = () => {
    if (!socialEnabled()) {
      return <p className="text-sm text-muted-foreground">Profiles aren’t open yet.</p>
    }
    if (hydrated && ready && !signedIn) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-sm">Make an account to see players’ profiles.</p>
          <Link
            href="/game?account=new"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            Make an account
          </Link>
        </div>
      )
    }
    if (!handle || player === null) {
      return <p className="text-sm text-muted-foreground">That player isn’t here.</p>
    }
    if (failed && !player) {
      return <p className="text-sm text-muted-foreground">Couldn’t reach Pip. Try again later.</p>
    }
    if (!player) {
      return <div className="h-64 animate-pulse rounded-3xl bg-foreground/[0.04]" aria-busy />
    }

    const tiles = shownTiles(player.shown, player.card, player.rating)
    const self = player.relation === 'self'
    // Adding somebody takes a profile of your own, so they can see who asked.
    const needsProfile = !self && me === null

    return (
      <>
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.03] px-5 py-7 text-center">
          <Face avatar={player.avatar} ring={player.ring} size={104} />
          <div className="min-w-0 max-w-full">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{player.name}</h1>
            <p className="break-all text-sm text-muted-foreground">@{player.handle}</p>
          </div>
          {player.bio && (
            <p className="max-w-md whitespace-pre-line break-words text-sm">{player.bio}</p>
          )}
          {player.relation === 'friends' && player.friendsSince && (
            <p className="text-xs text-muted-foreground">
              Friends since{' '}
              {new Date(player.friendsSince).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {self ? (
              <RowButton
                onClick={() => {
                  sound.play('tap')
                  setEditing(true)
                }}
              >
                Edit profile
              </RowButton>
            ) : needsProfile ? (
              <RowButton
                primary
                onClick={() => {
                  sound.play('tap')
                  setEditing(true)
                }}
              >
                Make your profile to add friends
              </RowButton>
            ) : player.relation === 'friends' ? (
              <>
                <RowButton
                  primary
                  onClick={() => {
                    sound.play('tap')
                    setChallenging(true)
                  }}
                >
                  Challenge
                </RowButton>
                <RowButton
                  disabled={busy}
                  onClick={() => void act(() => removeFriend(player.handle))}
                >
                  Remove friend
                </RowButton>
              </>
            ) : player.relation === 'sent' ? (
              <RowButton
                disabled={busy}
                onClick={() => void act(() => removeFriend(player.handle))}
              >
                Cancel request
              </RowButton>
            ) : player.relation === 'received' ? (
              <>
                <RowButton
                  primary
                  disabled={busy}
                  onClick={() => void act(() => answerFriend(player.handle, true))}
                >
                  Accept
                </RowButton>
                <RowButton
                  disabled={busy}
                  onClick={() => void act(() => answerFriend(player.handle, false))}
                >
                  Decline
                </RowButton>
              </>
            ) : (
              <RowButton
                primary
                disabled={busy}
                onClick={() => void act(() => requestFriend(player.handle))}
              >
                Add friend
              </RowButton>
            )}
          </div>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </section>

        {tiles.length > 0 ? (
          <Tiles tiles={tiles} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {self ? 'You’re not showing anything yet.' : 'Nothing shown.'}
          </p>
        )}

        {!self && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.play('tap')
                setSheet('block')
              }}
              className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <Ban className="size-4" /> Block
            </button>
            <button
              type="button"
              onClick={() => {
                sound.play('tap')
                setSheet('report')
              }}
              className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <Flag className="size-4" /> Report
            </button>
          </div>
        )}

        <ChallengeDialog
          friend={challenging ? player : null}
          onClose={() => setChallenging(false)}
        />
        <SafetyDialog
          player={player}
          step={sheet}
          onClose={() => setSheet(null)}
          onBlocked={() => router.push('/game/friends')}
        />
      </>
    )
  }

  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.back()}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">{body()}</div>
      <ProfileEditor
        open={editing}
        onOpenChange={(o) => {
          setEditing(o)
          // Saved or not, read the page again: a new profile changes the buttons.
          if (!o) load()
        }}
      />
    </PageShell>
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
