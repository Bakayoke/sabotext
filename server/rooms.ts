import { customAlphabet } from 'nanoid'
import { localize, parsePromptPack, pickPrompts } from './prompts.js'
import { trackFunnel } from './metrics.js'
import {
  limitsFor,
  tierFromExpiry,
} from './premium.js'
import type {
  Lang,
  MatchHighlight,
  MatchStats,
  Player,
  PromptPack,
  PublicRoom,
  Room,
  RoomStatus,
  RoundMode,
  RoundResult,
  Submission,
} from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)

export const WRITE_MS = 0
export const SABOTAGE_MS = 0
export const VOTE_MS = 0
/** Longer reveal for staged drama + share window */
export const REVEAL_MS = 16_000
export const POINTS_PER_VOTE = 100
export const FINALE_POINTS_PER_VOTE = 150

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
  _partyToken?: string | null,
  promptPack: PromptPack = 'mix',
): { room: Room; playerId: string } {
  const limits = limitsFor()
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
    promptPack: parsePromptPack(promptPack),
    status: 'lobby',
    usedPromptIds: [],
    currentRound: 0,
    roundMode: 'normal',
    writerId: null,
    prompt: null,
    promptIsPersonal: false,
    writerOrder: [],
    writerIndex: -1,
    originalText: '',
    submissions: [],
    sabotageTargets: {},
    voteOrder: [],
    votes: {},
    endsAt: 0,
    lastRound: null,
    highlights: [],
    rivalryHits: {},
    votesReceived: {},
    clutchBest: null,
    premiumExpiresAt: null,
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
        room.language === 'en'
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
  const playStatuses = new Set<RoomStatus>(['write', 'sabotage', 'vote', 'reveal'])
  for (const raw of list) {
    if (!raw?.code || rooms.has(raw.code)) continue
    if (raw.updatedAt && now - raw.updatedAt > ROOM_IDLE_MS) {
      if (!raw.premiumExpiresAt || raw.premiumExpiresAt <= now) continue
    }

    const status: RoomStatus =
      raw.status === 'lobby' ||
      raw.status === 'write' ||
      raw.status === 'sabotage' ||
      raw.status === 'vote' ||
      raw.status === 'reveal' ||
      raw.status === 'finished'
        ? raw.status
        : 'lobby'

    const room: Room = {
      ...raw,
      code: String(raw.code).toUpperCase(),
      highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
      isPublic: Boolean(raw.isPublic),
      waitlist: Array.isArray(raw.waitlist) ? raw.waitlist : [],
      sabotageTargets: raw.sabotageTargets ?? {},
      voteOrder: Array.isArray(raw.voteOrder) ? raw.voteOrder : [],
      usedPromptIds: Array.isArray(raw.usedPromptIds) ? raw.usedPromptIds : [],
      writerOrder: Array.isArray(raw.writerOrder) ? raw.writerOrder : [],
      roundMode:
        raw.roundMode === 'wouldSend' ||
        raw.roundMode === 'doubleSabotage' ||
        raw.roundMode === 'finale'
          ? raw.roundMode
          : 'normal',
      promptPack: parsePromptPack(raw.promptPack),
      promptIsPersonal: Boolean(raw.promptIsPersonal),
      rivalryHits:
        raw.rivalryHits && typeof raw.rivalryHits === 'object' ? raw.rivalryHits : {},
      votesReceived:
        raw.votesReceived && typeof raw.votesReceived === 'object' ? raw.votesReceived : {},
      clutchBest: raw.clutchBest ?? null,
      premiumExpiresAt: raw.premiumExpiresAt ?? null,
      players: (raw.players ?? []).map((p) => ({ ...p, connected: false })),
      status,
      // Keep mid-match state so redeploys don't wipe active games
      submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
      votes: raw.votes && typeof raw.votes === 'object' ? { ...raw.votes } : {},
      lastRound: raw.lastRound ?? null,
      prompt: raw.prompt ?? null,
      originalText: raw.originalText ?? '',
      endsAt: typeof raw.endsAt === 'number' ? raw.endsAt : 0,
      updatedAt: raw.updatedAt ?? now,
    }

    // Soft-advance reveal if the timer already elapsed while we were down
    if (playStatuses.has(room.status) && room.status === 'reveal' && room.endsAt > 0 && room.endsAt <= now) {
      room.endsAt = now
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
      error: room.language === 'en' ? 'Invalid round count' : 'Ogiltigt antal rundor',
    }
  }
  room.roundCount = count
  touch(room)
  return room
}

