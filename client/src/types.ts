export type Lang = 'sv' | 'en'

export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  roundCounts: number[]
}

export type MatchHighlight = {
  round: number
  promptTask: string
  originalText: string
  winnerText: string
  authorName: string
  votes: number
}

export type PartyPlan = 'day' | 'week'

export type PartyPassLocal = {
  token: string
  expiresAt: number
}

export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  playing: boolean
}

export type RoomStatus = 'lobby' | 'write' | 'sabotage' | 'vote' | 'reveal' | 'finished'

export type RoundResult = {
  submissionId: string
  authorId: string
  authorName: string
  text: string
  votes: number
  gained: number
}

export type PublicSubmission = {
  id: string
  text: string
  authorName?: string
  votes?: number
  isYours?: boolean
  isOriginal?: boolean
}

export type PublicRoom = {
  code: string
  hostId: string
  players: Player[]
  language: Lang
  roundCount: number
  hostPlays: boolean
  status: RoomStatus
  currentRound: number
  totalRounds: number
  writerId: string | null
  writerName: string | null
  youAreWriter: boolean
  youAreSpectator: boolean
  prompt: { recipient: string; task: string } | null
  originalText: string | null
  yourSabotage: string | null
  sabotageCount: number
  sabotageNeeded: number
  submissions: PublicSubmission[]
  yourVote: string | null
  votedCount: number
  voterCount: number
  endsAt: number
  lastRound: RoundResult[] | null
  phaseSeconds: number
  premiumTier: PremiumTier
  premiumExpiresAt: number | null
  limits: PremiumLimits
  isPublic: boolean
  waitlist: { id: string; name: string; at: number }[]
  highlights: MatchHighlight[]
}
