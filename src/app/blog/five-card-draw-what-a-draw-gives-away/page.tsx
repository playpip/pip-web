import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'five-card-draw-what-a-draw-gives-away')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function FiveCardDrawPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The only tell">
        <p>
          In Five-Card Draw nobody shows a card until the end. There is no board. The one thing you
          learn about anybody’s hand is how many cards they asked for.
        </p>
        <p>
          At Pip’s Draw tables, The Parlour, the regulars all decide what to throw by the same short
          rule, <Src path="src/lib/poker/ai/draw.ts" />. A fixed rule turns that number into a read.
          So we dealt every one of the 2,598,960 five-card hands through it and counted what each
          number means.
        </p>
      </Section>

      <Section title="None: they have it">
        <p>
          A regular stands pat on a straight or better and on nothing else. That is 19,716 deals,
          about one in 132. No regular stands pat on a bluff, so when one does, believe it.
        </p>
      </Section>

      <Section title="One: two pair, or a draw">
        <p>
          One card covers three different hands. Two pair throws its odd card: 123,552 deals. Four
          to a flush throws the fifth: 110,940, and 34,320 of those broke up a pair to do it. Four
          in a row throws the fifth too: 60,480.
        </p>
        <p>
          So we dealt the card too: every one of the 47 left, for each of those deals. A little over
          one in seven ends with a straight or better, the full houses included. About one in three
          ends with nothing at all, not even a pair. Two pair is still the likeliest thing to come
          over at the end. One card deserves some respect. Not a lot.
        </p>
      </Section>

      <Section title="Two: three of a kind, every time">
        <p>
          Only trips draw two. 54,912 deals, and nothing else in the rule asks for two. Of all the
          numbers it is the one that tells you exactly what you are up against.
        </p>
      </Section>

      <Section title="Three: a pair">
        <p>
          The common one, 1,057,224 deals, about four in ten. The rule keeps any pair, deuces
          included, and throws the rest. Even a pair of twos beats drawing four to an ace, which is
          what the next number is.
        </p>
      </Section>

      <Section title="Four and five: nothing">
        <p>
          Four cards means an ace and nothing to go with it: 466,560 deals. Five means not even
          that: 698,880, more than one deal in four. A regular holding K-Q-8-6-3 throws the lot.
        </p>
      </Section>

      <Section title="The one coin flip">
        <p>
          A pair at the end of four in a row, say 5-6-7-8-8, could go either way. The rule keeps the
          run and draws one 35 times in 100, and keeps the pair and draws three otherwise. It comes
          up in 6,696 deals, and it is the only spot where the number can mislead you.
        </p>
      </Section>

      <Section title="What it does not chase">
        <p>
          An ace closes a straight at one end. J-Q-K-A fills only with a ten and A-2-3-4 only with a
          five, four cards rather than the eight that fill 8-9-T-J. The rule chases neither. It
          keeps the ace and asks for four.
        </p>
        <p>
          It also misses a pair in the middle of the run. Holding 5-6-6-7-8, it does not see the
          four in a row, keeps the sixes and draws three.
        </p>
        <p>
          <Src path="tests/draw.test.ts" /> holds the rule itself, a hand for each number from
          standing pat to throwing all five. The counts come from one run over every deal, which
          takes too long for the test suite, so they are not pinned the way the rule is.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          The Parlour is one of the side tables in the{' '}
          <Link href={`${membershipFor('draw')}&from=blog`} className={linkClass}>
            membership
          </Link>
          , at two stakes. The page that link opens deals one hand through the draw first, each side
          throwing by the same rule. The ladder, the Rail, the Daily and the freeroll stay free.
        </p>
      </Section>
    </LegalPage>
  )
}
