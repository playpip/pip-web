import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideTable, Lead } from '@/components/learn/Guide'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { PlayCta } from '@/components/marketing/PlayCta'
import { SITE_URL, contentAlternates } from '@/config/site'

// A landing page, not a guide.
//
// The written guides under /learn answer a question and end at a table. This
// page answers a query where the product *is* the answer: someone typing "play
// poker free no signup" is already trying to do the exact thing Pip does, so
// the job is to confirm it in the first twenty words and get out of the way.
// Hence the different shape — the button sits above the argument rather than
// under it, the substance is a checklist and an FAQ rather than prose, and
// there is no Article markup because this is not one.
//
// It borrows the guides' presentational atoms (the column, the table, the CTA)
// on purpose. Everything shared between a guide and this page should look the
// same on both; only the running order is different.

const TITLE = 'Play poker free, no signup'
const DESCRIPTION =
  'Free Texas Hold’em against AI opponents that play a proper game. No signup, no download, no real money and nothing to buy. Type a name and you are dealt in.'
const PATH = '/play-poker-free-no-signup'

/**
 * The static export of app/opengraph-image.tsx, absolute for the unfurlers.
 *
 * Extension-less on purpose, and checked against `out/` rather than guessed:
 * the export writes the file as `opengraph-image` with no suffix, and
 * `public/_headers` is what forces it to serve as image/png. `.png` here would
 * have been a 404 and a card with a hole in it, which is worse than the generic
 * picture it was meant to replace.
 */
const SITE_CARD = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: 'Pip — poker without the casino',
}

export const metadata: Metadata = {
  title: 'Play poker free, no signup: Texas Hold’em in your browser · Pip',
  description: DESCRIPTION,
  alternates: contentAlternates(PATH),
  // Written out rather than inherited: a route that declares `openGraph` at all
  // replaces the root layout's block whole, image included, and a
  // summary_large_image card with no image in it is a worse share than the
  // generic picture it replaced. The card is Pip's own — this page has no art
  // of its own, and the site card is exactly on topic for it.
  openGraph: {
    type: 'website',
    siteName: 'Pip',
    locale: 'en_GB',
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_CARD],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@playpipio',
    creator: '@playpipio',
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_CARD],
  },
}

/**
 * The checklist somebody arriving on this query is actually running. Written as
 * data because the honest half of it is the right-hand column, and a table is
 * the shape that gets quoted and linked rather than skimmed.
 */
const CHECKLIST: { thing: string; answer: string }[] = [
  { thing: 'Signup or account', answer: 'Not needed. Type a name and you are in.' },
  { thing: 'Download or install', answer: 'None. It is a web page. Installable if you want it.' },
  {
    thing: 'Real money',
    answer: 'None anywhere. No wallet, no card details, nothing to win of value.',
  },
  { thing: 'Ads', answer: 'None.' },
  { thing: 'Chips for sale', answer: 'None. Run out and a free table opens instead.' },
  { thing: 'Pop-ups and daily-reward guilt', answer: 'None.' },
  {
    thing: 'Where your progress lives',
    answer: 'Your browser, on your device. Ours only if you switch sync on, and it ships off.',
  },
  { thing: 'What it costs', answer: 'Nothing.' },
]

/**
 * The questions this query arrives with. Answers are plain strings rather than
 * markup because the structured data below is built from the same array: the
 * one rule for FAQ markup is that it says what the page says, and two copies of
 * an answer drift. Anything that wants a link is prose elsewhere on the page.
 */
const FAQ: { q: string; a: string[] }[] = [
  {
    q: 'Is it actually free?',
    a: [
      'Yes. There is nothing to buy in the game, no ads, and no paid tier of anything on this page. The chips are play money and they are not for sale, which is the part that makes the rest of it hold: there is no purchase for us to be steering you towards.',
    ],
  },
  {
    q: 'Do I need to sign up?',
    a: [
      'No. You type a name, pick a face, and sit down. No email, no password, no verification link.',
      'There is one optional account, and it does exactly one thing: carries your progress to a second device. It is off unless you turn it on, and everything in the game works without it.',
    ],
  },
  {
    q: 'Do I need to download anything?',
    a: [
      'No. Pip is a web page and it plays in the tab you are reading this in. If you want it as an app you can install it from your browser, and it will then work with no connection at all.',
    ],
  },
  {
    q: 'Is any real money involved?',
    a: [
      'None, ever. There is no wallet, no cash-out, no prize with a value, and no currency symbol anywhere in the app. It is not a gambling site and there is nothing in it to gamble with.',
    ],
  },
  {
    q: 'Who am I playing against?',
    a: [
      'A fixed cast of AI regulars, not other people and not one bot wearing different names. They weigh their equity against the pot odds through a personality of their own, so they value-bet, semi-bluff, trap and fold.',
      'They are solid rather than superhuman. A strong player will out-read them, and we would rather say so here than have you find out and feel sold to.',
    ],
  },
  {
    q: 'Can I play on my phone?',
    a: [
      'Yes. It runs in any modern browser, and you can install it to the home screen from there. It was designed on a desktop first, so that is where it looks its best.',
    ],
  },
  {
    q: 'What happens if I lose all my chips?',
    a: [
      'A free table opens up, heads-up against the softest opponent in the game, and winning it buys you back onto the ladder. There is no top-up to purchase and no timer to wait out, because there is nothing here that a stuck player could be sold.',
    ],
  },
  {
    q: 'Is the shuffle fair?',
    a: [
      'The whole engine is open source, so this is a question you can settle by reading rather than by trusting us. An ordinary hand is shuffled by your own browser: there is no server in it, so there is nobody in a position to deal you anything on purpose.',
      'The Daily Deal is the stronger version. It is dealt from a seed derived from the date, which makes it identical for everyone in the world that day and reproducible from the source code.',
    ],
  },
]

