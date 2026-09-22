import type { Metadata } from 'next'
import { LegalPage, Section, List, Item, A } from '@/components/marketing/LegalPage'
import { DRILL_KINDS } from '@/config/drills'
import { contentAlternates, contentSocial } from '@/config/site'
import {
  HOW_TO_CANCEL,
  MEMBERSHIP_FEATURES,
  MEMBERSHIP_PRICE,
  MEMBERSHIP_PROMISES,
  checkoutReady,
} from '@/config/membership'

// The membership page.
//
// **On `LegalPage`, which is a hard requirement rather than a preference**: it
// carries the `BackButton` that stops a prose page stranding an installed-PWA
// player outside the app. A bespoke shell for this page would recreate that
// trap on the one page most likely to be opened from inside the app.
//
// **Everything it claims comes from `config/membership.ts`**, and the shipped
// half is filtered from the same list the roadmap half comes out of. That is
// not tidiness: this is the first page in the project whose job is to persuade,
// and the failure mode already has a name here — the ROADMAP said the
// membership was not built when part of it was, then said one drill was behind
// it when it was two. Both were written by somebody who meant it. A list plus a
// test is what stops the third one.
//
// **No pricing table.** A table is the construct the markdown mirror's Turndown
// pass has no support for and that shipped broken once already, and
// `data-mirror="skip"` silently does nothing inside one. Two prices read fine
// as a sentence.

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

const shipped = MEMBERSHIP_FEATURES.filter((f) => f.shipped)
const coming = MEMBERSHIP_FEATURES.filter((f) => !f.shipped)

// The free drill kinds, named from the same list the app gates on.
//
// Typed out, this line said "the drill called “Which hand wins?”" while the
// feature item below it said two kinds stay free: one page, two answers, and
// the one a buyer reads first understated what they already have. A sentence
// naming which things are free is a claim about `membersOnly`, so it reads
// `membersOnly`. `tests/freeClaims.test.ts` holds the same line on the README
// and the roadmap, which cannot import anything.
const freeDrills = DRILL_KINDS.filter((kind) => !kind.membersOnly)
  .map((kind) => `“${kind.title}”`)
  .join(' and ')

export default function MembershipPage() {
  return (
    <LegalPage title="Membership" updated="September 2026">
      <Section title="The short version">
        <p>
          Pip is free. The ten-venue ladder, the Rail, the Daily Deal, the Chip Shop, the freeroll,
          every written guide and the drills called {freeDrills} cost nothing and always will. The
          membership is {MEMBERSHIP_PRICE.monthly} a month, or {MEMBERSHIP_PRICE.annual} a year, and
          it adds to that. It never takes anything away from it.
        </p>
        <p>
          You will need a free Pip account, because a membership has to belong to someone. You do
          not need one to play.
        </p>
      </Section>

      <Section title="What you get today">
        <List>
          {shipped.map((feature) => (
            <Item key={feature.id}>
              <strong>{feature.title}.</strong> {feature.blurb}
            </Item>
          ))}
        </List>
      </Section>

      <Section title="What is coming, and is not here yet">
        <p>
          Listed because leaving it out would make the section above look bigger than it is. None of
          this is built. Do not join for it.
        </p>
        <List>
          {coming.map((feature) => (
            <Item key={feature.id}>
              <strong>{feature.title}.</strong> {feature.blurb}
            </Item>
          ))}
        </List>
      </Section>

      <Section title="The two rules">
        <List>
          {MEMBERSHIP_PROMISES.map((promise) => (
            <Item key={promise}>{promise}</Item>
          ))}
        </List>
        <p>
          One thing worth saying here rather than leaving you to find it. Member rooms are ordinary
          tables — same engine, same shuffle, same opponents, same prize-to-buy-in ratio — and
          winning in them moves your Roll like winning anywhere else does. Your rank comes from your
          Roll, so a member reaches a rank sooner for having more tables to win at.
        </p>
        <p>
          We do not think that is pay-to-win, and here is the reasoning so you can disagree with it.
          Pay-to-win means buying an advantage over another player. Pip is single-player: there is
          no leaderboard, no ranking table, and nobody to overtake. Rank is a marker of your own
          progress. If you want to spend an evening building a table and farming chips, that is your
          evening and it costs nobody anything. What we will not do, at any price, is sell you
          something that changes a hand — and that is the second rule above, which holds without an
          asterisk. The{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md">roadmap</A> logs this
          argument, including the afternoon we talked ourselves out of it and back into it.
        </p>
      </Section>

      <Section title="What it costs">
        <p>
          {MEMBERSHIP_PRICE.monthly} a month or {MEMBERSHIP_PRICE.annual} a year, in pounds,
          wherever you are. That is the whole price: any tax is already inside it, so the number
          here is the number that leaves your bank. We do not charge you in your own currency,
          because doing so quietly adds a conversion fee to the rate and then this paragraph would
          be false.
        </p>
        <p>
          It renews until you stop it. Monthly renews monthly, annual renews annually, and you can
          cancel either at any time.
        </p>
      </Section>

      {/* The section that serves the query rather than our interest. "cancel pip
          membership" is typed by somebody who wants to cancel, and landing them
          on a sales page serves the wrong intent. It is also the best available
          proof of the claim above, sitting on the page that makes it. */}
      <Section title="How to cancel">
        <p>{HOW_TO_CANCEL}</p>
        <p>
          Cancelling stops the renewal and leaves you a member until the period you have already
          paid for runs out. An annual membership cancelled in month two runs to the end of the year
          and is not refunded pro rata; that is the standard arrangement and we would rather you
          read it here than discover it. See the <A href="/terms">terms</A>.
        </p>
      </Section>

      <Section title="Can I join yet?">
        {checkoutReady() ? (
          <p>
            Yes. Open Settings, then Membership. You will need to be signed in to a free Pip account
            first.
          </p>
        ) : (
          <p>
            <strong>Not yet, and nobody has paid us anything.</strong> There is no checkout wired up
            behind this page — no Stripe account, no card form, no way to give us money. Everything
            listed above is built and sitting behind the membership check, which is why this page
            exists at all. We built the thing before we built the till on purpose. When that
            changes, this paragraph changes with it.
          </p>
        )}
      </Section>
    </LegalPage>
  )
}
