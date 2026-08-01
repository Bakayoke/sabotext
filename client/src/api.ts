import { io, Socket } from 'socket.io-client'
import type { Lang, PartyPassLocal, PublicRoom } from './types'

const SESSION_KEY = 'sabotext-session'
const PARTY_PASS_KEY = 'sabotext-party-pass'
const HAS_PAID_KEY = 'sabotext-has-paid'
export const NAME_KEY = 'sabotext-name'
export const GANG_KEY = 'sabotext-gang'

const GANG_TTL_MS = 36 * 60 * 60 * 1000

export type GangSave = { code: string; at: number }

export type HomePayload = {
  theme: { id: string; label: string; blurb: string }
  examples: { task: string; original: string; sabotage: string }[]
  activity: {
    gamesTonight: number
    liveRooms: number
    livePlayers: number
    openLobbies: number
  }
}

export type Session = { code: string; playerId: string; name: string }

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function loadPreferredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function savePreferredName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 20))
  } catch {
    // ignore
  }
}

export function loadGang(): GangSave | null {
  try {
    const raw = localStorage.getItem(GANG_KEY)
    if (!raw) return null
    const gang = JSON.parse(raw) as GangSave
    if (!gang?.code || !gang?.at || Date.now() - gang.at > GANG_TTL_MS) {
      localStorage.removeItem(GANG_KEY)
      return null
    }
    return gang
  } catch {
    return null
  }
}

export function saveGang(code: string) {
  try {
    localStorage.setItem(
      GANG_KEY,
      JSON.stringify({ code: code.toUpperCase().slice(0, 4), at: Date.now() } satisfies GangSave),
    )
  } catch {
    // ignore
  }
}

export function clearGang() {
  try {
    localStorage.removeItem(GANG_KEY)
  } catch {
    // ignore
  }
}

export function loadPartyPass(): PartyPassLocal | null {
  try {
    const raw = localStorage.getItem(PARTY_PASS_KEY)
    if (!raw) return null
    const pass = JSON.parse(raw) as PartyPassLocal
    if (!pass?.token || !pass?.expiresAt || pass.expiresAt <= Date.now()) {
      localStorage.removeItem(PARTY_PASS_KEY)
      return null
    }
    return pass
  } catch {
    return null
  }
}

export function savePartyPass(pass: PartyPassLocal) {
  localStorage.setItem(PARTY_PASS_KEY, JSON.stringify(pass))
}

export function clearPartyPass() {
  localStorage.removeItem(PARTY_PASS_KEY)
}

export function hasPaidBefore(): boolean {
  try {
    return localStorage.getItem(HAS_PAID_KEY) === '1'
  } catch {
    return false
  }
}

export function markPaidBefore() {
  try {
    localStorage.setItem(HAS_PAID_KEY, '1')
  } catch {
    // ignore
  }
}

export function isWeekend(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 5 || day === 6
}

let socket: Socket | null = null
let rejoinInFlight: Promise<Ack<{ playerId: string; room: PublicRoom }>> | null = null
let connectionListenersAttached = false

type ConnectionHandlers = {
  onRoom?: (room: PublicRoom) => void
  onConnection?: (connected: boolean) => void
}

const handlers: ConnectionHandlers = {}

function socketUrl() {
  const url = import.meta.env.VITE_SOCKET_URL as string | undefined
  return url && url.length > 0 ? url : undefined
}

function apiBase() {
  const url = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (url && url.length > 0) return url.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl(), {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
    })
  }

  if (!connectionListenersAttached) {
    connectionListenersAttached = true
    socket.on('connect', () => {
      handlers.onConnection?.(true)
      void ensureSessionBound()
    })
    socket.on('disconnect', () => {
      handlers.onConnection?.(false)
    })
    socket.on('room', (room: PublicRoom) => {
      handlers.onRoom?.(room)
    })
  }

  return socket
}

export function bindSocketHandlers(next: ConnectionHandlers) {
  handlers.onRoom = next.onRoom
  handlers.onConnection = next.onConnection
  getSocket()
}

