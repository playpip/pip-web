'use client'

import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { characterById } from '@/config/cast'
import { type LessonId, canTakeLesson, lessonById } from '@/config/lessons'
import { sound } from '@/lib/sound'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement, useMembership } from '@/store/entitlement'

/**
 * "Do it with Webb": the guide's way into the lesson that plays the same idea
 * out at a table.
 *
 * **It adds a door and changes no teaching.** The guides are free forever and
 * bring the search traffic, so their words are theirs; this card sits after
 * the prose, before the page's one call to play, and says what the lesson is
 * and — for anybody who is not a member — that it comes with the membership,
 * before the tap rather than after it. The tap goes to the lesson either way:
 * locked, it deals its first hand played down with the padlock where the
 * answers go, which says more about what it is than any sentence here could.
 *
 * Out of the Markdown mirrors, like the guides' widgets: it is a way into the
 * app, not part of the prose.
 */
export function DoItWithWebb({ lesson: id }: { lesson: LessonId }) {
  const lesson = lessonById(id)
  const webb = characterById('webb')
  const hydrated = useHydrated()
  const member = useEntitlement()
  const settled = useMembership((state) => state.checked)
  const gated = hydrated && settled && !canTakeLesson(lesson, member)

  return (
    <Link
      href={`/game/lessons/${lesson.id}`}
      onClick={() => sound.play('tap')}
      data-mirror="skip"
      className="group mt-10 flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 transition hover:border-foreground/20 hover:bg-foreground/[0.05] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {webb && <PlayerAvatar spec={webb.avatar} size={48} className="shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Do it with Webb
        </span>
        <span className="mt-1 block text-[1.0625rem] font-semibold tracking-tight">
          {lesson.title}, at the table
        </span>
        <span className="mt-1 block text-md leading-relaxed text-muted-foreground">
          {lesson.blurb}
        </span>
        {gated && (
          <span className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" />
            Comes with the membership.
          </span>
        )}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
    </Link>
  )
}
