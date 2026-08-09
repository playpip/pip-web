import type { Metadata } from 'next'
import { BestFive } from '@/components/learn/BestFive'
import { CanYouCheck } from '@/components/learn/CanYouCheck'
import { GuideLink, GuidePage, GuideTable, Lead, TryIt } from '@/components/learn/Guide'
import { Section } from '@/components/marketing/LegalPage'
import { guideBySlug } from '@/config/learn'
import { contentAlternates } from '@/config/site'

const guide = guideBySlug('how-to-play-texas-holdem')!

export const metadata: Metadata = {
  title: `${guide.metaTitle} · Pip`,
  description: guide.description,
  alternates: contentAlternates(`/learn/${guide.slug}`),
  openGraph: {
    type: 'article',
    url: `https://playpip.io/learn/${guide.slug}`,
    title: guide.metaTitle,
    description: guide.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: guide.metaTitle,
    description: guide.description,
  },
}

const ROUNDS = [
  {
    round: 'Preflop',
    dealt: 'Two private cards to each player',
    faceUp: '0',
    first: 'The player left of the big blind',
  },
  {
    round: 'The flop',
    dealt: 'Three community cards, together',
    faceUp: '3',
    first: 'The first player left of the button',
  },
  {
    round: 'The turn',
    dealt: 'One more community card',
    faceUp: '4',
    first: 'The first player left of the button',
  },
  {
    round: 'The river',
    dealt: 'One more community card',
    faceUp: '5',
    first: 'The first player left of the button',
  },
] as const

const strong = 'font-medium text-foreground'

