import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BackButton } from './BackButton'
import { Footer } from './Footer'
import { Wordmark } from './Wordmark'

/**
 * The frame for the prose pages (Privacy, Terms, the blog). A narrow, readable
 * column with the marketing chrome — same wordmark and footer language as the
 * landing page, so leaving the app for the fine print still feels like Pip.
 * Written in the house voice, not legalese; see docs/brand.md.
 */
export function LegalPage({
  title,
  updated,
  subtitle,
  back,
  children,
}: {
  title: string
  /** Renders as "Last updated {updated}" — for the legal pages. */
  updated?: string
  /** A plain line under the title (e.g. a blog post's date). */
  subtitle?: string
  /** A quiet back link above the title (e.g. a post back to the blog index). */
  back?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-foreground/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-10">
          {/* The back control is the installed app's only way home from here: a
              standalone PWA has no browser chrome to fall back on. */}
          <div className="flex items-center gap-1">
            <BackButton />
            <Link href="/" aria-label="Pip home" className="transition hover:opacity-80">
              <Wordmark />
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14 md:px-10 md:py-20">
        {/* Left-aligned with the chrome, capped at a readable measure. */}
        <div className="max-w-2xl">
          {back && (
            <Link
              href={back.href}
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {back.label}
            </Link>
          )}
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>}
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

/** A titled block of the document. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-md leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

/**
 * A dated note on a post whose subject has since moved. A post is a snapshot
 * with a date on it, so the original sentence stays exactly as it shipped and
 * this says what is true now. It is the same thing the sync post does in prose
 * when it says an old line will not be left to stand. Correcting in place and
 * saying so is the house voice; quietly editing history is not.
 */
export function Correction({ date, children }: { date: string; children: React.ReactNode }) {
  return (
    <aside className="mt-9 border-l-2 border-foreground/15 pl-4 first:mt-0">
      <h2 className="text-sm font-medium tracking-tight text-foreground">
        Since this was written (corrected {date})
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </aside>
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
  // A mailto: has nowhere to open, and target="_blank" leaves a stray tab behind.
  const newTab = href.startsWith('http')
  return (
    <a
      href={href}
      {...(newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition hover:decoration-foreground"
    >
      {children}
    </a>
  )
}
