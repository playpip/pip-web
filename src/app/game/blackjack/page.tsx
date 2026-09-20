import { Suspense } from 'react'
import { Splash } from '@/components/Splash'
import { BlackjackClient } from './BlackjackClient'

// Blackjack. Under /game because it is the app rather than content — the
// subtree layout's noindex and title cover it — and on its own route rather
// than /play/[venue] because that one drives the poker game store and this is
// not poker. See BlackjackClient for the rest of that argument.
//
// The Suspense boundary is required, not decorative: the client reads the
// table and the stack out of the query string, and `useSearchParams` suspends
// under the static export.
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <BlackjackClient />
    </Suspense>
  )
}
