import Link from 'next/link'

/**
 * The one call to action the prose pages get: a real link to a real table.
 *
 * Shared rather than written per page because the pages that use it are the
 * pages whose whole argument is that Pip does not badger you. One button, one
 * shape, one destination — a second variant of it appearing somewhere would be
 * the first step towards the thing we say we do not do.
 *
 * `/game` on purpose: `/play` is not a route (only `/play/<venue>` is), and a
 * dead CTA shipped in a guide draft once already.
 */
export function PlayCta({ label = 'Play a hand' }: { label?: string }) {
  return (
    <Link
      href="/game"
      className="inline-flex rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
    >
      {label}
    </Link>
  )
}
