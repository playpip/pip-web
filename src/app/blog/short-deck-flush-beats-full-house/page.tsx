import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'short-deck-flush-beats-full-house')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function ShortDeckFlushPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The rule">
        <p>
          Short Deck is Hold’em with the deuces, threes, fours and fives taken out. Thirty-six cards
          are left, and two rules come with them: a flush beats a full house, and the ace can play
          low under the six, so A-6-7-8-9 is a straight.
        </p>
        <p>
          The first one sounds like a house rule somebody lost an argument over. It is arithmetic.
          Poker ranks hands by how hard they are to make, and on a short deck the flush is the
          harder one.
        </p>
      </Section>

      <Section title="Counting them">
        <p>
          A full deck deals 2,598,960 different five-card hands. The standard counts are 5,108
          flushes and 3,744 full houses, so the flush is the more common hand and ranks below.
        </p>
        <p>
          A short deck deals 376,992. Of those, 480 are flushes and 1,728 are full houses. Same
          question, other answer.
        </p>
        <p>
          We did not look these up. <Src path="tests/shortDeckCounts.test.ts" /> deals every one of
          the 376,992 through the evaluator that settles Pip’s Short Deck pots, and fails if a count
          moves. It also checks that on five cards, from a pair upwards, every hand in the order is
          rarer than the one below it.
        </p>
      </Section>

      <Section title="Why the deck does it">
        <p>
          A flush needs five cards of one suit. A suit used to have thirteen cards and now has nine,
          so the ways to pick five from it fall from 1,287 to 126. A full house needs ranks, and
          every rank left in the deck still has all four of its cards. Stripping the deck costs the
          full house some company. It costs the flush most of its options.
        </p>
      </Section>

      <Section title="Seven cards say the same">
        <p>
          In Hold’em you play the best five of seven, so we counted those too: all 8,347,680
          seven-card hands on a short deck. 633,024 end as a full house and 175,560 as a flush. The
          flush is still the rarer hand.
        </p>
        <p>
          The same count found 233,100 that end as nothing at all. On a short deck, seven cards make
          a full house more often than they make high card. Two pair turns up more often than one
          pair. It is not a game for anybody who enjoys folding.
        </p>
        <p>
          That run takes minutes rather than a second, too long for the test suite, so the
          seven-card counts are not pinned by a test the way the five-card ones are.
        </p>
      </Section>

      <Section title="Where rarity stops">
        <p>
          The order does not follow rarity all the way. It stops at the bottom: on five short-deck
          cards, nothing at all (122,400 hands) is rarer than a pair (193,536), and nobody has
          proposed ranking nothing above a pair.
        </p>
        <p>
          It wobbles in the middle too. On five cards a straight is rarer than three of a kind,
          6,120 to 16,128. On seven it is not: 1,169,940 straights against 607,200 sets of trips. In
          Pip the straight still wins.
        </p>
        <p>
          Some rooms swap the two for exactly that reason. Pip plays the Triton rules, which is what
          most players mean by Short Deck: flush over full house, the ace low under the six, and
          everything else in the usual order. <Src path="src/lib/poker/shortDeck.ts" /> says which
          rule set it picked, because choosing quietly between two real rule sets is how a showdown
          ships wrong.
        </p>
      </Section>

      <Section title="The ace plays low">
        <p>
          With the deuce through five gone, the lowest straight is A-6-7-8-9, the ace standing in
          below the six. It is a nine-high straight, not an ace-high one, and the difference is a
          pot: scored as ace high it would beat the ten-high straight it loses to.
        </p>
        <p>
          The hand library we use for Hold’em reads A-6-7-8-9 as ace high and nothing else, and puts
          a full house over a flush, without mentioning either. It is the same library we have{' '}
          <Link href="/blog/pokersolver-undocumented" className={linkClass}>
            written about before
          </Link>
          . So Short Deck has its own evaluator, and <Src path="tests/shortDeck.test.ts" /> holds
          both rules, including a check that a short-deck hand is never handed to the library.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Short Deck is one of the side tables in the{' '}
          <Link href={`${membershipFor('shortdeck')}&from=blog`} className={linkClass}>
            membership
          </Link>
          , at three stakes. The ladder, the Rail, the Daily and the freeroll stay free. So did the
          arithmetic.
        </p>
      </Section>
    </LegalPage>
  )
}
