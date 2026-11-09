// One player's slow games: a Durable Object per account.
//
// A room knows who is at it; nothing knows which rooms one person is at. This
// object is that index. Each slow room sends every player at it their own
// mini table (`SlowCard`, already redacted for them) whenever it changes, and
// this keeps them for Home, counts them against the limit, and decides what to
// tell the player, and when, from the rules in `lib/multiplayer/notices.ts`.
//
// It also holds what those notices need: the player's quiet hours and
// switches (Settings → Notifications) and the devices they allowed pushes on.
// All of it is keyed by the account, so it works the same on every device.
//
// And the pushes that are not about a game (`lib/multiplayer/nudges.ts`):
// somebody passing them on the Pip Rating board, and their streak ending.
// The streak is checked once a day from the synced profile, for as long as
// they have a device to push to.
//
// And the days their free room and free quick match were last spent
// (`lib/multiplayer/freeRoom.ts`), so the one-a-day allowances hold on every
// device and cannot be reset from the browser.

import { DurableObject } from 'cloudflare:workers'
import {
  DEFAULT_PREFS,
  awake,
  emailSlot,
  nextDue,
  deviceId,
  planNotice,
  type Notice,
  type PlayPrefs,
  type PushDevice,
} from '@/lib/multiplayer/notices'
import {
  nextStreakCheck,
  nextUtcMidnight,
  passedCopy,
  ratingPushAllowed,
  readPlayStreak,
  streakCopy,
  type PushCopy,
} from '@/lib/multiplayer/nudges'
import { noticeCopy, type SlowCard } from '@/lib/multiplayer/slowCard'
import { MAX_SLOW_GAMES } from '@/lib/multiplayer/slow'
import { FREE_SLOW_GAMES, spentToday, utcDay, type FreeLeft } from '@/lib/multiplayer/freeRoom'
import { json, type Env } from './env'
import { emailOf, gameUrl, offLink, profileStateOf, pushAll, sendEmail, turnEmail } from './notify'

/** The daily free tables, and where the day each was last spent is kept. */
export type FreeDaily = 'room' | 'quick'
const FREE_KEYS: Record<FreeDaily, string> = { room: 'freeRoomDay', quick: 'freeQuickDay' }

/** Devices one account may register. The oldest is dropped past this. */
const MAX_DEVICES = 10

/** The pushes that are not about a game, and when each is next due. */
interface Nudges {
  /** The next streak check, or null while there is no device to push to. */
  streakAt: number | null
  /** A "passed you" waiting out the quiet hours; a newer one replaces it. */
  passed: { copy: PushCopy; at: number } | null
  /** When the last "passed you" went, for the twelve-hour gap. */
  passedLastAt: number | null
}

const NO_NUDGES: Nudges = { streakAt: null, passed: null, passedLastAt: null }

export class Player extends DurableObject<Env> {
  private async get<T>(key: string, fallback: T): Promise<T> {
    return ((await this.ctx.storage.get<T>(key)) ?? fallback) as T
  }

  private async games(): Promise<Record<string, SlowCard>> {
    return this.get<Record<string, SlowCard>>('games', {})
  }

  private async prefs(): Promise<PlayPrefs> {
    return { ...DEFAULT_PREFS, ...(await this.get<Partial<PlayPrefs>>('prefs', {})) }
  }

  private async devices(): Promise<PushDevice[]> {
    return this.get<PushDevice[]>('devices', [])
  }

  private async notices(): Promise<Record<string, Notice>> {
    return this.get<Record<string, Notice>>('notices', {})
  }

  private async nudges(): Promise<Nudges> {
    return { ...NO_NUDGES, ...(await this.get<Partial<Nudges>>('nudges', {})) }
  }

