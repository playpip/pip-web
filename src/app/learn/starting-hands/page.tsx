import type { Metadata } from 'next'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { ReuseChart } from '@/components/learn/ReuseChart'
import { StartingHandChart } from '@/components/learn/StartingHandChart'
import { Section } from '@/components/marketing/LegalPage'
import { guideBySlug, guideCardImage } from '@/config/learn'
import { contentAlternates, contentSocial } from '@/config/site'
import {
  FLUSH_BY_THE_RIVER,
  POCKET_PAIRS,
  SET_OR_BETTER_ON_THE_FLOP,
  SUITED_MATCHUPS,
  cumulativeShare,
  groupOdds,
} from '@/config/startingHands'

const guide = guideBySlug('starting-hands')!

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

// Quoted in the sentence under the chart. Derived from the same lists the grid
// is drawn from, so editing a band moves both at once or neither.
const SHARE = {
  any: Math.round(cumulativeShare('any')),
  middle: Math.round(cumulativeShare('middle')),
  late: Math.round(cumulativeShare('late')),
}

// The suited row, then the offsuit one, and the note beside the offsuit row is
// the difference between the two cells above it rather than a typed 3.4, so a
// change to either equity moves the note with it.
const SUITED_PREMIUM = SUITED_MATCHUPS.flatMap(({ cards, against, equity }) =>
  cards.map((hand, i) => ({
    hand: `${hand} against ${against}`,
    equity: `${equity[i].toFixed(1)}%`,
    note: i === 0 ? '' : `${(equity[0] - equity[i]).toFixed(1)} points for the suits`,
  })),
)

// Named as the cells they cover rather than as five typed percentages. Both
// figures in each row fall out of the combination counts, and those have to add
// to 1,326 across the whole grid, which is a test. A typed 5.88% is a promise.
const DEALT_GROUPS: { what: string; hands: readonly string[]; suffix?: string }[] = [
  { what: 'Any pocket pair', hands: POCKET_PAIRS, suffix: ' hands' },
  { what: 'Aces, kings or queens', hands: ['AA', 'KK', 'QQ'] },
  { what: 'Ace-king, suited or not', hands: ['AKs', 'AKo'] },
  { what: 'A named pair, say aces', hands: ['AA'] },
  { what: 'A named suited hand, say ace-king suited', hands: ['AKs'] },
]

const DEALT = DEALT_GROUPS.map(({ what, hands, suffix }) => {
  const { pct, oneIn } = groupOdds(hands)
  return { what, pct: `${pct.toFixed(2)}%`, roughly: `1 in ${oneIn}${suffix ?? ''}` }
})

// The three figures the prose quotes in its own sentences, same rule.
const PAIR_PCT = groupOdds(POCKET_PAIRS).pct.toFixed(1)
const SET_PCT = (SET_OR_BETTER_ON_THE_FLOP * 100).toFixed(1)
const FLUSH_PCT = (FLUSH_BY_THE_RIVER * 100).toFixed(1)

const strong = 'font-medium text-foreground'

