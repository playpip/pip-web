'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AccountRow } from './AccountRow'
import { AvatarEditor } from './AvatarEditor'
import { ChipsDialog } from './ChipsDialog'
import { AWARDS } from '@/lib/awards'
import { hasPlaceholderName } from '@/lib/newPlayer'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit player</DialogTitle>
          <DialogDescription>Update your avatar and name.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form seeds from the store each time. */}
        {open && <ProfileForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const { name: savedName, avatar: savedAvatar, awards, setName, setAvatar } = useProfile()

  const [spec, setSpec] = useState<AvatarSpec>(
    () => savedAvatar ?? { seed: freshSeed(), backgroundColor: AVATAR_BG_SWATCHES[1] },
  )
  // The placeholder a first visit is given (lib/newPlayer) starts the field
  // empty, so choosing a name is typing one rather than deleting ours first.
  const [name, setLocalName] = useState(() => (hasPlaceholderName(savedName) ? '' : savedName))
  const [chipsOpen, setChipsOpen] = useState(false)
  const earnedCount = AWARDS.filter((a) => awards[a.id] !== undefined).length

  const save = () => {
    if (!name.trim()) return
    setName(name)
    setAvatar(spec)
    sound.play('call')
    onDone()
  }

  return (
    // Four blocks (editor, Chips/Stats, Save, account) have to fit a phone in
    // portrait, and they didn't: the bottom of the account row was falling off
    // the screen. Everything below is the same content spaced tighter, and the
    // scroll is the backstop, not the fix. The height it scrolls within is the
    // dialog's own cap now (see ui/dialog.tsx) rather than a hand-guessed
    // `100dvh - 9rem`, which was a guess about the header's height and stopped
    // being true the moment the text size setting could double it.
    <div className="-mx-1 min-h-0 overflow-y-auto px-1 pt-1">
      <AvatarEditor
        spec={spec}
        name={name}
        onSpecChange={setSpec}
        onNameChange={setLocalName}
        onSubmit={save}
        avatarSize={88}
        compact
      />
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            sound.play('tap')
            setChipsOpen(true)
          }}
          className="flex-1 rounded-2xl bg-foreground/[0.06] py-3 font-medium transition hover:bg-foreground/[0.12]"
        >
          Chips · {earnedCount}/{AWARDS.length}
        </button>
        <button
          onClick={() => {
            sound.play('tap')
            router.push('/stats')
          }}
          className="flex-1 rounded-2xl bg-foreground/[0.06] py-3 font-medium transition hover:bg-foreground/[0.12]"
        >
          Stats
        </button>
      </div>
      <button
        onClick={save}
        disabled={!name.trim()}
        className="mt-2.5 w-full rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30"
      >
        Save
      </button>
      <AccountRow name={name} />
      <ChipsDialog open={chipsOpen} onOpenChange={setChipsOpen} />
    </div>
  )
}
