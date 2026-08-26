import type { Metadata } from 'next'
import Link from 'next/link'
import { A, LegalPage, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { CORRECTIONS } from '@/config/corrections'
import {
  FLOPS,
  FLOPS_BOARD_TRIPS,
  FLOPS_SET_OR_BETTER,
  FLOPS_WITH_YOUR_RANK,
} from '@/config/flopSet'
import { SAMPLE_TARGET, combinations } from '@/lib/poker/oddsQuote'

const post = BLOG_POSTS.find((p) => p.slug === 'august-what-shipped')!

export const metadata: Metadata = postMetadata(post)

// The month's numbers are imported rather than typed, for the reason the whole
// post is about: a figure written into prose is a figure nothing re-reads. The
// flop counts come from the same registry the answer page renders, and the
// calculator's two constants from the module that computes the quote, so if
// either moves this page moves with it.

const link =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

/**
 * Hands an opponent can hold heads-up with the board complete: your two and the
 * five on the table are out, so it is every pair from the 45 left. Written as
 * the sum rather than as 990 because 990 is the whole point of the paragraph it
 * appears in, and a typed 990 is the kind of figure this post is about.
 */
const EXACT_HEADS_UP_HANDS = combinations(52 - 7, 2)

export default function AugustRoundupPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          In August Pip stopped being only a poker table. There is somewhere to learn the game now,
          six written guides and a free odds calculator, and there is a drill in the app that deals
          you a spot and marks your answer. A tournament ends with a card that reads the run you
          just played.
        </p>
        <p>
          Two of the things we did this month were about our own work rather than the product. We
          measured our bots against how real people play and found them nothing like it, and we
          published a page listing every factual claim we have got wrong. That second one was the
          least comfortable thing here and is the one we would keep if we had to pick.
        </p>
      </Section>

      <Section title="Somewhere to learn the game">
        <p>
          <Link href="/learn" className={link}>
            Learn
          </Link>{' '}
          opened at the start of the month with one guide and finished it with six: hand rankings,
          how to play Texas Hold’em, which starting hands to play, pot odds, position, and how much
          to bet. Each one has something on it you can tap and change rather than only read.
        </p>
        <p>
          Every percentage on those pages is computed from a count rather than typed in, and a test
          deals the count out to check it. The starting-hands chart grades all 1,326 two-card hands.
          The flop table on the newest page grades all {FLOPS.toLocaleString('en-GB')} flops a
          pocket pair can meet. Written that way a wrong figure fails the build instead of sitting
          on a page nobody re-reads, which is a boring decision that has already caught things.
        </p>
      </Section>

      <Section title="The number everyone quotes is counting cards">
        <p>
          The last page of the month is a different shape from the others:{' '}
          <Link href="/learn/how-often-do-you-flop-a-set" className={link}>
            how often do you flop a set
          </Link>{' '}
          is a question with a number for an answer rather than a guide to a subject.
        </p>
        <p>
          Writing it turned something up. The figure everybody quotes for flopping a set with a
          pocket pair is 11.8%, and 11.8% is correct, but it is counting the wrong thing. It counts
          the flops that contain one of the two remaining cards of your rank:{' '}
          {FLOPS_WITH_YOUR_RANK.toLocaleString('en-GB')} of {FLOPS.toLocaleString('en-GB')}. Grade
          the hands instead of counting the cards and you get{' '}
          {FLOPS_SET_OR_BETTER.toLocaleString('en-GB')}, which is exactly 12%.
        </p>
        <p>
          The {FLOPS_BOARD_TRIPS} flops in the gap are the ones where the board comes three of a
          kind on its own. Neither of your cards arrived, and you have a full house anyway. It is a
          small difference and nobody is playing worse for the old number, but it is the sort of
          thing you only find by dealing them all out.
        </p>
      </Section>

      <Section title="A poker odds calculator">
        <p>
          There is a free{' '}
          <Link href="/poker-odds-calculator" className={link}>
            odds calculator
          </Link>{' '}
          on Pip now. Pick your two cards, add the board if there is one, say how many people you
          are against, and it works out your equity. No account, no signup, nothing to install, and
          it never leaves your browser.
        </p>
        <p>The reason it is worth a section is the second line of the answer.</p>
        <p>
          The way you work out equity is to deal the rest of the hand out over and over and count
          who wins. That makes the answer a sample rather than a fact. The same hand, under the same
          seed, reads 67.8% at 1,500 deals and 65.2% at 100,000. A number printed to a decimal place
          the run behind it cannot support is a made-up number, however precise it looks.
        </p>
        <p>
          So ours prints the margin next to it: 65% equity, ±0.7 points, from{' '}
          {SAMPLE_TARGET.toLocaleString('en-GB')} hands dealt. The number of digits follows the
          margin rather than the other way round, which is why you get a whole percent when a whole
          percent is what the run supports.
        </p>
        <p>
          Where the spot is small enough to count outright, it counts it outright instead. Heads-up
          with all five cards down, your opponent has {EXACT_HEADS_UP_HANDS} possible hands, all{' '}
          {EXACT_HEADS_UP_HANDS} get dealt, and the answer reads “Exact. All {EXACT_HEADS_UP_HANDS}{' '}
          possible hands your opponent could hold.” That is the only shape in the whole calculator
          that gets the word exact. Everything else is a sample, and says so.
        </p>
        <p>
          The engine is the same one the game uses to work out the win percentage in the corner of
          the table, in the same open repo, so none of this has to be taken on trust.
        </p>
      </Section>

      <Section title="Drills">
        <p>
          There is a drill in Pip now. It is in the app, next to the tables, and it is called Which
          hand wins?
        </p>
        <p>
          Two hands, a finished board, and one question. You pick who takes it, or that they split
          it. The answer comes back with the five cards each hand actually plays and one sentence
          saying what settled it, which is usually the part you wanted. Every spot is dealt fresh,
          so it is a different nine cards every time you open it.
        </p>
        <p>
          It is settled by the same code that settles a showdown at the table, card by card, rather
          than by a simulation. That matters more than it sounds. It means the drill cannot mark a
          right answer wrong.
        </p>
        <p>
          There is a rating. It starts at 1000 and moves against what the spot was worth: two
          different hands where the higher card wins is the easy end, the same hand twice settled by
          a kicker is where people go wrong, and a board where neither hand is ahead is the one
          nobody thinks to look for. Get an easy one right when you are already well above it and it
          is worth almost nothing, which is the honest outcome rather than a stingy one. A number
          that goes up every time you answer is a count of how much you played, not a reading of how
          well.
        </p>
        <p>
          Being straight about those numbers: nobody had played this when we picked them, so they
          are a judgement about the spots rather than a measurement of players. The order is the
          part we would defend. The numbers themselves will move once there are real answers to
          derive them from.
        </p>
        <p>
          What there is not, and will not be, is a streak. No daily goal, no counter that resets,
          nothing you lose by not turning up for a week. Your rating is exactly where you left it
          whenever you come back, because nothing in the drills layer is allowed to read the clock
          at all. That is not a promise about our intentions, it is a test that fails the build.
        </p>
        <p>
          It is free and there is no limit on how many you play, and that is not a thing we can take
          back later. The{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md">roadmap</A> says plainly
          that nothing which ships free gets metered afterwards, and this is the first thing that
          rule has had to hold.
        </p>
      </Section>

      <Section title="When a tournament ends">
        <p>Tournaments used to just end. Now one card comes up first.</p>
        <p>
          Three numbers across the top: where you finished, how many hands it took, and what it did
          to your Roll. Then the one moment worth naming, which is the biggest pot you won, what you
          showed for it and whose chips it took. Then a line on how you played this run against how
          you usually play, something like “You played 70% of your hands this run, looser than your
          usual 40%”. Then anything in your career that actually moved, a new best Roll or a better
          finish at that venue than you had managed there before.
        </p>
        <p>
          Then it is gone. Nothing stores it, there is no recap to go back to, and nothing sends you
          a copy.
        </p>
        <p>
          It reports one run, and that is the whole of it. It will not tell you whether you are
          improving, because one tournament does not know, and it never asks you to come back
          tomorrow. There is no streak counter anywhere in Pip and there was never going to be one.
        </p>
        <p>
          The other half of it is that the arithmetic has to be honest. The play-style read needs
          twenty hands under it before it will say anything at all, and it only calls a difference
          from your usual when the gap is bigger than ten points, because twenty hands carries about
          eleven points of noise and anything under that is the sample talking rather than you. A
          three-hand run gets no verdict on how you play. Three hands do not contain one.
        </p>
        <p>Pip would rather tell you nothing than tell you something it cannot support.</p>
      </Section>

      <Section title="Text size">
        <p>
          Pip has a text size setting now. It is in Settings: 100, 125, 150 or 200%, and it is kept
          per device, so your phone can be set large and your laptop can stay where it is.
        </p>
        <p>
          It exists because pinch-zoom is switched off in Pip on purpose. That is most of what makes
          the installed app feel like an app rather than a webpage, and a gesture that leaves you
          panned off the side of a table mid-hand was never much of an accessibility feature. WCAG
          asks that text reach 200%. So we built the other route to it.
        </p>
        <p>The reading surfaces go the whole way. The poker table stops at 150%.</p>
        <p>
          That second part is deliberate. A poker table cannot reflow. The seats, the board, the pot
          and the action row all have to be on screen at once and in the same places relative to
          each other, so type that doubles has nowhere to go but over the edge. We played a hand at
          200% on a phone and it stopped being a poker table. 150% is the largest size where it
          still is one, so that is where it stops, and if you pick 200% while sitting down the app
          tells you rather than leaving you to wonder why nothing moved.
        </p>
        <p>One guideline met. Not a claim that Pip is accessible. It was the one in our way.</p>
      </Section>

      <Section title="We measured our own bots">
        <p>
          Somebody opened an issue saying the bots were unrealistically aggressive. We built a
          harness to measure them, and the measurement said the opposite.
        </p>
        <p>
          Across the shipped ladder the bots were raising 1.9% to 7.8% of their hands before the
          flop, where a real player opens somewhere between 12% and 25%. They came into pots by
          calling, three to ten times more often than by raising, which is the signature of a
          calling station rather than a player. At the tightest tables they were folding pocket aces
          under the gun about half the time.
        </p>
        <p>
          The part worth admitting is that our tests were green throughout. Every one of them
          compared our tables to each other: the loose field played wider than the tight one, the
          ladder was ordered correctly, the personalities differed. Nothing in the suite knew what a
          person does, so a whole game of calling stations passed every check we had.
        </p>
        <p>
          That is fixed, and the tests that hold it now assert a band rather than a comparison.
          Every table in the game has to open more than 5% of hands and fewer than 40%, and cannot
          call more than eight times as often as it raises. The numbers come from how people play,
          not from how our other tables play.
        </p>
        <p>
          One more thing came out of it. The ladder does get harder as you climb, and we can now put
          a number on it: measured by what a seat does when it enters a pot, the share of entries
          that are raises runs from 32% at Friends’ Garage to 60% at The Main Event. It is not a
          clean step up rung by rung. The casino and the riverboat come in as raisers slightly less
          often than the pool hall and the card room do.
        </p>
      </Section>

      <Section title="Everything we have published that was wrong">
        <p>
          On the 24th we published{' '}
          <Link href="/blog/what-we-got-wrong" className={link}>
            a page of our own errors
          </Link>
          . Every factual claim Pip has made in public and then got wrong: what it said, why it was
          false, the day it started serving, the day the correction served, and how it was found.
          There are {CORRECTIONS.length} on it.
        </p>
        <p>
          Two things about it are worth saying here. The dates are merge dates rather than the day
          somebody noticed, because on this repository a merge is the deploy, and the gap between
          writing a fix and shipping it is part of what the page is admitting to. And no test has
          ever found one of these. Every single one was caught by a person reading, which is exactly
          why the page needed writing.
        </p>
        <p>
          It is generated from a registry rather than maintained by hand, because a hand-maintained
          list of your own mistakes is a list that quietly stops being updated, and one that stops
          being updated implies you stopped making them. Each fixed row names a fragment of the
          sentence that was wrong, and a test fails the build if that fragment ever appears on the
          site again.
        </p>
      </Section>

      <Section title="One stranger, twice">
        <p>
          The RSS feed on this blog was not built by us. Peter Z opened it as a pull request at the
          start of the month, and it is the{' '}
          <Link href="/rss.xml" className={link}>
            feed
          </Link>{' '}
          you can subscribe to. He came back on the 25th and added test coverage for the play-style
          read, the thing in the tournament card that says whether you played looser than you
          usually do. That is his fourth merged pull request since Pip launched.
        </p>
        <p>
          His name is on the{' '}
          <Link href="/credits" className={link}>
            credits page
          </Link>
          , which is the whole of the deal. The shelf of{' '}
          <A href="https://github.com/playpip/pip-web/labels/good%20first%20issue">
            good first issues
          </A>{' '}
          is kept stocked if you want yours there.
        </p>
      </Section>

      <Section title="What’s next">
        <p>
          Multiplayer is the big one and it is not close. Nearer than that: more guides, more
          questions answered with a number, and more of the figures on this site derived from a
          count rather than typed by a person.
        </p>
        <p>
          The rest of the direction is on the{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md">roadmap</A>, in the
          open. The section worth reading is the one about how Pip pays for itself, which is the
          question a free thing usually avoids until the day it stops being free.
        </p>
      </Section>
    </LegalPage>
  )
}
