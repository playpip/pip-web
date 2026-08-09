import type { Metadata } from 'next'
import Link from 'next/link'
import { A, LegalPage } from '@/components/marketing/LegalPage'
import { BLOG_POSTS, formatPostDate } from '@/config/blog'
import { contentAlternates } from '@/config/site'

export const metadata: Metadata = {
  title: 'Blog · Pip',
  description:
    'Notes from the Pip table — what shipped, what changed, and the occasional hand worth talking about.',
  alternates: contentAlternates('/blog'),
}

export default function BlogIndexPage() {
  return (
    <LegalPage
      title="Blog"
      subtitle="Notes from the table — what shipped, what changed, and the occasional hand worth talking about."
    >
      <ul className="space-y-8">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="group block">
              <p className="text-sm text-muted-foreground">{formatPostDate(post.date)}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight transition group-hover:text-foreground/80">
                {post.title}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                {post.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-[15px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Follow along:</span>{' '}
        <A href="/rss.xml">RSS</A>. No email, no account, no unsubscribe link to hunt for.
      </p>
    </LegalPage>
  )
}
