import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'
import { CELLS, SOLITAIRE_POINTS } from '@/lib/quick/solitaire'
import { starAt } from '@/lib/quick/solitairePuzzle'

const post = BLOG_POSTS.find((p) => p.slug === 'poker-solitaire-every-puzzle-solvable')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const table = SOLITAIRE_POINTS.map((row) => `${row.hand.toLowerCase()} ${row.points}`).join(', ')
const firstStar = starAt(1, 100)
const secondStar = starAt(2, 100)

export default function PokerSolitairePost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="Solitaire you can lose before you start">
        <p>
          Poker Solitaire is an old card game. You deal {CELLS} cards one at a time onto a five by
          five grid, each card stays where you put it, and when the grid is full every row and every
          column is a poker hand. Pip scores them on the American table: {table}. A better hand
          always scores more, so nobody has to learn a second ranking.
        </p>
        <p>
          Dealt one at a time, it is mostly luck. You place the seventh card without knowing the
          eighth, and some deals are worth far less than others before you place a card. That is
          fine for a round on the bus. It is no good for a puzzle that everyone plays on the same
          day, where a bad deal is just a bad day for everybody.
        </p>
      </Section>

      <Section title="The puzzle">
        <p>
          So the Puzzle takes the luck out. All {CELLS} cards start on the grid, face up. Tap one to
          pick it up, tap another to swap them, and keep going until the ten lines make the target.
          The Daily puzzle is the same cards and the same target for everyone that day.
        </p>
        <p>
          Every puzzle can be solved. Before it reaches you, Pip arranges the same {CELLS} cards
          itself and keeps its grid. The target is 90% of what that grid scored, rounded down to a
          five. So a grid that makes the target exists, and Pip has already seen it. You get one
          star at {firstStar}% of the target, two at {secondStar}%, and three when you make it.
        </p>
      </Section>

      <Section title="How Pip finds its grid">
        <p>
          It swaps two cards at random and keeps the swap if the score went up. Sometimes it keeps a
          swap that made things worse, which sounds wrong but stops it settling on a grid that only
          looks finished. It does that less and less as it goes, and runs through the whole thing
          three times. The method is called simulated annealing, after the way metal is cooled
          slowly so it sets without weak spots.
        </p>
        <p>That does not find the best grid there is. It finds a good one, quickly, on a phone.</p>
      </Section>

      <Section title="How good is a good one">
        <p>
          We dealt every Daily puzzle from 1 January to 31 December 2027, which is possible because
          each day’s cards come from its date. Then we ran a second search on each one, the same
          method with more than five times as many swaps and a different seed.
        </p>
        <p>
          The longer search beat Pip’s grid on 178 of the 365 days, by between 1 and 36 points. It
          fell short of Pip’s grid on 11. So Pip’s grid is often not the best one, and the target is
          90% of a good grid rather than a perfect one. That is on purpose. Matching the best grid
          exactly would be a chore. Ninety per cent of a good one takes some thought and gets
          finished.
        </p>
        <p>
          Over the year, the cards as they first lie on the grid scored 0 to 47 (half the days 13 or
          less). Pip’s grids scored 140 to 370, and the targets ran from 125 to 330, with half the
          days at 185 or less.
        </p>
      </Section>

      <Section title="Where to play it">
        <p>
          Poker Solitaire is one of the{' '}
          <Link href="/game/quick/solitaire" className={linkClass}>
            quick games
          </Link>
          , dealt one at a time or as the Puzzle. The quick games come with the{' '}
          <Link
            href={`${membershipFor('quick-games')}&from=blog&post=${post.slug}`}
            className={linkClass}
          >
            membership
          </Link>
          , and without it you get one free round of each a day. Your best is yours alone. There is
          no leaderboard, and nothing touches your Roll.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          The rules and the scoring table are <Src path="src/lib/quick/solitaire.ts" />, and the
          puzzle, the target and Pip’s search are <Src path="src/lib/quick/solitairePuzzle.ts" />.
          The year of Daily puzzles and the longer search are{' '}
          <Src path="scripts/solitaire-targets.ts" />, run on 10 November 2026. The scoring table
          and the stars on this page come from the code at build time. The other figures are from
          that run, and the same dates give the same cards, so anyone can run it again.
        </p>
      </Section>
    </LegalPage>
  )
}
