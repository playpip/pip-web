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
//
// A tap on the review also names the session already kept on this device
// (`waitingSessionLine`), read from local storage after hydration. Nothing is
// sent anywhere.
//
// A tap on Calling the river also deals one spot from it (`TappedSpot`), loaded
// only then, so nobody else's page carries the drill generator.
//
// A tap on any other paid drill lands on "Every drill", whose blurb lists nine
// of them, so the tap also names its kind (`&drill=`, `tappedDrill`) and this
// says which one it was, with one spot from it where the shared felt can draw
// one (`TappedDrillSpot`, `SAMPLED_DRILLS`).

import dynamic from 'next/dynamic'
import { SAMPLED_DRILLS, tappedDrill } from '@/config/drills'
import { type LocalPrice, tappedFeature } from '@/config/membership'
import { waitingSessionLine } from '@/lib/review/highlights'
import { loadReview } from '@/lib/review/session'
import { useHydrated } from '@/lib/useHydrated'

const TappedSpot = dynamic(() => import('./TappedSpot').then((m) => m.TappedSpot), {
  ssr: false,
})

const TappedDrillSpot = dynamic(() => import('./TappedDrillSpot').then((m) => m.TappedDrillSpot), {
  ssr: false,
})

export function TappedFor({ price }: { price: LocalPrice }) {
  const hydrated = useHydrated()
  const search = hydrated ? window.location.search : ''
  const feature = tappedFeature(search)
  // Back from checkout the same `?for=` rides along, and the answer to it is
  // the link in the welcome box, not the price again.
  if (!feature || new URLSearchParams(search).has('joined')) return null
  const waiting = feature.id === 'review' ? waitingSessionLine(loadReview()) : null
  const drill = tappedDrill(search)

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
        {waiting && <p className="mt-3 font-medium tabular-nums text-foreground">{waiting}</p>}
        {feature.id === 'river' && <TappedSpot />}
        {drill && (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You tapped <span className="font-medium text-foreground">{drill.title}</span>.{' '}
            {drill.blurb}
          </p>
        )}
        {drill && SAMPLED_DRILLS.includes(drill.id) && <TappedDrillSpot kind={drill} />}
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