/**
 * Two blocks, and the FAQ one is generated from FAQ above.
 *
 * Google restricted FAQ rich results to a handful of authoritative sites in
 * 2023, so this is not here to put an accordion in the search result. It is
 * here because the assistants that answer this query read structured data, and
 * a page whose answers are machine-readable is the same bet as llms.txt.
 */
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Pip',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any web browser',
    url: SITE_URL,
    description: DESCRIPTION,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a.join(' ') },
    })),
  },
]

const strong = 'font-medium text-foreground'
const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function PlayPokerFreeNoSignupPage() {
  return (
    <LegalPage title="Play poker free. No signup, no download.">
      {/* Stripped from the Markdown mirror by gen-llms.mjs, which drops <script>. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time constant, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Lead>
        <p>
          Pip is a free Texas Hold’em game that runs in a browser tab. No signup, no download, no
          real money and nothing to buy. Type a name, pick a face, and you are at a table.
        </p>
        <p>
          The engine is open source, so how the cards are dealt is something you can read rather
          than something you have to take our word for.
        </p>
      </Lead>

      <div className="mt-8">
        <PlayCta label="Play a hand now" />
        <p className="mt-3 text-sm text-muted-foreground">
          No email, no password, nothing to pay with.
        </p>
      </div>

      <Section title="The checklist, since that is what the question really is">
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">What you are checking for</th>
              <th scope="col">What Pip does</th>
            </tr>
          </thead>
          <tbody>
            {CHECKLIST.map((row) => (
              <tr key={row.thing}>
                <td className={strong}>{row.thing}</td>
                <td>{row.answer}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          Most pages answering this query are affiliate pages, and the free game on them is a
          doorway to a casino that pays them for you.{' '}
          <strong className={strong}>There is no doorway here.</strong> Nothing on this site takes
          payment, so nothing on this site is trying to move you towards taking out a card.
        </p>
      </Section>

      <Section title="What the first two minutes look like">
        <p>
          You land on one screen that asks for a name and offers you a face, and that is the entire
          signup. You start with{' '}
          <strong className={strong}>200 chips, and a seat at the Friends’ Garage costs 100</strong>
          , which is the bottom rung of a ladder of ten venues that runs up to The Main Event. Above
          that sit side tables that bend the format, ring games, and one Daily Deal.
        </p>
        <p>
          Win and your Roll grows, lose it all and a free table opens so you can win your way back
          in. Nothing about that loop has a purchase in it, which is why it can afford to be honest
          about how it is going.
        </p>
      </Section>

      <Section title="The honest limits">
        <p>
          <strong className={strong}>It is single-player.</strong> You are playing a cast of AI
          regulars, not other people. There is no multiplayer yet.
        </p>
        <p>
          <strong className={strong}>The AI is good, not superhuman.</strong> It plays a real game,
          equity and pot odds and position and bluffs, and a strong player will still out-read it.
        </p>
        <p>
          <strong className={strong}>The money is not real and never will be.</strong> If you came
          looking for a real-money game, this is the wrong page and there is nothing further down it
          that changes that.
        </p>
      </Section>

      <Section title="Common questions">
        <div className="space-y-6">
          {FAQ.map((entry) => (
            <div key={entry.q}>
              <h3 className={`text-md ${strong}`}>{entry.q}</h3>
              <div className="mt-2 space-y-3">
                {entry.a.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="If you want to learn rather than just play">
        <p>
          The written guides are free too, and they are the same deal as this page: public, no
          signup, no half of an answer held back.
        </p>
        <p>
          Start with{' '}
          <Link href="/learn/how-to-play-texas-holdem" className={link}>
            how to play Texas Hold’em
          </Link>{' '}
          if you have never played a hand,{' '}
          <Link href="/learn/hand-rankings" className={link}>
            poker hand rankings
          </Link>{' '}
          for what beats what, and{' '}
          <Link href="/learn/starting-hands" className={link}>
            which starting hands to play
          </Link>{' '}
          once the rules have stopped being the hard part. There is also a{' '}
          <Link href="/tutorial" className={link}>
            three-minute tour
          </Link>{' '}
          that needs nothing from you at all.
        </p>
      </Section>

      <section className="mt-12 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6">
        <div className="space-y-3 text-md leading-relaxed text-muted-foreground">
          <p>
            That is the whole pitch. This is a page about not having to do anything before you play,
            so the most useful thing it can do now is end.
          </p>
        </div>
        <div className="mt-5">
          <PlayCta />
        </div>
      </section>
    </LegalPage>
  )
}
