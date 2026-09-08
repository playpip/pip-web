import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { Section } from '@/components/marketing/LegalPage'
import { SEVEN_CARD_HANDS } from '@/config/handFrequencies'
import { guideBySlug } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'
import {
  BOARD_SPOT,
  KICKER_SPOT,
  POCKET_PAIR_ROLES,
  POCKET_PAIR_SHAPES,
  RANK_SHAPES,
  THIRD_PAIR_IS_THE_KICKER,
  THREE_PAIR_HANDS,
  THREE_PAIR_RANK_SHAPES,
  type WorkedSpot,
  oneHandIn,
  roleShare,
  shapeShare,
} from '@/config/threePair'
import { SUIT_GLYPH, cardFromString } from '@/lib/poker/cards'

// The second answer page. Two Search Console queries, `three pair texas
// holdem` and `texas holdem 3 pair`, take impressions off /learn/hand-rankings
// on a partial match, and the phrase appears nowhere on the site. See
// marketing#124, which carries the stop rule: if a page written for exactly
// this query cannot beat position 73 in six weeks, no page we write will rank.

const guide = guideBySlug('three-pair-in-texas-holdem')!

export const metadata: Metadata = {
  title: `${guide.metaTitle} · Pip`,
  description: guide.description,
  alternates: contentAlternates(`/learn/${guide.slug}`),
  ...contentSocial({
    path: `/learn/${guide.slug}`,
    title: guide.metaTitle,
    description: guide.description,
  }),
}

const strong = 'font-medium text-foreground'

const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

/** '8♠ 8♦', from the same strings the test hands to the evaluator. */
function face(cards: readonly string[]): string {
  return cards
    .map(cardFromString)
    .map((card) => `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`)
    .join(' ')
}

function Spot({ spot }: { spot: WorkedSpot }) {
  return (
    <p className="text-md text-muted-foreground">
      <span className={strong}>You</span> {face(spot.hole)} <span aria-hidden>·</span>{' '}
      <span className={strong}>Board</span> {face(spot.board)} <span aria-hidden>·</span>{' '}
      <span className={strong}>Them</span> {face(spot.villain)}
    </p>
  )
}