  /** One alarm for everything: the soonest of the game notices and the nudges. */
  private async arm(notices?: Record<string, Notice>): Promise<void> {
    const n = await this.nudges()
    const due = [
      nextDue(Object.values(notices ?? (await this.notices()))),
      n.streakAt,
      n.passed?.at,
    ]
    const at = due.reduce<number | null>(
      (min, t) => (t == null ? min : min === null || t < min ? t : min),
      null,
    )
    if (at === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(at)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user') ?? ''
    if (userId) await this.ctx.storage.put('user', userId)
    switch (`${request.method} ${url.pathname}`) {
      case 'GET /games': {
        const games = Object.values(await this.games()).filter((g) => g.phase !== 'closed')
        return json({ games }, 200)
      }
      case 'GET /open': {
        const open = Object.values(await this.games()).filter(
          (g) => g.phase === 'lobby' || g.phase === 'playing',
        )
        return json({ open: open.length, max: MAX_SLOW_GAMES }, 200)
      }
      case 'GET /free': {
        // What is left of their free hosting, whether or not they are a member.
        const now = Date.now()
        const hostedOpen = Object.values(await this.games()).filter(
          (g) => g.isHost && (g.phase === 'lobby' || g.phase === 'playing'),
        ).length
        return json(
          {
            room: !spentToday(await this.get<string | null>(FREE_KEYS.room, null), now),
            quick: !spentToday(await this.get<string | null>(FREE_KEYS.quick, null), now),
            slow: hostedOpen < FREE_SLOW_GAMES,
          } satisfies FreeLeft,
          200,
        )
      }
      case 'POST /free/claim': {
        // Read and written with nothing awaited between, so two tables
        // opened at once cannot both have today's.
        const { kind } = (await request.json()) as { kind?: FreeDaily }
        const key = kind && FREE_KEYS[kind]
        if (!key) return json({ ok: false }, 400)
        const now = Date.now()
        const previous = await this.get<string | null>(key, null)
        if (spentToday(previous, now)) return json({ ok: false }, 200)
        await this.ctx.storage.put(key, utcDay(now))
        return json({ ok: true, previous }, 200)
      }
      case 'POST /free/release': {
        // The table could not be opened after all: today's is theirs again.
        const body = (await request.json()) as { kind?: FreeDaily; previous?: string | null }
        const key = body.kind && FREE_KEYS[body.kind]
        if (!key) return json({ ok: false }, 400)
        if (typeof body.previous === 'string') await this.ctx.storage.put(key, body.previous)
        else await this.ctx.storage.delete(key)
        return json({ ok: true }, 200)
      }
      case 'POST /card':
        return this.card((await request.json()) as SlowCard)
      case 'POST /dismiss': {
        const { code, left } = (await request.json()) as { code?: string; left?: boolean }
        const games = await this.games()
        // A finished game can be swiped away, and one waiting for players once
        // the room has let them leave it. One being played is not yours to drop.
        const phase = code ? games[code]?.phase : undefined
        if (code && (phase === 'finished' || (phase === 'lobby' && left))) {
          delete games[code]
          await this.ctx.storage.put('games', games)
        }
        return json({ ok: true }, 200)
      }
      case 'GET /prefs':
        return json(
          {
            prefs: await this.prefs(),
            // Whether they have ever saved any: until then the timezone is a guess.
            set: (await this.ctx.storage.get('prefs')) !== undefined,
            devices: (await this.devices()).map((d) => ({ kind: d.kind, id: deviceId(d) })),
          },
          200,
        )
      case 'POST /prefs': {
        const next = (await request.json()) as PlayPrefs
        await this.ctx.storage.put('prefs', next)
        // New quiet hours can move the streak check.
        const n = await this.nudges()
        if (n.streakAt !== null) {
          await this.ctx.storage.put('nudges', {
            ...n,
            streakAt: nextStreakCheck(Date.now(), next),
          })
          await this.arm()
        }
        return json({ prefs: next, rooms: await this.liveCodes() }, 200)
      }
      case 'POST /devices': {
        const device = (await request.json()) as PushDevice
        const others = (await this.devices()).filter((d) => deviceId(d) !== deviceId(device))
        await this.ctx.storage.put('devices', [...others, device].slice(-MAX_DEVICES))
        // Somebody to push to: the daily streak check starts.
        const n = await this.nudges()
        if (n.streakAt === null) {
          await this.ctx.storage.put('nudges', {
            ...n,
            streakAt: nextStreakCheck(Date.now(), await this.prefs()),
          })
          await this.arm()
        }
        return json({ ok: true }, 200)
      }
      case 'POST /nudge/passed': {
        // From the outbox drain (index.ts `scheduled`), never from a client.
        const { name, rank } = (await request.json()) as { name?: string; rank?: number | null }
        const prefs = await this.prefs()
        const n = await this.nudges()
        const now = Date.now()
        if (
          typeof name === 'string' &&
          prefs.push &&
          prefs.rating &&
          (await this.devices()).length > 0 &&
          ratingPushAllowed(n.passedLastAt, now)
        ) {
          const copy = passedCopy(name, typeof rank === 'number' ? rank : null)
          await this.ctx.storage.put('nudges', { ...n, passed: { copy, at: awake(now, prefs) } })
          await this.arm()
        }
        return json({ ok: true }, 200)
      }
      case 'POST /devices/remove': {
        const { id } = (await request.json()) as { id?: string }
        await this.ctx.storage.put(
          'devices',
          (await this.devices()).filter((d) => deviceId(d) !== id),
        )
        return json({ ok: true }, 200)
      }
      case 'POST /email-off': {
        await this.ctx.storage.put('prefs', { ...(await this.prefs()), email: false })
        const notices = await this.notices()
        for (const n of Object.values(notices)) n.emailAt = null
        await this.ctx.storage.put('notices', notices)
        await this.arm(notices)
        return json({ ok: true }, 200)
      }
    }
    return new Response(null, { status: 404 })
  }

  /** Codes of the games still being played, so a change of quiet hours can reach them. */
  private async liveCodes(): Promise<string[]> {
    return Object.values(await this.games())
      .filter((g) => g.phase === 'lobby' || g.phase === 'playing')
      .map((g) => g.code)
  }

  /** A room's latest for this player: kept, and whatever it calls for planned. */
  private async card(card: SlowCard): Promise<Response> {
    const games = await this.games()
    const notices = await this.notices()
    if (card.phase === 'closed') {
      delete games[card.code]
      delete notices[card.code]
    } else {
      // Older news arriving late never overwrites newer.
      const prev = games[card.code]
      if (prev && prev.updatedAt > card.updatedAt) return json({ ok: true }, 200)
      games[card.code] = card
      const planned = planNotice(
        notices[card.code],
        card,
        await this.prefs(),
        (await this.devices()).length > 0,
        Date.now(),
      )
      if (planned) notices[card.code] = planned
      else delete notices[card.code]
    }
    await this.ctx.storage.put('games', games)
    await this.ctx.storage.put('notices', notices)
    await this.arm(notices)
    return json({ ok: true }, 200)
  }

  async alarm(): Promise<void> {
    try {
      await this.deliverNudges()
    } catch (e) {
      console.error('nudges failed', { error: String(e) })
    }
    try {
      await this.deliver()
    } catch (e) {
      console.error('notices failed', { error: String(e) })
    }
  }

  /** The board and the streak, whichever is due. Re-arms through `deliver`. */
  private async deliverNudges(): Promise<void> {
    const now = Date.now()
    const n = await this.nudges()
    const prefs = await this.prefs()
    let devices = await this.devices()
    const send = async (copy: PushCopy, url: string, tag: string) => {
      const gone = await pushAll(this.env, devices, { ...copy, url, tag })
      if (gone.length) devices = devices.filter((d) => !gone.includes(deviceId(d)))
    }

    if (n.passed && n.passed.at <= now) {
      if (prefs.push && prefs.rating) {
        await send(n.passed.copy, '/game/leaderboard', 'pip-rating')
        n.passedLastAt = now
      }
      n.passed = null
    }

    if (n.streakAt !== null && n.streakAt <= now) {
      if (awake(now, prefs) !== now) {
        // Quiet through every check time: it waits for them to wake.
        n.streakAt = awake(now, prefs)
      } else if (devices.length === 0) {
        // Nobody to tell: the check stops until a device is allowed again.
        n.streakAt = null
      } else {
        if (prefs.push && prefs.streak) {
          const userId = await this.get<string>('user', '')
          const copy = userId
            ? streakCopy(readPlayStreak(await profileStateOf(this.env, userId)), now)
            : null
          if (copy) await send(copy, '/game', 'pip-streak')
        }
        // Tomorrow's: today's has just been.
        n.streakAt = nextStreakCheck(nextUtcMidnight(now), prefs)
      }
    }

    await this.ctx.storage.put('devices', devices)
    await this.ctx.storage.put('nudges', n)
  }

  private async deliver(): Promise<void> {
    const now = Date.now()
    const userId = await this.get<string>('user', '')
    const games = await this.games()
    const notices = await this.notices()
    const prefs = await this.prefs()
    let devices = await this.devices()

    for (const n of Object.values(notices)) {
      if (n.pushAt === null || n.pushAt > now) continue
      n.pushAt = null
      const card = games[n.code]
      const copy = card && noticeCopy(card, now)
      // Nothing to say, or they are looking at the table already.
      if (!card || !copy || card.watching || !prefs.push || !prefs.slow) continue
      const gone = await pushAll(this.env, devices, {
        ...copy,
        url: gameUrl(card.code),
        tag: `pip-${card.code}`,
      })
      if (gone.length) devices = devices.filter((d) => !gone.includes(deviceId(d)))
    }
    await this.ctx.storage.put('devices', devices)

    const emailDue = Object.values(notices).some((n) => n.emailAt !== null && n.emailAt <= now)
    if (emailDue) {
      // Every game still waiting on them, the one that came due or not.
      const waiting = Object.values(games)
        .filter((g) => g.yourTurn && !g.watching && notices[g.code]?.key === g.turnKey)
        .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      const last = await this.get<number | null>('lastEmailAt', null)
      const slot = emailSlot(now, last, prefs)
      if (!prefs.email || waiting.length === 0) {
        for (const n of Object.values(notices))
          if (n.emailAt !== null && n.emailAt <= now) n.emailAt = null
      } else if (slot > now) {
        for (const n of Object.values(notices))
          if (n.emailAt !== null && n.emailAt <= now) n.emailAt = slot
      } else {
        const to = userId ? await emailOf(this.env, userId) : null
        if (to) {
          const off = await offLink(this.env, userId)
          await sendEmail(this.env, to, turnEmail(waiting, now, off), off)
        }
        await this.ctx.storage.put('lastEmailAt', now)
        // One email covers every game in it.
        for (const n of Object.values(notices)) n.emailAt = null
      }
    }

    // Spent notices are kept (their key stops the same turn being told twice)
    // until the game moves on; the alarm only needs the ones still due.
    await this.ctx.storage.put('notices', notices)
    await this.arm(notices)
  }
}
