'use client'

import { useEffect, useState } from 'react'
import { dailyDateKey, dailyNumber, dailySeed } from '@/lib/daily'

/**
 * Which Daily today is, and the seed it was dealt from — worked out in the
 * reader's browser rather than at build time.
 *
 * Build time was the obvious way and it is wrong: the app is a static export,
 * so the HTML is as old as the last merge, and a page that says "today is #57"
 * on the strength of whenever we last deployed is wrong by the next morning. A
 * present-tense claim baked into a build has gone stale on us before, which is
 * the whole reason this is a client component for three numbers.
 *
 * The prose around it is written to be complete without it: everything here is
 * derivable from the date and the epoch, both of which are in the page.
 */
export function TodaysDeal() {
  // Null until mounted. Rendering a date on the server and a different one in
  // the browser is a hydration mismatch, and this component exists precisely
  // because those two dates disagree.
  const [dateKey, setDateKey] = useState<string | null>(null)

  useEffect(() => setDateKey(dailyDateKey()), [])

  return (
    // Skipped in the Markdown mirror: gen-llms.mjs turndowns the built HTML,
    // where this is still the placeholder, and "loading" is not content.
    <div
      data-mirror="skip"
      className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6"
    >
      {dateKey === null ? (
        <p className="text-md text-muted-foreground">Working out which deal today is.</p>
      ) : (
        <>
          <p className="font-semibold text-foreground text-xl">
            Today is Daily #{dailyNumber(dateKey)}
          </p>
          <dl className="mt-4 space-y-1 text-md text-muted-foreground">
            <div className="flex gap-2">
              <dt>UTC date</dt>
              <dd>
                <code>{dateKey}</code>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Day seed</dt>
              <dd>
                <code>{dailySeed(dateKey)}</code>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-muted-foreground text-sm">
            Worked out in your browser from today&rsquo;s UTC date, by the same function the game
            uses. Nothing was asked of us to produce it.
          </p>
        </>
      )}
    </div>
  )
}
