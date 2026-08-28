import type { Metadata } from 'next'
import { A, Item, LegalPage, List, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import {
  formatCards,
  README_TOSTRING_QUOTE,
  SOLVER_VERSION,
  solverCase,
} from '@/config/pokersolverQuirks'

const post = BLOG_POSTS.find((p) => p.slug === 'pokersolver-undocumented')!

export const metadata: Metadata = postMetadata(post)

/** One worked case: what went in, what came back. */
function Case({ id, note }: { id: string; note?: string }) {
  const c = solverCase(id)
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <code>Hand.solve([{c.input.map((card) => `'${card}'`).join(', ')}])</code>
      </p>
      <p className="mt-2 text-xs leading-relaxed">
        <code>
          cards &rarr; {formatCards(c.cards)} ({c.cards.length})
        </code>
        <br />
        <code>name &rarr; {c.name}</code>
        <br />
        <code>descr &rarr; {c.descr}</code>
      </p>
      {note && <p className="mt-2 text-muted-foreground text-xs leading-relaxed">{note}</p>}
    </div>
  )
}

export default function PokersolverUndocumentedPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="Why this page exists">
        <p>
          Pip does not have its own hand evaluator. Ranking the best five cards out of seven, with
          kickers, is a solved problem with sharp edges, so we hand it to{' '}
          <A href="https://github.com/goldfire/pokersolver">pokersolver</A> and wrap the result.
          That wrapper is about sixty lines, and writing it meant finding out what the library does
          when the README stops describing it.
        </p>
        <p>
          There are five of those. We hit all five. Four of them have been asked about on the
          library&rsquo;s own issue tracker and left unanswered for between three and six years, so
          as far as we can tell there is nowhere to look them up. This is that place. Everything
          below was produced by running <code>pokersolver@{SOLVER_VERSION}</code>, and a test in our
          repository re-runs every case on every build, so if the library changes this page fails
          before it lies.
        </p>
        <p>
          None of this is a complaint. The library is good, it is free, it is doing the hard part,
          and it has not needed a release in years, which is usually a compliment.
        </p>
      </Section>

      <Section title="1. cards can hand you seven cards for a five-card hand">
        <p>
          The obvious reading of <code>hand.cards</code> is that it holds the five cards that make
          the hand. It holds every card that qualified. Six hearts in, six hearts back.
        </p>
        <Case id="flush-six" />
        <p>Seven hearts in, seven back.</p>
        <Case id="flush-seven" />
        <p>
          This is the one place the README is not merely quiet but wrong, and it is wrong about the
          string rather than the array. It documents <code>toString()</code> as:
        </p>
        <p>
          <em>&ldquo;{README_TOSTRING_QUOTE}&rdquo;</em>
        </p>
        <p>
          On the seven-card flush above, <code>toString()</code> returns seven. If you are drawing a
          board from that string, that is two cards you did not budget for.
        </p>
      </Section>

      <Section title="2. A full house does it too, and it is easier to miss">
        <p>
          A flush overflowing is at least visible in a suit. A full house does it when two different
          ranks both make trips, which is rare enough that a test suite written from the README will
          not contain one.
        </p>
        <Case id="boat-six" note="Six cards, and the description is right: aces full of kings." />
        <p>
          The categories that can overflow are flushes and full houses. Straights and straight
          flushes cannot, because a sixth card in sequence makes a different, higher straight rather
          than joining the one you have.
        </p>
        <Case id="straight-flush-long" />
      </Section>

      <Section title="3. An ace playing low comes back as a card with the value 1">
        <p>
          In a five-high straight the ace is the bottom card, and the library represents that
          literally: the returned card&rsquo;s value is the string <code>&apos;1&apos;</code>, and
          its rank is 0, below the deuce.
        </p>
        <Case
          id="wheel"
          note="The suit is intact. It is still the ace of hearts, still in the hand, and only the value is rewritten."
        />
        <p>
          It is the right internal choice and the wrong external one, because{' '}
          <code>&apos;1&apos;</code> is not a card and any lookup keyed on rank will miss it. If you
          render the returned cards, you have to map it back. We do, in one line, and it took a
          wrong-looking table to notice.
        </p>
      </Section>

      <Section title="4. The overflow keeps the solver's order, so the first five are the hand">
        <p>
          This is the behaviour that makes the other two survivable, and it is not written down
          anywhere, which is a shame because it is the useful one. The array is not sorted by rank.
          It is the cards that make the hand, in descending order, then the kickers, in descending
          order. So taking the first five is always correct, even when there are seven.
        </p>
        <p>
          The case that proves it is a full house whose trips are lower than its pair, because
          sorting by rank would put the aces first:
        </p>
        <Case id="boat-low-trips" note="Trips first, despite being threes against aces." />
        <p>
          Our whole handling of the overflow is <code>cards.slice(0, 5)</code> on the strength of
          that. It has been right in every case we have run, and it is the sort of thing that would
          break quietly in a minor version, so it now has a test rather than a comment.
        </p>
      </Section>

      <Section title="5. A royal flush is named &ldquo;Straight Flush&rdquo;">
        <p>
          <code>name</code> is the category, and a royal flush is not a separate category, so it
          comes back as a straight flush. Only <code>descr</code> says the words.
        </p>
        <Case id="royal" />
        <p>
          If you switch on <code>name</code> to pick a celebration, the best hand in poker gets the
          second-best one&rsquo;s. Two issues on the tracker are people finding this, in 2019 and in
          2021. Both were answered by other users.
        </p>
        <p>
          Note the ten as well: a ten goes in as <code>T</code> and comes back as <code>10</code>.
          Round-tripping a card through the solver does not give you the string you started with.
        </p>
      </Section>

      <Section title="One thing that is documented badly and works properly">
        <p>
          The most-discussed question on the tracker is how to tell which player won, given{' '}
          <code>Hand.winners</code> returns hands rather than seats. The accepted answer, and the
          most-upvoted comment on the repository, is to attach an index to each hand object before
          passing it in and read it back off the winner.
        </p>
        <p>
          That works, and it is not necessary. <code>Hand.winners</code> returns the same objects it
          was given, so a <code>Set</code> of the returned hands answers &ldquo;did this player
          win&rdquo; by identity, with nothing mutated and nothing to keep in sync:
        </p>
        <pre className="-mx-6 mt-4 overflow-x-auto px-6 md:mx-0 md:rounded-2xl md:border md:border-foreground/10 md:bg-foreground/[0.03] md:px-4 md:py-3">
          <code className="text-muted-foreground text-xs leading-relaxed">{`const solved = new Map(players.map((p) => [p, Hand.solve(cardsFor(p))]))
const won = new Set(Hand.winners([...solved.values()]))

const winners = players.filter((p) => won.has(solved.get(p)))`}</code>
        </pre>
        <p>
          That identity guarantee is not in the README either, which is presumably why the hack is
          the accepted answer. It is the one behaviour here we depend on without being able to see
          it, so it has a test too.
        </p>
      </Section>

      <Section title="What this page is not">
        <List>
          <Item>
            It is not a bug report. Four of these are omissions in a README, and the fifth is one
            sentence about <code>toString()</code>. The code does something defensible in every
            case.
          </Item>
          <Item>
            It is not a fork or a replacement. We use the library, unmodified, at the version named
            above.
          </Item>
          <Item>
            It is not exhaustive. It is what a hold&rsquo;em client hits. The library also deals pai
            gow, wild cards and five of a kind, none of which we touch, and there may well be more
            edges in there.
          </Item>
        </List>
        <p>
          If you found this because your flush had six cards in it: yes, that is meant to happen,
          take the first five, and the ace in your wheel is the one labelled 1.
        </p>
      </Section>
    </LegalPage>
  )
}