export default function ThreePairAnswer() {
  const threePairRow = RANK_SHAPES.find((row) => row.pattern === '2-2-2-1')!
  const trips = RANK_SHAPES.find((row) => row.pattern.includes('3 or a 4'))!
  return (
    <GuidePage slug="three-pair-in-texas-holdem">
      <Lead>
        <p>
          <strong className={strong}>You can hold three pairs. You cannot play them.</strong> A
          poker hand is five cards, and three pairs are six, so the two highest pairs play and the
          third one is left outside with a fifth card to find.
        </p>
        <p>
          That much every site will tell you. What none of them says is what the third pair is worth
          on the way out, which is one card, one time in four, and nothing at all the rest of the
          time.
        </p>
      </Lead>

      <Section title="Three pairs and a spare, once every 54 hands">
        <p>
          By the river you can see seven cards, and there are{' '}
          {SEVEN_CARD_HANDS.toLocaleString('en-GB')} of those. Split them by how the ranks fall and
          three pairs is the rarest shape of the five:
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Your seven cards</th>
              <th scope="col">Holdings</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {RANK_SHAPES.map((row) => (
              <tr key={row.pattern}>
                <td>{row.shape}</td>
                <td className="whitespace-nowrap">{row.hands.toLocaleString('en-GB')}</td>
                <td className="whitespace-nowrap">{shapeShare(row.hands)}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          The counts add to {SEVEN_CARD_HANDS.toLocaleString('en-GB')}, which is the only check
          worth having on a table like this one. Three separate pairs is{' '}
          <strong className={strong}>{threePairRow.hands.toLocaleString('en-GB')}</strong> of them,
          or one holding in {oneHandIn(threePairRow.hands)}. Some rank turning up three or four
          times over is {trips.hands.toLocaleString('en-GB')}, which is more than four times as
          often. Three pairs is the rarer shape and the weaker hand.
        </p>
        <p>
          Rank is all this table sees. A straight or a flush is a claim about sequence and suit, so
          those sit inside the rows rather than beside them, and the{' '}
          <GuideLink slug="hand-rankings">hand rankings</GuideLink> are the place to read them off.
          The three-pair row is the one row where it cannot happen: four different ranks are one
          short of a straight, and three pairs and a spare cannot put five cards in one suit.
        </p>
      </Section>

      <Section title="The third pair is worth one card, one time in four">
        <p>
          Ignore suits and there are {THREE_PAIR_RANK_SHAPES.toLocaleString('en-GB')} ways to be
          dealt three paired ranks and a spare. Every one of them grades as two pair. The only thing
          left to decide is the fifth card, and it is the higher of your third pair and the spare.
        </p>
        <p>
          Your third pair wins that in{' '}
          <strong className={strong}>{THIRD_PAIR_IS_THE_KICKER}</strong> of the{' '}
          {THREE_PAIR_RANK_SHAPES.toLocaleString('en-GB')}, which is one in four on the nose. It has
          to be lower than two other pairs and still higher than the loose card, and with four ranks
          in play each of them is the low one equally often. The other card of that pair never plays
          at all, whatever falls.
        </p>
      </Section>

      <Section title="From the seat holding the pocket pair">
        <p>
          The version people actually meet is narrower: you were dealt a pair, the board came with
          two more on it, and now you are counting to three. There are{' '}
          {POCKET_PAIR_SHAPES.toLocaleString('en-GB')} ways for that to happen, and your own two
          cards end up in one of three places.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">What happens to your pair</th>
              <th scope="col">Cards of yours that play</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {POCKET_PAIR_ROLES.map((role) => (
              <tr key={role.cards}>
                <td>{role.role}</td>
                <td className="whitespace-nowrap">{role.cards}</td>
                <td className="whitespace-nowrap">{roleShare(role.shapes)}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          Two times in three the pair does its job. One time in twelve it is demoted to the kicker,
          which is still enough:
        </p>
        <Spot spot={KICKER_SPOT} />
        <p>
          You both have aces and kings. Your eight is the fifth card and theirs is a seven, so one
          pip decides it, and the second eight in your hand did nothing. That is the good outcome.
        </p>
        <p>
          One time in four your pair is lower than everything else on the table, and then it does
          not matter that you were dealt it:
        </p>
        <Spot spot={BOARD_SPOT} />
        <p>
          Aces, nines and a king, which is the board, which is also{' '}
          <strong className={strong}>their</strong> hand. The threes are not in it. Split pot, and
          the player holding {face(BOARD_SPOT.villain)} did as well as you did.
        </p>
        <p>
          None of which means a small pocket pair is a bad hand. It means the thing worth counting
          is your best five cards rather than how many pairs are on the table, and the two come
          apart most often when the board pairs up. Same distinction as{' '}
          <GuideLink slug="how-often-do-you-flop-a-set">flopping a set</GuideLink>: did my card come
          and what have I got are different questions.
        </p>
      </Section>

      <Section title="Where these numbers come from">
        <p>
          They are not quoted from anywhere.{' '}
          <Link
            href="https://github.com/playpip/pip-web/blob/main/tests/threePair.test.ts"
            className={link}
          >
            A test in the repo
          </Link>{' '}
          deals all {THREE_PAIR_RANK_SHAPES.toLocaleString('en-GB')} rank shapes and all 864 ways to
          suit one of them, hands each to the same evaluator that settles a real pot on Pip, and
          checks every count above. Both spots on this page go through it too, winner included.
        </p>
        <p>
          {THREE_PAIR_HANDS.toLocaleString('en-GB')} holdings is more than a test should sit
          through, so it walks the two dimensions separately rather than their product. That is
          exhaustive because suits cannot change the grade here, and the test pins that as well
          rather than taking it as read.
        </p>
        <p>
          One thing the table does not say. These are combinations, not hands you would play: a hand
          that folds on the flop never reaches seven cards, so the shares are how often the shape
          exists rather than how often you meet it.
        </p>
      </Section>

      <TryIt>
        <p>
          Three pair looks like a lot of poker and grades as one line. The quickest way to believe
          that is to be shown your best five cards by something that has no reason to flatter you.
        </p>
        <p>Free, no signup, nothing to install.</p>
      </TryIt>
    </GuidePage>
  )
}
