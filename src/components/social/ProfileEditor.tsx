'use client'

// Your public profile: a handle people can find you by, a bio, and the things
// you choose to show (docs/social.md). Your name and face are the ones you play
// with, edited where they always are. Nothing is shown that you didn't switch on.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/settings/group'
import { ratingOf } from '@/lib/rating'
import { saveMyProfile, type MyProfile } from '@/lib/social/api'
import { cardOf, DEFAULT_SHOWN, SHOWABLE, type ShowKey } from '@/lib/social/card'
import {
  BIO_MAX,
  bioHasLink,
  handleShapeOk,
  normaliseHandle,
  suggestHandle,
  textOk,
} from '@/lib/social/clean'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { useSocial } from '@/store/social'
import { Face, shownTiles } from './parts'

export function ProfileEditor({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted while open, so each opening starts from what is saved. */}
        {open && <Form onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ onDone }: { onDone: () => void }) {
  const me = useSocial((s) => s.me)
  const profile = useProfile()
  const [handle, setHandle] = useState(() => me?.handle ?? suggestHandle(profile.name))
  const [bio, setBio] = useState(me?.bio ?? '')
  const [shown, setShown] = useState<ShowKey[]>(() => me?.shown ?? [...DEFAULT_SHOWN])
  const [searchable, setSearchable] = useState(me?.searchable ?? true)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const h = normaliseHandle(handle)
  const handleProblem = !handleShapeOk(h)
    ? 'A handle is 3 to 20 letters, numbers or underscores.'
    : !textOk(h)
      ? 'Pick a different handle.'
      : null
  const bioProblem =
    bio.length > BIO_MAX
      ? `Your bio can be ${BIO_MAX} characters at most.`
      : !textOk(bio)
        ? 'Your bio has a word Pip won’t show.'
        : bioHasLink(bio)
          ? 'Links can’t go in a bio.'
          : null

  // Every value, so each switch says what it would show.
  const all = SHOWABLE.map((s) => s.key)
  const preview = shownTiles(all, cardOf(profile, all), {
    rating: ratingOf(profile.rating.core),
    decisions: profile.rating.core.decisions,
  })
  const previewOf = (label: string) => preview.find((t) => t.label === label)

  const flip = (key: ShowKey) => {
    sound.play('tap')
    setShown((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  const save = async () => {
    if (handleProblem || bioProblem || saving) return
    setSaving(true)
    setProblem(null)
    const ordered = all.filter((k) => shown.includes(k))
    const r = await saveMyProfile({
      handle: h,
      name: profile.name,
      avatar: profile.avatar,
      ring: profile.avatarRing,
      bio: bio.trim(),
      shown: ordered,
      card: cardOf(profile, ordered),
      searchable,
    })
    setSaving(false)
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    sound.play('call')
    const saved: MyProfile = {
      handle: h,
      name: profile.name,
      avatar: profile.avatar,
      ring: profile.avatarRing,
      bio: bio.trim(),
      shown: ordered,
      searchable,
    }
    useSocial.getState().setMe(saved)
    onDone()
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{me ? 'Your profile' : 'Make your profile'}</DialogTitle>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <Face avatar={profile.avatar} ring={profile.avatarRing} size={56} />
        <div className="min-w-0">
          <p className="truncate font-medium">{profile.name}</p>
          <p className="truncate text-sm text-muted-foreground">@{h || 'handle'}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Handle</span>
        <span className="flex items-center rounded-xl border border-foreground/15 bg-foreground/[0.03] focus-within:border-foreground/40">
          <span className="pl-3 text-muted-foreground">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent px-1 py-2.5 outline-none"
          />
        </span>
        {handle.length > 0 && handleProblem && (
          <span className="text-xs text-destructive">{handleProblem}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
          Bio
          <span
            className={cn(
              'text-xs font-normal tabular-nums text-muted-foreground',
              bio.length > BIO_MAX && 'text-destructive',
            )}
          >
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="resize-none rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2.5 outline-none focus:border-foreground/40"
        />
        {bioProblem && <span className="text-xs text-destructive">{bioProblem}</span>}
      </label>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Show on your profile</h3>
        <ul className="@container divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
          {SHOWABLE.map((s) => {
            const v = previewOf(s.label)
            return (
              <li key={s.key} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 hyphens-auto break-words">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {v ? `${v.value}${v.detail ? ` ${v.detail}` : ''}` : 'Not enough hands yet'}
                  </span>
                </span>
                <Switch
                  label={s.label}
                  checked={shown.includes(s.key)}
                  onChange={() => flip(s.key)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <div className="@container overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 hyphens-auto break-words">
            <span className="block text-sm font-medium">Appear in search</span>
            <span className="block text-xs text-muted-foreground">Friends can always see you.</span>
          </span>
          <Switch
            label="Appear in search"
            checked={searchable}
            onChange={() => {
              sound.play('tap')
              setSearchable((s) => !s)
            }}
          />
        </div>
      </div>

      {problem && <p className="text-sm text-destructive">{problem}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={Boolean(handleProblem || bioProblem) || saving}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary/85 active:scale-[0.98] disabled:opacity-50"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Save
      </button>
    </div>
  )
}
