'use client'

// The account's footprint inside Settings: who you are, where your progress
// lives, and what you can do with it. Signed in, that is all here as rows
// (AccountRows); signed out, the sign-in forms open in AccountDialog.
//
// Signed out is a first-class state, permanently. There is no banner, no
// interstitial and no "sync your progress!" anywhere in the app, and if the
// build has no Supabase project configured the account rows render nothing.
//
// The account now has a second footprint, at the foot of the Edit player dialog
// (profile/AccountRow). That is still not a prompt: both are doors sitting in
// places the player already chose to open. The rule above is unchanged, and
// "no nagging. Ever." is on the landing page in public — so nothing here may
// grow into something that appears uninvited or comes back after a dismissal.

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AccountDialog, type AccountMode } from '@/components/settings/AccountDialog'
import { PasswordRow, SignOutRow, SyncRow } from '@/components/settings/AccountRows'
import { SettingsGroup } from '@/components/settings/group'
import { TransferRow } from '@/components/settings/sections'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { avatarRingById } from '@/config/cosmetics'
import { rankFor } from '@/config/ranks'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useInApp } from '@/lib/useInApp'

const secondaryButton =
  'min-h-11 min-w-[8rem] flex-1 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12] active:scale-[0.98]'
const primaryButton =
  'min-h-11 min-w-[8rem] flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]'

const rowButton =
  'w-full text-left transition hover:bg-foreground/[0.04] active:bg-foreground/[0.06]'

/**
 * The player, the account and the by-hand transfer, as one group.
 *
 * Create outranks Sign in because on a product this young the new players
 * outnumber the returning ones, and two identical grey buttons told a first
 * visitor nothing about which door was theirs.
 */
export function AccountGroup() {
  const status = useSync((s) => s.status)
  const email = useSync((s) => s.email)
  const dirty = useSync((s) => s.dirty)
  const error = useSync((s) => s.error)
  const { name, avatar, peakRoll, avatarRing } = useProfile()
  const hydrated = useHydrated()
  const [dialog, setDialog] = useState<AccountMode | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const where = useInApp() ? 'this app' : 'this browser'

  const signedIn = status === 'signed-in'
  const open = (mode: AccountMode) => {
    sound.play('tap')
    setDialog(mode)
  }

  return (
    <SettingsGroup label="Account">
      {/* You, as the lobby shows you. Tap to edit, as the lobby does. */}
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setProfileOpen(true)
        }}
        className={rowButton}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          {hydrated && avatar && (
            <PlayerAvatar spec={avatar} size={52} ring={avatarRingById(avatarRing)} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{hydrated ? name : ''}</p>
            <p className="truncate text-xs text-muted-foreground">
              {!hydrated
                ? ''
                : signedIn
                  ? `${email}${dirty ? ' · saving' : ''}`
                  : rankFor(peakRoll).name}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </button>

      {status !== 'off' &&
        (signedIn ? (
          <>
            <SyncRow />
            <PasswordRow />
            <SignOutRow />
          </>
        ) : (
          <div className="px-4 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your profile lives in {where}. An account keeps a copy and puts it on your other
              devices. It is never needed to play.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => open('signup')} className={primaryButton}>
                Create an account
              </button>
              <button type="button" onClick={() => open('signin')} className={secondaryButton}>
                Sign in
              </button>
            </div>
          </div>
        ))}

      <TransferRow />

      {/* The password form shows its own errors, so this is sync's and sign-out's. */}
      {signedIn && error && (
        <p className="px-4 py-3 text-xs leading-relaxed text-suit-red">{error}</p>
      )}

      <AccountDialog
        open={dialog !== null}
        mode={dialog ?? 'signin'}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </SettingsGroup>
  )
}
