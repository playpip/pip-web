'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AvatarEditor } from './AvatarEditor'
import { ChipsDialog } from './ChipsDialog'
import { AWARDS } from '@/lib/awards'
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
  const { name: savedName, avatar: savedAvatar, awards, setName, setAvatar } = useProfile()

  const [spec, setSpec] = useState<AvatarSpec>(
    () => savedAvatar ?? { seed: freshSeed(), backgroundColor: AVATAR_BG_SWATCHES[1] },
  )
  const [name, setLocalName] = useState(savedName)
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
    <div className="pt-2">
      <AvatarEditor
        spec={spec}
        name={name}
        onSpecChange={setSpec}
        onNameChange={setLocalName}
        onSubmit={save}
        avatarSize={112}
      />
      <button
        onClick={() => {
          sound.play('tap')
          setChipsOpen(true)
        }}
        className="mt-5 w-full rounded-2xl bg-foreground/[0.06] py-3 font-medium transition hover:bg-foreground/[0.12]"
      >
        Chips · {earnedCount} of {AWARDS.length}
      </button>
      <button
        onClick={save}
        disabled={!name.trim()}
        className="mt-3 w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30"
      >
        Save
      </button>
      <ChipsDialog open={chipsOpen} onOpenChange={setChipsOpen} />
    </div>
  )
}
