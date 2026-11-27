'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PublicFields, usePublicDraft } from '@/components/social/PublicFields'
import { socialEnabled } from '@/lib/social/api'
import { useSync } from '@/store/sync'
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the form seeds from the store each time. */}
        {open && <ProfileForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const {
    name: savedName,
    avatar: savedAvatar,
    avatarRing,
    awards,
    setName,
    setAvatar,
  } = useProfile()
  // Your handle, bio and what you show, for a signed-in player once friends
  // are switched on (docs/social.md). Saved with the name and face.
  const social = useSync((s) => s.status === 'signed-in') && socialEnabled()
  const draft = usePublicDraft(savedName)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const [spec, setSpec] = useState<AvatarSpec>(
    () => savedAvatar ?? { seed: freshSeed(), backgroundColor: AVATAR_BG_SWATCHES[1] },
  )
  // The placeholder a first visit is given (lib/newPlayer) starts the field
  // empty, so choosing a name is typing one rather than deleting ours first.
  const [name, setLocalName] = useState(() => (hasPlaceholderName(savedName) ? '' : savedName))
  const [chipsOpen, setChipsOpen] = useState(false)
  const earnedCount = AWARDS.filter((a) => awards[a.id] !== undefined).length

  const save = async () => {
    if (!name.trim() || saving || (social && draft.blocked)) return
    setProblem(null)
    if (social && draft.included) {
      setSaving(true)
      const failed = await draft.save({ name: name.trim(), avatar: spec, ring: avatarRing })
      setSaving(false)
      if (failed) {
        setProblem(failed)
        return
      }
    }
    setName(name)
    setAvatar(spec)
    sound.play('call')
    onDone()
  }

  return (
    // The blocks (editor, public profile, Chips, Save, account) have to fit a phone in
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
        onSubmit={() => void save()}
        avatarSize={88}
        compact
        customise
      />
      {social && (
        <div className="mt-5">
          <PublicFields draft={draft} />
        </div>
      )}
      {/* With a profile page your chips are on it, beside your games; this
          is the editor. Without one, this is still where they live. */}
      {!social && (
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            setChipsOpen(true)
          }}
          className="mt-4 w-full rounded-2xl bg-foreground/[0.06] py-3 font-medium transition hover:bg-foreground/[0.12]"
        >
          Chips · {earnedCount}/{AWARDS.length}
        </button>
      )}
      {problem && <p className="mt-3 text-sm text-destructive">{problem}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!name.trim() || saving || (social && draft.blocked)}
        className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <AccountRow name={name} />
      <ChipsDialog open={chipsOpen} onOpenChange={setChipsOpen} />
    </div>
  )
}