export async function ensureSessionBound(retries = 4): Promise<Ack<{ playerId: string; room: PublicRoom }> | null> {
  const session = loadSession()
  if (!session) return null
  if (rejoinInFlight) return rejoinInFlight

  rejoinInFlight = (async () => {
    let last: Ack<{ playerId: string; room: PublicRoom }> = {
      error: 'rejoin failed',
    } as Ack<{ playerId: string; room: PublicRoom }>
    for (let i = 0; i < retries; i++) {
      last = await rejoinGame(session.code, session.playerId)
      if (!last.error && last.room) {
        saveSession(session)
        return last
      }
      if (
        last.error?.includes('finns inte') ||
        last.error?.includes('hittades inte') ||
        last.error?.includes('not found')
      ) {
        break
      }
      await new Promise((r) => setTimeout(r, 700 * (i + 1)))
    }
    return last
  })()

  try {
    return await rejoinInFlight
  } finally {
    rejoinInFlight = null
  }
}

function whenConnected(): Promise<Socket> {
  const s = getSocket()
  if (s.connected) return Promise.resolve(s)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Kunde inte ansluta till servern. Kolla nätverket och försök igen.'))
    }, 15_000)

    const onConnect = () => {
      cleanup()
      resolve(s)
    }
    const onError = (err: Error) => {
      cleanup()
      reject(new Error(err?.message || 'Anslutningen misslyckades'))
    }
    const cleanup = () => {
      clearTimeout(timer)
      s.off('connect', onConnect)
      s.off('connect_error', onError)
    }

    s.on('connect', onConnect)
    s.on('connect_error', onError)
    if (!s.active) s.connect()
  })
}

type Ack<T> = T & { error?: string }

