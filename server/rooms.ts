import { customAlphabet } from 'nanoid'
import { localize, pickPrompts } from './prompts.js'
import { trackFunnel } from './metrics.js'
import {
  limitsFor,
  lookupPass,
  redeemPassCode,
  tierFromExpiry,
} from './premium.js'
import type {
  Lang,
  MatchHighlight,
  Player,
  PublicRoom,
  Room,
  RoomStatus,
  RoundResult,
  Submission,
} from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)

export const WRITE_MS = 0
export const SABOTAGE_MS = 0
export const VOTE_MS = 0
export const REVEAL_MS = 8_000

const DISCONNECT_GRACE_MS = 60_000
const HOST_TRANSFER_AFTER_MS = 90_000
const ROOM_IDLE_MS = 12 * 60 * 60 * 1000

const rooms = new Map<string, Room>()
const socketToPlayer = new Map<string, { code: string; playerId: string }>()
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

let onPersist: (() => void) | null = null

export function setPersistHook(fn: (() => void) | null) {
  onPersist = fn
}

function touch(room?: Room) {
  if (room) room.updatedAt = Date.now()
  onPersist?.()
}

function playerKey(code: string, playerId: string) {
  return `${code}:${playerId}`
}

function cancelDisconnectTimer(code: string, playerId: string) {
  const key = playerKey(code, playerId)
  const t = disconnectTimers.get(key)
  if (t) {
    clearTimeout(t)
    disconnectTimers.delete(key)
  }
}

function roomLimits(room: Room) {
  return limitsFor(tierFromExpiry(room.premiumExpiresAt))
}

function clampRounds(count: number, allowed: number[]) {
  return allowed.includes(count) ? count : allowed[Math.min(1, allowed.length - 1)] ?? 10
}

export function getAllowedRounds(premiumExpiresAt: number | null = null) {
  return limitsFor(tierFromExpiry(premiumExpiresAt)).roundCounts
}

function uniqueCode(): string {
  let code = makeCode()
  while (rooms.has(code)) code = makeCode()
  return code
}

function activePlayers(room: Room) {
  return room.players.filter((p) => p.playing && p.connected)
}

function playingPlayers(room: Room) {
  return room.players.filter((p) => p.playing)
}

