import type { Metadata } from 'next'
import { MarketingFrame } from '@/components/marketing/LegalPage'
import { MembershipScreen } from '@/components/membership/MembershipScreen'
import { contentAlternates, contentSocial } from '@/config/site'

// The membership page.
//
// **On `MarketingFrame`, which is a hard requirement rather than a
// preference**: it carries the `BackButton` that stops a page stranding an
// installed-PWA player outside the app. This is the page most likely to be
// opened from inside the app (every locked tile lands here), so it is the last
// one that could do without it. The frame is `LegalPage`'s chrome without its
// prose column, because this page lays itself out.
//
// **Everything it claims comes from `config/membership.ts`**, rendered by
// `MembershipScreen`. That is not tidiness: this is the one page in the project
// whose job is to persuade, and the failure it is prone to already has a name
// here — the ROADMAP said the membership was not built when part of it was,
// then said one drill was behind it when it was two. A list plus a test is what
// stops the third one. See the header of MembershipScreen for how the look is
// kept apart from the claims.

const DESCRIPTION =
  'What the Pip membership includes, what it costs, and how to cancel it. The game itself stays free.'

export const metadata: Metadata = {
  title: 'Membership · Pip',
  description: DESCRIPTION,
  alternates: contentAlternates('/membership'),
  // Named explicitly: declaring `openGraph` replaces the root block whole, so a
  // page that omits the image ships a summary_large_image card with nothing in
  // it. Two Learn guides are live in that state and this page is not joining
  // them.
  ...contentSocial({
    path: '/membership',
    title: 'Pip Membership',
    description: DESCRIPTION,
    type: 'website',
  }),
}

export default function MembershipPage() {
  return (
    <MarketingFrame>
      <MembershipScreen />
    </MarketingFrame>
  )
}
