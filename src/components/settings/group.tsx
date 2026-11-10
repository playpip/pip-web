'use client'

import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * The grouped list Settings is drawn in, iOS-style: a small label over a
 * rounded card of rows with hairlines between them. The page and the sheet at
 * the table both use it, so a setting looks the same wherever you change it.
 */
export function SettingsGroup({
  label,
  children,
  className,
}: {
  label?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0', className)}>
      {label && (
        <h2 className="mb-2 px-4 text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </h2>
      )}
      {/* A container, so a row can tell when the text size has left it no room
          for its icon (`RowIcon`) and drop it, rather than squeezing the words. */}
      <div className="@container divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
        {children}
      </div>
    </section>
  )
}

/** The tile colours. Brand tokens only, one per group, as iOS tints its icons. */
export type Tint = 'pip' | 'coral' | 'blue' | 'green' | 'streak' | 'plain'

const TINTS: Record<Tint, string> = {
  pip: 'bg-pip/15 text-pip',
  coral: 'bg-suit-red/15 text-suit-red',
  blue: 'bg-suit-blue/20 text-suit-blue',
  green: 'bg-suit-green/20 text-suit-green',
  streak: 'bg-streak/15 text-streak',
  plain: 'bg-foreground/[0.08] text-foreground/80',
}

/**
 * Hidden when the card is narrower than 16rem: a phone at 150% and up, where
 * the tile would cost the label a third of the row.
 */
export function RowIcon({ icon: Icon, tint = 'plain' }: { icon: LucideIcon; tint?: Tint }) {
  return (
    <span
      className={cn(
        'hidden size-8 shrink-0 place-items-center rounded-lg @[16rem]:grid',
        TINTS[tint],
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

/** One row: icon, label and hint on the left, the control on the right. */
export function SettingsRow({
  icon,
  tint,
  label,
  hint,
  control,
  children,
  className,
}: {
  icon?: LucideIcon
  tint?: Tint
  label: React.ReactNode
  hint?: React.ReactNode
  control?: React.ReactNode
  /** Anything that sits under the label row, full width (a segmented control). */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-4 py-3.5', className)}>
      <div className="flex items-center gap-3">
        {icon && <RowIcon icon={icon} tint={tint} />}
        {/* Hyphens, so a long word can still break at 200% text on a phone,
            where the switch leaves the label a column a few letters wide. */}
        <div className="min-w-0 flex-1 hyphens-auto break-words">
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {control}
      </div>
      {children}
    </div>
  )
}

/** A row that is a switch. The whole row is not the target: the switch is. */
export function SwitchRow({
  icon,
  tint,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  icon?: LucideIcon
  tint?: Tint
  label: string
  hint?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <SettingsRow
      icon={icon}
      tint={tint}
      label={label}
      hint={hint}
      control={<Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />}
    />
  )
}

/** The on/off switch, with a knob that springs across rather than slides. */
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors active:scale-[0.96] disabled:opacity-40',
        checked ? 'justify-end bg-primary' : 'justify-start bg-foreground/15',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
        className="size-6 rounded-full bg-background shadow-md"
      />
    </button>
  )
}
