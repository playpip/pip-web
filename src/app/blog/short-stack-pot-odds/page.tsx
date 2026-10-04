import type { Metadata } from 'next'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'short-stack-pot-odds')!

export const metadata: Metadata = postMetadata(post)

export default function ShortStackPotOddsPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          There are 500 chips in the middle. Someone bets 1000. You have 300 left. The usual pot
          odds sum says you pay 1000 to win 1500, so you need a quarter of the pot. That sum is
          wrong twice over, because you are not paying 1000 and you are not playing for 1500.
        </p>
        <p>
          Our session review made both mistakes, and the report and the read you get after a hand
          made the second one. All three are fixed. This is the right sum, and what the wrong one
          told people.
        </p>
      </Section>

      <Section title="You call for what you have">
        <p>
          A bet bigger than your stack does not cost you the bet. It costs you your stack. Calling
          puts your 300 in and you are all in, which is what the engine charges and what the{' '}
          <em>Call</em> button already said.
        </p>
        <p>
          The other 700 of their bet is not yours to win either. Nobody matched it. With one
          opponent it goes straight back to them; with more, it starts a side pot you have no claim
          on. What you are playing for is the 500 that was there, plus your 300, plus the 300 of
          theirs you covered: 1100.
        </p>
        <p>
          Pot odds are what you put in over the pot you could take, your call included: 300 out of
          1100, about 27%. The wrong sum, 300 out of the full 1800, says about 17%. A hand with 20%
          to win looks like a call on the wrong sum and loses 80 chips on the right one.
        </p>
      </Section>

      <Section title="What the review said">
        <p>
          The review steps back through your session and grades every move at the table, yours and
          the regulars’, against the cards everyone actually held. For anybody but you it worked out
          the price from the chips in front of each seat, and it priced a short stack at the full
          bet, against the full pot.
        </p>
        <p>
          Take the same spot, blinds at 10 and 20, with the short stack holding 35% against the
          bettor. The wrong sum takes 35% of a 2500 pot and charges 1000 for it: minus 125. Folding
          saved 125 chips, so the review marked the fold as good. The right sum takes 35% of 1100
          and charges 300: plus 85. The fold gave up 85 chips, about four big blinds. The review
          told you the opposite of what happened, with a number attached, which is the worst way to
          be wrong.
        </p>
        <p>
          The fix is in <Src path="src/lib/review/moveGrade.ts" />: call for the smaller of the bet
          and the stack, and take what nobody could match out of the pot. A test pins the spot above
          at minus 85.
        </p>
        <p>
          The report and the read after a hand work from somewhere else: a note the game makes when
          you act. That note charged you the right 300 and still counted the whole pot, so both
          judged your short calls on the 17% sum. <Src path="src/lib/coach.ts" /> now leaves the
          unmatched chips out. Sessions saved before the fix keep the old note, so the report still
          grades those spots the old way.
        </p>
      </Section>

      <Section title="While we were in there">
        <p>
          The report that comes with the review had a smaller habit of the same kind. Under{' '}
          <em>You pay off too often at the end</em>, its <em>See the hands</em> list could show a
          hand you folded, which is a strange way to prove you pay off. Only calls go there now, and
          folds already saved on your profile are left out when the list is drawn.
        </p>
      </Section>

      <Section title="Why short stacks">
        <p>
          Every venue on the ladder is a tournament, and tournaments end in short stacks. A short
          stack’s whole hand is often one call. If the number on that call is wrong, there is no
          second decision to make up for it.
        </p>
      </Section>
    </LegalPage>
  )
}
