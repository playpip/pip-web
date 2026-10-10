'use client'

// The lesson somebody tapped, named under "Lessons with Webb": its own line
// from the shelf, how many questions Webb stops to ask, and the practice it ends
// in. The feature's blurb covers all eight, so without this the page answered
// a tap on Bluffing with the course.
//
// Loaded on its own (`next/dynamic` in TappedFor), so the lesson scripts reach
// the browser only for somebody who tapped a locked lesson.

import { drillKind } from '@/config/drills'
import { lessonQuestions, tappedLesson } from '@/config/lessons'

export function TappedLesson({ search }: { search: string }) {
  const lesson = tappedLesson(search)
  if (!lesson) return null
  const asks = lessonQuestions(lesson)
  const practice = lesson.practice ? drillKind(lesson.practice) : null

  return (
    <p className="mt-3 leading-relaxed text-muted-foreground">
      You tapped <span className="font-medium text-foreground">{lesson.title}</span>. {lesson.blurb}{' '}
      Webb stops to ask you {asks} questions
      {practice ? (
        <>
          , and it ends in <span className="font-medium text-foreground">{practice.title}</span>.
        </>
      ) : (
        '.'
      )}
    </p>
  )
}
