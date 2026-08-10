import type { Metadata } from 'next'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { Section } from '@/components/marketing/LegalPage'
import { guideBySlug, guideCardImage } from '@/config/learn'
import {
  DRAWS,
  betSizes,
  breakevenFolds,
  chargingBet,
  multiple,
  oneCardChance,
  pct,
  potMultiple,
  requiredEquity,
} from '@/config/potOdds'
import { contentAlternates, contentSocial } from '@/config/site'

const guide = guideBySlug('bet-sizing')!

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

// Both prices, the charging bet and the growth table all come out of
// src/config/potOdds.ts, which is the same file /learn/pot-odds reads. The two
// pages are the same arithmetic seen from the two sides of the table, so they
// share the source rather than each writing the numbers out.
const PRICES = betSizes(['third', 'half', 'twothirds', 'pot', 'overbet'])
const GROWTH = betSizes(['third', 'half', 'twothirds', 'pot'])

/** The pot the growth table starts from, so the last column is a real number. */
const STARTING_POT = 10
const STREETS = 3

/** A min-bet, the one size the page tells you not to use. */
const MIN_BET = 0.1

// The draws the sizing table charges, in the guide's own words. The threshold
// beside each is computed; the phrase is how the sentence under it reads.
const CHARGED = [
  { id: 'gutshot', label: 'Gutshot, 4 outs', words: 'a tenth of the pot' },
  { id: 'oesd', label: 'Open-ended, 8 outs', words: 'a quarter of the pot' },
  { id: 'flush', label: 'Flush draw, 9 outs', words: 'a third of the pot' },
  { id: 'combo', label: 'Flush and open-ended, 15 outs', words: 'nearly the whole pot' },
].map((row) => {
  const draw = DRAWS.find((d) => d.id === row.id)!
  return { ...row, outs: draw.outs }
})

const strong = 'font-medium text-foreground'

