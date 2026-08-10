import type { Metadata } from 'next'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { Section } from '@/components/marketing/LegalPage'
import { guideBySlug, guideCardImage } from '@/config/learn'
import {
  DRAWS,
  WORKED_SPOTS,
  betSizes,
  byRiverChance,
  cardsText,
  oneCardChance,
  pct,
  requiredEquity,
} from '@/config/potOdds'
import { contentAlternates, contentSocial } from '@/config/site'

const guide = guideBySlug('pot-odds')!

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

// Every figure on this page comes out of src/config/potOdds.ts. The prose
// quotes the same functions the tables do, so a sentence and the row above it
// cannot disagree, and tests/potOdds.test.ts pins the arithmetic itself.
const PRICES = betSizes([
  'quarter',
  'third',
  'half',
  'twothirds',
  'threequarters',
  'pot',
  'overbet',
])

/** The illustration column: a bet of this size into a pot of 100 chips. */
const chips = (fraction: number) => Math.round(100 * fraction)

const FLUSH_OUTS = 9
const strong = 'font-medium text-foreground'

export default function PotOddsGuide() {
  return (
    <GuidePage slug="pot-odds">
      <Lead>
        <p>
          Divide what you have to call by the size the pot will be once you have called. If there is
          120 in the pot and someone bets 60, you are paying 60 to win 240, so you need to win the
          hand more than {pct(requiredEquity(0.5))}% of the time for the call to make money.
        </p>
        <p>
          That is the whole calculation. The hard part is the second number, which is how often you
          actually win, and most of this page is about that.
        </p>
      </Lead>

      <Section title="The price every bet size sets">
        <p>
          You do not need to do the division at the table. The answer only depends on the bet as a
          fraction of the pot, so there are about six numbers and they never change.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">The bet, into a pot of 100</th>
              <th scope="col">You call</th>
              <th scope="col">Final pot</th>
              <th scope="col">You need to win</th>
            </tr>
          </thead>
          <tbody>
            {PRICES.map((size) => (
              <tr key={size.id}>
                <td className={strong}>
                  {size.label}, {chips(size.fraction)}
                </td>
                <td>{chips(size.fraction)}</td>
                <td>{100 + 2 * chips(size.fraction)}</td>
                <td className={strong}>{pct(requiredEquity(size.fraction))}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          Read the whole table as one sentence: the bigger the bet, the more often you have to be
          right. A half-pot bet asks you to win a quarter of the time. Nobody can bet you off a hand
          for free, and the price they set is the only thing their bet actually tells you for
          certain.
        </p>
        <p>
          <strong className={strong}>
            The common mistake is dividing by the pot as it stands rather than the pot after your
            call.
          </strong>{' '}
          It makes every price look better than it is, which is a direction of error that costs
          money.
        </p>
      </Section>

      <Section title="The other half: counting outs">
        <p>
          An out is a card that gives you the best hand. After the flop there are 47 cards you have
          not seen, and the count of outs among them is your estimate of how often you get there.
        </p>
        <p>
          A flush draw is nine outs. There are thirteen cards in a suit, you can see four of them,
          and nine are left. Everything else is counted the same way, by working out which cards
          change the answer.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Your draw</th>
              <th scope="col">Outs</th>
              <th scope="col">Next card</th>
              <th scope="col">By the river, both cards</th>
            </tr>
          </thead>
          <tbody>
            {DRAWS.map((draw) => (
              <tr key={draw.id}>
                <td className={strong}>{draw.label}</td>
                <td>{draw.outs}</td>
                <td>{pct(oneCardChance(draw.outs))}%</td>
                <td>{pct(byRiverChance(draw.outs))}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          The shortcut is the rule of 4 and 2: multiply your outs by 4 for both cards, or by 2 for
          one card. It is close enough at small numbers and it drifts as the count grows. At nine
          outs it says {FLUSH_OUTS * 4} where the true figure is {pct(byRiverChance(FLUSH_OUTS))}.
          At fifteen it says {15 * 4} where the truth is {pct(byRiverChance(15))}, and fifteen outs
          is exactly the situation where people talk themselves into stacking off.
        </p>
      </Section>

      <Section title="The mistake nearly every pot-odds page makes">
        <p>
          <strong className={strong}>
            The “by the river” number is only yours if you are going to see both cards.
          </strong>
        </p>
        <p>
          You are on the flop, you have a flush draw, and someone bets. You will not necessarily see
          the turn and the river. You will see the turn, and then they get to bet again. Unless one
          of you is already all-in, or the bet has been checked through, the card you are buying is
          one card, not two.
        </p>
        <p>
          So the number to compare against the price is{' '}
          <strong className={strong}>
            {pct(oneCardChance(FLUSH_OUTS))}%, not {pct(byRiverChance(FLUSH_OUTS))}%.
          </strong>
        </p>
        <p>
          Facing a half-pot bet on the flop you need {pct(requiredEquity(0.5))}%. A bare flush draw
          does not have it. That is not an opinion about aggression, it is subtraction, and it is
          the single most useful thing on this page because the popular version of this advice has
          it backwards.
        </p>
        <p>
          There is a real defence of that call, and it is not the {pct(byRiverChance(FLUSH_OUTS))}%.
          It is implied odds, below.
        </p>
      </Section>

      <Section title="Outs are an estimate, and here is how wrong they get">
        <p>
          Counting outs assumes your card wins and nothing else does. Both halves of that are
          approximations. Below are five real spots, each one worked out by playing every single one
          of the 990 possible turn-and-river runouts and counting the results.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">The spot</th>
              <th scope="col">Outs you would count</th>
              <th scope="col">What it is really worth by the river</th>
            </tr>
          </thead>
          <tbody>
            {WORKED_SPOTS.map((spot) => (
              <tr key={spot.id}>
                <td className={`whitespace-nowrap ${strong}`}>
                  {cardsText(spot.hero)} on {cardsText(spot.flop)} against {cardsText(spot.villain)}
                </td>
                <td>{spot.outsLabel}</td>
                <td className={strong}>{spot.equity.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            The same nine outs are worth {WORKED_SPOTS[0].equity.toFixed(1)}% in one row and{' '}
            {WORKED_SPOTS[1].equity.toFixed(1)}% in the next.
          </strong>{' '}
          In the first, the extra value is all the things the count ignores: running straights,
          running pairs, cards that back into a hand you never planned. In the second, the opponent
          has flopped three queens, so every card that pairs the board makes them a full house and
          your flush arrives second. Nine outs, and a third of their value gone.
        </p>
        <p>Two lessons, and take the second one more seriously than the first.</p>
        <p>
          <strong className={strong}>Outs undercount when nothing is wrong.</strong> On a dry board
          against one pair, your real equity is a few points above the count, because backdoor cards
          are worth something.
        </p>
        <p>
          <strong className={strong}>Outs overcount when something is wrong.</strong> A paired
          board, a board of one suit, an opponent who has been raising every street. Those are the
          moments the count flatters you, and they are the moments you are being bet at hardest.
        </p>
        <p>
          If you take one habit from this section: when the board pairs, stop counting and start
          subtracting.
        </p>
      </Section>

      <Section title="Implied odds, in short">
        <p>
          Pot odds only price the money on the table now. Implied odds are the money you expect to
          win later on the streets where you hit.
        </p>
        <p>
          This is the honest argument for calling a flop bet with a draw that immediate odds say to
          fold. You are not claiming {pct(oneCardChance(FLUSH_OUTS))}% beats{' '}
          {pct(requiredEquity(0.5))}%. You are claiming the times you hit are worth more than the
          pot you are currently being offered, because they will pay you on the river.
        </p>
        <p>Three conditions, and all three have to hold.</p>
        <p>
          <strong className={strong}>The money has to exist.</strong> Implied odds against a short
          stack are imaginary. There has to be enough behind to win.
        </p>
        <p>
          <strong className={strong}>They have to pay.</strong> A flush that arrives on an obvious
          board gets checked back all day. The value is in the hands that cannot fold, not the ones
          that cannot call.
        </p>
        <p>
          <strong className={strong}>
            It has to be a hand you will get paid on and not one you get stacked with.
          </strong>{' '}
          The other half of this is reverse implied odds, which is what happens when you hit and
          lose anyway: the small flush against the big one, the straight on a paired board, the
          ace-high flush draw’s little brother. Draws to the second-best hand are how the price
          stops mattering at all.
        </p>
        <p>
          Implied odds are real and they are also the standard excuse for a call somebody wanted to
          make anyway. If you are appealing to them on every street, you are not using them, you are
          decorating.
        </p>
      </Section>

      <Section title="How this actually works at the table">
        <p>You have about four seconds, so you are not doing long division.</p>
        <p>
          <strong className={strong}>One. What does it cost me, as a fraction of the pot?</strong>{' '}
          Half pot, two-thirds, that is enough precision.
        </p>
        <p>
          <strong className={strong}>Two. So how often do I need to be right?</strong> Half is a
          quarter. Two-thirds is roughly {Math.round(requiredEquity(2 / 3) * 100)}%. Pot is a third.
        </p>
        <p>
          <strong className={strong}>Three. Am I better than that?</strong> One card, not two,
          unless the money is already in.
        </p>
        <p>
          Then fold most of the time, because the answer is usually no. Pot odds tell you when a
          call is not losing money. They do not tell you it is the best thing you could do with the
          hand, and they say nothing at all about the times raising is better than either. The hands
          worth being in these spots with are the ones on the{' '}
          <GuideLink slug="starting-hands">starting-hand chart</GuideLink>, and the seat you are in
          decides how often you get to make the decision at all, which is{' '}
          <GuideLink slug="position">the position guide</GuideLink>. From the other side of the
          table, the same arithmetic is <GuideLink slug="bet-sizing">how much to bet</GuideLink>.
        </p>
        <p>
          One more caution. Everything above is a one-on-one calculation. With three players still
          in, the price on offer is better and your chance of winning is worse, and the second
          effect is usually the bigger one.
        </p>
      </Section>

      <TryIt>
        <p>
          The arithmetic takes a minute to learn and a few hundred hands to apply without thinking,
          and only the first part can be read.
        </p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser, against opponents that price
          their own decisions the same way. No account needed, nothing to install, no money involved
          anywhere and none to spend. The table shows your win chance while the hand is live, so you
          can make your estimate first and then check it.
        </p>
      </TryIt>
    </GuidePage>
  )
}
