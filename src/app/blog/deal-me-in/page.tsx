import type { Metadata } from 'next'
import { LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'deal-me-in')!

export const metadata: Metadata = postMetadata(post)

export default function DealMeInPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          When you make a player, the next screen offers a short tour or a button that says{' '}
          <em>Deal me in</em>. Until 30 September that button took you to the lobby, which is a lot
          of things to choose between and none of them a hand of cards. In September, 217 people
          made a player and 149 of them played a hand within the hour. The other 68 made a
          character, picked a face for it, and did not play a hand that hour.
        </p>
        <p>Now the button deals you in. It seemed the least we could do, given the name.</p>
      </Section>

      <Section title="It wasn’t the tour">
        <p>
          The obvious suspect was the tour, since it sits between making a player and playing. It
          was innocent. Of the 77 who took it, 52 went on to play a hand. Of the 140 who skipped it,
          97 did. Two in three either way, which says people were leaving at the page both routes
          ended on, and that page was the lobby.
        </p>
        <p>
          The lobby is fine for someone who knows what the Rail is. For someone who has been a poker
          player for forty seconds, it is a menu at a restaurant they have not decided to eat at.
        </p>
      </Section>

      <Section title="What changed">
        <p>
          <em>Deal me in</em>, the tour’s <em>Take a seat</em>, and <em>Skip</em> on a tour you
          started from that screen all go straight to a table now. Which table is the same pick the
          lobby’s <em>Next up</em> card makes, so the two can’t disagree; for a new player it is
          Friends’ Garage. That pick lives in <Src path="src/components/onboarding/firstSeat.ts" />,
          which is short. If you haven’t made a player yet, you still go to the page that makes one.
        </p>
        <p>The lobby is still there. You just meet it after you’ve seen a card.</p>
      </Section>

      <Section title="What we don’t know yet">
        <p>
          Whether it worked. The numbers above come from our analytics, which count browsers rather
          than people, over one month. We will read the same step again at the end of October. If it
          hasn’t moved, the lobby wasn’t the problem either, and we will say so here.
        </p>
      </Section>
    </LegalPage>
  )
}
