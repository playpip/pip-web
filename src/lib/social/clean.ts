// What a handle, a name or a bio may say (docs/social.md).
//
// An exact copy of `pip_text_ok` in supabase/migrations/20261122090000_social.sql,
// so the form can say so before saving. The database is what enforces it;
// tests/social.test.ts fails if the lists here and there differ.

/** Matched as whole words. Names are kept off (Dick, Coon) so real people can use theirs. */
export const BAD_WORDS: readonly string[] = [
  'fucker',
  'fucking',
  'fucked',
  'shit',
  'shite',
  'cunt',
  'cunts',
  'cock',
  'cocks',
  'twat',
  'wank',
  'wanker',
  'slut',
  'whore',
  'fag',
  'fags',
  'dyke',
  'tits',
  'cum',
  'porn',
  'rape',
  'raped',
  'rapist',
  'nazi',
  'kike',
  'spic',
  'chink',
  'gook',
  'paki',
  'tranny',
  'retard',
  'retards',
  'nonce',
  'bitch',
  'pussy',
]

/** Innocent words that hold a stem, taken out before the stems are looked for. */
export const INNOCENT: readonly string[] = ['snigger']

/** Matched anywhere, with spaces and punctuation ignored. */
export const BAD_STEMS: readonly string[] = [
  'fuck',
  'nigger',
  'nigga',
  'faggot',
  'cocksuck',
  'hitler',
  'paedo',
  'pedophil',
  'childporn',
  'motherfuck',
  'whitepower',
  'siegheil',
]

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
}

/** False when the text says something Pip won't show. */
export function textOk(text: string): boolean {
  const plain = [...text.toLowerCase()].map((c) => LEET[c] ?? c).join('')
  let squash = plain.replace(/[^a-z]/g, '')
  for (const w of INNOCENT) squash = squash.replaceAll(w, '')
  if (BAD_STEMS.some((s) => squash.includes(s))) return false
  return !plain.split(/[^a-z]+/).some((w) => BAD_WORDS.includes(w))
}

export const HANDLE_MIN = 3
export const HANDLE_MAX = 20
export const BIO_MAX = 160

/** As the database keeps it: lower case, no @. */
export function normaliseHandle(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase()
}

export function handleShapeOk(handle: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(handle)
}

/** A first handle to offer, from the player's name: "Will L." → "will_l". */
export function suggestHandle(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, HANDLE_MAX)
  if (base.length >= HANDLE_MIN) return base
  return base ? `${base}_pip` : 'player'
}

/** The database refuses links in a bio; this says so first. Same pattern. */
export function bioHasLink(bio: string): boolean {
  return /(https?:|www\.|[a-z0-9]\.(com|net|org|io|gg|co|uk|xyz|ru|me|ly|tv|app|link)\b)/i.test(bio)
}
