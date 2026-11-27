'use client'

// The public half of Your profile (docs/social.md): a handle people can find
// you by, a bio, what your profile shows, and whether you appear in search.
// It lives inside the Your profile sheet (profile/ProfileDialog), under your
// face and name, and saves with them.
//
// A player without a public profile sees one line offering to make one; nothing
// is published until they open it and save.

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Switch } from '@/components/settings/group'
import type { AvatarSpec } from '@/lib/avatar'
import { ratingOf } from '@/lib/rating'
import { type MyProfile, saveMyProfile, setMemberBadge } from '@/lib/social/api'
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
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useSocial } from '@/store/social'
import { shownTiles } from './parts'

const ALL = SHOWABLE.map((s) => s.key)

/** The form's state, and its save. `included` is false until a new player opens it. */
export function usePublicDraft(name: string) {
  const me = useSocial((s) => s.me)
  const [included, setIncluded] = useState(() => Boolean(me))
  const [handle, setHandle] = useState(() => me?.handle ?? suggestHandle(name))
  const [bio, setBio] = useState(me?.bio ?? '')
  const [shown, setShown] = useState<ShowKey[]>(() => me?.shown ?? [...DEFAULT_SHOWN])
  const [searchable, setSearchable] = useState(me?.searchable ?? true)
  const [showMember, setShowMember] = useState(me?.showMember ?? true)

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

  /** Publish, with the name and face being saved alongside. Resolves to a problem, or null. */
  const save = async (face: {
    name: string
    avatar: AvatarSpec
    ring: string | null
  }): Promise<string | null> => {
    if (!included) return null
    if (handleProblem || bioProblem) return handleProblem ?? bioProblem
    const ordered = ALL.filter((k) => shown.includes(k))
    const r = await saveMyProfile({
      handle: h,
      name: face.name,
      avatar: face.avatar,
      ring: face.ring,
      bio: bio.trim(),
      shown: ordered,
      card: cardOf(useProfile.getState(), ordered),
      searchable,
    })
    if (!r.ok) return r.problem
    if (me && showMember !== me.showMember) await setMemberBadge(showMember)
    const saved: MyProfile = {
      handle: h,
      name: face.name,
      avatar: face.avatar,
      ring: face.ring,
      bio: bio.trim(),
      shown: ordered,
      searchable,
      showMember,
      badges: (me?.badges ?? []).filter((b) => b !== 'member' || showMember),
    }
    useSocial.getState().setMe(saved)
    return null
  }

  return {
    me,
    included,
    setIncluded,
    handle,
    setHandle,
    h,
    bio,
    setBio,
    shown,
    setShown,
    searchable,
    setSearchable,
    showMember,
    setShowMember,
    handleProblem,
    bioProblem,
    blocked: included && Boolean(handleProblem || bioProblem),
    save,
  }
}

export type PublicDraft = ReturnType<typeof usePublicDraft>

export function PublicFields({ draft }: { draft: PublicDraft }) {
  const profile = useProfile()
  const member = useEntitlement()

  if (!draft.included) {
    return (
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          draft.setIncluded(true)
        }}
        className="flex w-full items-center gap-3 rounded-2xl bg-foreground/[0.06] px-4 py-3 text-left transition hover:bg-foreground/[0.1]"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Choose a handle</span>
          <span className="block text-xs text-muted-foreground">So friends can find you.</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    )
  }

  // Every value, so each switch says what it would show.
  const preview = shownTiles(ALL, cardOf(profile, ALL), {
    rating: ratingOf(profile.rating.core),
    decisions: profile.rating.core.decisions,
  })
  const previewOf = (label: string) => preview.find((t) => t.label === label)
  const flip = (key: ShowKey) => {
    sound.play('tap')
    draft.setShown((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Handle</span>
        <span className="flex items-center rounded-xl border border-foreground/15 bg-foreground/[0.03] focus-within:border-foreground/40">
          <span className="pl-3 text-muted-foreground">@</span>
          <input
            value={draft.handle}
            onChange={(e) => draft.setHandle(e.target.value)}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent px-1 py-2.5 outline-none"
          />
        </span>
        {draft.handle.length > 0 && draft.handleProblem && (
          <span className="text-xs text-destructive">{draft.handleProblem}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
          Bio
          <span
            className={cn(
              'text-xs font-normal tabular-nums text-muted-foreground',
              draft.bio.length > BIO_MAX && 'text-destructive',
            )}
          >
            {draft.bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          value={draft.bio}
          onChange={(e) => draft.setBio(e.target.value)}
          rows={2}
          className="resize-none rounded-xl border border-foreground/15 bg-foreground/[0.03] px-3 py-2.5 outline-none focus:border-foreground/40"
        />
        {draft.bioProblem && <span className="text-xs text-destructive">{draft.bioProblem}</span>}
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
                    {s.key === 'games'
                      ? 'Every game you play, to replay'
                      : v
                        ? `${v.value}${v.detail ? ` ${v.detail}` : ''}`
                        : 'Not enough hands yet'}
                  </span>
                </span>
                <Switch
                  label={s.label}
                  checked={draft.shown.includes(s.key)}
                  onChange={() => flip(s.key)}
                />
              </li>
            )
          })}
          <li className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 hyphens-auto break-words">
              <span className="block text-sm font-medium">Appear in search</span>
              <span className="block text-xs text-muted-foreground">
                Friends can always see you.
              </span>
            </span>
            <Switch
              label="Appear in search"
              checked={draft.searchable}
              onChange={() => {
                sound.play('tap')
                draft.setSearchable((s) => !s)
              }}
            />
          </li>
          {member && (
            <li className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 hyphens-auto break-words">
                <span className="block text-sm font-medium">Member badge</span>
              </span>
              <Switch
                label="Member badge"
                checked={draft.showMember}
                onChange={() => {
                  sound.play('tap')
                  draft.setShowMember((s) => !s)
                }}
              />
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
