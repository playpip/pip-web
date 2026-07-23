import type { Metadata } from 'next'
import { A, LegalPage, Section } from '@/components/marketing/LegalPage'
import contributors from '@/data/contributors.json'

export const metadata: Metadata = {
  title: 'Credits · Pip',
  description: 'The people who build Pip. Open source, so the list writes itself.',
}

type Contributor = { login: string; avatar: string; url: string; contributions: number }

/**
 * Credits. The contributor list is generated at build time from the repo's
 * history (see scripts/gen-credits.mjs) — nobody maintains it by hand, and
 * nobody's added who didn't earn it. Land a change and you appear on the next
 * deploy. That's the whole pitch.
 */
export default function CreditsPage() {
  const people = contributors as Contributor[]

  return (
    <LegalPage title="Credits">
      <Section title="Built by whoever shows up">
        <p>
          Pip is open source, which means anyone can help build it — and these people have. This
          list isn&rsquo;t hand-picked: it&rsquo;s generated from the project&rsquo;s history every
          time the site is built. Land a change and your name shows up here on the next deploy.
        </p>
      </Section>

      <section className="mt-9">
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {people.map((p) => (
            <li key={p.login}>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 transition"
              >
                <img
                  src={p.avatar}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  className="size-10 shrink-0 rounded-full bg-foreground/5 ring-1 ring-foreground/10"
                />
                <span className="min-w-0 truncate text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
                  {p.login}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Section title="With thanks">
        <p>
          Not every contribution is a commit. Thanks to everyone who has playtested, filed a sharp
          bug report, or talked us out of a bad idea — it counts, even when git doesn&rsquo;t record
          it.
        </p>
      </Section>

      <Section title="Want to be on this list?">
        <p>
          The way on is simple: open a pull request that lands. Not a coder? Playtesting, design
          notes, and good bug reports are real contributions too — start with{' '}
          <A href="https://github.com/playpip/pip-web/blob/main/CONTRIBUTING.md">Contributing</A>,
          or pick up a{' '}
          <A href="https://github.com/playpip/pip-web/labels/good%20first%20issue">
            good first issue
          </A>
          .
        </p>
      </Section>
    </LegalPage>
  )
}
