import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, Correction, A } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'

const post = BLOG_POSTS.find((p) => p.slug === 'pip-is-live')!

export const metadata: Metadata = postMetadata(post)

export default function PipIsLivePost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Correction date="19 August 2026">
        <p>
          This post says “no accounts”. Pip has one now: optional, free, added on 3 August, and
          there to carry your progress to a second device. It is off unless you turn it on and
          nothing in the game asks for it, so <em>no account needed</em> still describes the way in.
          “No accounts” stopped being true after nine days. The sentence below is left as it
          shipped, because the date on this post is part of what it says.
        </p>
        <p>
          What we store, and what we do not, is in{' '}
          <Link
            href="/blog/two-devices-two-chip-counts"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
          >
            Two devices, two chip counts
          </Link>
          .
        </p>
      </Correction>

      <Section title="The short version">
        <p>
          Pip is single-player Texas Hold’em in the browser: real poker, against AI opponents with
          faces and personalities, at a table that doesn’t want anything from you. No accounts, no
          ads, no real money. It’s live at{' '}
          <Link
            href="/"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
          >
            playpip.io
          </Link>
          , and the whole codebase is open source.
        </p>
      </Section>

      <Section title="Why it exists">
        <p>
          Every free poker app we tried felt like a casino with the money filed off. Chip packs on a
          timer, spinning wheels, a shop between you and the table. The poker itself was an
          afterthought. We wanted the opposite: a calm table, the real rules, opponents worth
          reading, and nothing that’s trying to pull your wallet out of your pocket. That app didn’t
          seem to exist, so we built it.
        </p>
        <p>
          The house style is play money only, cosmetics that never touch gameplay, and no dark
          patterns of any kind. If that sounds like marketing, the nice thing about open source is
          you can check.
        </p>
      </Section>

      <Section title="Open, on purpose">
        <p>
          The code is MIT-licensed on <A href="https://github.com/playpip/pip-web">GitHub</A>. The
          poker engine is a pure, deterministic TypeScript module: give it the same seed and it
          deals the same hand, every time. That is what makes the Daily Deal checkable, since its
          seed comes from the date and everyone in the world plays the identical shuffle. An
          ordinary hand uses your browser’s own randomness, with no server in the loop to tilt it
          either way. Both cases come down to the same thing — you can read exactly how the cards
          come out.
        </p>
        <p>
          It’s already more than one person’s project: three contributors landed merged pull
          requests in the first days, and their names ship on the{' '}
          <Link
            href="/credits"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
          >
            credits page
          </Link>
          . If you’d like yours there too, the repo keeps a shelf of{' '}
          <A href="https://github.com/playpip/pip-web/labels/good%20first%20issue">
            good first issues
          </A>{' '}
          stocked.
        </p>
      </Section>

      <Section title="What's next">
        <p>
          The direction lives in the open in the{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/ROADMAP.md">roadmap</A>: more table
          life, a stronger path for new players, and deeper AI play. If something feels off, or a
          hand plays out strangely,{' '}
          <A href="https://github.com/playpip/pip-web/issues">open an issue</A> — every hand in Pip
          has a shareable permalink that replays it step by step, which makes a bug report unusually
          easy to believe.
        </p>
      </Section>
    </LegalPage>
  )
}
