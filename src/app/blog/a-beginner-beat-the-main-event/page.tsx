import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'a-beginner-beat-the-main-event')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function BeginnerBeatTheMainEventPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The hardest table">
        <p>
          The Main Event is the top of Pip’s ladder. Its tagline says near-optimal and merciless.
          The person who built Pip has played poker for two months, and was beating it, mostly by
          betting.
        </p>
        <p>
          That is either good news about the player or bad news about the table. We went to find out
          which.
        </p>
      </Section>

      <Section title="Bots against scripts">
        <p>
          Pip already had simulations that play the bots against each other. Those can never find a
          hole every bot shares, because the bot on the other side of the table has the same hole.
          So we wrote <Src path="scripts/exploit-sim.ts" />, which sits a scripted player at a real
          table against the real bots.
        </p>
        <p>
          The scripts play the way beginners play. One bets the pot every time it can. One calls
          everything. One only bets a strong hand. One shoves all-in or folds. One raises every hand
          it plays and bets every street it is checked to. And one plays the line most people find
          first: raise a decent hand, bet the flop whatever it brings, bet the turn again if checked
          to, and give up if anybody fights back.
        </p>
      </Section>

      <Section title="Seven folds in ten">
        <p>
          When that last script raised before the flop and the flop was checked to it, the Main
          Event folded to a bet of two-thirds of the pot 71% of the time.
        </p>
        <p>
          A two-thirds pot bet risks two chips to win three. It breaks even if it takes the pot two
          times in five, which is 40%, and that holds whatever cards you have. At 71% you can make
          that bet with any two cards and come out ahead before anybody shows a hand.
        </p>
        <p>
          In 600 tournaments at the Main Event the script won 117. A fair share at six seats is 100.
        </p>
      </Section>

      <Section title="Why the best bots folded">
        <p>
          Every bot read your hand off the chips you had put in. A raise before the flop and a bet
          after it added up to one of the strongest hands you could hold, whoever made them. That is
          the right read of somebody who only bets when they have it. It is exactly the wrong read
          of somebody who bets every time, and the bots could not tell the two apart. They had no
          memory of who they were playing.
        </p>
      </Section>

      <Section title="What changed">
        <p>
          <strong>The bots remember you.</strong> <Src path="src/lib/poker/ai/memory.ts" /> counts,
          for every player at the table, how often they raise before the flop, how often they bet
          after it, and how often they fold when bet into. Everybody starts out as a typical player,
          and a few orbits move the count where one hand cannot. A bet from somebody who bets
          everything says less, so the bots call it down and raise it back. Against somebody who
          folds a lot, they bluff more.
        </p>
        <p>
          The same flop bet now gets folded to 62% of the time from a stranger, and 27% of the time
          from a player the table has watched bet the pot at every chance.
        </p>
        <p>
          <strong>A bet is read by its size against this street’s pot</strong>, with a smaller
          weight for earlier streets, instead of counting every chip in the hand as proof. That is{' '}
          <Src path="src/lib/poker/ai/policy.ts" />.
        </p>
        <p>
          <strong>Short stacks play the chart.</strong> At fifteen big blinds or fewer, first in or
          facing one shove, the strong bots go all-in or fold from the same solved chart Pip’s
          shove-or-fold drill teaches (<Src path="src/lib/poker/ai/pushFold.ts" />
          ). The blinds here climb every few hands, so a lot of a tournament is played that short.
          The Main Event plays off the chart every time. Lower tables do it less often.
        </p>
        <p>
          <strong>Bet sizes stop giving the hand away</strong> from the middle of the ladder up. A
          bluff there is sized more like a bet for value, and at the top they look the same. The
          lower tables keep the tell on purpose. A table you can read is where you learn to read.
        </p>
        <p>With all of that in, the same script won 83 of 600 at the Main Event, down from 117.</p>
      </Section>

      <Section title="Then they learned the story">
        <p>
          A second change went in the same afternoon. The bots now read the hand as a sequence, not
          a pile of chips: who raised before the flop, who check-raised, who has led every street.
          The raiser bets the flop more often. A big hand sometimes checks to the raiser so it can
          raise later. A seat that has bet every street can finish the bluff on the river. And the
          table’s count of how often you fold now changes how often it bluffs you.
        </p>
        <p>
          In 300 tournaments against that table, where a fair share is 50, the c-bet script won 44.
          The one that bets every street it is checked to won 24.
        </p>
      </Section>

      <Section title="How sure we are">
        <p>
          Six hundred tournaments is not many. A player no better than the table wins 117 or more
          about one time in 27 by luck alone, so 117 on its own would not have convinced us. The
          fold rate did. Seven folds in ten against a break-even of four in ten is arithmetic, and a
          strategy that profits on most flops was always going to show up in the results.
        </p>
        <p>
          The 44 in 300 says less. A player exactly as good as the table lands there or lower about
          one time in five, so it says the c-bet stopped winning big, and nothing finer than that.
          The 24 is a different matter: luck gets that low about once in a hundred thousand tries.
        </p>
        <p>
          To make 600 tournaments finish, those runs held each bot to 300 simulated hands per
          decision. The real Main Event thinks through 1,800. And these are scripts, not people. A
          script does not get bored, change gear or notice that the table has started calling. The
          real test is a person sitting back down at the Main Event, and that one is open to anybody
          who gets there.
        </p>
      </Section>

      <Section title="For the human at the table">
        <p>
          Betting all the time works against opponents who do not adjust. Against a table that is
          watching, a bet that never means anything stops buying folds and starts getting called.
          The Main Event watches now.
        </p>
        <p>
          The ladder, the Rail, the Daily and the freeroll stay free. The shove-or-fold drill the
          bots learned from is in the{' '}
          <Link
            href={`${membershipFor('drills')}&drill=shove-or-fold&from=blog`}
            className={linkClass}
          >
            membership
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
