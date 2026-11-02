import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'
import { pct } from '@/config/potOdds'
import { ASKED, BY_BET, DECISIONS, HANDS, SHUFFLES } from '@/config/riverBluffs'
import { RIVER_FRACTIONS } from '@/lib/drills/callingTheRiver'

const post = BLOG_POSTS.find((p) => p.slug === 'calling-a-river-bet')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const n = (count: number) => count.toLocaleString('en-GB')

/** What a call costs as a share of the pot it wins: bet / (pot + 2 bets). */
const priceOf = (fraction: number) => fraction / (1 + 2 * fraction)

const SIZE_WORDS: Record<string, string> = {
  '1/5': 'a fifth of the pot',
  '1/4': 'a quarter of the pot',
  '1/3': 'a third of the pot',
  '2/5': 'two-fifths of the pot',
  '1/2': 'half the pot',
  '3/5': 'three-fifths of the pot',
  '2/3': 'two-thirds of the pot',
  '3/4': 'three-quarters of the pot',
  '1': 'the pot',
  '5/4': 'a pot and a quarter',
  '3/2': 'a pot and a half',
  '2': 'twice the pot',
}

const rows = BY_BET.map((row, i) => ({ ...row, price: priceOf(RIVER_FRACTIONS[i]) }))
const row = (label: string) => rows.find((r) => r.label === label)!
const smallest = rows[0]
const biggest = rows[rows.length - 1]
const dependsLow = Math.min(...rows.map((r) => r.depends))
const dependsHigh = Math.max(...rows.map((r) => r.depends))

export default function CallingARiverBetPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          They bet the river. You have a pair. Calling costs a share of the pot you would win, and
          your hand has to win at least that often to be worth it. A bet of half the pot needs{' '}
          {pct(row('1/2').price)}%. A bet of the pot needs {pct(row('1').price)}%.
        </p>
        <p>
          That half is arithmetic. The other half is how often your pair wins against the hands that
          bet like this, and that depends on how many of those bets are bluffs. We dealt{' '}
          {n(SHUFFLES)} hands through Pip’s river drill to see how often that changes the answer. In{' '}
          {n(DECISIONS.depends)} of {n(DECISIONS.total)} river decisions, it did.
        </p>
      </Section>

      <Section title="The price">
        <p>
          A call wins the pot plus their bet, and it costs your bet. So the share you pay is the bet
          over the pot plus both bets. The bigger the bet, the more often you need to win:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {['1/5', '1/3', '1/2', '3/4', '1', '2'].map((label) => (
            <li key={label}>
              A bet of {SIZE_WORDS[label]}: you need to win {pct(row(label).price)}%
            </li>
          ))}
        </ul>
        <p>None of this depends on who is betting. Everything after it does.</p>
      </Section>

      <Section title="Who is betting">
        <p>
          Pip’s river drill reads a bet as two kinds of hand. Value: the stronger half of the made
          hands they could have, or the strongest third when the bet is more than two-thirds of the
          pot. And bluffs: hands that missed, counted at a weight, because they bet some of those
          and not all of them.
        </p>
        <p>
          The weight is the one number nobody can know about a stranger. So the drill prices every
          spot twice, once at the rate Pip’s AI players at Friends’ Garage bluff, the bottom of the
          ladder, and once at The Main Event’s, the top, where they bluff a good deal more. Those
          rates were measured from the AI players’ own river bets, not chosen.
        </p>
      </Section>

      <Section title="What we found">
        <p>
          Of {n(SHUFFLES)} shuffles, {n(HANDS)} left you with a hand you would have played and a
          pair or better of your own on the river. Each was priced at twelve bet sizes, from a fifth
          of the pot to twice it: {n(DECISIONS.total)} different decisions. In{' '}
          {n(DECISIONS.depends)} of them the call was right against one of those two players and
          wrong against the other.
        </p>
        <p>
          That share hardly moves with the size of the bet. Out of {n(HANDS)} hands, it is between{' '}
          {n(dependsLow)} and {n(dependsHigh)} at every size. What moves is the rest. Facing{' '}
          {SIZE_WORDS[smallest.label]}, the call was right against both players {n(smallest.call)}{' '}
          times and wrong against both {n(smallest.fold)} times. Facing {SIZE_WORDS[biggest.label]},
          it was right against both {n(biggest.call)} times and wrong against both {n(biggest.fold)}
          .
        </p>
        <p>
          Some of that is the price, and some is that the drill assumes a big bet is a stronger
          hand. Either way the lesson is a dull one. Against a small bet a pair is right to call
          about twice as often as it is right to fold, against a big one the other way round, and
          about one time in four the hand in front of you is not what decides it. The player is.
        </p>
      </Section>

      <Section title="What the drill does about it">
        <p>
          It leaves those out. A spot is only asked when the answer is the same against both
          players, and clear of the line by four points at each end. {n(ASKED)} of the {n(SHUFFLES)}{' '}
          shuffles became a question. So the drill never marks you wrong for a call that was right
          against the other player.
        </p>
        <p>
          A real table does not leave them out. There, knowing who bluffs is your job, and the price
          is the only part anybody can work out for you.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          <Src path="src/lib/drills/riverBluffCount.ts" /> deals the drill’s own spots, the same
          deal and prices the drill grades, and sorts each bet into right to call, right to fold, or
          depends. The model of what bets is <Src path="src/lib/drills/riverRange.ts" />, where the
          measured bluffing rates are written down. The counts on this page are in{' '}
          <Src path="src/config/riverBluffs.ts" />, and <Src path="tests/riverBluffCount.test.ts" />{' '}
          counts them again on every build.
        </p>
        <p>
          Every win share is exact against the model: each hand they could hold is compared with
          yours once. They are counts over a model of what bets, not over hands people played.
          Boards that make two pair on their own are left out, as the drill leaves them out.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Calling the river is a drill in the{' '}
          <Link
            href={`${membershipFor('river')}&from=blog&post=calling-a-river-bet`}
            className={linkClass}
          >
            membership
          </Link>
          . The page that link opens deals one spot from it. <em>What have you got?</em> and{' '}
          <em>Which hand wins?</em> stay free, with the ladder, the Rail, the Daily and the
          freeroll.
        </p>
      </Section>
    </LegalPage>
  )
}
