import type { Metadata } from 'next'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { TheOrder } from '@/components/learn/TheOrder'
import { Section } from '@/components/marketing/LegalPage'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import { guideBySlug, guideCardImage } from '@/config/learn'
import {
  PREMIUM_BEHIND,
  SEATS,
  SEATS_AT_A_TABLE,
  playersBehind,
  postflopPlace,
  preflopPlace,
} from '@/config/positions'
import { contentAlternates, contentSocial } from '@/config/site'
import { BAND_ROUGHLY, type Band, cumulativeShare } from '@/config/startingHands'

const guide = guideBySlug('position')!

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

// The seat table is generated from src/config/positions.ts, which computes both
// orders from the rule the engine follows and is checked against a real hand in
// tests/positions.test.ts. The opening percentages are the starting-hand
// chart's own bands, so this page and that one cannot disagree about a hand.
const SHARE: Record<Band, number> = {
  any: Math.round(cumulativeShare('any')),
  middle: Math.round(cumulativeShare('middle')),
  late: Math.round(cumulativeShare('late')),
}

const OPENING = [
  { seat: 'Early', band: 'any' as const },
  { seat: 'Middle', band: 'middle' as const },
  { seat: 'Late, the cutoff or the button', band: 'late' as const },
]

const ordinal = (place: number): string =>
  ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][place - 1]

const strong = 'font-medium text-foreground'