export default function BetSizingGuide() {
  return (
    <GuidePage slug="bet-sizing">
      <Lead>
        <p>
          Most bets are worth between a third of the pot and the whole pot, and the size you pick
          inside that range should follow from what you want to happen next. A bet is not a measure
          of how much you like your hand. It is a price, and it sets two of them at once: the price
          the other player pays to continue, and the price you pay to find out.
        </p>
        <p>Everything below is those two numbers.</p>
      </Lead>

      <Section title="The two prices in every bet">
        <p>
          <strong className={strong}>The price you give them.</strong> They call your bet to win the
          pot plus your bet, so the bigger you bet, the more often they need to be right. This is{' '}
          <GuideLink slug="pot-odds">pot odds</GuideLink> seen from the other side of the table.
        </p>
        <p>
          <strong className={strong}>The price you pay.</strong> You are risking your bet to win the
          pot as it stands, so the bigger you bet, the more often they have to fold for a bluff to
          break even.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Your bet</th>
              <th scope="col">They need to win</th>
              <th scope="col">Your bluff needs folds</th>
            </tr>
          </thead>
          <tbody>
            {PRICES.map((size) => (
              <tr key={size.id}>
                <td className={strong}>{size.label}</td>
                <td>{pct(requiredEquity(size.fraction))}%</td>
                <td className={strong}>{pct(breakevenFolds(size.fraction))}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          The two columns move in opposite directions and that is the whole trade.{' '}
          <strong className={strong}>
            Betting more charges them more and puts you further out on a limb.
          </strong>{' '}
          A pot-sized bluff has to work half the time. A third-pot bluff has to work a quarter of
          the time, which is a much easier thing to be right about, and it is why small bluffs are
          usually better bluffs.
        </p>
        <p>
          The fold column is break-even and ignores the times you get called and win anyway, so
          treat it as the worst case rather than the whole story. It is still the number that should
          stop you betting twice the pot with nothing.
        </p>
      </Section>

      <Section title="Sizing when you have the best hand">
        <p>
          You are betting to be called. So the size to pick is the largest one a worse hand can talk
          itself into calling, and that is a fact about their hand, not yours.
        </p>
        <p>
          <strong className={strong}>
            The most expensive habit in poker is betting so big that only better hands continue.
          </strong>{' '}
          You win the pot you already had and lose a big one when you are beaten. If you have top
          pair and you bet twice the pot, everything worse folds and everything better calls, and
          you have arranged to be right about nothing.
        </p>
        <p>
          <strong className={strong}>Small bets are how thin value gets paid.</strong> With a hand
          that is probably best but not much better than best, a third of the pot gets called by
          second pair. Two-thirds does not.
        </p>
      </Section>

      <Section title="Sizing when they are drawing">
        <p>This is the part with real arithmetic in it, and it is not what most people expect.</p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Their draw</th>
              <th scope="col">Their chance on the next card</th>
              <th scope="col">The smallest bet that makes calling wrong</th>
            </tr>
          </thead>
          <tbody>
            {CHARGED.map((row) => (
              <tr key={row.id}>
                <td className={strong}>{row.label}</td>
                <td>{pct(oneCardChance(row.outs))}%</td>
                <td>
                  <span className={strong}>{row.words}</span>, {multiple(chargingBet(row.outs))}x
                </td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            A third of the pot already makes a bare flush draw a losing call for one card.
          </strong>{' '}
          You do not need to bet the pot to charge a draw, and against fifteen outs you almost
          cannot, which is worth knowing before you decide the answer to a scary board is always a
          bigger bet.
        </p>
        <p>Two honest caveats and neither is small.</p>
        <p>
          <strong className={strong}>You cannot really price anyone out</strong>, because{' '}
          <GuideLink slug="pot-odds">implied odds</GuideLink> are the money they win on the streets
          after they hit. What a bet does is make the call bad on its own terms, and how bad it
          needs to be depends on how much money is behind.
        </p>
        <p>
          <strong className={strong}>Bigger bets do charge draws more even after the call.</strong>{' '}
          Pricing them out is not the only goal. If they call a two-thirds bet with a flush draw,
          you have made a losing call happen, which is the second best outcome and often the
          likelier one.
        </p>
      </Section>

      <Section title="What the size does to the pot three streets later">
        <p>
          The pot grows by one plus twice your bet every time a bet gets called, and it compounds.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Bet size, every street</th>
              <th scope="col">Pot multiplies by</th>
              <th scope="col">Over three streets</th>
              <th scope="col">A pot of {STARTING_POT} becomes</th>
            </tr>
          </thead>
          <tbody>
            {GROWTH.map((size) => {
              const perStreet = potMultiple(size.fraction)
              const overThree = perStreet ** STREETS
              return (
                <tr key={size.id}>
                  <td className={strong}>{size.label}</td>
                  <td>{multiple(perStreet)}x</td>
                  <td className={strong}>{multiple(overThree, 1)}x</td>
                  <td>{Math.round(overThree * STARTING_POT)}</td>
                </tr>
              )
            })}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>Your flop bet decides how big the river is.</strong> A small
          bet on the flop is not the cautious option, it is a decision to play a small pot on the
          river, and if you have the best hand that is a decision to win less. A pot-sized bet on
          the flop is a commitment to a pot {multiple(potMultiple(1) ** STREETS, 0)} times the size
          of the one you started with, whether or not you still like your hand by then.
        </p>
        <p>Nobody thinks about the river when they choose a flop size. That is the reason to.</p>
      </Section>

      <Section title="The four sizes worth having">
        <p>You need fewer sizes than you think. Four covers almost everything.</p>
        <p>
          <strong className={strong}>A third of the pot.</strong> Cheap, gets called wide, does its
          work on dry boards where nothing much can be drawing. The best bluff size, because it only
          has to work a quarter of the time.
        </p>
        <p>
          <strong className={strong}>Half the pot.</strong> The default. If you have not got a
          reason for another number, this is the number.
        </p>
        <p>
          <strong className={strong}>Two-thirds to three-quarters.</strong> For wet boards and for
          hands that want to charge a draw. This is where most value bets belong.
        </p>
        <p>
          <strong className={strong}>The pot.</strong> Rare. Reserve it for the times you are either
          very strong or completely giving up, and know that as a bluff it now has to work half the
          time.
        </p>
        <p>
          And one to avoid.{' '}
          <strong className={strong}>
            The min-bet asks the other player to be right one time in{' '}
            {Math.round(1 / requiredEquity(MIN_BET))}.
          </strong>{' '}
          Everybody is right one time in {Math.round(1 / requiredEquity(MIN_BET))}. A tenth-pot bet
          folds out nothing, charges nothing, and hands a free card its correct price. If a hand is
          worth betting it is worth a third of the pot, and if it is not, check.
        </p>
      </Section>

      <Section title="The tell you are giving away for free">
        <p>
          If you bet big with strong hands and small with weak ones, you have told the table what
          you have before they look at your cards. It is the most common leak in low-stakes poker
          and it does not need a read to exploit, only attention.
        </p>
        <p>
          The fix is not complicated.{' '}
          <strong className={strong}>
            Pick your size from the board and the situation, not from how much you like your hand.
          </strong>{' '}
          The same board should get the same size from you whether you have flopped a set or nothing
          at all. That is also what makes bluffs work, since a bluff is only ever believed because
          it looks exactly like the times you were not bluffing. Where you are sitting decides how
          often you get to make that choice at all, which is{' '}
          <GuideLink slug="position">the position guide</GuideLink>.
        </p>
      </Section>

      <TryIt>
        <p>Sizing is a habit, and habits come from repetition rather than from tables.</p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser. No account needed, nothing to
          install, no money involved anywhere and none to spend. The action bar has ½, ¾ and Pot
          buttons and a slider for everything else, which is most of what this page is about. The
          opponents decide by comparing what they think they are worth against the price you have
          just set them, so a bet that gives a draw a good price gets called by that draw, and you
          can watch it happen.
        </p>
      </TryIt>
    </GuidePage>
  )
}