export function createRoom(
  hostName: string,
  roundCount: number,
  socketId: string,
  hostPlays = true,
  language: Lang = 'sv',
  partyToken?: string | null,
): { room: Room; playerId: string } {
  const pass = lookupPass(partyToken)
  const premiumExpiresAt = pass?.expiresAt ?? null
  const limits = limitsFor(tierFromExpiry(premiumExpiresAt))
  const count = clampRounds(roundCount, limits.roundCounts)

  const code = uniqueCode()
  const playerId = crypto.randomUUID()
  const host: Player = {
    id: playerId,
    name: hostName.trim().slice(0, 20) || (language === 'en' ? 'Host' : 'Värd'),
    score: 0,
    connected: true,
    playing: hostPlays,
  }

  const room: Room = {
    code,
    hostId: playerId,
    players: [host],
    language: language === 'en' ? 'en' : 'sv',
    roundCount: count,
    hostPlays,
    status: 'lobby',
    usedPromptIds: [],
    currentRound: 0,
    writerId: null,
    prompt: null,
    writerOrder: [],
    writerIndex: -1,
    originalText: '',
    submissions: [],
    sabotageTargets: {},
    votes: {},
    endsAt: 0,
    lastRound: null,
    highlights: [],
    premiumExpiresAt,
    isPublic: false,
    waitlist: [],
    updatedAt: Date.now(),
  }

  rooms.set(code, room)
  socketToPlayer.set(socketId, { code, playerId })
  touch(room)
  return { room, playerId }
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string,
):
  | { room: Room; playerId: string }
  | {
      error: string
      code?: 'ROOM_FULL' | 'NOT_FOUND' | 'STARTED'
      roomCode?: string
      waitlistCount?: number
    } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Hittade inget spel med den koden', code: 'NOT_FOUND' }

  if (
    room.status !== 'lobby' &&
    room.status !== 'write' &&
    room.status !== 'sabotage' &&
    room.status !== 'vote' &&
    room.status !== 'reveal' &&
    room.status !== 'finished'
  ) {
    return { error: 'Spelet har redan startat', code: 'STARTED' }
  }

  const displayName =
    name.trim().slice(0, 20) || (room.language === 'en' ? 'Player' : 'Spelare')

  const maxPlayers = roomLimits(room).maxPlayers
  if (maxPlayers > 0 && room.players.length >= maxPlayers) {
    const existing = room.waitlist.find(
      (w) => w.name.toLowerCase() === displayName.toLowerCase(),
    )
    if (!existing) {
      room.waitlist.push({
        id: crypto.randomUUID(),
        name: displayName,
        at: Date.now(),
      })
      room.waitlist = room.waitlist.slice(-24)
    }
    touch(room)
    trackFunnel('room_full', room.code)
    trackFunnel('waitlist_join', room.code)
    return {
      error:
        maxPlayers <= 5
          ? room.language === 'en'
            ? `Room is full (max ${maxPlayers} free). Unlock Party for more players.`
            : `Rummet är fullt (max ${maxPlayers} gratis). Lås upp Party för fler spelare.`
          : room.language === 'en'
            ? `Room is full (max ${maxPlayers})`
            : `Rummet är fullt (max ${maxPlayers})`,
      code: 'ROOM_FULL',
      roomCode: room.code,
      waitlistCount: room.waitlist.length,
    }
  }

  const playerId = crypto.randomUUID()
  const playing = room.status === 'lobby' || room.status === 'finished'
  room.players.push({
    id: playerId,
    name: displayName,
    score: 0,
    connected: true,
    playing,
  })
  room.waitlist = room.waitlist.filter((w) => w.name.toLowerCase() !== displayName.toLowerCase())
  socketToPlayer.set(socketId, { code: room.code, playerId })
  touch(room)
  return { room, playerId }
}

export function getBinding(socketId: string) {
  return socketToPlayer.get(socketId)
}

export function getRoom(code: string) {
  return rooms.get(code)
}

export function allRooms() {
  return rooms
}

export function hydrateRooms(list: Room[]) {
  const now = Date.now()
  for (const raw of list) {
    if (!raw?.code || rooms.has(raw.code)) continue
    if (raw.updatedAt && now - raw.updatedAt > ROOM_IDLE_MS) {
      if (!raw.premiumExpiresAt || raw.premiumExpiresAt <= now) continue
    }
    const room: Room = {
      ...raw,
      highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
      isPublic: Boolean(raw.isPublic),
      waitlist: Array.isArray(raw.waitlist) ? raw.waitlist : [],
      sabotageTargets: raw.sabotageTargets ?? {},
      premiumExpiresAt: raw.premiumExpiresAt ?? null,
      players: (raw.players ?? []).map((p) => ({ ...p, connected: false })),
      status:
        raw.status === 'write' ||
        raw.status === 'sabotage' ||
        raw.status === 'vote' ||
        raw.status === 'reveal'
          ? 'lobby'
          : raw.status,
      submissions: [],
      votes: {},
      endsAt: 0,
      lastRound: null,
      updatedAt: raw.updatedAt ?? now,
    }
    rooms.set(room.code, room)
  }
}

export function setRoundCount(code: string, playerId: string, count: number): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan välja antal rundor' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const allowed = roomLimits(room).roundCounts
  if (!allowed.includes(count)) {
    return {
      error:
        room.language === 'en'
          ? 'Invalid round count (Party required for 20/25)'
          : 'Ogiltigt antal rundor (Party krävs för 20/25)',
    }
  }
  room.roundCount = count
  touch(room)
  return room
}

export function setPublicLobby(
  code: string,
  playerId: string,
  isPublic: boolean,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.isPublic = Boolean(isPublic)
  touch(room)
  return room
}

