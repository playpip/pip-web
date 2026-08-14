'use client'

/**
 * The recap card on the end-of-tournament overlay. Presentation only: every
 * number and every sentence is built by `lib/recap` at the moment the run
 * ended, and this renders what it was given.
 *
 * Deliberately quiet. No call to action, no "play again", nothing asking for
 * tomorrow. The buttons underneath already offer the only two things to do.
 */

import type { Recap } from '@/lib/recap'

export function RunRecap({ recap }: { recap: Recap }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-3xl bg-white/5 p-5">
      {/* The overlay is always dark, so this block is on white alphas rather
          than theme tokens, matching the buttons and copy around it. */}
      <div className="grid grid-cols-3 gap-2">
        {recap.stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xs uppercase tracking-wider text-white/40">{s.label}</div>
            <div className="mt-1 font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>
      {recap.lines.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
          {recap.lines.map((line) => (
            <p key={line.id} className="text-left text-xs leading-relaxed text-white/70">
              {line.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
