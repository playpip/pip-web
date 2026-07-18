import { cn } from '@/lib/utils'

/**
 * The loading screen shown during the brief gap before the app hydrates (and
 * while a venue settles). It's deliberately JS-free — pure markup + a CSS pulse —
 * so it's baked into the prerendered HTML and paints instantly, even before the
 * bundle loads. The installed PWA's OS launch screen (manifest background_color +
 * icon) hands off to this.
 *
 * The chip uses the brand's fixed palette (it matches the favicon at
 * app/icon.svg), the same accepted exception the marketing ChipMark makes; the
 * surrounding surface uses theme tokens so it reads in light and dark.
 */
export function Splash() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background">
      {/* soft pip glow — the single accent, low alpha (matches the landing) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_-10%,color-mix(in_oklch,var(--color-pip)_16%,transparent),transparent_70%)]" />
      <div className="flex flex-col items-center gap-4">
        <ChipMark className="size-14 motion-safe:animate-pulse" />
        <span className="text-xl font-semibold lowercase tracking-tight text-muted-foreground">
          pip
        </span>
      </div>
    </div>
  )
}

/** The Pip poker chip (matches the favicon at app/icon.svg). */
function ChipMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn(className)} aria-label="Loading pip" role="img">
      <circle cx="16" cy="16" r="15" fill="#7C8CF0" />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeDasharray="3.3 6.517"
        strokeDashoffset="1.65"
      />
      <circle
        cx="16"
        cy="16"
        r="8.25"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        opacity="0.95"
      />
    </svg>
  )
}
