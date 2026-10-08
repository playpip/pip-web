import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideTable, Lead } from '@/components/learn/Guide'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { PlayCta } from '@/components/marketing/PlayCta'
import { TodaysDeal } from '@/components/marketing/TodaysDeal'
import { ACCOUNT_OFFER } from '@/config/account'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import { contentAlternates, contentSocial } from '@/config/site'
import { THE_DAILY, dailyFor } from '@/config/venues'
import { RANKS } from '@/config/ranks'
import { DAILY_EPOCH_UTC } from '@/lib/daily'

// The Daily Deal's front door.
//
// It is the most linkable thing we own and it had no URL anybody could arrive
// on: the share line the app copies names a deal number and, until this page,
// had nowhere to send anyone, and the tournament itself is /play/daily, which
// is app rather than content and is not in the sitemap.
//
// Shaped like /play-poker-free-no-signup rather than a Learn guide: the product
// is the answer to the question, so the button goes above the argument. Every
// number in the prose is read off THE_DAILY and the epoch instead of typed, so
// a venue rebalance cannot leave this page describing a tournament nobody can
// sit at. The one thing that cannot come from the config is which deal today
// is, and that is a client component for the reason written in it.

const PATH = '/daily'
const TITLE = 'The Daily Deal'
const DESCRIPTION =
  'One free Texas Hold’em tournament a day. Everyone who plays gets the same cards, and you can check the deck yourself.'

/** "16 July 2026", from the epoch the game counts from. */
const EPOCH_LABEL = new Date(DAILY_EPOCH_UTC).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const chips = (n: number) => n.toLocaleString('en-GB')

/**
 * The tournament, as a row per thing somebody would actually want to know.
 *
 * Data rather than prose because most of it is a number that lives in
 * src/config/venues.ts, and a paragraph is where those go to drift.
 */
const RULES: { thing: string; detail: string }[] = [
  {
    thing: 'New deal',
    detail: `Every day at midnight UTC. Deal #1 was ${EPOCH_LABEL}.`,
  },
  {
    thing: 'Entry',
    detail: `Free. You never pay from your Roll, and everyone starts with ${chips(THE_DAILY.startingStack ?? 0)} chips.`,
  },
  {
    thing: 'Seats',
    detail: `${THE_DAILY.seats}. You and four regulars, the same four for everyone.`,
  },
  {
    thing: 'Tier',
    detail: `Set by your rank. The higher your rank, the harder the regulars play and the more the Daily pays. Everyone at your tier plays the identical game.`,
  },
  {
    thing: 'Blinds',
    detail: `${THE_DAILY.smallBlind}/${THE_DAILY.bigBlind} to start, going up every ${HANDS_PER_LEVEL} hands.`,
  },
  {
    thing: 'Prizes',
    detail: `For 1st, by tier: ${RANKS.map((r) => `${r.name} ${chips(dailyFor(r.min).prize)}`).join(', ')}. 2nd gets a quarter of that. Paid onto your Roll.`,
  },
  {
    thing: 'Plays per day',
    detail: 'One. Sitting down counts, whether you finish or not.',
  },
  {
    thing: 'Result',
    detail: 'Tap the Daily tile in the lobby after you play to copy a line with your finish.',
  },
]

const FAQ: { q: string; a: string[] }[] = [
  {
    q: 'Does it cost anything?',
    a: [
      'No. Entry is free and there is no real money anywhere in Pip. The chips are play money and are not for sale.',
    ],
  },
  {
    q: 'Do I need an account?',
    a: [`No. ${ACCOUNT_OFFER}`],
  },
  {
    q: 'Does the Daily count for my streak?',
    a: [
      'Your streak counts the UTC days in a row you have played a hand anywhere in Pip, and the Daily counts. It is the flame at the top of the lobby. With an account, two devices share one streak, and you can turn on an email for the evenings it is about to end.',
    ],
  },
  {
    q: 'What happens if I close the tab halfway through?',
    a: [
      'The table is saved. Come back the same day and you pick up on the hand you were on. If you leave the table, today’s Daily is used up.',
    ],
  },
  {
    q: 'Do the opponents play the same way for everyone?',
    a: [
      'The same four regulars sit down for everyone, and they start from the same seed as the cards. How hard they play is set by your tier, so everyone at your rank faces the same opponents. What they do after that depends on what you do, so two players can finish the same deal very differently.',
    ],
  },
  {
    q: 'Can I look at today’s deck before I play?',
    a: [
      'Yes. The method is published and the date is the only input. You get the deck in dealt order. Which cards reach which seat depends on the seating and the button, which the deck alone does not tell you.',
    ],
  },
]

export const metadata: Metadata = {
  title: 'The Daily Deal: a free poker tournament every day, the same cards for everyone · Pip',
  description: DESCRIPTION,
  alternates: contentAlternates(PATH),
  ...contentSocial({ path: PATH, title: TITLE, description: DESCRIPTION, type: 'website' }),
}

/**
 * FAQ markup for the same reason /play-poker-free-no-signup carries it: not for
 * a rich result, which Google restricted to a handful of sites in 2023, but
 * because the assistants answering this kind of question read structured data.
 * Built from FAQ above so the two copies cannot say different things.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: { '@type': 'Answer', text: entry.a.join(' ') },
  })),
}

const strong = 'font-medium text-foreground'
const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function DailyPage() {
  return (
    <LegalPage title="The Daily Deal">
      {/* Stripped from the Markdown mirror by gen-llms.mjs, which drops <script>. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time constant, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Lead>
        <p>
          One free tournament a day. {THE_DAILY.seats} seats, and everyone who plays gets the same
          cards. A new deal starts at midnight UTC.
        </p>
      </Lead>

      <div className="mt-8">
        <PlayCta label="Play today’s deal" />
        <p className="mt-3 text-muted-foreground text-sm">
          The Daily is the tile in the lobby with today’s number on it.
        </p>
      </div>

      <TodaysDeal />

      <Section title="The rules">
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Thing</th>
              <th scope="col">How it works</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((row) => (
              <tr key={row.thing}>
                <td className={strong}>{row.thing}</td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
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

      <Section title="Checking the deal">
        <p>
          The deck comes from the UTC date and nothing else. The date is hashed into a seed
          (FNV-1a), each hand mixes in its own number, and a seeded generator (mulberry32) drives
          one Fisher-Yates shuffle. That is why a refresh re-deals the same hand. Only the Daily is
          dealt this way; every other table shuffles in your browser.
        </p>
        <p>
          A snippet you can run and a worked example:{' '}
          <Link href="/blog/verify-todays-deal" className={link}>
            how to verify today&rsquo;s deal
          </Link>
          .
        </p>
      </Section>

      <section className="mt-12 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6">
        <p className="text-md text-muted-foreground leading-relaxed">
          Free to play, same cards for everyone, one go a day.
        </p>
        <div className="mt-5">
          <PlayCta label="Play today’s deal" />
        </div>
      </section>
    </LegalPage>
  )
}
