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
// only then, so nobody else's page carries the drill generator. A tap on The
// Big Pot deals one Omaha showdown (`TappedOmaha`) the same way, and a tap on
// Short Deck one showdown where its flush rule decides the pot (`TappedShortDeck`).
//
// A tap on any other paid drill lands on "Every drill", whose blurb lists nine
// of them, so the tap also names its kind (`&drill=`, `tappedDrill`) and this
// says which one it was, with one spot from it where the shared felt can draw
// one (`TappedDrillSpot`, `SAMPLED_DRILLS`).
//
// A tap on a twist (Fast, Heads-Up, Bounty, Deep) lands on "Every side table",
// whose blurb names all four, so it names its family too (`&table=`,
// `tappedFamily`): the family's own note from the shelf, and its tables.
//
// A tap on a Deep Stack table lists its five prices (`TappedDeepStack`), each
// against the ladder table it is taken from.
//
// A tap on Five-Card Draw deals one hand through the draw (`TappedDraw`),
// loaded the same way as the Omaha showdown, and a tap on The Split one Hi-Lo
// showdown where the pot is cut in half (`TappedHiLo`).
//
// A tap on a locked lesson names the lesson the same way (`&lesson=`,
// `TappedLesson`), loaded only then, so nobody else's page carries the course.
//
// A tap on a locked Chip Shop item names it the same way (`&item=`,
// `TappedShopItem`), with which of the shelf's two deals it is.
//
// A tap on the report shows one (`TappedCoaching`): a made-up player's counts,
// read by the report's own code, loaded the same way. Under it, that the first
// full report of your own is free (lib/membership/freeReport).
//
// A tap on hosting lists the rules a host sets (`TappedMultiplayer`), from the
// lists the room itself is opened with, and a tap on the table builder lists
// what a built table lets you pick (`TappedCustomTable`), from the builder's.
//
// A tap on Blackjack lists its three houses and their edges (`TappedBlackjack`),
// from the rules the table is dealt by.

import dynamic from 'next/dynamic'
import { SAMPLED_DRILLS, tappedDrill } from '@/config/drills'
import { tappedFeature } from '@/config/membership'
import { familyTableNames, tappedFamily } from '@/config/venues'
import { FREE_REPORT_COPY } from '@/lib/membership/freeReport'
import type { ShownPrice } from '@/lib/membership/store'
import { waitingSessionLine } from '@/lib/review/highlights'
import { loadReview } from '@/lib/review/session'
import { useHydrated } from '@/lib/useHydrated'

const TappedSpot = dynamic(() => import('./TappedSpot').then((m) => m.TappedSpot), {
  ssr: false,
})

const TappedDraw = dynamic(() => import('./TappedDraw').then((m) => m.TappedDraw), {
  ssr: false,
})

const TappedOmaha = dynamic(() => import('./TappedOmaha').then((m) => m.TappedOmaha), {
  ssr: false,
})

const TappedShortDeck = dynamic(() => import('./TappedShortDeck').then((m) => m.TappedShortDeck), {
  ssr: false,
})

const TappedHiLo = dynamic(() => import('./TappedHiLo').then((m) => m.TappedHiLo), {
  ssr: false,
})

const TappedDeepStack = dynamic(() => import('./TappedDeepStack').then((m) => m.TappedDeepStack), {
  ssr: false,
})

const TappedDrillSpot = dynamic(() => import('./TappedDrillSpot').then((m) => m.TappedDrillSpot), {
  ssr: false,
})

const TappedLesson = dynamic(() => import('./TappedLesson').then((m) => m.TappedLesson), {
  ssr: false,
})

const TappedShopItem = dynamic(() => import('./TappedShopItem').then((m) => m.TappedShopItem), {
  ssr: false,
})

const TappedMultiplayer = dynamic(
  () => import('./TappedMultiplayer').then((m) => m.TappedMultiplayer),
  { ssr: false },
)

const TappedCustomTable = dynamic(
  () => import('./TappedCustomTable').then((m) => m.TappedCustomTable),
  { ssr: false },
)

const TappedBlackjack = dynamic(() => import('./TappedBlackjack').then((m) => m.TappedBlackjack), {
  ssr: false,
})

const TappedCoaching = dynamic(() => import('./TappedCoaching').then((m) => m.TappedCoaching), {
  ssr: false,
})

export function TappedFor({ price }: { price: ShownPrice }) {
  const hydrated = useHydrated()
  const search = hydrated ? window.location.search : ''
  const feature = tappedFeature(search)
  // Back from checkout the same `?for=` rides along, and the answer to it is
  // the link in the welcome box, not the price again.
  if (!feature || new URLSearchParams(search).has('joined')) return null
  const waiting = feature.id === 'review' ? waitingSessionLine(loadReview()) : null
  const drill = tappedDrill(search)
  const family = tappedFamily(search)
  const lesson = feature.id === 'lessons' && new URLSearchParams(search).has('lesson')
  const shopItem = feature.id === 'cosmetics' && new URLSearchParams(search).has('item')

  return (
    <section
      aria-labelledby="tapped-for"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pt-6 md:px-10 md:pt-8"
    >
      <div className="rounded-2xl border border-pip/30 bg-pip/[0.06] px-5 py-5 md:px-7 md:py-6">
        <p className="text-sm font-medium text-pip">What you tapped is part of</p>
        <h2 id="tapped-for" className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          {feature.title}
        </h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{feature.blurb}</p>
        {waiting && <p className="mt-3 font-medium tabular-nums text-foreground">{waiting}</p>}
        {feature.id === 'draw' && <TappedDraw />}
        {feature.id === 'river' && <TappedSpot />}
        {feature.id === 'omaha' && <TappedOmaha />}
        {feature.id === 'shortdeck' && <TappedShortDeck />}
        {feature.id === 'hilo' && <TappedHiLo />}
        {drill && (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You tapped <span className="font-medium text-foreground">{drill.title}</span>.{' '}
            {drill.blurb}
          </p>
        )}
        {drill && SAMPLED_DRILLS.includes(drill.id) && <TappedDrillSpot kind={drill} />}
        {family && (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You tapped <span className="font-medium text-foreground">{family.name}</span>.{' '}
            {family.note} The tables:{' '}
            {new Intl.ListFormat('en-GB').format(familyTableNames(family))}.
          </p>
        )}
        {feature.id === 'rooms' && <TappedDeepStack />}
        {lesson && <TappedLesson search={search} />}
        {shopItem && <TappedShopItem search={search} />}
        {feature.id === 'coaching' && <TappedCoaching />}
        {feature.id === 'coaching' && (
          <p className="mt-3 font-medium text-foreground">{FREE_REPORT_COPY.offer}</p>
        )}
        {feature.id === 'multiplayer' && <TappedMultiplayer />}
        {feature.id === 'custom-tables' && <TappedCustomTable />}
        {feature.id === 'blackjack' && <TappedBlackjack />}
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
