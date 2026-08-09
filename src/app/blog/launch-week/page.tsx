import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, A } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate } from '@/config/blog'
import { contentAlternates } from '@/config/site'

const post = BLOG_POSTS.find((p) => p.slug === 'launch-week')!

export const metadata: Metadata = {
  title: `${post.title} · Pip`,
  description: post.description,
  alternates: contentAlternates(`/blog/${post.slug}`),
}

export default function LaunchWeekPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          Pip launched on the 23rd. The plan for week one was to fix whatever broke. What actually
          happened is that strangers turned up with pull requests, so the week shipped more than the
          plan did: a new card back, four more hand nicknames, a quicker freeroll, and the blog
          you’re reading now. Posts like this one will appear whenever enough has shipped to be
          worth saying out loud.
        </p>
      </Section>

      <Section title="What day one already had">
        <p>
          For anyone arriving via this post rather than the launch: the first version was not a
          skeleton. Pip shipped with a ladder of venues, from Friends’ Garage up to The Main Event,
          and a cast of named opponents with their own personalities and long memories of how you
          play. Every hand gets a permalink that replays it step by step, the Daily Deal gives
          everyone in the world the same shuffle once a day, and an avatar creator and Chip Shop
          handle the cosmetics — none of which ever touch gameplay. The whole thing installs as an
          app and works offline, and there is still no account behind any of it: your profile lives
          in your browser and moves to another device by QR code when you want it to.
        </p>
      </Section>

      <Section title="Three strangers, four pull requests">
        <p>
          Awanthi Malawanage added the Lilac card back to the Chip Shop. Mochammad Fadhlan
          Al-Ghiffari stocked the deck with four established starting-hand nicknames — the
          Oldsmobile, the Big Lick, Antony and Cleopatra, and Katie — each of which pays a bonus
          chip when you win with it. Peter Z added test coverage on launch day, then came back two
          days later and added more.
        </p>
        <p>
          All three names now ship on the{' '}
          <Link
            href="/credits"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
          >
            credits page
          </Link>
          , which is the deal: contribute, and the site remembers. If you’d like your name there
          too, the shelf of{' '}
          <A href="https://github.com/playpip/pip-web/labels/good%20first%20issue">
            good first issues
          </A>{' '}
          is kept stocked.
        </p>
      </Section>

      <Section title="House changes">
        <p>
          Friends’ Garage — the table you can always afford — now seats three instead of four, with
          the prize trimmed to 300 chips to match. Fewer opponents means a shorter tournament, which
          matters most at the venue you visit when you’re broke. Two first-visit glitches are gone
          as well: the landing video no longer replays itself, and the reload button now, in fact,
          reloads.
        </p>
      </Section>

      <Section title="Under the hood">
        <p>
          The site gained a sitemap and a robots.txt, which it had somehow launched without. Every
          content page now also mirrors itself as plain markdown — add <code>.md</code> to the end
          of the address — with an index at <code>/llms.txt</code>, for readers who prefer their web
          without the styling. And every pull request now runs the full test gate before merge: the
          same one we use, because contributors’ code is our code once it lands.
        </p>
      </Section>

      <Section title="What's next">
        <p>
          The most-requested feature of launch week is coaching: Pip watching how you play and
          telling you what it noticed. Two different people asked for it on day one, in nearly the
          same words, so it’s now{' '}
          <A href="https://github.com/playpip/pip-web/issues/18">issue #18</A> and the conversation
          about what it should look like is happening there — join in if you have opinions. The rest
          of the direction lives in the{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md">roadmap</A>, in the
          open, as usual.
        </p>
      </Section>
    </LegalPage>
  )
}
