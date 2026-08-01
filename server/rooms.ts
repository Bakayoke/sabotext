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

export const WRITE_MS = 60_000
export const SABOTAGE_MS = 90_000
export const VOTE_MS = 35_000
export const REVEAL_MS = 7_000

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
  return allowed.includes(count) ? count : allowed[0] ?? 6
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
          ? 'Invalid round count (Party required for 12/16)'
          : 'Ogiltigt antal rundor (Party krävs för 12/16)',
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
  if (isPublic && tierFromExpiry(room.premiumExpiresAt) !== 'party') {
    return { error: 'Party krävs för öppna rum (Hitta spel)' }
  }
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
    if (tierFromExpiry(room.premiumExpiresAt) !== 'party') continue
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

  const orderIds = room.writerOrder.filter((id) =>
    connectedPlaying.some((p) => p.id === id),
  )
  for (const p of connectedPlaying) {
    if (!orderIds.includes(p.id)) orderIds.push(p.id)
  }
  room.writerOrder = orderIds.length ? orderIds : connectedPlaying.map((p) => p.id)
  room.writerIndex = (room.writerIndex + 1) % room.writerOrder.length
  room.writerId = room.writerOrder[room.writerIndex] ?? connectedPlaying[0].id

  const exclude = new Set(room.usedPromptIds)
  const [prompt] = pickPrompts(1, room.language, exclude)
  room.prompt = prompt
  if (prompt) room.usedPromptIds.push(prompt.id)

  room.originalText = ''
  room.submissions = []
  room.votes = {}
  room.lastRound = null
  room.status = 'write'
  room.endsAt = Date.now() + WRITE_MS
}

export function submitOriginal(
  code: string,
  playerId: string,
  text: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'write') return { error: 'Inte skrivfas just nu' }
  if (room.writerId !== playerId) return { error: 'Bara skribenten kan skicka' }

  const cleaned = text.trim().slice(0, 280)
  if (cleaned.length < 2) {
    return {
      error: room.language === 'en' ? 'Write a bit more' : 'Skriv lite mer',
    }
  }

  room.originalText = cleaned
  room.submissions = [
    {
      id: crypto.randomUUID(),
      authorId: playerId,
      text: cleaned,
      isOriginal: true,
    },
  ]
  enterSabotage(room)
  touch(room)
  return room
}

function enterSabotage(room: Room) {
  room.status = 'sabotage'
  room.endsAt = Date.now() + SABOTAGE_MS
}

function saboteurs(room: Room) {
  return playingPlayers(room).filter((p) => p.connected && p.id !== room.writerId)
}

export function submitSabotage(
  code: string,
  playerId: string,
  text: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'sabotage') return { error: 'Inte sabotagefas just nu' }
  if (playerId === room.writerId) return { error: 'Skribenten saboterar inte' }

  const player = room.players.find((p) => p.id === playerId)
  if (!player?.playing) return { error: 'Du spelar inte' }

  const cleaned = text.trim().slice(0, 280)
  if (cleaned.length < 2) {
    return {
      error: room.language === 'en' ? 'Write a bit more' : 'Skriv lite mer',
    }
  }

  const existing = room.submissions.find((s) => s.authorId === playerId && !s.isOriginal)
  if (existing) {
    existing.text = cleaned
  } else {
    room.submissions.push({
      id: crypto.randomUUID(),
      authorId: playerId,
      text: cleaned,
      isOriginal: false,
    })
  }

  const needed = saboteurs(room)
  const done = needed.every((p) =>
    room.submissions.some((s) => s.authorId === p.id && !s.isOriginal),
  )
  if (done && needed.length > 0) {
    enterVote(room)
  }

  touch(room)
  return room
}