export function unlockRoomWithPass(
  code: string,
  token: string,
): Room | { error: string } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Rummet finns inte' }
  const pass = lookupPass(token)
  if (!pass) return { error: 'Party-passet är ogiltigt eller har gått ut' }
  room.premiumExpiresAt = pass.expiresAt
  // Keep waitlist names so host sees who to ping — they can join freely now
  touch(room)
  return room
}

export function activatePartyPass(
  code: string,
  playerId: string,
  passCode: string,
): { room: Room; pass: { token: string; expiresAt: number } } | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan aktivera Party' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }

  const redeemed = redeemPassCode(passCode)
  if ('error' in redeemed) return redeemed

  room.premiumExpiresAt = redeemed.expiresAt
  const limits = roomLimits(room)
  if (!limits.roundCounts.includes(room.roundCount)) {
    room.roundCount = limits.roundCounts[0] ?? 6
  }
  touch(room)
  return { room, pass: { token: redeemed.token, expiresAt: redeemed.expiresAt } }
}

export function applyPartyToken(
  code: string,
  playerId: string,
  token: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan aktivera Party' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const pass = lookupPass(token)
  if (!pass) return { error: 'Party-passet är ogiltigt eller har gått ut' }
  room.premiumExpiresAt = pass.expiresAt
  const limits = roomLimits(room)
  if (!limits.roundCounts.includes(room.roundCount)) {
    room.roundCount = limits.roundCounts[0] ?? 6
  }
  touch(room)
  return room
}

export type PublicLobbyCard = {
  code: string
  language: Lang
  playerCount: number
  maxPlayers: number
  seatsLeft: number | null
  roundCount: number
  party: boolean
}

export function listPublicLobbies(opts?: {
  language?: Lang | null
  limit?: number
}): PublicLobbyCard[] {
  const lang = opts?.language
  const limit = opts?.limit ?? 20
  const now = Date.now()
  const cards: PublicLobbyCard[] = []

  for (const room of rooms.values()) {
    if (!room.isPublic || room.status !== 'lobby') continue
    if (lang && room.language !== lang) continue
    if (!room.players.some((p) => p.connected)) continue
    if (now - (room.updatedAt || 0) > 30 * 60 * 1000) continue

    const limits = roomLimits(room)
    const max = limits.maxPlayers
    const count = room.players.length
    if (max > 0 && count >= max) continue

    cards.push({
      code: room.code,
      language: room.language,
      playerCount: count,
      maxPlayers: max,
      seatsLeft: max > 0 ? max - count : null,
      roundCount: room.roundCount,
      party: tierFromExpiry(room.premiumExpiresAt) === 'party',
    })
  }

  cards.sort((a, b) => {
    if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount
    const aSeats = a.seatsLeft ?? 99
    const bSeats = b.seatsLeft ?? 99
    return bSeats - aSeats
  })

  return cards.slice(0, limit)
}

export function liveActivity() {
  let liveRooms = 0
  let livePlayers = 0
  let openLobbies = 0
  for (const room of rooms.values()) {
    const connected = room.players.filter((p) => p.connected).length
    if (connected === 0) continue
    liveRooms += 1
    livePlayers += connected
    if (room.status === 'lobby') openLobbies += 1
  }
  return { liveRooms, livePlayers, openLobbies }
}

export function setHostPlaying(
  code: string,
  playerId: string,
  playing: boolean,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const host = room.players.find((p) => p.id === playerId)
  if (!host) return { error: 'Värden hittades inte' }
  host.playing = playing
  room.hostPlays = playing
  touch(room)
  return room
}

export function setLanguage(
  code: string,
  playerId: string,
  language: Lang,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.language = language === 'en' ? 'en' : 'sv'
  touch(room)
  return room
}

