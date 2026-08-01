import { useEffect, useState } from 'react'
import {
  bindSocketHandlers,
  castVote,
  clearSession,
  createGame,
  ensureSessionBound,
  joinGame,
  loadSession,
  rematchGame,
  saveSession,
  setHostPlaying,
  setLanguage,
  setRoundCount,
  startGame,
  submitOriginal,
  submitSabotage,
} from './api'
import { t } from './i18n'
import { JoinQr } from './qr'
import type { Lang, PublicRoom } from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'lobby' | 'play'

const ROUND_OPTIONS = [4, 6, 8, 10]
const FACTOPIA_URL = 'https://factopia.net'
const PARTY_PATHS_URL = 'https://partypaths.com'

function SisterLinks({
  s,
  compact,
}: {
  s: ReturnType<typeof t>
  compact?: boolean
}) {
  const cls = `sister-game${compact ? ' compact' : ''}`
  return (
    <div className={`sister-stack${compact ? ' compact' : ''}`}>
      <a className={cls} href={FACTOPIA_URL} target="_blank" rel="noreferrer">
        <strong>Factopia</strong>
        <span>{s.factopiaPitch}</span>
        <em>{s.factopiaCta}</em>
      </a>
      <a className={cls} href={PARTY_PATHS_URL} target="_blank" rel="noreferrer">
        <strong>Party Paths</strong>
        <span>{s.partyPathsPitch}</span>
        <em>{s.partyPathsCta}</em>
      </a>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [rounds, setRounds] = useState(6)
  const [lang, setLang] = useState<Lang>('sv')
  const [hostPlays, setHostPlaysLocal] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tvMode, setTvMode] = useState(false)

  const s = t(room?.language ?? lang)

  useEffect(() => {
    const app = document.querySelector('.app')
    app?.classList.toggle('tv', tvMode)
    if (tvMode) {
      void document.documentElement.requestFullscreen?.().catch(() => null)
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => null)
    }
    return () => {
      app?.classList.remove('tv')
    }
  }, [tvMode])

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setTvMode(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    bindSocketHandlers({
      onRoom: (r) => {
        setRoom(r)
        if (r.status === 'lobby') setScreen('lobby')
        else setScreen('play')
      },
      onConnection: setConnected,
    })

    const params = new URLSearchParams(window.location.search)
    const join = params.get('join')
    if (join) setJoinCode(join.toUpperCase())

    void (async () => {
      const session = loadSession()
      if (!session) return
      setName(session.name)
      const res = await ensureSessionBound()
      if (res && !res.error && res.room) {
        setPlayerId(res.playerId)
        setRoom(res.room)
        setScreen(res.room.status === 'lobby' ? 'lobby' : 'play')
      }
    })()
  }, [])

  async function handleCreate() {
    setError(null)
    setBusy(true)
    const res = await createGame(name, rounds, hostPlays, lang)
    setBusy(false)
    if (res.error || !res.room || !res.playerId) {
      setError(res.error || 'Error')
      return
    }
    saveSession({ code: res.room.code, playerId: res.playerId, name: name.trim() || 'Spelare' })
    setPlayerId(res.playerId)
    setRoom(res.room)
    setTvMode(!hostPlays)
    setScreen('lobby')
  }

  async function handleJoin() {
    setError(null)
    setBusy(true)
    const res = await joinGame(joinCode, name)
    setBusy(false)
    if (res.error || !res.room || !res.playerId) {
      setError(res.error || 'Error')
      return
    }
    saveSession({ code: res.room.code, playerId: res.playerId, name: name.trim() || 'Spelare' })
    setPlayerId(res.playerId)
    setRoom(res.room)
    setScreen(res.room.status === 'lobby' ? 'lobby' : 'play')
  }

  function leave() {
    clearSession()
    setRoom(null)
    setPlayerId(null)
    setTvMode(false)
    setScreen('home')
  }

  return (
    <div className={`app${tvMode ? ' tv' : ''}`}>
      <div className="atmosphere" aria-hidden>
        <div className="glow glow-a" />
        <div className="glow glow-b" />
        <div className="grid-fade" />
      </div>

      <div className="shell">
        {!connected && (
          <div className="banner">{s.offline}</div>
        )}

        {screen === 'home' && (
          <Home
            s={s}
            name={name}
            setName={setName}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            rounds={rounds}
            setRounds={setRounds}
            lang={lang}
            setLang={setLang}
            hostPlays={hostPlays}
            setHostPlays={setHostPlaysLocal}
            error={error}
            busy={busy}
            onCreate={handleCreate}
            onJoin={handleJoin}
          />
        )}

        {screen === 'lobby' && room && playerId && (
          <Lobby
            room={room}
            playerId={playerId}
            s={s}
            tvMode={tvMode}
            setTvMode={setTvMode}
            onLeave={leave}
            onError={setError}
            error={error}
          />
        )}

        {screen === 'play' && room && playerId && (
          <Play
            room={room}
            playerId={playerId}
            s={s}
            tvMode={tvMode}
            setTvMode={setTvMode}
            onLeave={leave}
          />
        )}
      </div>
    </div>
  )
}