export default function HowToPlayGuide() {
  return (
    <GuidePage slug="how-to-play-texas-holdem">
      <Lead>
        <p>
          Every player gets two private cards. Five more are dealt face up in the middle, in three
          stages, with a round of betting after each stage. You make the best five-card hand you can
          out of the seven available to you. If two or more players are still in at the end, the
          cards are shown and the best hand takes the pot.
        </p>
        <p>
          That is the whole game. The rest of this page is the detail: what the blinds are for, who
          acts when, what your options are on your turn, and a full hand played out from the deal to
          the showdown.
        </p>
      </Lead>

      <Section title="Before any cards are dealt">
        <p>Three seats have names, and they move one place to the left after every hand.</p>
        <p>
          <strong className={strong}>The button</strong> marks who is nominally the dealer. It
          matters because the player on the button acts last on every betting round after the first,
          which is the biggest positional advantage in the game.
        </p>
        <p>
          <strong className={strong}>The small blind</strong> sits directly to the left of the
          button. <strong className={strong}>The big blind</strong> sits to the left of the small
          blind. Both put chips in before they have seen a card. The big blind is the full opening
          bet, and the small blind is usually half of it.
        </p>
        <p>
          Blinds exist to make the game move. Without them there is no cost to sitting and folding
          forever, so nobody would ever have a reason to play a hand. The blinds put something in
          the middle worth winning, and they rotate so everyone pays them equally.
        </p>
      </Section>

      <Section title="The four betting rounds">
        <GuideTable>
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">What gets dealt</th>
              <th scope="col">Cards face up</th>
              <th scope="col">Who acts first</th>
            </tr>
          </thead>
          <tbody>
            {ROUNDS.map((row) => (
              <tr key={row.round}>
                <td className={`whitespace-nowrap ${strong}`}>{row.round}</td>
                <td>{row.dealt}</td>
                <td>{row.faceUp}</td>
                <td>{row.first}</td>
              </tr>
            ))}
          </tbody>
        </GuideTable>
        <p>
          The community cards belong to everybody. Your hand is the best five out of your two plus
          those five.
        </p>
        <p>
          Notice the change after the first round. Preflop the blinds act last, because they have
          already put money in and deserve the last word on it. From the flop onwards the button
          acts last, every single round, and keeps that advantage for the whole hand. That one
          detail is why position matters so much that it has{' '}
          <GuideLink slug="position">a guide of its own</GuideLink>.
        </p>
      </Section>

      <Section title="What you can do on your turn">
        <p>
          Five things, and which of them are available depends entirely on whether somebody has bet.
        </p>
        <p>
          <strong className={strong}>Fold.</strong> Give up the hand. You lose whatever you have
          already put in and nothing more.
        </p>
        <p>
          <strong className={strong}>Check.</strong> Pass the action along without putting in chips.
          Only available when there is no bet in front of you.
        </p>
        <p>
          <strong className={strong}>Call.</strong> Match the current bet.
        </p>
        <p>
          <strong className={strong}>Bet.</strong> Put chips in when nobody else has yet this round.
        </p>
        <p>
          <strong className={strong}>Raise.</strong> Increase an existing bet. A raise must be at
          least as big as the last bet or raise. If somebody bets 20, you cannot make it 25. The
          smallest raise available to you is 40.
        </p>
        <p>
          The rule that catches almost everyone on their first night is the checking rule. You can
          only check when there is nothing to call. Once anybody bets, checking disappears from your
          options and you are choosing between call, raise and fold. That is the whole choice, every
          time.
        </p>
        <p>
          In no-limit Hold’em you may also move <strong className={strong}>all-in</strong> at any
          point, betting every chip in front of you. You can never be forced to bet more than you
          have, and you can never lose more than is on the table.
        </p>
        <CanYouCheck />
      </Section>

      <Section title="A hand, from the deal to the showdown">
        <p>Six players, blinds of 10 and 20. You are on the button.</p>
        <p>
          <strong className={strong}>Preflop.</strong> You are dealt K♠ Q♠. The first two players
          fold. The player to your right calls 20. You raise to 60. Both blinds fold, giving up the
          10 and 20 they had already posted. The remaining player calls your extra 40.
        </p>
        <p>There is now 150 in the pot, and two players left.</p>
        <p>
          <strong className={strong}>The flop: K♦ 8♠ 3♥.</strong> Your opponent acts first, because
          you have the button. He checks. You have made a pair of kings with a queen kicker, so you
          bet 90. He calls. The pot is 330.
        </p>
        <p>
          <strong className={strong}>The turn: 5♣.</strong> He checks again. You bet 200. He calls.
          The pot is 730.
        </p>
        <p>
          <strong className={strong}>The river: Q♥.</strong> The board now reads K♦ 8♠ 3♥ 5♣ Q♥, and
          your queen has paired too. You hold two pair, kings and queens. He checks, you bet 350,
          and he calls. The pot is 1,430.
        </p>
        <p>
          <strong className={strong}>The showdown.</strong> You bet last, so you show first. You
          turn over K♠ Q♠. He shows K♥ J♦.
        </p>
        <p>
          Both of you have a pair of kings, so the kickers settle it. Your best five cards are K♠ K♦
          Q♠ Q♥ 8♠, which is two pair. His are K♥ K♦ Q♥ J♦ 8♠, which is one pair. Two pair beats one
          pair and you take the 1,430.
        </p>
        <p>
          Read his hand again, though, because it makes a point that costs beginners money.{' '}
          <strong className={strong}>His jack played.</strong> The queen on the river went into his
          hand as well as yours, and his fifth card was the jack from his own hand. Every card on
          the table is available to every player, so a card that helps you often helps somebody else
          at the same time.
        </p>
      </Section>

      <Section title="Which five cards are yours">
        <p>
          This is the single most misunderstood rule in Hold’em, so it is worth stating on its own.
        </p>
        <p>
          <strong className={strong}>
            You make the best five-card hand out of the seven available, and you are not required to
            use your own cards at all.
          </strong>{' '}
          Sometimes both of your cards play. Sometimes one plays and the other is dead weight.
          Sometimes the five cards on the table are already better than anything you can make with
          them, in which case everybody still in the hand has the same hand and the pot is split.
        </p>
        <p>
          People who have played Omaha often get this backwards, because Omaha makes you use exactly
          two of your four cards. Hold’em has no such rule. Count to the best five and stop.
        </p>
        <BestFive />
      </Section>

      <Section title="The showdown, in detail">
        <p>
          The last player to bet or raise shows their cards first. If nobody bet on the river, the
          first active player to the left of the button shows first, and the rest follow clockwise.
        </p>
        <p>
          If your hand cannot win, you can <strong className={strong}>muck</strong> it: fold it face
          down without showing. You give up any claim to the pot, and nobody learns what you had.
        </p>
        <p>
          Suits never break a tie. There is no suit ranking in Texas Hold’em, so two players with
          genuinely identical hands split the pot down the middle. The full order, and how ties are
          settled inside each hand, is on{' '}
          <GuideLink slug="hand-rankings">the hand rankings page</GuideLink>.
        </p>
      </Section>

      <Section title="Five things that catch people out">
        <p>
          <strong className={strong}>You do not have to use both your cards.</strong> Or either of
          them. See above.
        </p>
        <p>
          <strong className={strong}>You cannot check when there is a bet in front of you.</strong>{' '}
          Call, raise or fold.
        </p>
        <p>
          <strong className={strong}>A raise has a minimum size.</strong> At least the size of the
          last bet or raise.
        </p>
        <p>
          <strong className={strong}>The button moves every hand.</strong> Position is a rotation,
          not a seat you got given.
        </p>
        <p>
          <strong className={strong}>Folding is a move, not a failure.</strong> Most hands are worth
          folding, and folding them is what a good player spends most of the night doing. Which
          hands are worth playing is a whole subject in itself, and it is{' '}
          <GuideLink slug="starting-hands">the next guide</GuideLink>.
        </p>
        <p>
          One thing that changes by format rather than by rule: in a tournament the blinds go up on
          a timer, so waiting for a good hand gets more expensive as the night goes on. In a cash
          game they stay where they are and you can sit as long as you like. The rules of a hand are
          identical in both.
        </p>
      </Section>

      <TryIt>
        <p>
          Reading the rules gets you to the point where you can follow a hand. Playing gets you to
          the point where you stop having to think about the order of things at all, which usually
          takes about twenty minutes and cannot be read into place.
        </p>
        <p>
          You can play Texas Hold’em on Pip right now, in the browser, against opponents that
          actually play. No account needed, nothing to install, no money involved anywhere and none
          to spend. It tells you what hand you have made as you go, so the rules on this page turn
          into something you do rather than something you looked up.
        </p>
      </TryIt>
    </GuidePage>
  )
}
