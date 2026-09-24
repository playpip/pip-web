'use client'

import Link from 'next/link'
import { BookOpen, ChevronRight, CircleHelp, FileText, Lock, Play, Target } from 'lucide-react'
import { drillHref } from '@/components/drills/exit'
import { canPlayDrill, drillKind } from '@/config/drills'
import { guideBySlug } from '@/config/learn'
import {
  COURSE,
  type CourseItem,
  type CourseLevel,
  canTakeLesson,
  lessonById,
} from '@/config/lessons'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { useProfile } from '@/store/profile'

/**
 * Lessons with Webb, on the Learn shelf: five levels, and what is in each.
 *
 * **What is built is a way in, what is paid says so, and what is not built says
 * that.** A lesson or a pack you can play is a row that takes you there; one
 * that comes with the membership wears the padlock and the same plain line the
 * drills room uses, and a tap goes to /membership (docs/membership.md: invited,
 * never uninvited). What the course will teach but does not have yet is on the
 * shelf too, greyed, labelled "Not built yet", and goes nowhere — the house rule
 * is that nothing unbuilt is sold, and a padlock on it would be selling it.
 *
 * **Level 1 is free and says so.** It is the tour and the two free drills,
 * composed here rather than rebuilt; nothing in it is gated or ever will be.
 *
 * Progress is the drills' own: the rating for a kind you have played, read off
 * the profile. The lessons keep nothing (see LessonScreen), so there is nothing
 * of theirs to show and no "complete" tick to be behind on.
 *
 * **No entrance animation, on purpose.** This is a content page a crawler and
 * the Markdown mirror read from the server render, and a fade-in starts at
 * opacity 0 — which is what a page with no JavaScript would be left showing.
 * The rows press like the drills' tiles instead.
 *
 * The padlocks wait for the membership to be known, like the drills room's, so
 * a member never sees a flash of locks; the server render is the shelf without
 * them, which is also what the Markdown mirror reads.
 */
export function CourseShelf() {
  return (
    <section aria-labelledby="lessons-with-webb" className="mt-12">
      <h2 id="lessons-with-webb" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Lessons with Webb
      </h2>
      <p className="mt-1 text-md text-muted-foreground">
        Read it, then play it at the table, a level at a time. Level 1 and every guide are free.
      </p>
      {/* A path, not a grid: five steps on one rail, each with a single grouped
          list. The first version was a card per level holding a card per item,
          two columns wide — boxes in boxes, with holes where a level had an odd
          number of things (Will, 2026-09-23: "cluttered and clumsy"). */}
      <ol className="mt-8">
        {COURSE.map((level, index) => (
          <Level key={level.level} level={level} last={index === COURSE.length - 1} />
        ))}
      </ol>
    </section>
  )
}

/** Whether every built thing on a level is free. Level 1, by construction. */
function isFree(level: CourseLevel): boolean {
  return level.items.every((item) => {
    if (item.kind === 'drill') return !drillKind(item.id).membersOnly
    if (item.kind === 'lesson') return !lessonById(item.id).membersOnly
    return item.kind === 'tour' || item.kind === 'guide'
  })
}

function Level({ level, last }: { level: CourseLevel; last: boolean }) {
  const free = isFree(level)
  const built = level.items.filter((item) => item.kind !== 'planned')
  const planned = level.items.flatMap((item) => (item.kind === 'planned' ? [item.title] : []))
  const empty = built.length === 0
  return (
    <li className={cn('relative pl-12 sm:pl-14', last ? 'pb-0' : 'pb-10')}>
      {/* The rail between one step and the next. */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[1.0625rem] top-11 w-px bg-foreground/10"
        />
      )}
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-0 grid size-9 place-items-center rounded-full text-sm font-semibold tabular-nums',
          empty
            ? 'border border-dashed border-foreground/20 text-muted-foreground'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {level.level}
      </span>

      <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1">
        <h3
          className={cn('text-lg font-semibold tracking-tight', empty && 'text-muted-foreground')}
        >
          <span className="sr-only">Level {level.level}: </span>
          {level.title}
        </h3>
        {!empty && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-2xs font-medium',
              free
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-foreground/[0.06] text-muted-foreground',
            )}
          >
            {free ? 'Free' : 'Members'}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-md leading-relaxed text-muted-foreground">{level.blurb}</p>

      {!empty && (
        <ul className="mt-4 divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
          {built.map((item) => (
            <li key={itemKey(item)}>
              <Item item={item} />
            </li>
          ))}
        </ul>
      )}

      {planned.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground/80">
          <span className="font-medium">Not built yet:</span> {planned.join(' · ')}
        </p>
      )}
    </li>
  )
}

