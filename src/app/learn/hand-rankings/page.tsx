import type { Metadata } from 'next'
import { AceRuns } from '@/components/learn/AceRuns'
import { GuideChart, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { WhoWins } from '@/components/learn/WhoWins'
import { Section } from '@/components/marketing/LegalPage'
import { HAND_FREQUENCIES, formatShare, sevenCardShare } from '@/config/handFrequencies'
import { guideBySlug, guideCardImage } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'

const guide = guideBySlug('hand-rankings')!

export const metadata: Metadata = {
  title: `${guide.metaTitle} · Pip`,
  description: guide.description,
  alternates: contentAlternates(`/learn/${guide.slug}`),
  ...contentSocial({
    path: `/learn/${guide.slug}`,
    title: guide.metaTitle,
    description: guide.description,
    image: guideCardImage(guide),
  }),
}

const strong = 'font-medium text-foreground'

export default function HandRankingsGuide() {
  return (
    <GuidePage slug="hand-rankings">
      <Lead>
        <p>
          There are ten poker hands. Strongest to weakest: royal flush, straight flush, four of a
          kind, full house, flush, straight, three of a kind, two pair, one pair, high card. In
          Texas Hold’em you make the best five-card hand you can from your two cards and the five on
          the table, and suits never break a tie.
        </p>
        <p>
          That’s the answer. The rest of this page is the detail you need the first few times, and
          one table worth keeping.
        </p>
      </Lead>

      <Section title="The ten hands, strongest first">
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Hand</th>
              <th scope="col">What it is</th>
              <th scope="col">Example</th>
            </tr>
          </thead>
          <tbody>
            {HAND_FREQUENCIES.map((row) => (
              <tr key={row.hand}>
                <td>{row.n}</td>
                <td className={`whitespace-nowrap ${strong}`}>{row.hand}</td>
                <td>{row.what}</td>
                <td className="whitespace-nowrap">{row.example}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        {/* Directly under the table it draws, so the two are read as one
            thing. It is also the asset most likely to be reposted, which is
            the argument for it sitting high on the page rather than at the
            foot where a screenshot would miss it. */}
        <GuideChart slug="hand-rankings" />
        <p>
          The order is not arbitrary.{' '}
          <strong className={strong}>
            Every hand beats the one below it because it is rarer than the one below it
          </strong>
          , counted over five cards, and on five cards that holds exactly, all the way down the
          list. If you ever forget whether a flush beats a straight, the question you’re really
          asking is which one is harder to make. It’s the flush.
        </p>
        <p>
          Deal seven cards instead of five, which is what Hold’em does, and the rule breaks in
          exactly one place. It is at the bottom of the list, it is the most useful thing on this
          page, and it has its own paragraph further down.
        </p>
      </Section>

      <Section title="How ties are settled">
        <p>Two players can easily make “the same” hand. Three rules settle almost every case.</p>
        <p>
          <strong className={strong}>Rank first.</strong> A pair of kings beats a pair of nines.
          Three queens beat three sevens. Compare the part of the hand that names it before anything
          else.
        </p>
        <p>
          <strong className={strong}>Then kickers.</strong> If the named part ties, the remaining
          cards decide, highest first. A-K against A-Q, on a board of A-8-5-3-2, is a pair of aces
          each. The king plays and wins. Kickers are where most beginner pots are quietly lost, and
          they’re the main reason ace-rag is a worse hand than it looks.
        </p>
        <p>
          <strong className={strong}>Suits never break a tie.</strong> There is no suit order in
          Texas Hold’em. If two hands are genuinely identical, the pot is split. This surprises
          people who’ve played other card games, so it’s worth saying flatly: a heart flush and a
          spade flush of the same ranks are the same hand.
        </p>
      </Section>

      <Section title="Two things that catch people out">
        <p>
          <strong className={strong}>
            The ace plays high and low, but never round the corner.
          </strong>{' '}
          A-K-Q-J-10 is the highest straight. A-2-3-4-5 is the lowest, and it’s the only straight
          where the ace counts as a one. Q-K-A-2-3 is not a straight at all. Nothing wraps.
        </p>
        {/* Sits with its own paragraph: read as prose the three runs all look
            equally plausible, and seeing them side by side is the argument. */}
        <AceRuns />
        <p>
          <strong className={strong}>Your best five cards might not include your cards.</strong> You
          make the best five from the seven available, and sometimes all five of those are on the
          table. If the board is A-K-Q-J-10 with no flush possible, everyone still in the hand has
          the same straight and the pot is split, no matter what they’re holding. Beginners often
          fold in that spot thinking they’ve lost.
        </p>
      </Section>

      {/* Sits here because by this point the reader has the order, the tie
          rules and the board-plays case, which is what the three examples
          turn on. */}
      <WhoWins />

      <Section title="How often each hand actually turns up">
        <p>
          Here is the part most rankings pages leave out, and it’s the part that changes how you
          play.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Hand</th>
              <th scope="col">Chance of making it by the river</th>
            </tr>
          </thead>
          <tbody>
            {HAND_FREQUENCIES.map((row) => (
              <tr key={row.hand}>
                <td className={`whitespace-nowrap ${strong}`}>{row.hand}</td>
                <td>{formatShare(sevenCardShare(row.hand))}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            Read that honestly: these are the odds for seven random cards, not for hands that reach
            a showdown.
          </strong>{' '}
          Real play is not random, because people fold. But the shape of the table is the useful
          bit, and the shape says three things.
        </p>
        <p>
          <strong className={strong}>A single pair is a real hand.</strong> Nearly half of all
          seven-card holdings end up as exactly one pair, and pairs win an enormous number of pots.
          New players routinely fold winners because a pair “doesn’t feel like enough”. It usually
          is.
        </p>
        <p>
          <strong className={strong}>
            One pair is commoner than no pair at all, which is the one place the ranking’s own logic
            turns over.
          </strong>{' '}
          One pair beats high card because on five cards it is rarer. Deal seven and it stops being
          rarer, because missing every pair across seven cards is harder than hitting one: high card
          arrives {formatShare(sevenCardShare('High card'))}% of the time and one pair{' '}
          {formatShare(sevenCardShare('One pair'))}%. The order above is not wrong, it is settled on
          five cards and this table is seven. What it means at a table is that having nothing is
          rarer, and worse, than a rankings chart makes it look.
        </p>
        <p>
          <strong className={strong}>
            The big hands are rare enough that waiting for them is not a strategy.
          </strong>{' '}
          A full house or better turns up under three times in a hundred. If your plan is to fold
          until you’re dealt something spectacular, the blinds will take your chips long before the
          cards do.
        </p>
      </Section>

      <Section title="The folk names">
        <p>
          Poker has an old habit of naming starting hands. Pocket aces are Pocket Rockets. Ace-king
          is Big Slick. Two eights are Snowmen. Seven-two offsuit, the worst hand in Hold’em, is The
          Hammer.
        </p>
        <p>
          None of this affects what beats what. It’s just the culture the game carries around with
          it, and it’s genuinely useful for talking about hands out loud. Pip whispers the name when
          you’re dealt one, which is a nicer way to learn them than a list.
        </p>
      </Section>

      <TryIt>
        <p>
          Reading a rankings table gets you to the point where you recognise the hands. Playing gets
          you to the point where you see them coming. That second part only happens at a table.
        </p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser, against opponents that
          actually play. No account needed, nothing to install, no money involved anywhere and none
          to spend. The hand strength is shown as you go, so the rankings stop being something you
          look up and start being something you know.
        </p>
      </TryIt>
    </GuidePage>
  )
}
