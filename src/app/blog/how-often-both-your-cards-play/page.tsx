import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { SEVEN_CARD_HANDS } from '@/config/handFrequencies'
import { membershipFor } from '@/config/membership'
import {
  BOARD_STRAIGHT,
  BOTH_FOR_A_STRAIGHT,
  DEALS,
  HOLE_CARDS_PLAYING,
  ONE_CARD_FLUSH,
  THIRD_PAIR,
  TIED_FIVES,
  TIED_FIVES_TOTAL,
  TWO_RIGHT_FIVES,
  type WorkedHand,
} from '@/config/whichFivePlay'
import { cardFromString, SUIT_GLYPH } from '@/lib/poker/cards'

const post = BLOG_POSTS.find((p) => p.slug === 'how-often-both-your-cards-play')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const n = (count: number) => count.toLocaleString('en-GB')

function face(cards: readonly string[]): string {
  return cards
    .map(cardFromString)
    .map((card) => `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`)
    .join(' ')
}

function Hand({ hand }: { hand: WorkedHand }) {
  return (
    <p className="text-foreground">
      You {face(hand.hole)} <span aria-hidden>·</span> Board {face(hand.board)}
    </p>
  )
}

export default function BothYourCardsPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The count">
        <p>
          In Hold’em you hold two cards, the board shows five, and your hand is the best five of the
          seven. Nobody makes you say which five. So we counted how often your own two make it in.
        </p>
        <p>
          Every way to deal two hole cards and a five-card board from one deck is {n(DEALS)} deals.
          For each one we took the best hand you can make and asked which of your cards it needs:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Both of them: {n(HOLE_CARDS_PLAYING.both)}.</li>
          <li>One of them, either will do or only one helps: {n(HOLE_CARDS_PLAYING.one)}.</li>
          <li>Neither, because the board alone is as good: {n(HOLE_CARDS_PLAYING.board)}.</li>
        </ul>
        <p>
          So both your cards play in a little under half of all deals, and one card does the work
          slightly more often than two. In about one deal in twenty, your cards play no part at all.
        </p>
        <p>
          These are deals to the river with nobody folding. Real hands fold, and the ones that get
          to a showdown are not a random sample. It is a count of what the cards can do, not of what
          players do with them.
        </p>
      </Section>

      <Section title="When the board plays">
        <Hand hand={BOARD_STRAIGHT} />
        <p>
          You have a straight. So does everybody else still in the hand. Your eight makes a straight
          too, just a worse one, so it sits out. When the board is your best hand, every other
          player has at least the board as well, and the most you can win is a share.
        </p>
        <Hand hand={THIRD_PAIR} />
        <p>
          A pocket pair that does nothing. Aces and kings on the board, the queen as the kicker, and
          your threes are the third pair, which a hand of five has no room for.{' '}
          <Link href="/learn/three-pair-in-texas-holdem" className={linkClass}>
            Three pair
          </Link>{' '}
          has a page of its own.
        </p>
      </Section>

      <Section title="When one card does it">
        <Hand hand={ONE_CARD_FLUSH} />
        <p>
          Four hearts on the board and the ace of hearts in your hand: an ace-high flush. The seven
          of clubs does not come into it. Swap it for any card but a heart and the hand is the same.
        </p>
        <Hand hand={BOTH_FOR_A_STRAIGHT} />
        <p>
          Here it takes both. Eight, nine and ten on the board, the six and seven in your hand, and
          neither card makes the straight without the other.
        </p>
      </Section>

      <Section title="More than one right answer">
        <Hand hand={TWO_RIGHT_FIVES} />
        <p>
          The king makes a nine-to-king straight, and there are two nines to start it with, yours
          and the board’s. Both fives are the same hand. Neither is more right than the other.
        </p>
        <p>
          Seven cards can be cut down to five in twenty-one ways, and usually one way is best. Of
          the {n(SEVEN_CARD_HANDS)} possible sets of seven, {n(TIED_FIVES_TOTAL)} have two or more
          that tie, about one in {(SEVEN_CARD_HANDS / TIED_FIVES_TOTAL).toFixed(0)}. Most of them,{' '}
          {n(TIED_FIVES.straight)}, are straights with a pair inside them like this one. Another{' '}
          {n(TIED_FIVES.twoPair)} are three pair where the third pair is also the best kicker, so
          either card of it will do. The last {n(TIED_FIVES.fullHouse + TIED_FIVES.quads)} are full
          houses and fours of a kind with a spare card to choose between.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          A short program dealt all {n(SEVEN_CARD_HANDS)} sets of seven and split each one every way
          it can be split into two hole cards and a board, which takes about a minute. It ranks
          hands with an evaluator of its own, written for speed, so it is not the code that settles
          Pip’s pots. Two checks tie it to that code. Its count of each hand type over seven cards
          matches the standard table exactly. And 400,000 random deals through Pip’s evaluator came
          out at 19,568 board, 191,959 one card and 188,473 both, against 19,566, 191,832 and
          188,602 expected from the full count.
        </p>
        <p>
          The full count is too slow for the test suite and is not pinned by it.{' '}
          <Src path="tests/whichFivePlay.test.ts" /> holds the rest: the three rows add up to every
          deal, and each hand in this post plays the cards it says it does, by Pip’s evaluator.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          <em>Which five play?</em> is a drill: seven cards, tap the five that count. It is graded
          by ranking all twenty-one fives, so when two tie, either one is right. It is in the{' '}
          <Link
            href={`${membershipFor('drills')}&drill=which-five-play&from=blog`}
            className={linkClass}
          >
            membership
          </Link>
          . <em>What have you got?</em>, which asks you to name the hand rather than point at it,
          stays free for everyone, as does <em>Which hand wins?</em>
        </p>
      </Section>
    </LegalPage>
  )
}
