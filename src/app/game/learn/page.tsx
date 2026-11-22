'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Calculator, Target } from 'lucide-react'
import { CourseShelf } from '@/components/learn/CourseShelf'
import { PageShell } from '@/components/PageShell'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { characterById } from '@/config/cast'
import { sound } from '@/lib/sound'

// `/game/learn`: Webb's shelf inside the app, with the sidebar. The same
// course as /learn, which stays the public page a search lands on; this one
// keeps a player in the app rather than walking them out to the website.

function DoCard({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string
  icon: typeof Calculator
  title: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={() => sound.play('tap')}
      className="group block rounded-2xl border border-foreground/10 p-5 transition hover:border-foreground/20 hover:bg-foreground/[0.02]"
    >
      <Icon className="size-5 text-muted-foreground transition group-hover:text-foreground" />
      <h3 className="mt-3 flex items-center gap-1.5 font-semibold tracking-tight">
        {title}
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Link>
  )
}

export default function Page() {
  const router = useRouter()
  const webb = characterById('webb')
  return (
    <PageShell leading="back" backLabel="Back" onBack={() => router.push('/game')}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center gap-4">
          {webb && <PlayerAvatar spec={webb.avatar} size={56} />}
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Learn with Webb</h1>
            <p className="text-sm text-muted-foreground">Wrote the book. This is the shelf.</p>
          </div>
        </header>
        <CourseShelf />
        <section className="grid gap-4 sm:grid-cols-2">
          <DoCard href="/game/drills" icon={Target} title="Drills">
            One question at a time, dealt fresh and marked by the engine.
          </DoCard>
          <DoCard href="/poker-odds-calculator" icon={Calculator} title="Poker odds calculator">
            Your two cards, the board if there is one, and how many people you are against.
          </DoCard>
        </section>
      </div>
    </PageShell>
  )
}
