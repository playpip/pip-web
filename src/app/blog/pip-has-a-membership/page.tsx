import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate, postMetadata } from '@/config/blog'
import { MEMBERSHIP_PRICE, SELLER } from '@/config/membership'

const post = BLOG_POSTS.find((p) => p.slug === 'pip-has-a-membership')!

export const metadata: Metadata = postMetadata(post)

const linkClass =
  'font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground'

export default function PipHasAMembershipPost() {
  return (
    <LegalPage
      title={post.title}
      subtitle={formatPostDate(post.date)}
      back={{ href: '/blog', label: 'All posts' }}
    >
      <Section title="The short version">
        <p>
          Pip has a membership. {MEMBERSHIP_PRICE.monthly} a month or {MEMBERSHIP_PRICE.annual} a
          year. We waited to write this until a real card had gone through it and come out the other
          side.
        </p>
      </Section>

      <Section title="What it buys">
        <p>
          The side tables, Pot-Limit Omaha, Short Deck, Omaha Hi-Lo, Five-Card Draw, and blackjack,
          for some reason. Levels 2 to 5 of Lessons with Webb, every drill, Session review, and the
          members’ shelf. The full list is on{' '}
          <Link href="/membership" className={linkClass}>
            /membership
          </Link>
          , which is built from the same file the game reads, so it cannot list something that is
          not built.
        </p>
      </Section>

      <Section title="What it doesn’t">
        <p>
          The ladder, the Rail, the Daily and the freeroll are free forever. Level 1, every written
          guide, the odds calculator and the per-hand read are free too. Nothing you can buy changes
          a hand.
        </p>
      </Section>

      <Section title="On your statement">
        <p>
          It is sold by {SELLER.name}, so your statement says <code>{SELLER.statement}</code>. To
          cancel: Settings, Membership, Manage. We don’t ask why.
        </p>
      </Section>
    </LegalPage>
  )
}
