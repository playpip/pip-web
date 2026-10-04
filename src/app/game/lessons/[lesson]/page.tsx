import type { Metadata } from 'next'
import { LessonScreen } from '@/components/lessons/LessonScreen'
import { LESSONS, lessonById } from '@/config/lessons'

// Lessons with Webb, one route per lesson, enumerated from the registry the way
// /game/drills/[kind] is: the app is a static export, so an id that is not in
// config/lessons.ts cannot be reached at all. Inside /game on purpose — a
// lesson is played, not read, and the written guides stay on /learn.
export const dynamicParams = false

export function generateStaticParams() {
  return LESSONS.map((lesson) => ({ lesson: lesson.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lesson: string }>
}): Promise<Metadata> {
  const { lesson } = await params
  const { title, blurb } = lessonById(lesson)
  return { title: `${title} · Lessons with Webb · Pip`, description: blurb }
}

export default async function Page({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson } = await params
  return <LessonScreen lesson={lessonById(lesson)} />
}
