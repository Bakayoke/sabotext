import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  allRooms,
  createRoom,
  disconnectSocket,
  getBinding,
  getRoom,
  hydrateRooms,
  joinRoom,
  liveActivity,
  listPublicLobbies,
  onPhaseTimeout,
  pruneIdleRooms,
  reconnectSocket,
  rematch,
  roomsNeedingTick,
  setHostPlaying,
  setLanguage,
  setPersistHook,
  setPublicLobby,
  setRoundCount,
  setPromptPack,
  startGame,
  submitOriginal,
  submitSabotage,
  castVote,
  toPublicRoom,
  getAllowedRounds,
} from './rooms.js'
import { allPasses, restorePasses, setPassPersistHook } from './premium.js'
import { buildSnapshot, flushPersist, initPersist, loadSnapshot, persistDiagnostics, scheduleSave } from './persist.js'
import { funnelSnapshot, publicActivity, trackFunnel, type FunnelEvent } from './metrics.js'
import { exampleHighlights, localize, todaysTheme } from './prompts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://sabotext.linus-stenvi.workers.dev',
  'https://sabotext.com',
  'https://www.sabotext.com',
]

const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const allowedOrigins = [...new Set([...defaultOrigins, ...corsOrigins])]

const app = express()
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'sabotext',
    free: true,
    persist: persistDiagnostics(),
    rounds: getAllowedRounds(),
  })
})

app.get('/api/lobbies', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : req.query.lang === 'sv' ? 'sv' : null
  const lobbies = listPublicLobbies({ language: lang, limit: 24 })
  const live = liveActivity()
  res.json({
    lobbies,
    onlineRooms: lobbies.length,
    weekThemePack: null,
    activity: publicActivity(live),
  })
})

app.get('/api/home', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'sv'
  const theme = todaysTheme()
  const live = liveActivity()
  res.json({
    theme: {
      id: theme.id,
      label: localize(theme.label, lang),
      blurb: localize(theme.blurb, lang),
    },
    examples: exampleHighlights(lang),
    activity: publicActivity(live),
  })
})

app.post('/api/metrics', (req, res) => {
  const event = String(req.body?.event ?? '') as FunnelEvent
  const meta = typeof req.body?.meta === 'string' ? req.body.meta : undefined
  trackFunnel(event, meta)
  res.json({ ok: true })
})

app.get('/api/metrics', (_req, res) => {
  res.json(funnelSnapshot())
})

app.get('/api/room/:code/preview', (req, res) => {
  const room = getRoom(String(req.params.code ?? '').toUpperCase())
  if (!room) {
    res.status(404).json({ error: 'not found' })
    return
  }
  res.json({
    code: room.code,
    status: room.status,
    language: room.language,
    playerCount: room.players.length,
    roundCount: room.roundCount,
  })
})

const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next()
  })
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 20_000,
  pingTimeout: 60_000,
  connectTimeout: 30_000,
})

function broadcastRoom(roomCode: string) {
  const room = getRoom(roomCode)
  if (!room) return
  const sockets = io.sockets.adapter.rooms.get(roomCode)
  if (!sockets) return
  for (const socketId of sockets) {
    const binding = getBinding(socketId)
    const socket = io.sockets.sockets.get(socketId)
    if (socket && binding) {
      socket.emit('room', toPublicRoom(room, binding.playerId))
    }
  }
}

