'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AwardChip } from '@/components/AwardChip'
import { AWARDS, type AwardKind } from '@/lib/awards'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

// Dev switch: renders every chip as earned so the designs can be reviewed.
const PREVIEW_ALL_CHIPS = false

const SECTIONS: { kind: AwardKind; title: string }[] = [
  { kind: 'venue', title: 'Venues' },
  { kind: 'hand', title: 'Hands' },
  { kind: 'moment', title: 'Moments' },
  { kind: 'journey', title: 'The Journey' },
]

/**
 * The chip collection — earned chips in colour, unearned as hollow outlines.
 * Tap a chip to read how it's earned; the set doubles as a quiet goal list.
 */
export function ChipsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const owned = useProfile((s) => s.awards)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const isEarned = (id: string) => PREVIEW_ALL_CHIPS || owned[id] !== undefined
  const selected = AWARDS.find((a) => a.id === selectedId)
  const earnedCount = AWARDS.filter((a) => isEarned(a.id)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chips</DialogTitle>
          <DialogDescription>
            Special chips for the moments worth remembering — {earnedCount} of {AWARDS.length}{' '}
            collected.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1.5 flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-1.5 py-1">
          {SECTIONS.map(({ kind, title }) => (
            <section key={kind}>
              <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {title}
              </p>
              <div className="grid grid-cols-5 gap-x-2 gap-y-3">
                {AWARDS.filter((a) => a.kind === kind).map((award) => {
                  const earned = isEarned(award.id)
                  return (
                    <button
                      key={award.id}
                      onClick={() => {
                        sound.play('tap')
                        setSelectedId(award.id === selectedId ? null : award.id)
                      }}
                      aria-label={award.name}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition hover:bg-foreground/5 active:scale-95',
                        selectedId === award.id &&
                          'bg-foreground/5 ring-1 ring-inset ring-foreground/20',
                      )}
                    >
                      <AwardChip award={award} earned={earned} size={48} />
                      <span
                        className={cn(
                          'w-full truncate text-center text-[10px] leading-tight',
                          earned ? 'text-foreground' : 'text-muted-foreground/60',
                        )}
                      >
                        {award.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="min-h-4 border-t border-foreground/10 pt-3 text-center text-xs text-muted-foreground">
          {selected
            ? `${selected.name} — ${selected.how.toLowerCase()}`
            : 'Tap a chip for its story.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
