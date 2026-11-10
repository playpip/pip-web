'use client'

import { Switch } from '@/components/settings/group'

/** A labelled on/off switch, as the rating sheet draws them. */
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
      <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