export function setPromptPack(
  code: string,
  playerId: string,
  pack: PromptPack,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan välja tema' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.promptPack = parsePromptPack(pack)
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
      party: true,
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
  room.rivalryHits = {}
  room.votesReceived = {}
  room.clutchBest = null
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
  room.rivalryHits = {}
  room.votesReceived = {}
  room.clutchBest = null
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

function pickRoundMode(
  currentRound: number,
  totalRounds: number,
  playerCount: number,
): RoundMode {
  if (currentRound >= totalRounds && totalRounds >= 2) return 'finale'
  if (totalRounds >= 4 && currentRound === Math.ceil(totalRounds / 2)) return 'wouldSend'
  if (
    totalRounds >= 5 &&
    playerCount >= 3 &&
    currentRound === Math.max(2, Math.ceil(totalRounds / 3))
  ) {
    return 'doubleSabotage'
  }
  return 'normal'
}

function trackRivalry(room: Room, saboteurId: string, targetId: string) {
  if (!room.rivalryHits) room.rivalryHits = {}
  if (!room.rivalryHits[saboteurId]) room.rivalryHits[saboteurId] = {}
  const row = room.rivalryHits[saboteurId]!
  row[targetId] = (row[targetId] ?? 0) + 1
}

function saboteurPlayers(room: Room) {
  const needed = writers(room)
  const assigned = Object.keys(room.sabotageTargets)
  if (room.roundMode === 'doubleSabotage' && assigned.length > 0) {
    return needed.filter((p) => assigned.includes(p.id))
  }
  return needed
}

function computeMatchStats(room: Room): MatchStats | null {
  if (room.status !== 'finished') return null

  let topRivalry: MatchStats['topRivalry'] = null
  for (const [fromId, targets] of Object.entries(room.rivalryHits ?? {})) {
    for (const [toId, count] of Object.entries(targets)) {
      if (count < 2) continue
      if (!topRivalry || count > topRivalry.count) {
        const saboteur = room.players.find((p) => p.id === fromId)?.name
        const victim = room.players.find((p) => p.id === toId)?.name
        if (saboteur && victim) topRivalry = { saboteur, victim, count }
      }
    }
  }

  let mostVoted: MatchStats['mostVoted'] = null
  for (const [playerId, votes] of Object.entries(room.votesReceived ?? {})) {
    if (votes <= 0) continue
    if (!mostVoted || votes > mostVoted.votes) {
      const name = room.players.find((p) => p.id === playerId)?.name
      if (name) mostVoted = { name, votes }
    }
  }

  let clutch: MatchStats['clutch'] = null
  if (room.clutchBest && room.clutchBest.gained > 0) {
    const name = room.players.find((p) => p.id === room.clutchBest!.playerId)?.name
    if (name) {
      clutch = {
        name,
        gained: room.clutchBest.gained,
        text: room.clutchBest.text,
      }
    }
  }

  if (!topRivalry && !mostVoted && !clutch) return null
  return { topRivalry, mostVoted, clutch }
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
    room.voteOrder = []
    room.votes = {}
    room.roundMode = 'normal'
    room.promptIsPersonal = false
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
  room.roundMode = pickRoundMode(
    room.currentRound,
    room.roundCount,
    connectedPlaying.length,
  )

  const exclude = new Set(room.usedPromptIds)
  const [picked] = pickPrompts(1, room.language, exclude, room.promptPack ?? 'mix')
  let prompt = picked ?? null
  room.promptIsPersonal = false

  // ~40%: make the SMS recipient someone in the room
  if (prompt && connectedPlaying.length >= 2 && Math.random() < 0.4) {
    const star = connectedPlaying[Math.floor(Math.random() * connectedPlaying.length)]!
    prompt = {
      ...prompt,
      recipient: { sv: star.name, en: star.name },
    }
    room.promptIsPersonal = true
  }

  room.prompt = prompt
  if (picked) room.usedPromptIds.push(picked.id)

  room.originalText = ''
  room.submissions = []
  room.sabotageTargets = {}
  room.voteOrder = []
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
  room.sabotageTargets = {}

  if (room.roundMode === 'doubleSabotage' && needed.length >= 3) {
    const victim = needed[Math.floor(Math.random() * needed.length)]!
    for (const p of needed) {
      if (p.id === victim.id) continue
      room.sabotageTargets[p.id] = victim.id
      trackRivalry(room, p.id, victim.id)
    }
  } else {
    // Fall back to normal circle if double sabotage isn't viable
    if (room.roundMode === 'doubleSabotage') room.roundMode = 'normal'
    const order = shuffle(needed.map((p) => p.id))
    for (let i = 0; i < order.length; i++) {
      const saboteur = order[i]!
      const target = order[(i + 1) % order.length]!
      room.sabotageTargets[saboteur] = target
      trackRivalry(room, saboteur, target)
    }
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

  const needed = saboteurPlayers(room)
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
    room.voteOrder = []
    room.status = 'reveal'
    room.endsAt = Date.now() + REVEAL_MS
    return
  }

  room.votes = {}
  room.voteOrder = shuffle(entries.map((s) => s.id))
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
  const pointsPerVote =
    room.roundMode === 'finale' ? FINALE_POINTS_PER_VOTE : POINTS_PER_VOTE

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
    const gained = votes * pointsPerVote
    if (author && gained) author.score += gained
    if (votes > 0) {
      if (!room.votesReceived) room.votesReceived = {}
      room.votesReceived[s.authorId] = (room.votesReceived[s.authorId] ?? 0) + votes
    }
    if (gained > 0 && (!room.clutchBest || gained > room.clutchBest.gained)) {
      room.clutchBest = { playerId: s.authorId, gained, text: s.text }
    }
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
  for (const r of results) {
    if (r.votes > 0 && r.votes === topVotes) pushHighlight(room, r)
  }
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
  const saboteurs = saboteurPlayers(room)
  const writeDone = neededPlayers.filter((p) =>
    room.submissions.some((s) => s.authorId === p.id && s.isOriginal),
  ).length
  const sabotageDone = saboteurs.filter((p) =>
    room.submissions.some((s) => s.authorId === p.id && !s.isOriginal),
  ).length

  const targetAuthorId = room.sabotageTargets[viewerId]
  const targetOriginal = targetAuthorId
    ? room.submissions.find((s) => s.authorId === targetAuthorId && s.isOriginal)
    : undefined
  const targetPlayer = targetAuthorId
    ? room.players.find((p) => p.id === targetAuthorId)
    : undefined
  const youSkipSabotage =
    room.status === 'sabotage' &&
    Boolean(viewer?.playing) &&
    !targetAuthorId

  const anonymousVote = room.roundMode === 'finale'

  let submissions: PublicRoom['submissions'] = []

  if (room.status === 'vote') {
    const entries = room.submissions.filter((s) => !s.isOriginal)
    const byId = new Map(entries.map((s) => [s.id, s]))
    const order =
      room.voteOrder.length > 0
        ? [...room.voteOrder.filter((id) => byId.has(id))]
        : entries.map((s) => s.id)
    // Append any missing ids (shouldn't happen mid-vote)
    for (const s of entries) {
      if (!order.includes(s.id)) order.push(s.id)
    }
    submissions = order.map((id) => {
      const s = byId.get(id)!
      return {
        id: s.id,
        text: s.text,
        isYours: anonymousVote ? false : s.authorId === viewerId,
        isOriginal: false,
      }
    })
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

  let waitingNames: string[] = []
  if (room.status === 'write') {
    waitingNames = neededPlayers
      .filter((p) => !room.submissions.some((s) => s.authorId === p.id && s.isOriginal))
      .map((p) => p.name)
  } else if (room.status === 'sabotage') {
    waitingNames = saboteurs
      .filter((p) => !room.submissions.some((s) => s.authorId === p.id && !s.isOriginal))
      .map((p) => p.name)
  } else if (room.status === 'vote') {
    waitingNames = voteEligible(room)
      .filter((p) => !room.votes[p.id])
      .map((p) => p.name)
  }

  const saboteursOnYou =
    room.status === 'sabotage'
      ? Object.entries(room.sabotageTargets)
          .filter(([, targetId]) => targetId === viewerId)
          .map(([saboteurId]) => room.players.find((p) => p.id === saboteurId)?.name)
          .filter((n): n is string => Boolean(n))
      : []

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
    promptPack: room.promptPack ?? 'mix',
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.roundCount,
    roundMode: room.roundMode ?? 'normal',
    writerId: null,
    writerName: null,
    youAreWriter: false,
    youAreSpectator,
    youSkipSabotage,
    prompt: room.prompt
      ? {
          recipient: localize(room.prompt.recipient, lang),
          task: localize(room.prompt.task, lang),
        }
      : null,
    promptIsPersonal: Boolean(room.promptIsPersonal),
    originalText:
      room.status === 'sabotage' ? (targetOriginal?.text ?? null) : null,
    sabotageTargetName:
      room.status === 'sabotage' ? (targetPlayer?.name ?? null) : null,
    waitingNames,
    saboteursOnYou,
    yourWrite,
    yourSabotage,
    writeCount: writeDone,
    writeNeeded: neededPlayers.length,
    sabotageCount: sabotageDone,
    sabotageNeeded: saboteurs.length,
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
    matchStats: computeMatchStats(room),
  }
}

export type { Submission }
