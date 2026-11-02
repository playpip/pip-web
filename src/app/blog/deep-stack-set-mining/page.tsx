import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { FLOPS, FLOPS_WITH_YOUR_RANK } from '@/config/flopSet'
import { membershipFor } from '@/config/membership'
import {
  MISSES_PER_HIT,
  SET_MINE_RAISE_BB,
  SET_MINE_STACK_BB,
  SET_MINE_TABLES,
} from '@/config/setMining'

const post = BLOG_POSTS.find((p) => p.slug === 'deep-stack-set-mining')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

const n = (count: number) => count.toLocaleString('en-GB')

const missesPerHit = MISSES_PER_HIT.toFixed(1)
const stackNeeded = Math.ceil(SET_MINE_STACK_BB)
const deepHands = SET_MINE_TABLES.map((row) => row.deep.hands)
const ladderHands = SET_MINE_TABLES.map((row) => row.ladder.hands)

export default function DeepStackSetMiningPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The call">
        <p>
          Set mining is calling a raise with a small pair for one reason: to flop three of a kind.
          If the flop misses, you fold. If it hits, you hope somebody has a hand they like.
        </p>
        <p>
          The flop brings your third card {n(FLOPS_WITH_YOUR_RANK)} times in {n(FLOPS)} (
          <Link href="/learn/how-often-do-you-flop-a-set" className={linkClass}>
            how often you flop a set
          </Link>{' '}
          has the full count). The other {n(FLOPS - FLOPS_WITH_YOUR_RANK)} times it does not. That
          is {missesPerHit} misses for every hit, and every miss costs the call.
        </p>
      </Section>

      <Section title="What the hit has to win">
        <p>
          Say the raise is to {SET_MINE_RAISE_BB} big blinds. Each miss costs {SET_MINE_RAISE_BB},
          so to break even each hit has to win back {missesPerHit} of those, about{' '}
          {Math.round(SET_MINE_RAISE_BB * MISSES_PER_HIT)} big blinds, on top of the{' '}
          {SET_MINE_RAISE_BB} it cost. Call it {stackNeeded} big blinds in front of you.
        </p>
        <p>
          The raiser needs them too. You can only win what they have, so the number that counts is
          the smaller of the two stacks.
        </p>
        <p>
          And {stackNeeded} is the floor. It assumes every set wins and every raiser pays you all of
          it. Sets lose, and people fold. The real number is higher, but nobody can tell you by how
          much without knowing who you are playing.
        </p>
      </Section>

      <Section title={`How long a table keeps ${stackNeeded} big blinds`}>
        <p>
          In a tournament the blinds go up, so the same stack is worth fewer big blinds every level.
          Here is how many hands each of Pip’s tables deals before the stack you sat down with is
          under {stackNeeded} big blinds, with the ladder table and Deep Stack at the same buy-in
          side by side.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {SET_MINE_TABLES.map(({ deep, ladder }) => (
            <li key={deep.table.id}>
              {n(deep.table.buyIn)} chips: {ladder.table.name} starts you at{' '}
              {Math.round(ladder.startBigBlinds)} big blinds and keeps {stackNeeded} for{' '}
              {ladder.hands} hands. Deep Stack starts you at {deep.startBigBlinds} and keeps it for{' '}
              {deep.hands}.
            </li>
          ))}
        </ul>
        <p>
          The ladder gives you {Math.min(...ladderHands)} to {Math.max(...ladderHands)} hands of set
          mining. Deep Stack gives you {Math.min(...deepHands)} to {Math.max(...deepHands)}, more
          than three times as many at every price. With three times the chips and the same opening
          blinds, the blinds have to climb three times as high before the stack runs short, and Deep
          Stack’s levels last twelve hands at every price.
        </p>
      </Section>

      <Section title="What this does not count">
        <p>
          It counts the stack you sat down with. Win a pot and you are deeper than this, lose one
          and you are shorter, and the raiser’s stack moves the same way. Nor does anyone at the
          table promise to raise to {SET_MINE_RAISE_BB} big blinds. Treat the numbers as a clock,
          not a forecast: they say when the blinds alone stop the call paying, and nothing about
          your cards.
        </p>
      </Section>

      <Section title="How we counted">
        <p>
          <Src path="src/config/setMining.ts" /> takes the flop count from the same file the set
          guide prints it from, and walks each table’s blinds hand by hand through{' '}
          <Src path="src/config/blinds.ts" />, which is what the tables post their blinds with.{' '}
          <Src path="tests/setMining.test.ts" /> deals every flop again to recount the{' '}
          {n(FLOPS_WITH_YOUR_RANK)}, and checks every figure on this page. Change a table’s blinds
          and this page changes with it, or the build fails.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Deep Stack is a side table in the{' '}
          <Link
            href={`${membershipFor('rooms')}&from=blog&post=deep-stack-set-mining`}
            className={linkClass}
          >
            membership
          </Link>
          , at five prices from {n(SET_MINE_TABLES[0].deep.table.buyIn)} to{' '}
          {n(SET_MINE_TABLES[SET_MINE_TABLES.length - 1].deep.table.buyIn)}. The ladder stays free,
          and so does folding your sevens.
        </p>
      </Section>
    </LegalPage>
  )
}
