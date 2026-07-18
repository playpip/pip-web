'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AvatarEditor } from '@/components/profile/AvatarEditor'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'

export function Onboarding({ onCreated }: { onCreated?: () => void }) {
  const createProfile = useProfile((s) => s.createProfile)
  const [spec, setSpec] = useState<AvatarSpec>(() => ({
    seed: freshSeed(),
    backgroundColor: AVATAR_BG_SWATCHES[1],
  }))
  const [name, setName] = useState('')

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
      </motion.div>
    </div>
  )
}
