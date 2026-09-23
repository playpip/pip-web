// Which currency to show somebody the membership in.
//
// Pure: the caller hands in the browser's languages and time zone, so this is
// testable and the page decides when it is safe to ask (after hydration — the
// static HTML and the markdown mirror are always in pounds).
//
// **This only picks what the page shows first.** It is a guess from two weak
// signals, the picker beside the price is always there to overrule it, and
// nothing is charged from it: checkout is handed the currency the player was
// looking at when they pressed the button.

import type { CurrencyCode } from '@/config/membership'

/** Priced in pounds. The Crown dependencies use them. */
const GBP_REGIONS = new Set(['GB', 'UK', 'IM', 'JE', 'GG'])

/**
 * Europe outside the pound. The eurozone, plus the rest of Europe, where a
 * euro price is nearer home than a dollar one.
 */
const EUR_REGIONS = new Set([
  // Eurozone.
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SK',
  'SI',
  'ES',
  // Priced in euros for the eurozone's microstates and the rest of the EU and EEA.
  'AD',
  'MC',
  'SM',
  'VA',
  'ME',
  'XK',
  'SE',
  'DK',
  'NO',
  'IS',
  'PL',
  'CZ',
  'HU',
  'RO',
  'CH',
  'LI',
])

/** Mainland China. Hong Kong, Macau and Taiwan have currencies of their own, so they get dollars. */
const CNY_REGIONS = new Set(['CN'])

function fromRegion(region: string): CurrencyCode | null {
  const r = region.toUpperCase()
  if (GBP_REGIONS.has(r)) return 'GBP'
  if (EUR_REGIONS.has(r)) return 'EUR'
  if (CNY_REGIONS.has(r)) return 'CNY'
  return null
}

/** The region subtag of a language tag: "en-US" → "US", "zh-Hans-CN" → "CN", "en" → null. */
function regionOf(tag: string): string | null {
  const parts = tag.split(/[-_]/).slice(1)
  return parts.find((p) => /^[A-Za-z]{2}$/.test(p)) ?? null
}

/** A time zone is a better signal than a bare language ("en", "zh") and a worse one than a region. */
function fromTimeZone(zone: string): CurrencyCode | null {
  if (
    zone === 'Europe/London' ||
    zone === 'Europe/Isle_of_Man' ||
    zone === 'Europe/Jersey' ||
    zone === 'Europe/Guernsey'
  ) {
    return 'GBP'
  }
  if (zone.startsWith('Europe/')) return 'EUR'
  if (
    zone === 'Asia/Shanghai' ||
    zone === 'Asia/Chongqing' ||
    zone === 'Asia/Harbin' ||
    zone === 'Asia/Urumqi'
  ) {
    return 'CNY'
  }
  return null
}

/**
 * The currency to open the page in.
 *
 * The first language that names a region wins, then the time zone, then
 * dollars — the currency the most people outside our three other regions can
 * read a price in without converting it.
 */
export function detectCurrency(languages: readonly string[], timeZone: string): CurrencyCode {
  for (const tag of languages) {
    const region = regionOf(tag)
    if (!region) continue
    return fromRegion(region) ?? fromTimeZone(timeZone) ?? 'USD'
  }
  return fromTimeZone(timeZone) ?? 'USD'
}
