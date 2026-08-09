'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AvatarEditor } from '@/components/profile/AvatarEditor'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { sound } from '@/lib/sound'

export function Onboarding({ onCreated }: { onCreated?: () => void }) {
  const createProfile = useProfile((s) => s.createProfile)
  const [spec, setSpec] = useState<AvatarSpec>(() => ({
    seed: freshSeed(),
    backgroundColor: AVATAR_BG_SWATCHES[1],
  }))
  const [name, setName] = useState('')
  const [signInOpen, setSignInOpen] = useState(false)
  // Sync unconfigured means there are no accounts in this build to return to.
  const hasAccounts = useSync((s) => s.status !== 'off')

  const enter = () => {
    if (!name.trim()) return
    sound.play('call')
    createProfile(name, spec)
    onCreated?.()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold lowercase tracking-tight">pip</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Casual poker, redesigned. Make your player.
          </p>
        </div>

        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-8">
          <AvatarEditor
            spec={spec}
            name={name}
            onSpecChange={setSpec}
            onNameChange={setName}
            onSubmit={enter}
          />
        </div>

        <button
          onClick={enter}
          disabled={!name.trim()}
          className="mt-6 w-full rounded-2xl bg-primary py-4 text-lg font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 enabled:active:scale-[0.98] disabled:opacity-30"
        >
          Enter
        </button>

        {/* The way back for someone who already has an account.
            Without this it was a dead end: onboarding has no AppBar, so no
            Settings, so no sign-in — a returning player on a new device had to
            invent a name they didn't want, land in the lobby and go looking.
            Signing in from here fills the profile in for them instead
            (sync#syncNow restores outright when the device is pristine).

            It is a text link under Enter, not a second button beside it,
            because making a player is what this screen is for. It doubles as
            the only mention a first-timer needs: the sentence tells them
            accounts exist without asking them for one. */}
        {hasAccounts && (
          <>
            <button
              onClick={() => {
                sound.play('tap')
                setSignInOpen(true)
              }}
              className="mt-4 flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline"
            >
              Already have an account? Sign in
            </button>
            <AccountDialog open={signInOpen} mode="signin" onOpenChange={setSignInOpen} />
          </>
        )}
      </motion.div>
    </div>
  )
}
