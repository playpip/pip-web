import { cn } from '@/lib/utils'

/** The pip wordmark — the chip mark plus the lowercase name. Shared by the
 * marketing landing and the legal pages. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-2 text-xl font-semibold lowercase tracking-tight',
        className,
      )}
    >
      <ChipMark className="size-5" />
      pip
    </span>
  )
}

/** The brand mark — the Pip poker chip (matches the favicon at src/app/icon.svg). */
function ChipMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
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
