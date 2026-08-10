import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Wordmark } from './Wordmark'

/**
 * The one site footer — shared by the landing page and the prose pages so the
 * chrome never shifts between routes. Quiet link columns, no anchors back into
 * page sections.
 */

const FOOTER_GROUPS: {
  title: string
  links: { label: string; href: string; external?: boolean }[]
}[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Learn poker', href: '/learn' },
      // The one internal link into the free-poker landing page. A page nothing
      // links to is a page a crawler reaches only through the sitemap, and this
      // is the label it would want to be found under anyway.
      { label: 'Free poker, no signup', href: '/play-poker-free-no-signup' },
      { label: 'Blog', href: '/blog' },
      { label: 'Credits', href: '/credits' },
      // A quiet text link rather than an icon: we have exactly one social
      // account, and a row built for one icon reads as a placeholder.
      { label: 'X', href: 'https://x.com/playpipio', external: true },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: 'https://github.com/playpip/pip-web', external: true },
      {
        label: 'Roadmap',
        href: 'https://github.com/playpip/pip-web/blob/main/ROADMAP.md',
        external: true,
      },
      {
        label: 'Contributing',
        href: 'https://github.com/playpip/pip-web/blob/main/CONTRIBUTING.md',
        external: true,
      },
    ],
  },
  {
    title: 'The fine print',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-foreground/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-10 px-6 py-12 md:flex-row md:px-10">
        <div>
          <Wordmark />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Casual Texas Hold’em, redesigned. Free, open source, and play money — never real
            gambling.
          </p>
          <div className="mt-5">
            <ThemeToggle />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium">{group.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="transition hover:text-foreground">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