export function startGame(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }

  if (room.premiumExpiresAt && room.premiumExpiresAt <= Date.now()) {
    room.premiumExpiresAt = null
    room.isPublic = false
    room.roundCount = clampRounds(room.roundCount, roomLimits(room).roundCounts)
  }

  const waitlist = room.waitlist ?? []
  if (waitlist.length > 0 && tierFromExpiry(room.premiumExpiresAt) !== 'party') {
    return {
      error:
        room.language === 'en'
          ? `Don't start yet — ${waitlist.length} waiting. Unlock Party first.`
          : `Starta inte än — ${waitlist.length} vill in. Lås upp Party först.`,
    }
  }

  const players = playingPlayers(room).filter((p) => p.connected)
  if (players.length < 2) {
    return {
      error:
        room.language === 'en'
          ? 'Need at least 2 players (3 recommended)'
          : 'Behöver minst 2 spelare (3 rekommenderas)',
    }
  }

  room.players.forEach((p) => {
    p.score = 0
  })
  room.usedPromptIds = []
  room.currentRound = 0
  room.writerOrder = shuffle(players.map((p) => p.id))
  room.writerIndex = -1
  room.lastRound = null
  room.highlights = []
  beginRound(room)
  touch(room)
  trackFunnel('game_start', code)
  return room
}

export function rematch(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta om' }
  if (room.status !== 'finished') return { error: 'Spelet är inte klart ännu' }

  room.status = 'lobby'
  room.currentRound = 0
  room.writerId = null
  room.prompt = null
  room.writerOrder = []
  room.writerIndex = -1
  room.originalText = ''
  room.submissions = []
  room.votes = {}
  room.endsAt = 0
  room.lastRound = null
  room.highlights = []
  room.players.forEach((p) => {
    p.score = 0
    if (p.id !== room.hostId) p.playing = true
  })
  touch(room)
  return room
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function beginRound(room: Room) {
  room.currentRound += 1
  if (room.currentRound > room.roundCount) {
    room.status = 'finished'
    room.endsAt = 0
    room.writerId = null
    room.prompt = null
    room.originalText = ''
    room.submissions = []
    room.sabotageTargets = {}
    room.votes = {}
    trackFunnel('game_finished', room.code)
    return
  }

  const connectedPlaying = playingPlayers(room).filter((p) => p.connected)
  if (connectedPlaying.length < 2) {
    room.status = 'finished'
    room.endsAt = 0
    trackFunnel('game_finished', room.code)
    return
  }

  room.writerOrder = shuffle(connectedPlaying.map((p) => p.id))
  room.writerIndex = 0
  room.writerId = null

  const exclude = new Set(room.usedPromptIds)
  const [prompt] = pickPrompts(1, room.language, exclude)
  room.prompt = prompt
  if (prompt) room.usedPromptIds.push(prompt.id)

  room.originalText = ''
  room.submissions = []
  room.sabotageTargets = {}
  room.votes = {}
  room.lastRound = null
  room.status = 'write'
  room.endsAt = 0
}

function writers(room: Room) {
  return playingPlayers(room).filter((p) => p.connected)
}

/** Everyone writes their own SMS for the prompt. */
export function submitOriginal(
  code: string,
  playerId: string,
  text: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'write') {
    return { error: 'Inte skrivfas just nu' }
  }

  const player = room.players.find((p) => p.id === playerId)
  if (!player?.playing) return { error: 'Du spelar inte' }

  const cleaned = text.trim().slice(0, 280)
  if (cleaned.length < 2) {
    return {
      error: room.language === 'en' ? 'Write a bit more' : 'Skriv lite mer',
    }
  }

  const existing = room.submissions.find((s) => s.authorId === playerId && s.isOriginal)
  if (existing) {
    existing.text = cleaned
  } else {
    room.submissions.push({
      id: crypto.randomUUID(),
      authorId: playerId,
      text: cleaned,
      isOriginal: true,
    })
  }

  const needed = writers(room)
  const done =
    needed.length > 0 &&
    needed.every((p) => room.submissions.some((s) => s.authorId === p.id && s.isOriginal))
  if (done) enterSabotage(room)

  touch(room)
  return room
}

