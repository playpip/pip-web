import type { Metadata } from 'next'
import Link from 'next/link'
import { Lead } from '@/components/learn/Guide'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { OddsCalculator } from '@/components/marketing/OddsCalculator'
import { SITE_URL, contentAlternates, contentSocial } from '@/config/site'

// A tool, not a guide and not a landing page.
//
// It sits flat at /poker-odds-calculator rather than under /tools, because one
// tool is not a toolbox and /tools would 404 for anyone who trims the URL,
// which crawlers do. Cheap to move later behind a redirect if there is ever a
// second one.
//
// The shape is: the thing itself, immediately, then the sentence that says why
// this one is worth using, then the prose. The widget is app and opts out of
// the Markdown mirrors; everything under it is content and belongs in them,
// which is why the explanation of what the calculator does is written as prose
// rather than drawn inside it.
//
// No server, ever, on this page. The moment it needs an API it is a running
// cost and an attack surface, and the whole idea dies on its own terms. It is
// also free and stays free: it answers a question about a hand, it generates
// nothing, grades nobody and remembers nothing between visits, so it never goes
// near the membership boundary.

const PATH = '/poker-odds-calculator'
const TITLE = 'Poker odds calculator'
const DESCRIPTION =
  'Texas Hold’em odds, worked out in your browser. Pick your cards, add a board, choose how many opponents. Free, no signup, no ads, nothing to install.'

export const metadata: Metadata = {
  title: 'Poker odds calculator - free, no signup | Pip',
  description: DESCRIPTION,
  alternates: contentAlternates(PATH),
  ...contentSocial({ path: PATH, title: TITLE, description: DESCRIPTION, type: 'website' }),
}

/**
 * Not here for a rich result: Google restricted those years ago. It is here
 * because the assistants fielding this question read structured data, which is
 * the same bet as llms.txt.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Pip poker odds calculator',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any web browser',
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
}

const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function PokerOddsCalculatorPage() {
  return (
    <LegalPage title={TITLE}>
      {/* Stripped from the Markdown mirror by gen-llms.mjs, which drops <script>. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time constant, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Lead>
        <p>
          Pick your two cards, add the board if there is one, say how many people you are against.
          Leave the board empty and it works the hand out preflop. That is the whole thing.
        </p>
      </Lead>

      <OddsCalculator />

      <p className="mt-5 text-md leading-relaxed text-muted-foreground">
        This deals the hand out and counts who wins, rather than looking the answer up. It is the
        same engine Pip’s game uses to work out the win percentage in the corner of the table, it
        runs entirely in your browser, and it is{' '}
        <a
          href="https://github.com/playpip/pip-web"
          target="_blank"
          rel="noreferrer"
          className={link}
        >
          open source
        </a>
        , so you can check it rather than trust it.
      </p>

      <Section title="What equity actually means">
        <p>
          Equity is your share of the pot if the hand were played to the end from here, every time.
          Ace-king against one random hand is about two thirds, which sounds like a lot until you
          notice it means you lose a third of the time.
        </p>
        <p>
          It is not a decision on its own. A hand that wins 30% of the time is a fold against one
          price and a call against another, and the thing that decides which is the size of the bet,
          not the size of the number here. That arithmetic is in{' '}
          <Link href="/learn/pot-odds" className={link}>
            pot odds
          </Link>
          .
        </p>
        <p>
          Two things this does not do. It assumes your opponents hold random cards, which nobody
          does after they have put money in, so treat the number as a floor on a big bet and a
          ceiling on a small one. And it says nothing about how the hand gets played.{' '}
          <Link href="/learn/position" className={link}>
            Position
          </Link>{' '}
          is usually worth more than the two or three points between{' '}
          <Link href="/learn/starting-hands" className={link}>
            one starting hand and the next
          </Link>
          .
        </p>
      </Section>

      <Section title="Where the numbers come from">
        <p>
          Pip is an open-source Texas Hold’em game. The engine here is <code>estimateEquity</code>{' '}
          from the same repo the game runs on, doing the same job it does when you play a hand.
          There is no account, no email box, and nothing to install.
        </p>
        <p>
          Where the spot is small enough to count outright, it is counted outright and the answer
          says so: heads-up with the board complete is 990 possible hands your opponent could hold,
          and every one of them gets dealt. Everywhere else it deals a large sample and prints the
          margin of error that sample earns, because a number quoted to a decimal place it cannot
          support is a made-up number.
        </p>
        <p>
          If you want to play a few hands rather than count them,{' '}
          <Link href="/game" className={link}>
            that is here
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