const itemKey = (item: CourseItem) =>
  item.kind === 'planned'
    ? `planned:${item.title}`
    : item.kind === 'tour'
      ? 'tour'
      : item.kind === 'guide'
        ? `guide:${item.slug}`
        : item.id

/** What a row on the shelf says and where it goes, before the membership is asked. */
function rowFor(item: Exclude<CourseItem, { kind: 'planned' }>): {
  label: string
  title: string
  blurb: string
  href: string
  icon: typeof BookOpen
  paid: boolean
  drill: ReturnType<typeof drillKind> | null
} {
  if (item.kind === 'guide') {
    const guide = guideBySlug(item.slug)
    if (!guide) throw new Error(`No guide ${item.slug}`)
    const answer = guide.kind === 'answer'
    return {
      label: answer ? 'Quick answer' : 'Guide',
      title: guide.title,
      blurb: guide.description,
      href: `/learn/${guide.slug}`,
      icon: answer ? CircleHelp : FileText,
      paid: false,
      drill: null,
    }
  }
  if (item.kind === 'tour') {
    return {
      label: 'Tour',
      title: 'Learn poker in three minutes',
      blurb: 'The order of play and what beats what, in eight short pages.',
      href: '/tutorial?from=learn',
      icon: BookOpen,
      paid: false,
      drill: null,
    }
  }
  if (item.kind === 'lesson') {
    const lesson = lessonById(item.id)
    return {
      label: 'Lesson',
      title: lesson.title,
      blurb: lesson.blurb,
      href: `/game/lessons/${lesson.id}`,
      icon: Play,
      paid: Boolean(lesson.membersOnly),
      drill: null,
    }
  }
  const kind = drillKind(item.id)
  return {
    label: 'Practice',
    title: kind.title,
    blurb: kind.blurb,
    href: drillHref(kind.id, 'learn'),
    icon: Target,
    paid: Boolean(kind.membersOnly),
    drill: kind,
  }
}

function Item({ item }: { item: Exclude<CourseItem, { kind: 'planned' }> }) {
  const hydrated = useHydrated()
  const member = useEntitlement()
  const settled = useMembership((state) => state.checked)
  const row = rowFor(item)
  const known = hydrated && (!row.paid || settled)
  const open =
    item.kind === 'tour'
      ? true
      : item.kind === 'lesson'
        ? canTakeLesson(lessonById(item.id), member)
        : row.drill
          ? canPlayDrill(row.drill, member)
          : true
  const gated = known && !open
  const Icon = row.icon

  return (
    <Link
      href={gated ? '/membership' : row.href}
      onClick={() => sound.play('tap')}
      aria-label={gated ? `${row.title} — what the membership is` : undefined}
      className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-foreground/[0.03] active:bg-foreground/[0.06] motion-reduce:transition-none"
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          gated
            ? 'bg-foreground/[0.05] text-muted-foreground'
            : item.kind === 'lesson'
              ? 'bg-primary text-primary-foreground'
              : 'bg-foreground/[0.07] text-foreground',
        )}
        aria-hidden
      >
        {gated ? (
          <Lock className="size-3.5" />
        ) : (
          <Icon className={cn('size-3.5', item.kind === 'lesson' && 'fill-current')} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {/* The title wraps rather than truncating: at 390px an ellipsis ate
            "Learn poker in three minutes" down to "Learn poker i…". The line
            under it is the kind on a phone and the kind plus the blurb wider. */}
        <span className="block font-medium leading-snug">{row.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          {item.kind === 'tour' && (
            <span className="shrink-0 rounded-full bg-foreground/[0.07] px-2 py-0.5 text-2xs font-medium">
              Start here
            </span>
          )}
          {item.kind === 'guide' && (
            // Reading is free on every level, including the members' ones, and
            // the row says so where a padlock would otherwise be expected.
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
              Free
            </span>
          )}
          <span className="min-w-0 truncate">
            {row.label}
            {gated ? ' · Members' : <span className="hidden sm:inline"> · {row.blurb}</span>}
          </span>
        </span>
      </span>
      {hydrated && row.drill && !gated && <Rating id={row.drill.id} />}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
    </Link>
  )
}

/** Your rating on a kind, once you have answered one. The drills' own mirror. */
function Rating({ id }: { id: string }) {
  const record = useProfile((s) => s.drills[id])
  if (!record || record.answered === 0) return null
  return (
    <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums">
      {record.rating}
    </span>
  )
}