function enterSabotage(room: Room) {
  const needed = writers(room)
  const order = shuffle(needed.map((p) => p.id))
  room.sabotageTargets = {}
  for (let i = 0; i < order.length; i++) {
    const saboteur = order[i]!
    const target = order[(i + 1) % order.length]!
    room.sabotageTargets[saboteur] = target
  }
  // Drop any leftover sabotages from a weird mid-round state
  room.submissions = room.submissions.filter((s) => s.isOriginal)
  room.votes = {}
  room.status = 'sabotage'
  room.endsAt = 0
}

/** Rewrite the SMS you were assigned. */
export function submitSabotage(
  code: string,
  playerId: string,
  text: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'sabotage') {
    return { error: 'Inte sabotagefas just nu' }
  }

  const player = room.players.find((p) => p.id === playerId)
  if (!player?.playing) return { error: 'Du spelar inte' }

  const targetAuthorId = room.sabotageTargets[playerId]
  if (!targetAuthorId) {
    return {
      error: room.language === 'en' ? 'No text to sabotage' : 'Ingen text att sabotera',
    }
  }

  const original = room.submissions.find(
    (s) => s.authorId === targetAuthorId && s.isOriginal,
  )
  if (!original) {
    return {
      error: room.language === 'en' ? 'Original missing' : 'Originalet saknas',
    }
  }

  const cleaned = text.trim().slice(0, 280)
  if (cleaned.length < 2) {
    return {
      error: room.language === 'en' ? 'Write a bit more' : 'Skriv lite mer',
    }
  }

  const existing = room.submissions.find((s) => s.authorId === playerId && !s.isOriginal)
  if (existing) {
    existing.text = cleaned
    existing.targetAuthorId = targetAuthorId
  } else {
    room.submissions.push({
      id: crypto.randomUUID(),
      authorId: playerId,
      text: cleaned,
      isOriginal: false,
      targetAuthorId,
    })
  }

  const needed = writers(room)
  const done =
    needed.length > 0 &&
    needed.every((p) => room.submissions.some((s) => s.authorId === p.id && !s.isOriginal))
  if (done) enterVote(room)

  touch(room)
  return room
}

function enterVote(room: Room) {
  const entries = room.submissions.filter((s) => !s.isOriginal)
  if (entries.length === 0) {
    room.lastRound = []
    room.status = 'reveal'
    room.endsAt = Date.now() + REVEAL_MS
    return
  }

  room.votes = {}
  room.status = 'vote'
  room.endsAt = 0
}

export function castVote(
  code: string,
  playerId: string,
  submissionId: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'vote') return { error: 'Inte röstfas just nu' }

  const player = room.players.find((p) => p.id === playerId)
  if (!player?.playing) return { error: 'Du spelar inte' }

  const target = room.submissions.find((s) => s.id === submissionId && !s.isOriginal)
  if (!target) return { error: 'Ogiltigt val' }

  room.votes[playerId] = submissionId

  const voters = voteEligible(room)
  if (voters.length > 0 && voters.every((p) => room.votes[p.id])) {
    resolveVote(room)
  }

  touch(room)
  return room
}

function voteEligible(room: Room) {
  return playingPlayers(room).filter((p) => p.connected)
}

function pushHighlight(room: Room, winner: RoundResult) {
  if (winner.votes <= 0) return
  const lang = room.language
  const promptTask = room.prompt ? localize(room.prompt.task, lang) : ''
  const highlight: MatchHighlight = {
    round: room.currentRound,
    promptTask,
    originalText: winner.originalText || promptTask,
    winnerText: winner.text,
    authorName: winner.authorName,
    votes: winner.votes,
  }
  room.highlights = [...room.highlights, highlight]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)
}

