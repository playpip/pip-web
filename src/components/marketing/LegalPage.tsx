import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Wordmark } from './Wordmark'

/**
 * The frame for the legal pages (Privacy, Terms). A narrow, readable column with
 * the marketing chrome — same wordmark and footer language as the landing page,
 * so leaving the app for the fine print still feels like Pip. Written in the
 * house voice, not legalese; see docs/brand.md.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-foreground/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6 md:px-8">
          <Link href="/" aria-label="Pip home" className="transition hover:opacity-80">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 md:px-8 md:py-20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>}
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-foreground/5">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-8 text-sm text-muted-foreground md:px-8">
          <Link href="/" className="transition hover:text-foreground">
            Home
          </Link>
          <Link href="/privacy" className="transition hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-foreground">
            Terms
          </Link>
          <Link href="/credits" className="transition hover:text-foreground">
            Credits
          </Link>
          <a
            href="https://github.com/playpip/pip-web"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}

/** A titled block of the document. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

/** A quiet dash-bulleted list. */
export function List({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2">{children}</ul>
}

export function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.6rem] size-1 shrink-0 rounded-full bg-foreground/30" />
      <span>{children}</span>
    </li>
  )
}

/** An external link, styled to sit calmly in body copy. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
    >
      {children}
    </a>
  )
}