export default function PositionGuide() {
  return (
    <GuidePage slug="position">
      <Lead>
        <p>
          Position is where you sit in the betting order, measured from the dealer button. Acting
          late means you have watched everyone else act before you decide, and acting early means
          you have not. It is the reason the same two cards are a fold in one seat and a raise in
          another: from the first seat you can profitably play about {SHARE.any}% of hands, and from
          the button about {SHARE.late}%.
        </p>
        <p>The cards did not change. Your seat did.</p>
      </Lead>

      <Section title="The seats, in the order they act">
        <p>
          The button moves one seat to the left after every hand, so everyone gets every seat. At a
          six-handed table it is your button once every {SEATS_AT_A_TABLE} hands.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Seat</th>
              <th scope="col">Before the flop</th>
              <th scope="col">After the flop</th>
              <th scope="col">Players still to act preflop</th>
            </tr>
          </thead>
          <tbody>
            {SEATS.map((seat) => {
              const last = postflopPlace(seat) === SEATS_AT_A_TABLE
              const first = postflopPlace(seat) === 1
              return (
                <tr key={seat.id}>
                  <td className={strong}>{seat.name}</td>
                  <td className={preflopPlace(seat) === SEATS_AT_A_TABLE ? strong : undefined}>
                    {preflopPlace(seat) === SEATS_AT_A_TABLE ? 'last' : ordinal(preflopPlace(seat))}
                  </td>
                  <td className={last || first ? strong : undefined}>
                    {last ? 'last' : ordinal(postflopPlace(seat))}
                  </td>
                  <td>{playersBehind(seat)}</td>
                </tr>
              )
            })}
          </tbody>
        </GuideTable>
        <p>Two things in that table surprise people, and both are worth more than the names.</p>
        <p>
          <strong className={strong}>The button is not last before the flop.</strong> The blinds act
          after it, because they have already put money in and are owed the chance to respond. The
          button is last on the flop, the turn and the river, which is three streets out of four and
          all of the ones where the pot is big.
        </p>
        <p>
          <strong className={strong}>
            The blinds act last before the flop and first after it.
          </strong>{' '}
          They pay for one and then hand back the other. That trade is the whole reason the blinds
          are the seats where money is lost.
        </p>
        <TheOrder />
      </Section>

      <Section title="Why acting last is worth so much">
        <p>
          It is not mysterious and it is not about aggression. It is that you get more information
          for the same money, every round, for the whole hand.
        </p>
        <p>
          <strong className={strong}>You see their decision before you make yours.</strong> From the
          button, three players have already told you something before the flop, and after it
          everyone still in the hand acts before you do, on every street. From the first seat you
          are guessing, and everyone behind you gets to react to your guess.
        </p>
        <p>
          <strong className={strong}>You choose whether there is a bet at all.</strong> Checked to
          you, you can bet. Bet into, you can fold cheaply. In early position you make that decision
          first and then find out whether it was a good one.
        </p>
        <p>
          <strong className={strong}>You control what the pot costs.</strong> Last to act, you
          decide the size of the pot on every street after the flop. First to act, someone else
          decides it for you. That is <GuideLink slug="bet-sizing">bet sizing</GuideLink>, and
          position is what lets you use it.
        </p>
        <p>
          <strong className={strong}>
            And bluffs work when the other player has already given up.
          </strong>{' '}
          From last position you know they have. From first position you are hoping.
        </p>
        <p>
          None of that is measurable as equity, which is exactly why beginners underrate it. Equity
          is a property of the cards, and position is a property of the information, and only one of
          the two shows up in a percentage on screen.
        </p>
      </Section>

      <Section title="What it does to the hands you play">
        <p>
          This is the practical version, and it comes straight from the{' '}
          <GuideLink slug="starting-hands">starting-hand chart</GuideLink>, whose bands are arranged
          by position for this reason.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Seat</th>
              <th scope="col">Hands worth opening</th>
              <th scope="col">Roughly</th>
            </tr>
          </thead>
          <tbody>
            {OPENING.map((row) => (
              <tr key={row.band}>
                <td className={strong}>{row.seat}</td>
                <td className={strong}>{SHARE[row.band]}%</td>
                <td>{BAND_ROUGHLY[row.band].text}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            The playable set roughly triples between the first seat and the last.
          </strong>{' '}
          J9s is a fold under the gun and a routine open on the button. So is A9o, so is 87s, so is
          most of what sits in the middle of the chart. If you play the same hands from every seat,
          you are either far too tight on the button or far too loose under the gun, and it is
          almost always the second one.
        </p>
        <p>
          There is a bonus you get for free. If everyone at the table plays those bands,{' '}
          <strong className={strong}>
            the action folds around to the button about four times in ten.
          </strong>{' '}
          When it does, you are last to act with only two players left to get through, and quite
          often you win the blinds without a flop. That is not a trick, it is just what happens to
          whoever is sitting in the good seat.
        </p>
      </Section>

      <Section title="The other half: who is left behind you">
        <p>
          Playing early is not only about acting first. It is that more people can still turn up
          with a better hand.
        </p>
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Players still to act</th>
              <th scope="col">Chance one of them has JJ+ or ace-king</th>
            </tr>
          </thead>
          <tbody>
            {PREMIUM_BEHIND.map((row) => (
              <tr key={row.behind}>
                <td className={strong}>
                  {row.behind}
                  {row.from ? `, ${row.from}` : ''}
                </td>
                <td className={strong}>{row.chance.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          <strong className={strong}>
            You are about two and a half times more likely to run into a big hand from the first
            seat than from the button.
          </strong>{' '}
          Same cards, same table, different number of people who can beat you. That is the second
          reason the early range is a third of the size, and it has nothing to do with information
          at all. The bottom row is exact, at 40 of the 1,326 possible hands; the other two come
          from dealing the table out a couple of million times, because the cards you can see are
          cards they cannot have.
        </p>
      </Section>

      <Section title="The blinds">
        <p>
          You post before you see cards, once an orbit, whatever you are dealt. Then you act last
          before the flop and first on every street after it. They are the worst seats at the table
          and you cannot skip them, so the useful question is only how cheaply you get through them.
        </p>
        <p>
          <strong className={strong}>
            The big blind is the one place you correctly play a wide range out of position.
          </strong>{' '}
          You already have money in the pot, so you are being offered a better price to continue
          than any other seat gets. That price is <GuideLink slug="pot-odds">pot odds</GuideLink>,
          and it is a real discount. Take it when it is genuinely cheap. It is still the worst seat,
          and the discount does not turn a bad hand into a good one.
        </p>
        <p>
          <strong className={strong}>The small blind is the trap.</strong> It has money in like the
          big blind and none of the compensation, because it acts first on every street after the
          flop. Being half-in is the reason people call there, and it is a reason to fold, not a
          reason to play.
        </p>
      </Section>

      <Section title="Three mistakes worth naming">
        <p>
          <strong className={strong}>
            Playing a hand because it looks good, from wherever you happen to be sitting.
          </strong>{' '}
          This is the whole error and everything else is a version of it. Look at the seat before
          you look at the cards.
        </p>
        <p>
          <strong className={strong}>
            Calling from the blinds because you are already partly in.
          </strong>{' '}
          The chips you posted are not yours any more. They are in the pot, and they will not be
          less spent if you fold.
        </p>
        <p>
          <strong className={strong}>Forgetting about position after the flop.</strong> Once the
          hand starts, what matters is whether you act before or after the player doing the betting.
          If they are on your left, every street costs you the same guess again.
        </p>
      </Section>

      <TryIt>
        <p>
          Position is the one concept on this list you cannot practise by reading, because it only
          exists at a table where the button moves.
        </p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser. No account needed, nothing to
          install, no money involved anywhere and none to spend. Tables run from two seats up to{' '}
          {SEATS_AT_A_TABLE}, so your seat changes every hand and the whole of this page turns up
          several times a minute. The blinds also rise every {HANDS_PER_LEVEL} hands, which is one
          full orbit, so the good seat is worth a bit more each time it comes back round to you.
        </p>
      </TryIt>
    </GuidePage>
  )
}
