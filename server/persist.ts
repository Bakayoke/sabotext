import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import type { Room } from './types.js'

export type PersistedSnapshot = {
  version: 1
  savedAt: number
  rooms: Room[]
}

type Backend = {
  name: string
  load(): Promise<PersistedSnapshot | null>
  save(snapshot: PersistedSnapshot): Promise<void>
}

let backend: Backend | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: PersistedSnapshot | null = null
let ready = false
let lastSaveAt = 0
let lastError: string | null = null

function emptySnapshot(): PersistedSnapshot {
  return { version: 1, savedAt: Date.now(), rooms: [] }
}

function fileBackend(dir: string): Backend {
  const file = path.join(dir, 'sabotext-state.json')
  return {
    name: `file:${file}`,
    async load() {
      try {
        const raw = await readFile(file, 'utf8')
        return JSON.parse(raw) as PersistedSnapshot
      } catch {
        return null
      }
    },
    async save(snapshot) {
      await mkdir(dir, { recursive: true })
      await writeFile(file, JSON.stringify(snapshot), 'utf8')
    },
  }
}

async function redisBackend(url: string): Promise<Backend> {
  const { createClient } = await import('redis')
  const client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
    },
  })
  client.on('error', (err) => {
    lastError = err instanceof Error ? err.message : 'redis error'
    console.error('Redis error', err)
  })
  await client.connect()
  const key = 'sabotext:state'
  return {
    name: 'redis',
    async load() {
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw) as PersistedSnapshot
    },
    async save(snapshot) {
      await client.set(key, JSON.stringify(snapshot), { EX: 60 * 60 * 48 })
    },
  }
}

async function dirExists(dir: string) {
  try {
    await access(dir)
    return true
  } catch {
    return false
  }
}

export async function initPersist(): Promise<{ backend: string | null }> {
  const redisUrl =
    process.env.REDIS_URL?.trim() ||
    process.env.REDIS_PRIVATE_URL?.trim() ||
    process.env.REDIS_PUBLIC_URL?.trim()
  const dataDir =
    process.env.SABOTEXT_DATA_DIR?.trim() ||
    ((await dirExists('/data')) ? '/data' : '')

  try {
    if (redisUrl) {
      backend = await redisBackend(redisUrl)
      lastError = null
    } else if (dataDir) {
      backend = fileBackend(dataDir)
      lastError = null
    } else {
      backend = null
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'persist init failed'
    console.error('Persist init failed', err)
    backend = null
  }

  ready = true
  return { backend: backend?.name ?? null }
}

export async function loadSnapshot(): Promise<PersistedSnapshot> {
  if (!backend) return emptySnapshot()
  try {
    const snap = await backend.load()
    return snap ?? emptySnapshot()
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'load failed'
    return emptySnapshot()
  }
}

export function buildSnapshot(rooms: Room[]): PersistedSnapshot {
  // Don't persist mid-round secrets unnecessarily — keep structure simple
  const cleaned = rooms.map((r) => ({
    ...r,
    // Mark everyone disconnected on restore; they'll rejoin
    players: r.players.map((p) => ({ ...p, connected: false })),
  }))
  return { version: 1, savedAt: Date.now(), rooms: cleaned }
}

export function scheduleSave(snapshot: PersistedSnapshot) {
  pending = snapshot
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushPersist()
  }, 800)
}

export async function flushPersist() {
  if (!backend || !pending) return
  const snap = pending
  pending = null
  try {
    await backend.save(snap)
    lastSaveAt = Date.now()
    lastError = null
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'save failed'
    console.error('Persist save failed', err)
  }
}

export function persistDiagnostics() {
  return {
    configured: Boolean(backend),
    backend: backend?.name ?? null,
    ready,
    lastSaveAt: lastSaveAt || null,
    lastError,
  }
}