function enterVote(room: Room) {
  const sabotages = room.submissions.filter((s) => !s.isOriginal)
  if (sabotages.length === 0) {
    const writer = room.players.find((p) => p.id === room.writerId)
    if (writer) writer.score += 500
    room.lastRound = writer
      ? [
          {
            submissionId: room.submissions[0]?.id ?? '',
            authorId: writer.id,
            authorName: writer.name,
            text: room.originalText,
            votes: 0,
            gained: 500,
          },
        ]
      : []
    room.status = 'reveal'
    room.endsAt = Date.now() + REVEAL_MS
    return
  }

  room.votes = {}
  room.status = 'vote'
  room.endsAt = Date.now() + VOTE_MS
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
  if (target.authorId === playerId) {
    return {
      error: room.language === 'en' ? "Can't vote for your own" : 'Du kan inte rösta på dig själv',
    }
  }

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
    originalText: room.originalText,
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

  const sabotages = room.submissions.filter((s) => !s.isOriginal)
  const tally = new Map<string, number>()
  for (const s of sabotages) tally.set(s.id, 0)
  for (const subId of Object.values(room.votes)) {
    tally.set(subId, (tally.get(subId) ?? 0) + 1)
  }

  const ranked = [...sabotages].sort(
    (a, b) => (tally.get(b.id) ?? 0) - (tally.get(a.id) ?? 0),
  )

  const results: RoundResult[] = []
  ranked.forEach((s, i) => {
    const author = room.players.find((p) => p.id === s.authorId)
    const votes = tally.get(s.id) ?? 0
    let gained = 0
    if (i === 0 && votes > 0) gained = 1000
    else if (i === 1 && votes > 0 && ranked.length >= 3) gained = 400
    if (author && gained) author.score += gained
    results.push({
      submissionId: s.id,
      authorId: s.authorId,
      authorName: author?.name ?? '?',
      text: s.text,
      votes,
      gained,
    })
  })

  room.lastRound = results
  if (results[0]) pushHighlight(room, results[0])
  room.status = 'reveal'
  room.endsAt = Date.now() + REVEAL_MS
}

export function onPhaseTimeout(room: Room) {
  if (room.status === 'write') {
    if (!room.originalText) {
      const fallback =
        room.language === 'en'
          ? "Sorry I'm late, something came up…"
          : 'Förlåt att jag är sen, det hände något…'
      room.originalText = fallback
      room.submissions = [
        {
          id: crypto.randomUUID(),
          authorId: room.writerId ?? '',
          text: fallback,
          isOriginal: true,
        },
      ]
    }
    enterSabotage(room)
    touch(room)
    return
  }

  if (room.status === 'sabotage') {
    enterVote(room)
    touch(room)
    return
  }

  if (room.status === 'vote') {
    resolveVote(room)
    touch(room)
    return
  }

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
  if (status === 'write') return WRITE_MS / 1000
  if (status === 'sabotage') return SABOTAGE_MS / 1000
  if (status === 'vote') return VOTE_MS / 1000
  if (status === 'reveal') return REVEAL_MS / 1000
  return 0
}

export function toPublicRoom(room: Room, viewerId: string): PublicRoom {
  const lang = room.language
  const viewer = room.players.find((p) => p.id === viewerId)
  const youAreWriter = room.writerId === viewerId
  const youAreSpectator = !viewer?.playing
  const writer = room.players.find((p) => p.id === room.writerId)
  const tier = tierFromExpiry(room.premiumExpiresAt)
  const limits = limitsFor(tier)

  const yourSabotage =
    room.submissions.find((s) => s.authorId === viewerId && !s.isOriginal)?.text ?? null

  const needed = saboteurs(room).length
  const sabotageDone = room.submissions.filter((s) => !s.isOriginal).length

  let submissions: PublicRoom['submissions'] = []

  if (room.status === 'vote') {
    const sabotages = shuffle(room.submissions.filter((s) => !s.isOriginal))
    submissions = sabotages.map((s) => ({
      id: s.id,
      text: s.text,
      isYours: s.authorId === viewerId,
      isOriginal: false,
    }))
  } else if (room.status === 'reveal' || room.status === 'finished') {
    submissions = room.submissions.map((s) => {
      const author = room.players.find((p) => p.id === s.authorId)
      const votes = Object.values(room.votes).filter((v) => v === s.id).length
      return {
        id: s.id,
        text: s.text,
        authorName: author?.name,
        votes: s.isOriginal ? undefined : votes,
        isYours: s.authorId === viewerId,
        isOriginal: s.isOriginal,
      }
    })
  }

  const showOriginal =
    room.status === 'sabotage' ||
    room.status === 'vote' ||
    room.status === 'reveal' ||
    (room.status === 'write' && youAreWriter && room.originalText)

  const showHighlights = room.status === 'finished' || room.status === 'reveal'

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
    writerId: room.writerId,
    writerName: writer?.name ?? null,
    youAreWriter,
    youAreSpectator,
    prompt: room.prompt
      ? {
          recipient: localize(room.prompt.recipient, lang),
          task: localize(room.prompt.task, lang),
        }
      : null,
    originalText: showOriginal ? room.originalText || null : null,
    yourSabotage,
    sabotageCount: sabotageDone,
    sabotageNeeded: needed,
    submissions,
    yourVote: room.votes[viewerId] ?? null,
    votedCount: Object.keys(room.votes).length,
    voterCount: voteEligible(room).length,
    endsAt: room.endsAt,
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
