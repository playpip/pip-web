import type { Metadata } from 'next'
import Link from 'next/link'
import { Correction, LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'your-cards-stay-on-the-server')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function YourCardsStayOnTheServerPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Correction date="26 October 2026">
        <p>
          Below, this post says hosting needs the membership. Since 25 October anyone with a free
          Pip account can open one room a day, play one quick match a day and host one slow game at
          a time. The membership opens as many as you like.
        </p>
      </Correction>

      <Section title="Two kinds of table">
        <p>
          A single-player game of Pip runs in your browser. The deck is in the tab with you, and so
          are the bots’ cards. Anybody who opens the developer tools can read them. That has never
          mattered, because the only person you can cheat there is you.
        </p>
        <p>
          On 11 October Pip got multiplayer: private rooms you open for your friends, and quick
          match at the ladder’s stakes. Once there is another person at the table, a card in your
          browser is a card somebody can read.
        </p>
      </Section>

      <Section title="Face down is only a picture">
        <p>
          A card drawn face down is a drawing. If the browser was sent the card, the drawing is all
          that hides it. So a room is not dealt in anybody’s browser. Our server deals it, and keeps
          the deck and every hole card.
        </p>
        <p>
          Each player is sent their own copy of the table, made by{' '}
          <Src path="src/lib/multiplayer/view.ts" />. The deck is emptied. Everybody else’s cards
          are taken out, and only how many each player holds is left, so the backs can still be
          drawn. Cards come back only for the players a showdown turns over. A pot won when
          everybody else folds shows nothing to anyone.
        </p>
        <p>
          Account ids stay on the server too. Nobody at a table needs one, and a list of them is the
          first thing anyone collecting accounts would want.
        </p>
      </Section>

      <Section title="Every step, not one hand">
        <p>
          A test that checks one hand picked to pass tells you about that hand.{' '}
          <Src path="tests/multiplayerView.test.ts" /> plays twelve seeded games instead, and at
          every step checks the copy each person at the table would be sent, and the copy someone
          watching would get. None may carry the deck, and none may carry a card its reader is not
          entitled to see.
        </p>
      </Section>

      <Section title="The AI players">
        <p>
          The server does hand its bots the whole table, every card included, which is a fair thing
          to be suspicious of. The bots’ decisions read their own cards, the board and how everybody
          has bet. They guess at your hand from your betting, the same way a person would.
        </p>
        <p>
          We wanted that pinned rather than promised, so{' '}
          <Src path="tests/multiplayerBotsSeeOwnCards.test.ts" /> makes every bot decision twice in
          a seeded game: once from the whole table, once from the copy a person in that seat would
          be sent, with the same dice. The two must match. To check the test could fail, we made a
          bot look at one opponent’s cards. It failed.
        </p>
        <p>
          In quick match, AI players take any seat that has not filled after about thirty seconds.
          Each one has an AI tag on its name plate.
        </p>
      </Section>

      <Section title="What this does not do">
        <p>
          You cannot check a room’s shuffle. The server shuffles, and nothing yet lets you verify it
          afterwards. The Daily Deal is still the only thing on Pip you can deal again yourself.
        </p>
        <p>
          The members’ view of the rest of a game after you bust, every hand face up, stays at the
          single-player tables. At a room the server has nothing to send it.
        </p>
        <p>
          And none of this makes a room tamper-proof. It means one thing: your cards are not in
          anybody else’s browser until you show them.
        </p>
      </Section>

      <Section title="Dealing your friends in">
        <p>
          A member opens a room and sends the code. Friends join free with a Pip account, camera and
          voice if they want them. Multiplayer is part of the{' '}
          <Link
            href={`${membershipFor('multiplayer')}&from=blog&post=your-cards-stay-on-the-server`}
            className={linkClass}
          >
            membership
          </Link>
          . The ladder, the Rail, the Daily and the freeroll stay free.
        </p>
      </Section>
    </LegalPage>
  )
}
