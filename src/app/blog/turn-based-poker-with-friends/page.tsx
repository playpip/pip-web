import type { Metadata } from 'next'
import Link from 'next/link'
import { Correction, LegalPage, Section, Src } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { membershipFor } from '@/config/membership'
import { ENDING_HANDS, MAX_SLOW_GAMES, MOVE_HOURS, SLOW_SEATS } from '@/lib/multiplayer/slow'

const post = BLOG_POSTS.find((p) => p.slug === 'turn-based-poker-with-friends')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

/** "1, 4, 12 or 24", from the list the server checks against. */
function either(values: readonly number[]): string {
  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`
}

export default function TurnBasedPokerPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Correction date="26 October 2026">
        <p>
          Two things below stopped being true within three days. Since 25 October anyone with a free
          Pip account can host one slow game at a time, and open one live room a day; the membership
          hosts as many as you like. And since 24 October a slow table has camera and voice, the
          same as a live room, for when you both happen to be there.
        </p>
      </Correction>

      <Section title="The short version">
        <p>
          A slow game is a private Texas Hold’em table where each move gets hours, not seconds. You
          check on the bus, your friend calls after lunch, the river comes the next morning. Nobody
          has to be free at the same time, which for most groups of friends is the whole problem.
        </p>
        <p>
          The host needs the membership. Everybody else needs a free account and the invite. The
          chips are play chips.
        </p>
      </Section>

      <Section title="What the host picks">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {either(SLOW_SEATS)} seats, heads-up unless you change it, and no AI players in the
            empty ones;
          </li>
          <li>time for each move: {either(MOVE_HOURS)} hours;</li>
          <li>
            how it ends: last player standing, after {either(ENDING_HANDS)} hands, or on a date,
            when the hand in play finishes and the biggest stack wins;
          </li>
          <li>
            the stake, starting chips, how fast the blinds climb, and whether the chips come from
            the Roll or it is just for fun, the same as{' '}
            <Link href="/blog/poker-night-with-friends-online" className={linkClass}>
              a live room
            </Link>
            .
          </li>
        </ul>
        <p>
          The blinds climb by hands played, not by the hour, so a game that takes a fortnight is not
          all blinds by the end of it. You can be in {MAX_SLOW_GAMES} slow games at once, which is
          more than most people have friends who answer.
        </p>
      </Section>

      <Section title="The clock stops while you sleep">
        <p>
          Each player sets their own quiet hours, 23:00 to 08:00 unless they change them, in their
          own timezone. Your move clock does not run during yours. A one-hour clock that starts at
          22:30 has half an hour that night and half an hour after eight the next morning, and the
          clocks going back in October is handled too. The arithmetic is in{' '}
          <Src path="src/lib/multiplayer/slow.ts" />.
        </p>
        <p>
          Run out of time and Pip checks for you if it can and folds if it can’t. Do that twice in a
          row and you are sat out, moved for straight away, until you next open the game.
        </p>
      </Section>

      <Section title="Moves set in advance">
        <p>
          While somebody else is thinking, you can set check/fold, check, or call. When the turn
          reaches you, it is made for you if it still makes sense. A call lapses if the bet changes,
          and everything lapses when the street ends. Nobody else at the table is told what you set.
          Live rooms have these now too.
        </p>
      </Section>

      <Section title="What you missed">
        <p>
          Open a game after a day away and the hands you missed play out on the felt, move by move,
          before you get the table back. There is a Skip. A slow game keeps its last ten hands for
          this. Each one is dealt again from the moves that were made, and if the replay does not
          end where the real hand did, it isn’t shown. A wrong replay is worse than none. The
          rebuild is <Src path="src/lib/multiplayer/catchUp.ts" />.
        </p>
      </Section>

      <Section title="Being told it is your move">
        <p>
          Pip asks once, at your first slow game’s table, whether it may send notifications. Say yes
          and you get one when it is your move. On an iPhone, a browser can only do that once Pip is
          on your Home Screen.
        </p>
        <p>
          Email is on unless you turn it off. It comes only if a move has waited a quarter of its
          clock, or five minutes when there is no device to notify. One email lists every game
          waiting on you, at most one every twelve hours, and each has a link that turns them off in
          one tap. Nothing arrives during your quiet hours, or while you have the table open. The
          rules are <Src path="src/lib/multiplayer/notices.ts" />, and the switches are under
          Settings, Slow games.
        </p>
      </Section>

      <Section title="What it doesn’t do">
        <p>
          It is Hold’em only, there are no cameras at a slow table, and there is no real money and
          no way to add any. A game nobody starts is cleared after three days, and a finished one
          stays on Pip’s Home for a week, long enough to mention it to the loser.
        </p>
      </Section>

      <Section title="Where it is">
        <p>
          Opening a slow game is part of the{' '}
          <Link
            href={`${membershipFor('multiplayer')}&from=blog&post=turn-based-poker-with-friends`}
            className={linkClass}
          >
            membership
          </Link>
          , as is opening a live room. Joining a friend’s game is free, and so are the ladder, the
          Rail, the Daily and the freeroll.
        </p>
      </Section>
    </LegalPage>
  )
}
