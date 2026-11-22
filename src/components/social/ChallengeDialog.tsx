'use client'

// Challenge a friend: a heads-up room opened for the two of you, and a push
// and an inbox note to them (docs/social.md). It is an ordinary private room or
// slow game, so it counts like any other you host: free accounts get the one a
// week (or the one slow game at a time) and the server says so when it's used.
// Accepting costs nothing.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ROOM_ERRORS } from '@/components/room/MultiplayerHub'
import { settingsForPace } from '@/components/room/RoomSettings'
import { VENUES } from '@/config/venues'
import { createRoom } from '@/lib/multiplayer/client'
import { DEFAULT_SETTINGS, type RoomSettings } from '@/lib/multiplayer/room'
import { inviteFriends, type PlayerRow } from '@/lib/social/api'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { useRoom } from '@/store/room'
import { Face } from './parts'

export function ChallengeDialog({
  friend,
  onClose,
}: {
  /** Null: closed. */
  friend: PlayerRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={friend !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {friend && <Form key={friend.handle} friend={friend} />}
      </DialogContent>
    </Dialog>
  )
}

function Choice({
  on,
  onClick,
  children,
  disabled = false,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => {
        sound.play('tap')
        onClick()
      }}
      className={cn(
        'min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition active:scale-[0.98] disabled:opacity-40',
        on ? 'border-primary bg-primary/15' : 'border-foreground/15 hover:bg-foreground/[0.05]',
      )}
    >
      {children}
    </button>
  )
}

function Form({ friend }: { friend: PlayerRow }) {
  const router = useRouter()
  const spendable = useSpendableRoll()
  const [slow, setSlow] = useState(false)
  const [forRoll, setForRoll] = useState(true)
  const affordable = VENUES.filter((v) => v.buyIn <= spendable)
  const [stakeId, setStakeId] = useState(() => (affordable[0] ?? VENUES[0]).id)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const stake = VENUES.find((v) => v.id === stakeId) ?? VENUES[0]
  const canPay = !forRoll || stake.buyIn <= spendable
  // The first few stakes are plenty for a challenge; the list stays short on a phone.
  const stakes = VENUES.filter((v) => !v.membersOnly).slice(0, 6)

  const go = async () => {
    if (sending || !canPay) return
    sound.play('call')
    setSending(true)
    setProblem(null)
    const { name, avatar, avatarRing } = useProfile.getState()
    const settings: RoomSettings = settingsForPace(
      { ...DEFAULT_SETTINGS, forRoll, seats: 2 },
      slow ? 'slow' : 'live',
    )
    const room = await createRoom(
      stake.id,
      {
        name,
        avatar: avatar ?? { seed: name || 'pip', backgroundColor: 'b6e3f4' },
        ring: avatarRing,
      },
      { ...settings, seats: 2 },
      slow ? 'slow' : 'private',
    )
    if ('error' in room) {
      setSending(false)
      setProblem(ROOM_ERRORS[room.error] ?? ROOM_ERRORS.busy)
      return
    }
    // The room is open either way; if the word doesn't reach them, the
    // lobby's invite link still does.
    await inviteFriends([friend.handle], 'challenge', room.code, slow)
    useRoom.getState().enter(room.code)
    router.push(`/game/room?code=${room.code}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Challenge</DialogTitle>
      </DialogHeader>
      <div className="flex items-center gap-3">
        <Face avatar={friend.avatar} ring={friend.ring} size={48} />
        <div className="min-w-0">
          <p className="truncate font-medium">{friend.name}</p>
          <p className="truncate text-sm text-muted-foreground">Heads-up, just the two of you</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Pace</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
          <Choice on={!slow} onClick={() => setSlow(false)}>
            Live
          </Choice>
          <Choice on={slow} onClick={() => setSlow(true)}>
            Slow
          </Choice>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Play for</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
          <Choice on={forRoll} onClick={() => setForRoll(true)}>
            Chips from your Roll
          </Choice>
          <Choice on={!forRoll} onClick={() => setForRoll(false)}>
            Fun
          </Choice>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Stake</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
          {stakes.map((v) => (
            <Choice
              key={v.id}
              on={v.id === stakeId}
              disabled={forRoll && v.buyIn > spendable}
              onClick={() => setStakeId(v.id)}
            >
              <span className="block">{v.name}</span>
              <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                {formatChips(v.buyIn)} chips
              </span>
            </Choice>
          ))}
        </div>
      </section>

      {problem && <p className="text-sm text-destructive">{problem}</p>}

      <button
        type="button"
        onClick={() => void go()}
        disabled={sending || !canPay}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary/85 active:scale-[0.98] disabled:opacity-50"
      >
        {sending && <Loader2 className="size-4 animate-spin" />}
        Challenge {friend.name}
      </button>
    </div>
  )
}
