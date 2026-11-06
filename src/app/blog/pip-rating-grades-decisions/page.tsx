import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'
import {
  ANCHOR_LOSS,
  ANCHOR_RATING,
  DECAY,
  EXPERIENCE_CAPS,
  FLAG_AFTER,
  IMPLAUSIBLE_RATING,
  LOSS_CAP_BB,
  MAX_CHANGE_PER_SUBMIT,
  MAX_DECISIONS_PER_HOUR,
  PROVISIONAL_DECISIONS,
  RATING_BANDS,
  ratingFromLoss,
  STEP,
} from '@/lib/rating'

const post = BLOG_POSTS.find((p) => p.slug === 'pip-rating-grades-decisions')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const n = (count: number) => count.toLocaleString('en-GB')
const pct = (share: number) => `${Number((share * 100).toFixed(3))}%`

const recent = Math.round(1 / (1 - DECAY))
const bands = RATING_BANDS.map((b, i) =>
  i === 0 ? `${b.name} (under ${n(RATING_BANDS[1].min)})` : `${b.name} (${n(b.min)})`,
).join(', ')
const bandAt = (name: string) => RATING_BANDS.find((b) => b.name === name)!.min
const [strongCap, expertCap, masterCap] = EXPERIENCE_CAPS

export default function PipRatingPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The problem with counting wins">
        <p>
          Poker results are mostly the cards. You can play a hand perfectly and lose it, and play it
          badly and win, and over an evening the cards can hide which of those you did. A rating
          built on who won would mostly be a rating of luck.
        </p>
        <p>
          The Pip Rating ignores who won. It looks at each decision when you made it, with the cards
          you could see, and asks how much that decision gave away against the other choice. A right
          call that loses to a river card costs you nothing. A bad call that gets lucky still costs
          what it cost.
        </p>
      </Section>

      <Section title="What it grades">
        <p>
          Two kinds of decision. Every call or fold you make facing a bet, priced in big blinds from
          your equity and the price you were offered. And your first move when it folds round to you
          before the flop, graded against the two charts the app already teaches: the shove chart
          when you have 15 big blinds or fewer, the opening chart from 25.
        </p>
        <p>
          It does not grade bets and raises after the flop. What they are worth depends on how often
          the other player folds, and the only players we could measure that against are Pip’s own.
          A rating built on that would reward beating our AI, which is not the same thing as playing
          well. The hand review still grades those, with every card face up.
        </p>
        <p>
          It counts Hold’em hands at the ladder, the Rail, the Daily, the freeroll and the Hold’em
          side tables. Not the other variants, not drills, and not rooms with friends, for now.
        </p>
      </Section>

      <Section title="The scale">
        <p>
          Each decision has a stake (the pot plus the price) and a cost (what it gave up, at most{' '}
          {LOSS_CAP_BB} big blinds). Your rating comes from the share of the stake you gave away,
          over roughly your last {n(recent)} decisions, with recent ones counting more.
        </p>
        <p>
          Give away {pct(ANCHOR_LOSS)} and you rate {n(ANCHOR_RATING)}. Every time you halve that,
          you gain {STEP} points: {pct(ANCHOR_LOSS / 2)} is {n(ratingFromLoss(ANCHOR_LOSS / 2))},{' '}
          {pct(ANCHOR_LOSS / 4)} is {n(ratingFromLoss(ANCHOR_LOSS / 4))}. Double it and you lose{' '}
          {STEP}: {pct(ANCHOR_LOSS * 2)} is {n(ratingFromLoss(ANCHOR_LOSS * 2))}.
        </p>
        <p>
          Weighting by stake is what stops the obvious trick. Fold everything and you make hundreds
          of cheap, correct folds, but the few expensive ones you get wrong carry the weight.
        </p>
        <p>The bands are {bands}.</p>
      </Section>

      <Section title="Where people land">
        <p>
          We seated scripted players at real tables against each table’s own AI and rated their
          hands exactly as the app does, a few hundred rated decisions each, so each figure is give
          or take about 100. Calling every bet rated about 400. So did folding to every bet, and so
          did calling or folding on a coin flip. Paying everything and paying nothing land in the
          same place.
        </p>
        <p>
          The best player we could script, which plays the shove chart exactly, rated 1,670 to
          2,160. So {n(bandAt('Expert'))} sits at about the edge of the best play Pip has, and most
          people will never see it. That is on purpose. Nobody reaches {n(bandAt('Expert'))} in
          chess in a month either.
        </p>
        <p>
          Those scripted players decide with the same equity estimate that grades them, so they
          agree with the grader more than a person would. Real players will sit lower than their
          script. We would guess a careful beginner starts somewhere around 600 to 900, and we will
          know more once enough people have played.
        </p>
      </Section>

      <Section title="New players">
        <p>
          Everyone starts at {n(ANCHOR_RATING)}. The rating is provisional until{' '}
          {PROVISIONAL_DECISIONS} rated decisions. After that the number is held under{' '}
          {n(strongCap.cap + 1)} until {n(strongCap.before)} decisions, under {n(expertCap.cap + 1)}{' '}
          until {n(expertCap.before)}, and under {n(masterCap.cap + 1)} until {n(masterCap.before)}.
          A good week is not a career. Your play still counts in full underneath, so the number
          catches up when a cap lifts, and the app tells you when one is holding you back.
        </p>
      </Section>

      <Section title="What the server can and cannot check">
        <p>
          Hands against the AI are dealt and played on your device. The server never sees a hand,
          only the list of decisions and what each cost. Someone determined could send decisions
          that never happened, and no check can prove otherwise.
        </p>
        <p>
          What it can do is make that slow and visible. It works the rating out again itself rather
          than trusting the number your device sends. It refuses decisions that cost more than they
          could, hands less than two seconds apart, hands it has already counted, and more than
          {n(MAX_DECISIONS_PER_HOUR)} decisions an hour. Once you are rated, one batch of hands
          moves you at most {MAX_CHANGE_PER_SUBMIT} points. And a record of {n(IMPLAUSIBLE_RATING)}{' '}
          or better after {FLAG_AFTER} decisions comes off the leaderboard until a person has looked
          at it.
        </p>
        <p>
          Someone patient enough can still beat that. If it becomes a problem, the fix is to rate
          only hands our server deals, which is how rooms with friends already work.
        </p>
      </Section>

      <Section title="Who sees what">
        <p>
          The number is free for everyone. Make an account and you are on the leaderboard, and you
          can take yourself off it at any time without your rating stopping. It is the one ranking
          on Pip anyone else can see. Your chips and your Roll title stay private.
        </p>
        <p>
          Nothing you can buy raises it, because it measures decisions, and more tables or more
          chips do not make a call any better. What{' '}
          <Link
            href={`${membershipFor('rating')}&from=blog&post=pip-rating-grades-decisions`}
            className={linkClass}
          >
            members
          </Link>{' '}
          get is the rating drawn day by day, and which kinds of decision are moving it. The number
          tells you where you are. The breakdown tells you which of your folds is doing it.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          The arithmetic is one file, <Src path="src/lib/rating/maths.ts" />, and the server runs an
          exact copy of it. The opening and shove grades are{' '}
          <Src path="src/lib/rating/preflop.ts" />. The scripted players are{' '}
          <Src path="scripts/rating-calibrate.ts" />, run on 5 November 2026, and{' '}
          <Src path="docs/rating.md" /> has the full table and everything the server checks. Every
          figure on this page except the calibration comes from the code at build time, so if the
          scale changes, this page changes with it.
        </p>
      </Section>
    </LegalPage>
  )
}
