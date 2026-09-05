export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  roundCounts: number[]
}

/** Sabotext is fully free — unlimited players and all round options. */
export const GAME_LIMITS: PremiumLimits = {
  maxPlayers: 0,
  roundCounts: [8, 10, 12, 15, 20, 25],
}

/** @deprecated use GAME_LIMITS */
export const FREE_LIMITS = GAME_LIMITS
/** @deprecated use GAME_LIMITS */
export const PARTY_LIMITS = GAME_LIMITS

export type PartyPass = {
  token: string
  tier: 'party'
  expiresAt: number
  plan?: 'day' | 'week'
}

const passes = new Map<string, PartyPass>()

export function setPassPersistHook(_fn: (() => void) | null) {
  // no-op — payments removed
}

export function limitsFor(_tier?: PremiumTier): PremiumLimits {
  return GAME_LIMITS
}

export function isPartyActive(_expiresAt?: number | null): boolean {
  return true
}

export function tierFromExpiry(_expiresAt?: number | null): PremiumTier {
  return 'party'
}

export function restorePasses(_list: PartyPass[]) {
  // no-op
}

export function allPasses() {
  return passes
}

export function lookupPass(_token?: string | null): PartyPass | null {
  return null
}
