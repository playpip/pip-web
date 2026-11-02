import type { Metadata } from 'next'
import Link from 'next/link'
import { Correction, LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'poker-night-with-friends-online')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function PokerNightPost() {
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

      <Section title="The short version">
        <p>
          One person opens a private room on Pip and sends the others a link. Up to eight of you sit
          at one Texas Hold’em table, with your cameras and mics on if you want them. The host needs
          the membership. Everybody else needs a free account and the link.
        </p>
        <p>
          The chips are play chips. Nobody owes anybody anything at the end, which used to be the
          hardest part of the evening.
        </p>
      </Section>

      <Section title="Who deals">
        <p>
          Our server does. It shuffles, deals, and sends each player their own two cards and nobody
          else’s, until a showdown turns them over. Nobody has to hold a deck up to a webcam and
          read out the flop. How that works, and the test that checks it, is in{' '}
          <Link href="/blog/your-cards-stay-on-the-server" className={linkClass}>
            Your cards stay on the server
          </Link>
          .
        </p>
      </Section>

      <Section title="What the host sets">
        <p>Before the first hand, the host picks:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>the seats, from two to eight;</li>
          <li>the stake, one of the ladder’s, which sets the chips and the blinds;</li>
          <li>starting chips: standard, deep or very deep;</li>
          <li>blinds: slow, normal, turbo, or fixed so they never rise;</li>
          <li>time to act: 15, 30 or 60 seconds;</li>
          <li>what happens when somebody leaves;</li>
          <li>whose chips: from the Roll, or just for fun.</li>
        </ul>
        <p>
          Everybody at the table can read the rules. Only the host can change them, and only before
          the deal. The game is a sit-and-go: the same stack each, the blinds climb unless you fixed
          them, and the last player with chips wins. The rules live in{' '}
          <Src path="src/lib/multiplayer/room.ts" />.
        </p>
      </Section>

      <Section title="Whose chips">
        <p>
          The Roll is the bankroll you carry up Pip’s ladder. <em>From the Roll</em> takes the
          buy-in from each player’s Roll and pays the winner the buy-in times the seats.{' '}
          <em>Just for fun</em> takes nothing and pays nothing.
        </p>
        <p>
          Either way the chips are never for sale, and nobody at the table sees anybody else’s Roll
          or rank. The membership changes nothing once the cards are dealt. A host who pays plays
          the same cards as a friend who didn’t.
        </p>
      </Section>

      <Section title="Faces and voices">
        <p>
          Both are off until you tap them. Turn the camera on and your face takes your seat where
          the avatar was. Turn the mic on and the room hears you. The picture is 320 by 240 at 15
          frames a second, which is enough to see somebody trying not to smile.
        </p>
        <p>
          Video and voice go between players’ browsers; the room server passes on the messages that
          connect them. Tap anybody’s seat to mute them or hide their camera, for you only. Report
          and block are on the same sheet. A blocked player’s camera and voice stop reaching you,
          and they are not told.
        </p>
      </Section>

      <Section title="When somebody gets up">
        <p>
          Stand up mid-game and the host’s rule decides. With <em>Keep their seat</em>, your chips
          stay and your hands fold until you sit back down. With <em>They’re out</em>, you are out
          after the hand in progress, which is how some poker nights have always ended.
        </p>
        <p>
          Short of people? Before the deal the host can fill empty chairs with Pip’s regulars, the
          same characters you meet on the ladder.
        </p>
      </Section>

      <Section title="What it doesn’t do">
        <p>
          It is Hold’em only. There is no real money and no way to add any. A room is cleared half
          an hour after its game ends, so there is no record of who won last week. You will have to
          remember that yourselves, and you will.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Opening a room is part of the{' '}
          <Link
            href={`${membershipFor('multiplayer')}&from=blog&post=poker-night-with-friends-online`}
            className={linkClass}
          >
            membership
          </Link>
          , and that page says what else is in it. Joining a friend’s room is free, and so are the
          ladder, the Rail, the Daily and the freeroll.
        </p>
      </Section>
    </LegalPage>
  )
}