async function emitAck<T>(event: string, data: unknown): Promise<Ack<T>> {
  try {
    const s = await whenConnected()
    if (event !== 'create' && event !== 'join' && event !== 'rejoin' && event !== 'redeemParty') {
      await ensureSessionBound(2)
    }
    return await new Promise<Ack<T>>((resolve) => {
      s.timeout(12_000).emit(event, data, (err: Error | null, res: Ack<T>) => {
        if (err) resolve({ error: 'Inget svar från servern' } as Ack<T>)
        else resolve(res ?? ({ error: 'Tomt svar' } as Ack<T>))
      })
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Anslutningsfel' } as Ack<T>
  }
}

export function createGame(name: string, roundCount: number, hostPlays: boolean, language: Lang) {
  const pass = loadPartyPass()
  return emitAck<{ playerId: string; room: PublicRoom }>('create', {
    name,
    roundCount,
    hostPlays,
    language,
    partyToken: pass?.token ?? null,
  })
}

export function joinGame(code: string, name: string) {
  return emitAck<{
    playerId: string
    room: PublicRoom
    code?: string
    roomCode?: string
    waitlistCount?: number
  }>('join', { code, name })
}

export function rejoinGame(code: string, playerId: string) {
  return emitAck<{ playerId: string; room: PublicRoom }>('rejoin', { code, playerId })
}

export function setRoundCount(count: number) {
  return emitAck<{ ok?: boolean }>('setRoundCount', { count })
}

export function setHostPlaying(playing: boolean) {
  return emitAck<{ ok?: boolean }>('setHostPlaying', { playing })
}

export function setLanguage(language: Lang) {
  return emitAck<{ ok?: boolean }>('setLanguage', { language })
}

export function setPublicLobby(isPublic: boolean) {
  return emitAck<{ ok?: boolean }>('setPublicLobby', { isPublic })
}

export function redeemParty(code: string) {
  return emitAck<{ token: string; expiresAt: number }>('redeemParty', { code })
}

export function activateParty(code: string) {
  return emitAck<{ ok?: boolean; token: string; expiresAt: number }>('activateParty', { code })
}

export function applyStoredPartyToken() {
  const pass = loadPartyPass()
  if (!pass) {
    return Promise.resolve({ error: 'Inget party-pass sparat' } as Ack<{ ok?: boolean }>)
  }
  return emitAck<{ ok?: boolean }>('applyPartyToken', { token: pass.token })
}

export function startGame() {
  return emitAck<{ ok?: boolean }>('start', {})
}

export function rematchGame() {
  return emitAck<{ ok?: boolean }>('rematch', {})
}

export function submitOriginal(text: string) {
  return emitAck<{ ok?: boolean }>('submitOriginal', { text })
}

export function submitSabotage(text: string) {
  return emitAck<{ ok?: boolean }>('submitSabotage', { text })
}

export function castVote(submissionId: string) {
  return emitAck<{ ok?: boolean }>('castVote', { submissionId })
}

export type PartyInfo = {
  enabled: boolean
  amountOre: number
  amountLabel: string
  durationHours: number
  weekAmountOre?: number
  weekAmountLabel?: string
  weekDurationHours?: number
  firstPartyPercentOff?: number
  firstPartyDayLabel?: string
  firstPartyWeekLabel?: string
}

export async function fetchHome(lang: Lang): Promise<HomePayload> {
  const fallback: HomePayload = {
    theme: { id: 'default', label: 'Sabotext', blurb: '' },
    examples: [],
    activity: { gamesTonight: 0, liveRooms: 0, livePlayers: 0, openLobbies: 0 },
  }
  try {
    const res = await fetch(`${apiBase()}/api/home?lang=${lang}`)
    if (!res.ok) return fallback
    return (await res.json()) as HomePayload
  } catch {
    return fallback
  }
}

export async function fetchPartyInfo(): Promise<PartyInfo> {
  try {
    const res = await fetch(`${apiBase()}/api/party/info`)
    if (!res.ok) throw new Error('info failed')
    return (await res.json()) as PartyInfo
  } catch {
    return {
      enabled: false,
      amountOre: 3900,
      amountLabel: '39 kr',
      durationHours: 24,
      weekAmountOre: 9900,
      weekAmountLabel: '99 kr',
      weekDurationHours: 168,
    }
  }
}

export async function fetchStripeHint(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/health`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      stripeDiag?: { hint?: string | null; envPrefixes?: Record<string, string | null> }
    }
    if (data.stripeDiag?.hint) return data.stripeDiag.hint
    const prefix = data.stripeDiag?.envPrefixes?.STRIPE_SECRET_KEY
    if (prefix?.startsWith('pk_')) {
      return 'Du har Publishable key (pk_…) i Railway. Byt till Secret key (sk_…).'
    }
    return null
  } catch {
    return null
  }
}

export async function startPartyCheckout(
  locale: 'sv' | 'en',
  roomCode?: string,
  plan: 'day' | 'week' = 'day',
  firstTime = false,
) {
  try {
    const res = await fetch(`${apiBase()}/api/party/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        roomCode: roomCode ?? null,
        plan,
        firstTime,
      }),
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || !data.url) return { error: data.error || 'Kunde inte starta köp' }
    return { url: data.url }
  } catch {
    return { error: 'Kunde inte nå betalningen' }
  }
}

export async function claimPartySession(sessionId: string) {
  try {
    const res = await fetch(`${apiBase()}/api/party/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = (await res.json()) as {
      token?: string
      expiresAt?: number
      roomCode?: string | null
      error?: string
    }
    if (!res.ok || !data.token || !data.expiresAt) {
      return { error: data.error || 'Kunde inte hämta Party' }
    }
    return {
      token: data.token,
      expiresAt: data.expiresAt,
      roomCode: data.roomCode || undefined,
    }
  } catch {
    return { error: 'Kunde inte hämta Party' }
  }
}

export async function trackMetric(
  event:
    | 'room_full'
    | 'waitlist_join'
    | 'checkout_start'
    | 'checkout_cancel'
    | 'checkout_paid'
    | 'guest_unlock_click'
    | 'group_size_upsell'
    | 'public_requires_party'
    | 'game_start'
    | 'game_finished'
    | 'share_results',
  meta?: string,
) {
  try {
    await fetch(`${apiBase()}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, meta }),
    })
  } catch {
    // ignore
  }
}
