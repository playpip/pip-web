'use client'

import { useState } from 'react'
import { PlayingCard } from '@/components/PlayingCard'
import {
  type Band,
  BAND_LABEL,
  BAND_SYMBOL,
  CHART_RANKS,
  chartHand,
  dealtOdds,
  HAND_BANDS,
  HAND_NOTES,
  handCards,
} from '@/config/startingHands'
import { cn } from '@/lib/utils'

/**
 * The 169-cell chart, poke-able. The idea people get wrong about a chart like
 * this is that it lists good hands. It lists decisions: the same two cards are
 * a fold in one seat and a routine open in another, and a static grid cannot
 * make that point while a grid you can tap can.
 *
 * The grid stays a real <table> so it still flattens into the Markdown mirrors
 * and still reads row-by-row to a screen reader. Only the detail panel is
 * marked data-mirror="skip"; the chart itself is the page's most useful
 * content and belongs in the mirror.
 *
 * Nothing here is generated, scored or remembered between visits, which is the
 * line that keeps the guides free. Every number is computed from the band
 * lists and the combination count, so there is no table of 169 facts to keep
 * true.
 */

/**
 * Cell backgrounds, green through amber to red as the band narrows. Colour is
 * never the only signal: the symbol stays in the cell and the band is spelled
 * out for a screen reader, so the chart survives being printed in grey or read
 * by somebody who cannot separate red from green.
 */
const BAND_TINT: Record<Band, string> = {
  any: 'bg-emerald-500/20',
  middle: 'bg-amber-500/20',
  late: 'bg-suit-red/20',
}

const FOLD_TINT = 'bg-foreground/[0.03]'

export function StartingHandChart() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="mt-5">
      <Legend />

      {/* Scrolls inside its own box rather than pushing the page sideways,
          which is the whole difficulty of 13 columns on a phone. */}
      <div className="-mx-6 mt-4 overflow-x-auto px-6 md:mx-0 md:px-0">
        <table className="w-full min-w-md border-separate border-spacing-[2px] text-center text-2xs leading-none sm:text-[0.8125rem]">
          <thead>
            <tr>
              <th scope="col" className="w-5">
                <span className="sr-only">Higher card</span>
              </th>
              {CHART_RANKS.map((rank) => (
                <th key={rank} scope="col" className="pb-1 font-medium text-muted-foreground">
                  {rank}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHART_RANKS.map((rowRank, row) => (
              <tr key={rowRank}>
                <th scope="row" className="pr-1 text-right font-medium text-muted-foreground">
                  {rowRank}
                </th>
                {CHART_RANKS.map((colRank, col) => {
                  const hand = chartHand(row, col)
                  const band = HAND_BANDS[hand]
                  return (
                    <td key={colRank} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSelected(hand)}
                        aria-pressed={selected === hand}
                        className={cn(
                          'w-full rounded-[4px] px-0.5 py-1.5 whitespace-nowrap transition',
                          band ? `${BAND_TINT[band]} font-medium` : FOLD_TINT,
                          'hover:brightness-110 active:scale-[0.96]',
                          selected === hand && 'ring-2 ring-foreground',
                        )}
                      >
                        {hand}
                        {band ? (
                          <>
                            {/* The symbol is a key a screen reader cannot use,
                                so the band is spelled out and the glyph hidden. */}
                            <span className="ml-0.5 text-[0.5625rem]" aria-hidden="true">
                              {BAND_SYMBOL[band]}
                            </span>
                            {/* Dropped from the Markdown mirror: 169 repeats of
                                "Late only, the cutoff or the button" is noise to
                                a reader that can see the legend once, above. */}
                            <span className="sr-only" data-mirror="skip">
                              , {BAND_LABEL[band]}
                            </span>
                          </>
                        ) : (
                          <span className="sr-only" data-mirror="skip">
                            , fold
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Detail hand={selected} />
    </div>
  )
}

function Legend() {
  const bands: Band[] = ['any', 'middle', 'late']
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-muted-foreground">
      {bands.map((band) => (
        <li key={band} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('size-4 shrink-0 rounded-[4px]', BAND_TINT[band])}
          />
          {/* Symbol and label in one text node, so the Markdown mirror gets
              "● Any position" rather than the two run together. */}
          <span className="font-medium text-foreground">{`${BAND_SYMBOL[band]} ${BAND_LABEL[band]}`}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('size-4 shrink-0 rounded-[4px]', FOLD_TINT)} />
        <span>unmarked, fold</span>
      </li>
    </ul>
  )
}

/**
 * What one cell says. Present whether or not anything is selected, so tapping
 * a cell does not shove the page around underneath the finger that tapped it.
 */
function Detail({ hand }: { hand: string | null }) {
  return (
    <div
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors. The
      // grid above it is not: that is the content.
      data-mirror="skip"
      aria-live="polite"
      className="mt-4 min-h-28 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5"
    >
      {hand === null ? (
        <p className="text-md leading-relaxed text-muted-foreground">
          Tap any hand for what it is, when it plays and how often it turns up.
        </p>
      ) : (
        <HandDetail hand={hand} />
      )}
    </div>
  )
}

function HandDetail({ hand }: { hand: string }) {
  const band = HAND_BANDS[hand]
  const { pct, oneIn } = dealtOdds(hand)
  const note = HAND_NOTES[hand]
  const shape =
    hand.length === 2 ? 'a pocket pair' : hand.endsWith('s') ? 'suited' : 'offsuit, or unsuited'

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex shrink-0 gap-1.5">
        {handCards(hand).map((card) => (
          <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
        ))}
      </div>
      <div className="min-w-40 flex-1">
        <p className="text-base font-semibold tracking-tight">
          {hand}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{shape}</span>
        </p>
        <p className="mt-1 text-md leading-relaxed">
          {band ? (
            <>
              <span aria-hidden="true">{BAND_SYMBOL[band]} </span>
              <span className="font-medium">{BAND_LABEL[band]}</span>
            </>
          ) : (
            <span className="font-medium">Fold it, from every seat</span>
          )}
        </p>
        <p className="mt-1 text-md text-muted-foreground tabular-nums">
          Dealt {pct.toFixed(2)}% of the time, about once in {oneIn} hands.
        </p>
        {note && <p className="mt-2 text-md leading-relaxed text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}
