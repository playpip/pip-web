'use client'

import { cn } from '@/lib/utils'

/** A labelled on/off switch, as Settings and Manage account draw them. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition disabled:opacity-40',
          checked ? 'bg-primary' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-background shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}
