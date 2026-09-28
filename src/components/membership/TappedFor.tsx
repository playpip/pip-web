'use client'

// The answer to the tap, above everything else on the page.
//
// Every padlock in the app goes to `/membership`, and until this the page
// opened the same way whatever was tapped: a hero, four counts, a list of
// tools, and the thing you asked about somewhere below. A locked tap carries
// `?for=<feature id>` now (`membershipFor` in config/membership.ts), and this
// puts that feature's own entry first, in the words the list below already
// uses, with the price next to it.
//
// **It renders nothing without a `?for=` it recognises**, and nothing before
// hydration, so the static HTML and the markdown mirror are the plain page for
// everybody. The query string is read from `window.location` rather than
// `useSearchParams`, which would suspend the prerendered page (the same reason
// `Join` reads `?joined=1` this way).

import { type LocalPrice, tappedFeature } from '@/config/membership'
import { useHydrated } from '@/lib/useHydrated'

export function TappedFor({ price }: { price: LocalPrice }) {
  const hydrated = useHydrated()
  const feature = hydrated ? tappedFeature(window.location.search) : null
  if (!feature) return null

  return (
    <section
      aria-labelledby="tapped-for"
      className="mx-auto w-full max-w-3xl px-4 pt-8 md:px-10 md:pt-12"
    >
      <div className="rounded-2xl border border-pip/30 bg-pip/[0.06] px-5 py-5 md:px-7 md:py-6">
        <p className="text-sm font-medium text-pip">What you tapped is part of</p>
        <h2 id="tapped-for" className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {feature.title}
        </h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{feature.blurb}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          It comes with everything else on this page, for{' '}
          <span className="font-semibold tabular-nums text-foreground">{price.monthly}</span> a
          month or{' '}
          <span className="font-semibold tabular-nums text-foreground">{price.annual}</span> a year.{' '}
          <a href="#plans" className="underline underline-offset-2 hover:text-foreground">
            See the plans
          </a>
          .
        </p>
      </div>
    </section>
  )
}
