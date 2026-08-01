export type Lang = 'sv' | 'en'

export type Localized = { sv: string; en: string }

export type RoomStatus = 'lobby' | 'write' | 'sabotage' | 'vote' | 'reveal' | 'finished'

export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  playing: boolean
}

export type Prompt = {
  id: string
  recipient: Localized
  task: Localized
}

export type Submission = {
  id: string
  authorId: string
  text: string
  /** true = writer's original (not voteable alone; shown for context) */
  isOriginal: boolean
}

export type RoundResult = {
  submissionId: string
  authorId: string
  authorName: string
  text: string
  votes: number
  gained: number
}

export type MatchHighlight = {
  round: number
  promptTask: string
  originalText: string
  winnerText: string
  authorName: string
  votes: number
}

export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  roundCounts: number[]
}

export type Room = {
  code: string
  hostId: string
  players: Player[]
  language: Lang
  roundCount: number
  hostPlays: boolean
  status: RoomStatus
  /** Prompt ids used this match (avoid repeats) */
  usedPromptIds: string[]
  currentRound: number
  writerId: string | null
  prompt: Prompt | null
  /** Writer order for this match */
  writerOrder: string[]
  writerIndex: number
  originalText: string
  submissions: Submission[]
  /** playerId → submissionId */
  votes: Record<string, string>
  endsAt: number
  lastRound: RoundResult[] | null
  /** Top sabotages of the match (kept top 5 by votes) */
  highlights: MatchHighlight[]
  premiumExpiresAt: number | null
  /** Listed on Find game / open lobbies */
  isPublic: boolean
  /** People who tried to join while room was full */
  waitlist: { id: string; name: string; at: number }[]
  updatedAt: number
}

export type PublicSubmission = {
  id: string
  text: string
  /** Only revealed after vote / in reveal */
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
  /** Your submitted sabotage text if any */
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