export function resolveVote(room: Room) {
  if (room.status !== 'vote') return

  const entries = room.submissions.filter((s) => !s.isOriginal)
  const tally = new Map<string, number>()
  for (const s of entries) tally.set(s.id, 0)
  for (const subId of Object.values(room.votes)) {
    tally.set(subId, (tally.get(subId) ?? 0) + 1)
  }

  const ranked = [...entries].sort(
    (a, b) => (tally.get(b.id) ?? 0) - (tally.get(a.id) ?? 0),
  )

  const topVotes = ranked.length ? (tally.get(ranked[0]!.id) ?? 0) : 0
  const tied =
    topVotes > 0 &&
    ranked.filter((s) => (tally.get(s.id) ?? 0) === topVotes).length > 1

  const results: RoundResult[] = []
  ranked.forEach((s) => {
    const author = room.players.find((p) => p.id === s.authorId)
    const target = s.targetAuthorId
      ? room.players.find((p) => p.id === s.targetAuthorId)
      : undefined
    const original = s.targetAuthorId
      ? room.submissions.find((o) => o.authorId === s.targetAuthorId && o.isOriginal)
      : undefined
    const votes = tally.get(s.id) ?? 0
    let gained = 0
    if (!tied && votes === topVotes && votes > 0) gained = 1000
    if (author && gained) author.score += gained
    results.push({
      submissionId: s.id,
      authorId: s.authorId,
      authorName: author?.name ?? '?',
      text: s.text,
      votes,
      gained,
      originalText: original?.text,
      targetName: target?.name,
    })
  })

  room.lastRound = results
  if (!tied && results[0] && results[0].votes > 0) pushHighlight(room, results[0])
  room.status = 'reveal'
  room.endsAt = Date.now() + REVEAL_MS
}

export function onPhaseTimeout(room: Room) {
  // No timers on write / sabotage / vote — wait until everyone is done.
  if (room.status === 'reveal') {
    beginRound(room)
    touch(room)
  }
}

export function roomsNeedingTick(): Room[] {
  const now = Date.now()
  const out: Room[] = []
  for (const room of rooms.values()) {
    if (!room.endsAt) continue
    if (
      room.status === 'write' ||
      room.status === 'sabotage' ||
      room.status === 'vote' ||
      room.status === 'reveal'
    ) {
      if (room.endsAt > 0 && room.endsAt <= now) out.push(room)
    }
  }
  return out
}

export function reconnectSocket(
  code: string,
  playerId: string,
  socketId: string,
): Room | { error: string } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Rummet finns inte' }
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return { error: 'Spelaren hittades inte' }

  cancelDisconnectTimer(code, playerId)
  player.connected = true
  socketToPlayer.set(socketId, { code: room.code, playerId })
  touch(room)
  return room
}

export function disconnectSocket(socketId: string) {
  const binding = socketToPlayer.get(socketId)
  if (!binding) return null
  socketToPlayer.delete(socketId)

  const room = rooms.get(binding.code)
  if (!room) return null
  const player = room.players.find((p) => p.id === binding.playerId)
  if (!player) return null

  const key = playerKey(binding.code, binding.playerId)
  cancelDisconnectTimer(binding.code, binding.playerId)
  disconnectTimers.set(
    key,
    setTimeout(() => {
      disconnectTimers.delete(key)
      const r = rooms.get(binding.code)
      if (!r) return
      const p = r.players.find((x) => x.id === binding.playerId)
      if (!p || p.connected) return
      maybeTransferHost(r, true)
      touch(r)
    }, DISCONNECT_GRACE_MS),
  )

  player.connected = false
  maybeTransferHost(room)
  touch(room)
  return room
}

function maybeTransferHost(room: Room, force = false) {
  const host = room.players.find((p) => p.id === room.hostId)
  if (host?.connected) return
  if (!force && Date.now() - room.updatedAt < HOST_TRANSFER_AFTER_MS) return
  const next = room.players.find((p) => p.connected && p.id !== room.hostId)
  if (next) room.hostId = next.id
}

export function pruneIdleRooms() {
  const now = Date.now()
  for (const [code, room] of rooms) {
    const idle = now - (room.updatedAt || 0) > ROOM_IDLE_MS
    const partyLive = Boolean(room.premiumExpiresAt && room.premiumExpiresAt > now)
    const anyoneConnected = room.players.some((p) => p.connected)
    if (idle && !partyLive && !anyoneConnected) {
      rooms.delete(code)
    }
  }
}

