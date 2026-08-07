import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'

export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  roundCounts: number[]
}

export const FREE_LIMITS: PremiumLimits = {
  maxPlayers: 5, // host + 4
  roundCounts: [8, 10, 12, 15],
}

export const PARTY_LIMITS: PremiumLimits = {
  maxPlayers: 0, // unlimited
  roundCounts: [10, 12, 15, 20, 25],
}

export const PARTY_PASS_MS = 24 * 60 * 60 * 1000
export const PARTY_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type PartyPlan = 'day' | 'week'

export type PartyPass = {
  token: string
  tier: 'party'
  expiresAt: number
  plan?: PartyPlan
}

const passes = new Map<string, PartyPass>()

let onPersist: (() => void) | null = null

export function setPassPersistHook(fn: (() => void) | null) {
  onPersist = fn
}

function touchPasses() {
  onPersist?.()
}

function tokenSecret(): string {
  return (
    process.env.PARTY_TOKEN_SECRET?.trim() ||
    process.env.PARTY_PASS_CODES?.trim() ||
    'sabotext-dev-pass-secret'
  )
}

/** Normalize promo codes: trim, strip wrapping quotes, uppercase. */
export function normalizePassCode(code: string): string {
  return code
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

function configuredPassCodes(): Set<string> {
  const raw = process.env.PARTY_PASS_CODES ?? 'LinusÄrBästHundraProcent'
  return new Set(
    raw
      .split(/[,;\n]+/)
      .map((s) => normalizePassCode(s))
      .filter(Boolean),
  )
}

export function partyCodesConfiguredCount(): number {
  return configuredPassCodes().size
}

export function limitsFor(tier: PremiumTier): PremiumLimits {
  return tier === 'party' ? PARTY_LIMITS : FREE_LIMITS
}

export function isPartyActive(expiresAt: number | null | undefined): boolean {
  return typeof expiresAt === 'number' && expiresAt > Date.now()
}

export function tierFromExpiry(expiresAt: number | null | undefined): PremiumTier {
  return isPartyActive(expiresAt) ? 'party' : 'free'
}

function signPayload(id: string, expiresAt: number): string {
  return createHmac('sha256', tokenSecret()).update(`${id}.${expiresAt}`).digest('base64url')
}

function encodeToken(id: string, expiresAt: number): string {
  return `st1.${id}.${expiresAt}.${signPayload(id, expiresAt)}`
}

function decodeSignedToken(token: string): PartyPass | null {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'st1') return null
  const id = parts[1]
  const expiresAt = Number(parts[2])
  const sig = parts[3]
  if (!id || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || !sig) return null
  const expected = signPayload(id, expiresAt)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return { token, tier: 'party', expiresAt }
}

export function issuePartyPass(plan: PartyPlan = 'day'): PartyPass {
  const duration = plan === 'week' ? PARTY_WEEK_MS : PARTY_PASS_MS
  const expiresAt = Date.now() + duration
  const id = randomUUID()
  const pass: PartyPass = {
    token: encodeToken(id, expiresAt),
    tier: 'party',
    expiresAt,
    plan,
  }
  passes.set(pass.token, pass)
  touchPasses()
  return pass
}

export function restorePasses(list: PartyPass[]) {
  const now = Date.now()
  for (const pass of list) {
    if (!pass?.token || !pass.expiresAt || pass.expiresAt <= now) continue
    passes.set(pass.token, pass)
  }
}

export function allPasses() {
  return passes
}

export function redeemPassCode(code: string): PartyPass | { error: string } {
  const normalized = normalizePassCode(code)
  if (!normalized) return { error: 'Ange en party-kod' }
  if (!configuredPassCodes().has(normalized)) {
    return { error: 'Ogiltig party-kod' }
  }
  return issuePartyPass('day')
}

export function lookupPass(token: string | null | undefined): PartyPass | null {
  if (!token) return null

  const cached = passes.get(token)
  if (cached) {
    if (cached.expiresAt <= Date.now()) {
      passes.delete(token)
      touchPasses()
      return null
    }
    return cached
  }

  // Stateless verify — works across Railway restarts / multiple instances without Redis
  const signed = decodeSignedToken(token)
  if (signed) {
    passes.set(token, signed)
    return signed
  }

  return null
}
