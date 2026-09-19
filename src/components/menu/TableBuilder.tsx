'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { SectionScreen } from './SectionScreen'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import {
  CUSTOM_BUY_INS,
  CUSTOM_DEPTHS,
  CUSTOM_SEATS,
  CUSTOM_SPEEDS,
  DEFAULT_CUSTOM,
  type CustomTableSpec,
  customPrize,
  customVenue,
  invitableCast,
  maxBounty,
  refuseCustomTable,
  rungFor,
} from '@/config/customTable'

/**
 * Build your own table.
 *
 * Every control here changes the *shape* of the game. There is deliberately no
 * control for how good the opponents are: that comes from the buy-in, by the
 * same ladder everybody plays, and the reason is in config/customTable.ts — a
 * difficulty dial next to a stakes dial is a chip printer.
 *
 * The screen says so out loud rather than leaving it to be discovered, because
 * a player who cannot find the difficulty setting should learn that it does not
 * exist and why, not conclude we forgot it.
 */
export function TableBuilder() {
  const ready = useRequireProfile()
  const router = useRouter()
  const money = useMoney()
  const member = useEntitlement()
  const spendable = useSpendableRoll()
  const saved = useProfile((s) => s.customTable)
  const setCustomTable = useProfile((s) => s.setCustomTable)
  const [spec, setSpec] = useState<CustomTableSpec>(saved ?? DEFAULT_CUSTOM)

  if (!ready) return <Splash />

  const set = (patch: Partial<CustomTableSpec>) => {
    const next = { ...spec, ...patch }
    // Changing the buy-in can put an existing bounty over what the new stakes
    // can fund, so it is clamped here rather than left to fail validation with
    // a message about a field the player did not touch.
    next.bounty = Math.min(next.bounty, maxBounty(next.buyIn))
    // Same for invitations when the table shrinks.
    next.castIds = next.castIds.slice(0, next.seats - 1)
    setSpec(next)
  }

  const refusal = refuseCustomTable(spec)
  const rung = rungFor(spec.buyIn)
  const affordable = spendable >= spec.buyIn
  const canDeal = member && !refusal && affordable

  const deal = () => {
    if (!canDeal) return
    sound.play('call')
    setCustomTable(spec)
    router.push(`/play/${customVenue(spec).id}`)
  }

  return (
    <SectionScreen
      title="Build a table"
      subtitle="Pick the seats, the stakes, the speed and the company. Deal it whenever you like."
    >
      {!member && (
        <div className="mb-6 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4" /> Building a table comes with the membership.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You can set one up and see what it would pay. Dealing it needs a membership.{' '}
            <Link href="/membership" className="underline underline-offset-2 hover:text-foreground">
              What that is
            </Link>
            .
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Row label="Seats" hint="Including you.">
          <Choices
            options={CUSTOM_SEATS.map((n) => ({ value: n, label: String(n) }))}
            value={spec.seats}
            onPick={(seats) => set({ seats })}
          />
        </Row>

        <Row
          label="Buy-in"
          hint={`Your stake and your stack. It also picks the table: ${rung.name.toLowerCase()} players.`}
        >
          <Choices
            options={CUSTOM_BUY_INS.map((n) => ({
              value: n,
              label: money(n),
              dim: spendable < n,
            }))}
            value={spec.buyIn}
            onPick={(buyIn) => set({ buyIn })}
          />
        </Row>

        <Row label="Stacks" hint="How deep everyone sits, as a multiple of the buy-in.">
          <Choices
            options={CUSTOM_DEPTHS.map((n) => ({ value: n, label: `${n}×` }))}
            value={spec.depth}
            onPick={(depth) => set({ depth })}
          />
        </Row>

        <Row label="Speed" hint="Hands per blind level. Fewer is faster.">
          <Choices
            options={CUSTOM_SPEEDS.map((n) => ({ value: n, label: String(n) }))}
            value={spec.handsPerLevel}
            onPick={(handsPerLevel) => set({ handsPerLevel })}
          />
        </Row>

        <Row
          label="Bounty"
          hint="Paid the moment you knock someone out. It comes out of the prize, never on top of it."
        >
          <Choices
            // Deduped: at the lowest buy-in a quarter and an eighth round to
            // the same number, and two identical chips is a broken-looking
            // control rather than a choice.
            options={[...new Set([0, Math.floor(maxBounty(spec.buyIn) / 2), maxBounty(spec.buyIn)])]
              .filter((n) => n >= 0)
              .map((n) => ({ value: n, label: n === 0 ? 'None' : money(n) }))}
            value={spec.bounty}
            onPick={(bounty) => set({ bounty })}
          />
        </Row>

        <Row
          label="Who sits down"
          hint={`Up to ${spec.seats - 1}. Leave it empty and the regulars are drawn as usual. Company only — nobody in the cast is easier than anybody else.`}
        >
          <div className="flex flex-wrap gap-2">
            {invitableCast().map((ch) => {
              const picked = spec.castIds.includes(ch.id)
              const full = !picked && spec.castIds.length >= spec.seats - 1
              return (
                <button
                  key={ch.id}
                  disabled={full}
                  onClick={() => {
                    sound.play('tap')
                    set({
                      castIds: picked
                        ? spec.castIds.filter((id) => id !== ch.id)
                        : [...spec.castIds, ch.id],
                    })
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition',
                    picked
                      ? 'border-foreground/40 bg-foreground/[0.06]'
                      : 'border-foreground/10 hover:border-foreground/25',
                    full && 'opacity-35',
                  )}
                >
                  <PlayerAvatar spec={ch.avatar} size={22} />
                  {ch.name}
                </button>
              )
            })}
          </div>
        </Row>

        {/* The receipt. Everything derived, nothing typed, so it cannot disagree
            with the table that gets dealt. */}
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Buy-in" value={money(spec.buyIn)} />
            <Fact label="You sit with" value={money(spec.buyIn * spec.depth)} />
            <Fact label="Winner takes" value={money(customPrize(spec))} />
            <Fact label="Blinds" value={`${money(rung.smallBlind)} / ${money(rung.bigBlind)}`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The opposition comes from the buy-in, not from a setting — {rung.name} plays at{' '}
            {money(rung.buyIn)}, so that is who you have built. There is no difficulty dial here on
            purpose.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2">
          <button
            onClick={deal}
            disabled={!canDeal}
            className="rounded-2xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            Deal it
          </button>
          {refusal ? (
            <p className="text-sm text-muted-foreground">{refusal}</p>
          ) : !affordable ? (
            <p className="text-sm text-muted-foreground">
              You need {money(spec.buyIn)} to sit at this one.
            </p>
          ) : null}
        </div>
      </div>
    </SectionScreen>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{label}</h2>
      {hint && <p className="mb-2 mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

function Choices<T extends number>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string; dim?: boolean }[]
  value: T
  onPick: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => {
            sound.play('tap')
            onPick(option.value)
          }}
          className={cn(
            'min-w-11 rounded-xl border px-3 py-1.5 text-sm tabular-nums transition',
            option.value === value
              ? 'border-foreground/40 bg-foreground/[0.06] font-semibold'
              : 'border-foreground/10 hover:border-foreground/25',
            // Dimmed, never disabled: a price you cannot reach yet is still a
            // table worth looking at the numbers for.
            option.dim && option.value !== value && 'opacity-45',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  )
}