export function phaseSeconds(status: RoomStatus): number {
  // Never expose countdown pressure for write/vote — only soft reveal advance
  if (status === 'reveal') return REVEAL_MS / 1000
  return 0
}

export function toPublicRoom(room: Room, viewerId: string): PublicRoom {
  const lang = room.language
  const viewer = room.players.find((p) => p.id === viewerId)
  const youAreSpectator = !viewer?.playing
  const tier = tierFromExpiry(room.premiumExpiresAt)
  const limits = limitsFor(tier)

  const yourWrite =
    room.submissions.find((s) => s.authorId === viewerId && s.isOriginal)?.text ?? null
  const yourSabotage =
    room.submissions.find((s) => s.authorId === viewerId && !s.isOriginal)?.text ?? null

  const neededPlayers = writers(room)
  const writeDone = neededPlayers.filter((p) =>
    room.submissions.some((s) => s.authorId === p.id && s.isOriginal),
  ).length
  const sabotageDone = neededPlayers.filter((p) =>
    room.submissions.some((s) => s.authorId === p.id && !s.isOriginal),
  ).length

  const targetAuthorId = room.sabotageTargets[viewerId]
  const targetOriginal = targetAuthorId
    ? room.submissions.find((s) => s.authorId === targetAuthorId && s.isOriginal)
    : undefined
  const targetPlayer = targetAuthorId
    ? room.players.find((p) => p.id === targetAuthorId)
    : undefined

  let submissions: PublicRoom['submissions'] = []

  if (room.status === 'vote') {
    const entries = shuffle(room.submissions.filter((s) => !s.isOriginal))
    submissions = entries.map((s) => ({
      id: s.id,
      text: s.text,
      isYours: s.authorId === viewerId,
      isOriginal: false,
    }))
  } else if (room.status === 'reveal' || room.status === 'finished') {
    submissions = room.submissions
      .filter((s) => !s.isOriginal)
      .map((s) => {
        const author = room.players.find((p) => p.id === s.authorId)
        const votes = Object.values(room.votes).filter((v) => v === s.id).length
        return {
          id: s.id,
          text: s.text,
          authorName: author?.name,
          votes,
          isYours: s.authorId === viewerId,
          isOriginal: false,
        }
      })
  }

  const showHighlights = room.status === 'finished' || room.status === 'reveal'

  // Never surface phase timers to clients for write/vote (and clear stale endsAt)
  const endsAt =
    room.status === 'reveal' && room.endsAt > 0 ? room.endsAt : 0

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ ...p })),
    language: lang,
    roundCount: room.roundCount,
    hostPlays: room.hostPlays,
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.roundCount,
    writerId: null,
    writerName: null,
    youAreWriter: false,
    youAreSpectator,
    prompt: room.prompt
      ? {
          recipient: localize(room.prompt.recipient, lang),
          task: localize(room.prompt.task, lang),
        }
      : null,
    originalText:
      room.status === 'sabotage' ? (targetOriginal?.text ?? null) : null,
    sabotageTargetName:
      room.status === 'sabotage' ? (targetPlayer?.name ?? null) : null,
    yourWrite,
    yourSabotage,
    writeCount: writeDone,
    writeNeeded: neededPlayers.length,
    sabotageCount: sabotageDone,
    sabotageNeeded: neededPlayers.length,
    submissions,
    yourVote: room.votes[viewerId] ?? null,
    votedCount: Object.keys(room.votes).length,
    voterCount: voteEligible(room).length,
    endsAt,
    lastRound: room.lastRound,
    phaseSeconds: phaseSeconds(room.status),
    premiumTier: tier,
    premiumExpiresAt: room.premiumExpiresAt,
    limits,
    isPublic: Boolean(room.isPublic),
    waitlist: room.waitlist ?? [],
    highlights: showHighlights ? room.highlights : [],
  }
}

export type { Submission }
