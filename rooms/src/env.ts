// What the room server is given by Cloudflare: its Durable Object namespaces,
// the plain settings, and the secrets (wrangler secret put).

export interface Env {
  ROOMS: DurableObjectNamespace
  QUEUES: DurableObjectNamespace
  /** One per account: their slow games, notification prefs and devices. */
  PLAYERS: DurableObjectNamespace
  /** The hands-played count on the landing page (`tally.ts`). */
  TALLY: DurableObjectNamespace
  /** The open tables list on Multiplayer (`lobby.ts`). */
  LOBBY: DurableObjectNamespace
  /** Where this Worker is reached from outside, for links in emails. */
  PUBLIC_URL?: string
  /** Comma-separated origins allowed to open a socket or create a room. */
  ALLOWED_ORIGINS: string
  SUPABASE_URL?: string
  /** The public anon key, the same one the site is built with. */
  SUPABASE_ANON_KEY?: string
  /** Reads `memberships`, which no client can. Server-side only. */
  SUPABASE_SERVICE_ROLE_KEY?: string
  /** "1" accepts `dev:<user>:member` tokens. Local development only. */
  DEV_AUTH?: string
  /** Cloudflare Realtime TURN key, for camera and mic. Optional. */
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
  /** Web push (VAPID) keys, base64url. Without them, browsers are not pushed to. */
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  /** Resend, for slow games' turn emails. Without it they are logged, not sent. */
  RESEND_API_KEY?: string
  /** Signs the "stop these emails" link. Falls back to the service role key. */
  NOTIFY_SECRET?: string
  /** The running version (wrangler.jsonc `version_metadata`). */
  VERSION?: WorkerVersionMetadata
}

export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  return env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .includes(origin)
}

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  if (!originAllowed(request, env)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** A player's own index (`player.ts`), by account. */
export function playerStub(env: Env, userId: string): DurableObjectStub {
  return env.PLAYERS.get(env.PLAYERS.idFromName(userId))
}
