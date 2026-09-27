'use client'

// The bento — the four pieces every "about you" screen is built from.
//
// Lifted out of StatsPage, which had the only one, and now shares it with the
// report. They were four small components and would have been a copy-paste,
// which is the version where the two screens drift a radius and a tracking
// apart over a year and nobody can say which is right.

import { cn } from '@/lib/utils'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5', className)}
    >
      {children}
    </div>
  )
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{children}</p>
}

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-foreground/[0.04] p-4">
      <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {detail && (
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">{detail}</span>
        )}
      </p>
    </div>
  )
}

export function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-2 py-2.5 text-center">
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-3xs uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="text-3xs text-muted-foreground/60">{sub}</p>
    </div>
  )
}
