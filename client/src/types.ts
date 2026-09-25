export type Lang = 'sv' | 'en'

export type PromptPack = 'mix' | 'work' | 'dating' | 'family' | 'chaos'

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

export type MatchStats = {
  topRivalry: { saboteur: string; victim: string; count: number } | null
  mostVoted: { name: string; votes: number } | null
  clutch: { name: string; gained: number; text: string } | null
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
  originalText?: string
  targetName?: string
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
  promptPack?: PromptPack
  status: RoomStatus
  currentRound: number
  totalRounds: number
  roundMode?: 'normal' | 'wouldSend' | 'doubleSabotage' | 'finale'
  writerId: string | null
  writerName: string | null
  youAreWriter: boolean
  youAreSpectator: boolean
  youSkipSabotage?: boolean
  prompt: { recipient: string; task: string } | null
  promptIsPersonal?: boolean
  originalText: string | null
  sabotageTargetName: string | null
  waitingNames?: string[]
  saboteursOnYou?: string[]
  yourWrite: string | null
  yourSabotage: string | null
  writeCount: number
  writeNeeded: number
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
  matchStats?: MatchStats | null
}
