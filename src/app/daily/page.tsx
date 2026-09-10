import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideTable, Lead } from '@/components/learn/Guide'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { PlayCta } from '@/components/marketing/PlayCta'
import { TodaysDeal } from '@/components/marketing/TodaysDeal'
import { ACCOUNT_OFFER } from '@/config/account'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import { contentAlternates, contentSocial } from '@/config/site'
import { THE_DAILY } from '@/config/venues'
import { DAILY_EPOCH_UTC } from '@/lib/daily'

// The Daily Deal's front door.
//
// It is the most linkable thing we own and it had no URL anybody could arrive
// on: the share line the app copies says "pip daily #142" with nowhere to send
// anyone, and the tournament itself is /play/daily, which is app rather than
// content and is not in the sitemap.
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
  'One Texas Hold’em tournament a day, dealt from a seed made out of the date. Everyone in the world who sits down plays the identical shuffle, and you can work the deck out yourself before you do.'

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
    thing: 'A new deal',
    detail: `Midnight UTC. Deal #1 was ${EPOCH_LABEL}, and there has been one every day since.`,
  },
  {
    thing: 'Seats',
    detail: `${THE_DAILY.seats}. You and four of the regulars, and they are the same four for everybody.`,
  },
  {
    thing: 'Buy-in',
    detail: `${chips(THE_DAILY.buyIn)} chips. Play money, not for sale, and there is no free Daily: under ${chips(THE_DAILY.buyIn)} and the tile stays locked until you win your way back.`,
  },
  {
    thing: 'Blinds',
    detail: `${THE_DAILY.smallBlind}/${THE_DAILY.bigBlind} to start, going up every ${HANDS_PER_LEVEL} hands like any other tournament here.`,
  },
  {
    thing: 'Winner takes',
    detail: `${chips(THE_DAILY.prize)} chips, straight onto your Roll. Nobody else gets paid.`,
  },
  {
    thing: 'How often you can play it',
    detail: 'Once. Sitting down counts as playing it, whether you finish or not.',
  },
  {
    thing: 'What you keep',
    detail:
      'Where you finished, as a line of text you can copy. No streak, no history, no column for tomorrow.',
  },
]

const FAQ: { q: string; a: string[] }[] = [
  {
    q: 'Can I look at today’s deck before I play it?',
    a: [
      'Yes, and there is no point pretending otherwise: the method is published and the date is the only input. If you want to spoil it for yourself, the instructions are one link away.',
      'What you get is the deck in dealt order, not your hand. Which card reaches which seat depends on the seat order and where the button is, and neither of those is in the snippet.',
    ],
  },
  {
    q: 'Do I need an account?',
    a: [`No. ${ACCOUNT_OFFER}`],
  },
  {
    q: 'Do the opponents play the same way for everyone?',
    a: [
      'Their randomness comes out of the same day seed the cards do, so the deal is identical for every player in the world. What they do with it depends on what you do, which is why two people can finish deal #57 with completely different stories about it.',
    ],
  },
  {
    q: 'What happens if I close the tab halfway through?',
    a: [
      'The table is saved, so coming back the same day puts you where you were, on the hand you were on.',
      'Walking away for good still counts as played. The shuffle is knowable in advance, so a re-deal would be a hole in the thing rather than a courtesy.',
    ],
  },
  {
    q: 'Is any real money in it?',
    a: [
      `None. The buy-in is ${chips(THE_DAILY.buyIn)} play chips, the prize is ${chips(THE_DAILY.prize)} more of them, and neither is for sale at any price.`,
    ],
  },
  {
    q: 'Which deal is today?',
    a: [
      `Count the days from ${EPOCH_LABEL}, counting that day as #1. The panel at the top of this page does it for you, in your browser, because a number baked into a page at build time is wrong by the next morning.`,
    ],
  },
]

export const metadata: Metadata = {
  title: 'The Daily Deal: one poker tournament a day, the same cards for everyone · Pip',
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
          Every UTC day, Pip deals one tournament. {THE_DAILY.seats} seats, the same shuffle for
          everyone in the world who sits down that day, and at midnight it is gone.
        </p>
        <p>
          The shuffle is made out of the date and nothing else, so you can work out the deck without
          asking us and without reading our code. Hardly anybody does. The point is that they could.
        </p>
      </Lead>

      <div className="mt-8">
        <PlayCta label="Play today’s deal" />
        <p className="mt-3 text-muted-foreground text-sm">
          That opens the game. The Daily is the tile with today’s number on it.
        </p>
      </div>

      <TodaysDeal />

      <Section title="The rules, all of them">
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

      <Section title="Why everyone gets the same cards">
        <p>
          The chain runs date, seed, deck, and every link in it is ordinary. The UTC date written{' '}
          <code>2026-07-16</code> goes through FNV-1a to make the day&rsquo;s seed. Each hand mixes
          its own number into that seed, mulberry32 turns the result into a stream of numbers, and
          one pass of Fisher-Yates puts the deck in order. Nothing in there is clever and nothing in
          there is ours.
        </p>
        <p>
          That is also why refreshing mid-tournament re-deals the hand you were on rather than a
          fresh one, and why we could not have dealt you a worse deck for playing well. The deck was
          decided by the calendar before anyone sat down.
        </p>
        <p>
          The full chain, a snippet that runs anywhere JavaScript runs, and one day&rsquo;s answer
          to check yours against:{' '}
          <Link href="/blog/verify-todays-deal" className={link}>
            how to verify today&rsquo;s deal
          </Link>
          .
        </p>
        <p>
          <strong className={strong}>Only the Daily works this way.</strong> Every other table
          shuffles in your own browser, which is a different claim and a weaker one: there is no
          server in it, so there is nobody in a position to deal you anything on purpose.
        </p>
      </Section>

      <Section title="What it deliberately does not do">
        <p>
          <strong className={strong}>There is no streak.</strong> Play thirty days running and Pip
          will not congratulate you, because a number that only goes up while you keep turning up is
          a number that punishes a day off.
        </p>
        <p>
          <strong className={strong}>There is no countdown and no reminder.</strong> No
          notification, no email, no badge on the tab. Miss a day and nothing happens to you.
        </p>
        <p>
          <strong className={strong}>There is no leaderboard.</strong> There is no server keeping
          one, and where you finished is yours to copy and send to somebody or not.
        </p>
        <p>
          <strong className={strong}>Yesterday&rsquo;s deal is gone.</strong> Not archived, not
          replayable. The tile shows today&rsquo;s number and that is the whole state of it.
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

      <section className="mt-12 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6">
        <div className="space-y-3 text-md text-muted-foreground leading-relaxed">
          <p>
            Same cards for everyone, once a day, and then it is over. Tomorrow is not a reward for
            today.
          </p>
        </div>
        <div className="mt-5">
          <PlayCta label="Play today’s deal" />
        </div>
      </section>
    </LegalPage>
  )
}