io.on('connection', (socket) => {
  socket.on('create', ({ name, roundCount, hostPlays, language, promptPack }, ack) => {
    try {
      const { room, playerId } = createRoom(
        name,
        Number(roundCount) || 6,
        socket.id,
        hostPlays !== false,
        language === 'en' ? 'en' : 'sv',
        null,
        promptPack,
      )
      socket.join(room.code)
      const payload = { playerId, room: toPublicRoom(room, playerId) }
      ack?.(payload)
      socket.emit('room', payload.room)
    } catch {
      ack?.({ error: 'Kunde inte skapa spel' })
    }
  })

  socket.on('setPublicLobby', ({ isPublic }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setPublicLobby(binding.code, binding.playerId, Boolean(isPublic))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('join', ({ code, name }, ack) => {
    try {
      const result = joinRoom(String(code ?? ''), String(name ?? ''), socket.id)
      if ('error' in result) {
        if (result.code === 'ROOM_FULL' && result.roomCode) {
          broadcastRoom(result.roomCode)
        }
        ack?.({
          error: result.error,
          code: result.code,
          roomCode: result.roomCode,
          waitlistCount: result.waitlistCount,
        })
        return
      }
      socket.join(result.room.code)
      const payload = { playerId: result.playerId, room: toPublicRoom(result.room, result.playerId) }
      ack?.(payload)
      socket.emit('room', payload.room)
      broadcastRoom(result.room.code)
    } catch {
      ack?.({ error: 'Kunde inte gå med' })
    }
  })

  socket.on('rejoin', ({ code, playerId }, ack) => {
    try {
      const result = reconnectSocket(String(code ?? ''), String(playerId ?? ''), socket.id)
      if ('error' in result) {
        ack?.(result)
        return
      }
      socket.join(result.code)
      const payload = { playerId, room: toPublicRoom(result, playerId) }
      ack?.(payload)
      socket.emit('room', payload.room)
      broadcastRoom(result.code)
    } catch {
      ack?.({ error: 'Kunde inte återansluta' })
    }
  })

  socket.on('setRoundCount', ({ count }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setRoundCount(binding.code, binding.playerId, Number(count))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setPromptPack', ({ pack }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setPromptPack(binding.code, binding.playerId, pack)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setHostPlaying', ({ playing }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setHostPlaying(binding.code, binding.playerId, Boolean(playing))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setLanguage', ({ language }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setLanguage(binding.code, binding.playerId, language === 'en' ? 'en' : 'sv')
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('start', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = startGame(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('submitOriginal', ({ text }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = submitOriginal(binding.code, binding.playerId, String(text ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('submitSabotage', ({ text }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = submitSabotage(binding.code, binding.playerId, String(text ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('castVote', ({ submissionId }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = castVote(binding.code, binding.playerId, String(submissionId ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('rematch', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = rematch(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('disconnect', () => {
    const room = disconnectSocket(socket.id)
    if (room) broadcastRoom(room.code)
  })
})

setInterval(() => {
  for (const room of roomsNeedingTick()) {
    onPhaseTimeout(room)
    broadcastRoom(room.code)
  }
}, 250)

setInterval(() => {
  pruneIdleRooms()
  scheduleSave(buildSnapshot(allPasses().values(), allRooms().values()))
}, 30_000)

async function boot() {
  const persist = await initPersist()
  const persistNow = () => scheduleSave(buildSnapshot(allPasses().values(), allRooms().values()))
  setPersistHook(persistNow)
  setPassPersistHook(persistNow)

  const snapshot = await loadSnapshot()
  if (snapshot) {
    restorePasses(snapshot.passes)
    hydrateRooms(snapshot.rooms)
    console.log(
      `Persist restore: ${snapshot.passes.length} passes, ${snapshot.rooms.length} rooms (${persist.backend})`,
    )
  } else if (persist.backend) {
    console.log(`Persist ready (${persist.backend}) — empty state`)
  } else {
    console.log(
      'Persist: memory only. Set REDIS_URL or SABOTEXT_DATA_DIR to keep Party/rooms across restarts.',
    )
  }

  process.on('SIGTERM', () => {
    void flushPersist().finally(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    void flushPersist().finally(() => process.exit(0))
  })

  httpServer.listen(PORT, () => {
    const pdiag = persistDiagnostics()
    console.log(`Sabotext API on :${PORT}`)
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
    console.log('Billing: free (no Stripe)')
    console.log(
      `Persist: ${pdiag.configured ? pdiag.backend : 'memory only'}${pdiag.hint ? ` | ${pdiag.hint}` : ''}`,
    )
  })
}

void boot()
