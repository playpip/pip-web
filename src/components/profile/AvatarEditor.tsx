'use client'

import { motion } from 'framer-motion'
import { Shuffle } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AVATAR_BG_SWATCHES, freshSeed, type AvatarSpec } from '@/lib/avatar'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** Controlled avatar + name editor, shared by onboarding and the profile dialog. */
export function AvatarEditor({
  spec,
  name,
  onSpecChange,
  onNameChange,
  onSubmit,
  avatarSize = 132,
}: {
  spec: AvatarSpec
  name: string
  onSpecChange: (spec: AvatarSpec) => void
  onNameChange: (name: string) => void
  onSubmit?: () => void
  avatarSize?: number
}) {
  const shuffle = () => {
    sound.play('tap')
    onSpecChange({ ...spec, seed: freshSeed() })
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div key={spec.seed} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <PlayerAvatar spec={spec} size={avatarSize} />
      </motion.div>

      <button
        type="button"
        onClick={shuffle}
        className="flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/10 active:scale-95"
      >
        <Shuffle className="size-4" /> Shuffle
      </button>

      <div className="flex gap-2">
        {AVATAR_BG_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => {
              sound.play('tap')
              onSpecChange({ ...spec, backgroundColor: swatch })
            }}
            aria-label={`background ${swatch}`}
            className={cn(
              'size-7 rounded-full ring-2 ring-transparent transition',
              spec.backgroundColor === swatch && 'ring-foreground/70',
            )}
            style={{ backgroundColor: `#${swatch}` }}
          />
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value.slice(0, 16))}
        placeholder="Your name"
        className="w-full rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-center text-lg outline-none transition focus:border-foreground/30"
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSubmit?.()}
      />
    </div>
  )
}