export default function StartingHandsGuide() {
  return (
    <GuidePage slug="starting-hands">
      <Lead>
        <p>
          Play about one hand in seven when you are first to act, and about two in five when you are
          last. There are 169 distinct starting hands in Texas Hold’em and most of them are not
          worth playing, but which ones qualify depends on where you are sitting, because acting
          last is worth more than almost any pair of cards.
        </p>
        <p>
          That is the answer, and it is why the chart below is arranged by position rather than by
          strength. Most starting-hand charts tell you <em>what</em> to play. The useful question is{' '}
          <em>when</em>.
        </p>
      </Lead>

      <Section title="The chart">
        <p>
          The action has folded to you and you are deciding whether to come in. Find your two cards,
          and the colour and symbol tell you the earliest seat you should open them from. Tap any
          hand for the detail.
        </p>
        <p>Suited hands are above the diagonal, pairs are on it, offsuit hands are below.</p>
        <StartingHandChart />
        <p>
          That works out at{' '}
          <strong className={strong}>
            {SHARE.any}% of hands from early position, {SHARE.middle}% from the middle, and{' '}
            {SHARE.late}% from the button.
          </strong>{' '}
          The set roughly triples between the first seat and the last, and the cards did not change.
          Your seat did.
        </p>
        <p>
          <strong className={strong}>Read this chart as a floor, not a law.</strong> It assumes
          nobody has raised in front of you, a six-handed table and stacks of a normal depth. It is
          a conventional beginner range rather than anything solved, and any strong player would
          adjust it constantly. It is a good place to start and a bad place to stay.
        </p>
      </Section>

      <Section title="Why position changes the answer at all">
        <p>
          You are not being asked to guess whether your two cards are good. You are being asked
          whether they will still be good after four rounds of betting against people you cannot
          see.
        </p>
        <p>
          Acting last means you have watched everyone else act before you decide. You get more
          information for the same money, every round, for the whole hand. That is worth more than
          most of the difference between one starting hand and another, which is why a hand like J9s
          is a fold from the first seat and a routine open from the button.{' '}
          <GuideLink slug="position">The position guide</GuideLink> is the long version.
        </p>
        <p>
          The other half of it is how many people are left behind you. From early position five
          players still get to wake up with a better hand. From the button there are two. The same
          cards are simply likelier to be best when fewer people can beat them.
        </p>
      </Section>

      <Section title="What actually makes a hand worth playing">
        <p>Four things, and they matter in this order.</p>
        <p>
          <strong className={strong}>High cards.</strong> Most hands never improve past one pair, so
          the pair you make wants to be a big one. This is the whole reason ace-king beats
          king-queen and king-queen beats queen-jack. Nothing clever in it.
        </p>
        <p>
          <strong className={strong}>Being a pair already.</strong> You start with a made hand
          nobody has to help you find. Pocket pairs are rare, at {PAIR_PCT}% of hands, and small
          ones are worth playing mostly because of what they can become: a pocket pair flops a set
          or better <strong className={strong}>{SET_PCT}% of the time</strong>, which is once in
          every eight and a half hands. That is the whole business case for playing 44.
        </p>
        <p>
          <strong className={strong}>Cards that work together.</strong> Connected cards make
          straights, and cards close in rank make more straights than distant ones. 76 belongs to
          four possible straights. Put one gap between them and 86 belongs to three. King-seven
          belongs to none at all, because no run of five ranks holds both.
        </p>
        <p>
          <strong className={strong}>Being suited.</strong> This one is real and it is smaller than
          people think. Two suited cards make a flush by the river{' '}
          <strong className={strong}>{FLUSH_PCT}% of the time</strong>, so a flush is not the plan,
          it is a bonus. Priced properly:
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Hand</th>
              <th scope="col">Equity against a fixed opponent</th>
              <th scope="col">
                <span className="sr-only">What the suits are worth</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {SUITED_PREMIUM.map((row) => (
              <tr key={row.hand}>
                <td className={`whitespace-nowrap ${strong}`}>{row.hand}</td>
                <td>{row.equity}</td>
                <td className={row.note ? strong : undefined}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            So suitedness is worth about three to four points. It is a tiebreaker, not a
            transformation.
          </strong>{' '}
          It is usually enough to move a hand one band on the chart above, which is exactly what it
          does: ATs is playable from anywhere and ATo waits for the middle. It is not enough to make
          two low suited cards worth playing, and “but they were suited” has probably cost more
          beginners more money than any other sentence in poker.
        </p>
      </Section>

      <Section title="The four traps">
        <p>
          <strong className={strong}>Any ace.</strong> A5o and A9o are on the chart from late
          position only, and for a reason. When your ace pairs, you have top pair with a bad kicker,
          and the way that hand loses is to somebody with the same pair and a better one. It wins
          small pots and loses big ones. Ace-rag is the most reliably overplayed hand in poker, and
          it is <GuideLink slug="hand-rankings">kickers</GuideLink> doing the damage.
        </p>
        <p>
          <strong className={strong}>Any two suited cards.</strong> {FLUSH_PCT}%. See above.
        </p>
        <p>
          <strong className={strong}>Face cards that do not match.</strong> KJo, QJo and JTo look
          like a handful of picture cards. They make second-best pairs against exactly the hands
          that raise, which is the definition of an expensive holding. Note where they sit on the
          chart, which is later than they feel.
        </p>
        <p>
          <strong className={strong}>Playing a hand because you are bored.</strong> Most of poker is
          folding. From the first seat this chart folds {100 - SHARE.any}% of the time, and the
          discipline to do that is worth more than any refinement to which hands are in the other{' '}
          {SHARE.any}%.
        </p>
      </Section>

      <Section title="How often you actually get the good stuff">
        <p>
          Worth knowing, because it sets expectations for a session and stops the chart feeling
          unfairly tight.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">You are dealt</th>
              <th scope="col">How often</th>
              <th scope="col">Roughly</th>
            </tr>
          </thead>
          <tbody>
            {DEALT.map((row) => (
              <tr key={row.what}>
                <td className={strong}>{row.what}</td>
                <td className="whitespace-nowrap">{row.pct}</td>
                <td className="whitespace-nowrap">{row.roughly}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          Aces arrive once in 221 hands. At a normal pace that is a couple of hours.{' '}
          <strong className={strong}>
            The tight-looking chart above is not asking you to wait for aces, and if you sit waiting
            for aces you will pay far more in blinds than they will ever win you.
          </strong>{' '}
          Most of the money is made with hands that are merely good, in seats where being merely
          good is enough.
        </p>
      </Section>

      <TryIt>
        <p>
          A chart is a memory aid for a decision you have to make in about four seconds, and it only
          becomes automatic by making it a few hundred times. That part cannot be read.
        </p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser, against opponents that
          actually play. No account needed, nothing to install, no money involved anywhere and none
          to spend. Your position moves every hand, so the interesting half of this page turns up on
          its own, several times a minute.
        </p>
      </TryIt>

      {/* After the CTA on purpose: whoever wants to repost the grid has already
          read the page, and somebody learning poker should not have to scroll
          past a block of HTML to reach the end of it. */}
      <ReuseChart slug="starting-hands" />
    </GuidePage>
  )
}