function Home({
  s,
  name,
  setName,
  joinCode,
  setJoinCode,
  rounds,
  setRounds,
  lang,
  setLang,
  hostPlays,
  setHostPlays,
  error,
  busy,
  onCreate,
  onJoin,
}: {
  s: ReturnType<typeof t>
  name: string
  setName: (v: string) => void
  joinCode: string
  setJoinCode: (v: string) => void
  rounds: number
  setRounds: (v: number) => void
  lang: Lang
  setLang: (v: Lang) => void
  hostPlays: boolean
  setHostPlays: (v: boolean) => void
  error: string | null
  busy: boolean
  onCreate: () => void
  onJoin: () => void
}) {
  return (
    <main className="home">
      <header className="hero">
        <p className="brand">Sabotext</p>
        <h1>{s.tagline}</h1>
        <p className="lede">{s.subtitle}</p>
      </header>

      <div className="panel">
        <label className="field">
          <span>{s.yourName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Alex"
            autoComplete="nickname"
          />
        </label>

        <div className="row">
          <label className="field grow">
            <span>{s.rounds}</span>
            <div className="pills">
              {ROUND_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={rounds === n ? 'pill on' : 'pill'}
                  onClick={() => setRounds(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>{s.language}</span>
            <div className="pills">
              <button type="button" className={lang === 'sv' ? 'pill on' : 'pill'} onClick={() => setLang('sv')}>
                SV
              </button>
              <button type="button" className={lang === 'en' ? 'pill on' : 'pill'} onClick={() => setLang('en')}>
                EN
              </button>
            </div>
          </label>
        </div>

        <label className="check">
          <input type="checkbox" checked={hostPlays} onChange={(e) => setHostPlays(e.target.checked)} />
          <span>{hostPlays ? s.hostPlays : s.hostOnly}</span>
        </label>

        <button type="button" className="btn primary" disabled={busy || !name.trim()} onClick={onCreate}>
          {s.create}
        </button>

        <div className="divider">
          <span>eller</span>
        </div>

        <label className="field">
          <span>{s.code}</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            maxLength={4}
            placeholder="ABCD"
            className="code-input"
            autoCapitalize="characters"
          />
        </label>

        <button
          type="button"
          className="btn secondary"
          disabled={busy || !name.trim() || joinCode.length < 4}
          onClick={onJoin}
        >
          {s.join}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      <SisterLinks s={s} />
    </main>
  )
}

function Lobby({
  room,
  playerId,
  s,
  tvMode,
  setTvMode,
  onLeave,
  onError,
  error,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (e: string | null) => void
  error: string | null
}) {
  const isHost = room.hostId === playerId
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const inviteUrl = `${window.location.origin}/?join=${room.code}`
  const playing = room.players.filter((p) => p.playing)
  const canStart = playing.filter((p) => p.connected).length >= 2

  async function copy(text: string = inviteUrl) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <main className={`lobby${tvMode ? ' tv-lobby' : ''}`}>
      {showQr && (
        <div className="qr-overlay" role="dialog" aria-label={s.showQr}>
          <JoinQr url={inviteUrl} size={320} alt={`QR ${room.code}`} />
          <div className="big-code">{room.code}</div>
          <p className="muted">{s.scanToJoin}</p>
          <button type="button" className="btn secondary" onClick={() => void copy()}>
            {copied ? s.copied : s.copyLink}
          </button>
          <button type="button" className="btn ghost dark" onClick={() => setShowQr(false)}>
            {s.hideQr}
          </button>
        </div>
      )}

      <header className="lobby-head">
        <div className="lobby-top">
          <p className="brand sm">Sabotext</p>
          <div className="lobby-actions">
            <button type="button" className="btn ghost dark sm" onClick={() => setTvMode((v) => !v)}>
              {tvMode ? s.tvModeOff : s.tvMode}
            </button>
            {!tvMode && (
              <button type="button" className="btn ghost dark sm hide-on-tv" onClick={() => setShowQr(true)}>
                {s.showQr}
              </button>
            )}
          </div>
        </div>
        <div className="code-block">
          <span className="label">{s.code}</span>
          <strong className="big-code">{room.code}</strong>
        </div>
        <div className="invite-qr">
          <JoinQr url={inviteUrl} size={tvMode ? 280 : 180} alt={`QR ${room.code}`} />
          <span>{tvMode ? s.joinOnPhone : s.scanToJoin}</span>
        </div>
        {!tvMode && (
          <>
            <p className="muted center hide-on-tv">{s.inviteHint}</p>
            <button type="button" className="btn ghost dark hide-on-tv" onClick={() => void copy()}>
              {copied ? s.copied : s.share}
            </button>
          </>
        )}
      </header>

      {isHost && !tvMode && (
        <div className="panel tight hide-on-tv">
          <div className="row">
            <label className="field grow">
              <span>{s.rounds}</span>
              <div className="pills">
                {ROUND_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={room.roundCount === n ? 'pill on' : 'pill'}
                    onClick={() => void setRoundCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>{s.language}</span>
              <div className="pills">
                <button
                  type="button"
                  className={room.language === 'sv' ? 'pill on' : 'pill'}
                  onClick={() => void setLanguage('sv')}
                >
                  SV
                </button>
                <button
                  type="button"
                  className={room.language === 'en' ? 'pill on' : 'pill'}
                  onClick={() => void setLanguage('en')}
                >
                  EN
                </button>
              </div>
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={room.hostPlays}
              onChange={(e) => void setHostPlaying(e.target.checked)}
            />
            <span>{room.hostPlays ? s.hostPlays : s.hostOnly}</span>
          </label>
        </div>
      )}

      <section className={`panel${tvMode ? ' tv-players-panel' : ''}`}>
        <h2>{s.players}</h2>
        <ul className={`player-list${tvMode ? ' tv-players' : ''}`}>
          {room.players.map((p) => (
            <li key={p.id} className={!p.connected ? 'dim' : undefined}>
              <span>
                {p.name}
                {p.id === room.hostId ? ` · ${s.host}` : ''}
                {!p.playing ? ' · TV' : ''}
              </span>
              <span className="score">{p.score}</span>
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          type="button"
          className="btn primary"
          disabled={!canStart}
          onClick={async () => {
            onError(null)
            const res = await startGame()
            if (res.error) onError(res.error)
          }}
        >
          {canStart ? s.start : s.needPlayers}
        </button>
      ) : (
        <p className="muted center">{s.waiting}</p>
      )}

      {error && <p className="error">{error}</p>}

      <button type="button" className="btn ghost hide-on-tv" onClick={onLeave}>
        {s.leave}
      </button>
    </main>
  )
}

function Play({
  room,
  playerId,
  s,
  tvMode,
  setTvMode,
  onLeave,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
}) {
  const isHost = room.hostId === playerId
  const totalMs = (room.phaseSeconds || 30) * 1000
  const { seconds, ratio } = useCountdown(room.endsAt || null, totalMs)

  if (room.status === 'finished') {
    return <Winner room={room} s={s} isHost={isHost} tvMode={tvMode} setTvMode={setTvMode} onLeave={onLeave} />
  }

  return (
    <main className={`play${tvMode ? ' tv-play' : ''}`}>
      <header className="play-bar">
        <p className="brand sm">Sabotext</p>
        <span className="meta">
          {s.round} {room.currentRound}/{room.totalRounds}
        </span>
        {room.endsAt > 0 && (
          <div className="timer" style={{ ['--ratio' as string]: String(ratio) }}>
            <i />
            <span>{seconds}s</span>
          </div>
        )}
        <button type="button" className="btn ghost dark sm" onClick={() => setTvMode((v) => !v)}>
          {tvMode ? s.tvModeOff : s.tvMode}
        </button>
      </header>

      {room.youAreSpectator && !tvMode && <p className="banner soft">{s.spectator}</p>}

      {room.status === 'write' && <WritePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'sabotage' && <SabotagePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'vote' && <VotePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'reveal' && <RevealPhase room={room} s={s} />}

      <ScoreStrip room={room} playerId={playerId} />
    </main>
  )
}

function PromptCard({ room, s }: { room: PublicRoom; s: ReturnType<typeof t> }) {
  if (!room.prompt) return null
  return (
    <div className="prompt-card">
      <span className="prompt-to">
        {s.to}: <strong>{room.prompt.recipient}</strong>
      </span>
      <p>{room.prompt.task}</p>
    </div>
  )
}

function WritePhase({ room, s, tvMode }: { room: PublicRoom; s: ReturnType<typeof t>; tvMode?: boolean }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!room.youAreWriter || tvMode) {
    return (
      <section className="phase wait">
        <PromptCard room={room} s={s} />
        <div className="pulse-dot" />
        <h2>
          {room.writerName} {s.theyWrite}
        </h2>
        <p className="muted">{s.waitingWriter}</p>
      </section>
    )
  }

  return (
    <section className="phase">
      <h2>{s.youWrite}</h2>
      <PromptCard room={room} s={s} />
      <div className="sms">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder={s.writePlaceholder}
          rows={4}
          maxLength={280}
        />
        <div className="sms-meta">{text.length}/280</div>
      </div>
      <button
        type="button"
        className="btn primary"
        disabled={sending || text.trim().length < 2}
        onClick={async () => {
          setErr(null)
          setSending(true)
          const res = await submitOriginal(text)
          setSending(false)
          if (res.error) setErr(res.error)
        }}
      >
        {s.send}
      </button>
      {err && <p className="error">{err}</p>}
    </section>
  )
}

function SabotagePhase({ room, s, tvMode }: { room: PublicRoom; s: ReturnType<typeof t>; tvMode?: boolean }) {
  const [text, setText] = useState(room.yourSabotage ?? room.originalText ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const done = Boolean(room.yourSabotage)

  useEffect(() => {
    if (room.yourSabotage) setText(room.yourSabotage)
    else if (room.originalText && !text) setText(room.originalText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.originalText, room.yourSabotage])

  if (room.youAreWriter || room.youAreSpectator || tvMode) {
    return (
      <section className="phase wait">
        <PromptCard room={room} s={s} />
        <div className="bubble original">
          <span>{s.original}</span>
          <p>{room.originalText}</p>
        </div>
        <h2>{s.waitingSabotage}</h2>
        <p className="muted">
          {room.sabotageCount}/{room.sabotageNeeded}
        </p>
      </section>
    )
  }

  return (
    <section className="phase">
      <h2>{s.sabotageTitle}</h2>
      <p className="muted">{s.sabotageHint}</p>
      <PromptCard room={room} s={s} />
      <div className="bubble original">
        <span>{s.original}</span>
        <p>{room.originalText}</p>
      </div>
      <div className="sms">
        <label className="sms-label">{s.yourVersion}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder={s.sabotagePlaceholder}
          rows={4}
          maxLength={280}
          disabled={done}
        />
        <div className="sms-meta">{text.length}/280</div>
      </div>
      {!done ? (
        <button
          type="button"
          className="btn primary"
          disabled={sending || text.trim().length < 2}
          onClick={async () => {
            setErr(null)
            setSending(true)
            const res = await submitSabotage(text)
            setSending(false)
            if (res.error) setErr(res.error)
          }}
        >
          {s.submitSabotage}
        </button>
      ) : (
        <p className="ok">{s.submitted}</p>
      )}
      {err && <p className="error">{err}</p>}
    </section>
  )
}

function VotePhase({ room, s, tvMode }: { room: PublicRoom; s: ReturnType<typeof t>; tvMode?: boolean }) {
  const [err, setErr] = useState<string | null>(null)

  return (
    <section className="phase">
      <h2>{s.voteTitle}</h2>
      {!tvMode && <p className="muted">{s.voteHint}</p>}
      <div className="bubble original compact">
        <span>{s.original}</span>
        <p>{room.originalText}</p>
      </div>
      <div className="vote-grid">
        {room.submissions.map((sub) => {
          const selected = room.yourVote === sub.id
          const disabled = Boolean(sub.isYours) || room.youAreSpectator || Boolean(tvMode)
          return (
            <button
              key={sub.id}
              type="button"
              className={`vote-card ${selected ? 'selected' : ''} ${sub.isYours ? 'mine' : ''}`}
              disabled={disabled}
              onClick={async () => {
                if (disabled) return
                setErr(null)
                const res = await castVote(sub.id)
                if (res.error) setErr(res.error)
              }}
            >
              <p>{sub.text}</p>
              {sub.isYours && !tvMode && <span className="tag">{s.yourVersion}</span>}
              {selected && !tvMode && <span className="tag on">{s.voted}</span>}
            </button>
          )
        })}
      </div>
      <p className="muted center">
        {room.votedCount}/{room.voterCount}
      </p>
      {err && <p className="error">{err}</p>}
    </section>
  )
}

function RevealPhase({ room, s }: { room: PublicRoom; s: ReturnType<typeof t> }) {
  const winner = room.lastRound?.[0]
  return (
    <section className="phase">
      <h2>{s.revealTitle}</h2>
      {winner && winner.votes > 0 && (
        <div className="winner-bubble">
          <span>{s.winner}: {winner.authorName}</span>
          <p>{winner.text}</p>
          <em>
            +{winner.gained} {s.points} · {winner.votes} {s.votes}
          </em>
        </div>
      )}
      <ul className="results">
        {(room.lastRound ?? []).map((r) => (
          <li key={r.submissionId}>
            <div>
              <strong>{r.authorName}</strong>
              <p>{r.text}</p>
            </div>
            <span>
              {r.votes} · +{r.gained}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted center">{s.nextRound}</p>
    </section>
  )
}

function Winner({
  room,
  s,
  isHost,
  tvMode,
  setTvMode,
  onLeave,
}: {
  room: PublicRoom
  s: ReturnType<typeof t>
  isHost: boolean
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
}) {
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score)
  const champ = ranked[0]

  return (
    <main className="winner-screen">
      <Confetti />
      <div className="lobby-top" style={{ marginBottom: '0.5rem' }}>
        <p className="brand">Sabotext</p>
        <button type="button" className="btn ghost dark sm" onClick={() => setTvMode((v) => !v)}>
          {tvMode ? s.tvModeOff : s.tvMode}
        </button>
      </div>
      <h1>{s.winner}</h1>
      {champ && (
        <p className="champ">
          {champ.name}
          <span>
            {champ.score} {s.points}
          </span>
        </p>
      )}
      <ul className="player-list">
        {ranked.map((p, i) => (
          <li key={p.id}>
            <span>
              {i + 1}. {p.name}
            </span>
            <span className="score">{p.score}</span>
          </li>
        ))}
      </ul>
      {isHost ? (
        <button type="button" className="btn primary" onClick={() => void rematchGame()}>
          {s.rematch}
        </button>
      ) : (
        <p className="muted">{s.waiting}</p>
      )}
      {!tvMode && <SisterLinks s={s} compact />}
      <button type="button" className="btn ghost dark hide-on-tv" onClick={onLeave}>
        {s.leave}
      </button>
    </main>
  )
}

function ScoreStrip({ room, playerId }: { room: PublicRoom; playerId: string }) {
  const top = [...room.players]
    .filter((p) => p.playing)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  return (
    <aside className="score-strip" aria-label="scores">
      {top.map((p) => (
        <span key={p.id} className={p.id === playerId ? 'you' : undefined}>
          {p.name} <b>{p.score}</b>
        </span>
      ))}
    </aside>
  )
}
