import { cn } from '@/lib/utils'

/** The key that presses a button, in its top-right corner. The button must be `relative`. */
export function KeyBadge({ children, className }: { children: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-md bg-foreground/[0.06] px-1 text-[0.65rem] font-medium leading-none text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
