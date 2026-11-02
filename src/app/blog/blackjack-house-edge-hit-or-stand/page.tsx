import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import {
  EDGE_BEFORE,
  ENDLESS_SHOE_EDGE,
  HANDS_PER_TABLE,
  PLAYED_EDGE,
  PLAYED_EDGE_SE,
} from '@/config/blackjackEdge'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'
import { HOUSE_RULES, houseRulesById } from '@/lib/blackjack/rules'

const post = BLOG_POSTS.find((p) => p.slug === 'blackjack-house-edge-hit-or-stand')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const millions = `${HANDS_PER_TABLE / 1_000_000} million`
const pct = (value: number, places = 2) => `${value.toFixed(places)}%`
const points = (value: number) => `${value.toFixed(2)} points`

export default function BlackjackEdgePost() {
  const friendly = houseRulesById('friendly')
  const standard = houseRulesById('standard')
  const brutal = houseRulesById('brutal')
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The numbers on the cards">
        <p>
          Pip’s Blackjack has two buttons, hit and stand. There is no doubling, no splitting and no
          surrender. Each of the three tables states its house edge on the card before you sit down,
          because a number you have to work out for yourself is a number somebody hoped you would
          not.
        </p>
        <p>
          So we played {millions} hands at each table, through the same code that deals them in the
          app, and counted what the house kept.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {HOUSE_RULES.map((house) => (
            <li key={house.id}>
              {house.name} ({house.blurb.replace(/\.$/, '').toLowerCase()}): the card said{' '}
              {EDGE_BEFORE[house.id]}%, the hands said {pct(PLAYED_EDGE[house.id])}.
            </li>
          ))}
        </ul>
        <p>
          Friendly was right. The other two were wrong, both by saying the house took more than it
          does, which is the less embarrassing way to be wrong. It is still wrong on the one screen
          whose whole point is the number, so the cards now say {standard.edgePercent}% and{' '}
          {brutal.edgePercent}%.
        </p>
      </Section>

      <Section title="What the rules are worth">
        <p>
          Friendly and Standard differ only in the shoe: one deck against six. That alone is worth{' '}
          {points(PLAYED_EDGE.standard - PLAYED_EDGE.friendly)} to you. Part of it is naturals: they
          come a little more often from one deck, and a natural is the only hand that pays more than
          evens.
        </p>
        <p>
          Brutal changes three things at once. Eight decks, the dealer hits a soft seventeen, and a
          natural pays six for five instead of three for two. Together they cost{' '}
          {points(PLAYED_EDGE.brutal - PLAYED_EDGE.standard)} more than Standard. Most of that is
          the six for five: a natural comes about once in twenty-one hands, and it now pays three
          tenths of a bet less each time.
        </p>
        <p>
          Every table here takes more than a casino table with the same shoe and payouts, because
          doubling and splitting are gone, and both were yours to use. We took them out to keep the
          game to one decision. The edge on the card is what that decision costs.
        </p>
      </Section>

      <Section title="How to play it">
        <p>
          With only hit and stand, the best play fits in a paragraph. Take a card on 11 or less.
          Stand on 17 or more. On 12, stand against a dealer 4, 5 or 6 and hit against anything
          else. On 13 to 16, stand against 2 to 6 and hit against 7 or higher. With an ace counted
          as eleven, hit 17 or less, hit 18 against a 9, a ten or an ace, and stand on 19 or more.
        </p>
        <p>
          If you know the usual chart, two things change. A hard 9, 10 or 11 you would double you
          now just hit, a soft 18 you would double against a 3 to 6 you stand on, and a pair is only
          its total. A pair of eights is a hard 16, and you hit it against a ten, grimly.
        </p>
        <p>
          That is the whole strategy the {millions} hands were played with. Play any other way and
          the house takes more than the card says.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          <Src path="scripts/blackjack-edge.ts" /> deals hands through Pip’s Blackjack engine,
          reshuffles where the app reshuffles, plays each one by the strategy above, and reports the
          share of each stake the house kept. It ran two separate seeds of 20 million hands a table.
          Each figure carries a standard error of about {PLAYED_EDGE_SE} points, so the first
          decimal is solid and the second is close.
        </p>
        <p>
          The strategy was worked out exactly for a shoe with no bottom, where every card is as
          likely as it was at the start. Over that endless shoe the same strategy loses{' '}
          {pct(ENDLESS_SHOE_EDGE.standsSoft17Pays3to2, 1)} at Standard’s rules and{' '}
          {pct(ENDLESS_SHOE_EDGE.hitsSoft17Pays6to5, 1)} at Brutal’s. A real shoe does slightly
          better for you than an endless one, which is why every dealt figure sits below these.
        </p>
        <p>
          The count takes three minutes and is not re-run by the test suite.{' '}
          <Src path="tests/blackjackEdge.test.ts" /> holds the part it can: each card states the
          edge its table played at, to one decimal, read from{' '}
          <Src path="src/lib/blackjack/rules.ts" />.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Blackjack is in the{' '}
          <Link
            href={`${membershipFor('blackjack')}&from=blog&post=blackjack-house-edge-hit-or-stand`}
            className={linkClass}
          >
            membership
          </Link>
          , with the {friendly.name}, {standard.name} and {brutal.name} tables and their edges on
          show before you pick one. The chips are play money and are never for sale. It is not
          poker, and it does not pretend to be.
        </p>
      </Section>
    </LegalPage>
  )
}
