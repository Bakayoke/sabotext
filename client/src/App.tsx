import { useEffect, useState } from 'react'
import {
  bindSocketHandlers,
  castVote,
  clearSession,
  createGame,
  ensureSessionBound,
  fetchHome,
  fetchLobbies,
  joinGame,
  loadGang,
  loadPreferredName,
  loadSession,
  rematchGame,
  saveGang,
  savePreferredName,
  saveSession,
  setHostPlaying,
  setLanguage,
  setPublicLobby,
  setRoundCount,
  startGame,
  submitOriginal,
  submitSabotage,
  trackMetric,
  type HomePayload,
  type PublicLobbyCard,
} from './api'
import { t } from './i18n'
import { JoinQr } from './qr'
import { QrJoinScanner } from './qrScan'
import { renderResultsImage } from './shareCard'
import type { Lang, PublicRoom } from './types'
import { Confetti } from './ui'

type Screen = 'home' | 'join' | 'find' | 'lobby' | 'play'

const ROUND_OPTIONS = [8, 10, 12, 15, 20, 25]
const FACTOPIA_URL = 'https://factopia.net'
const PARTY_PATHS_URL = 'https://partypaths.com'
const SCOURGEBORN_URL = 'https://scourgeborn.com'
const YOUR_TASK_IS_URL = 'https://yourtaskis.com'
const KLOTTERKAOS_URL = 'https://klotterkaos.com'
const KLUDDKRIG_URL = 'https://kluddkrig.com'

function joinUrl(code: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('join', code.toUpperCase())
  return url.toString()
}

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
      <a className={cls} href={SCOURGEBORN_URL} target="_blank" rel="noreferrer">
        <strong>Scourgeborn</strong>
        <span>{s.scourgebornPitch}</span>
        <em>{s.scourgebornCta}</em>
      </a>
      <a className={cls} href={YOUR_TASK_IS_URL} target="_blank" rel="noreferrer">
        <strong>Your Task Is</strong>
        <span>{s.yourTaskIsPitch}</span>
        <em>{s.yourTaskIsCta}</em>
      </a>
      <a className={cls} href={KLOTTERKAOS_URL} target="_blank" rel="noreferrer">
        <strong>Klotterkaos</strong>
        <span>{s.klotterkaosPitch}</span>
        <em>{s.klotterkaosCta}</em>
      </a>
      <a className={cls} href={KLUDDKRIG_URL} target="_blank" rel="noreferrer">
        <strong>Kluddkrig</strong>
        <span>{s.kluddkrigPitch}</span>
        <em>{s.kluddkrigCta}</em>
      </a>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState(() => loadPreferredName())
  const [joinCode, setJoinCode] = useState('')
  const [joinStep, setJoinStep] = useState<'code' | 'name' | 'scan'>('code')
  const [rounds, setRounds] = useState(10)
  const [lang, setLang] = useState<Lang>('sv')
  const [lobbies, setLobbies] = useState<PublicLobbyCard[]>([])
  const [hostPlays, setHostPlaysLocal] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tvMode, setTvMode] = useState(false)

  const uiLang = room?.language ?? lang
  const s = t(uiLang)

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
    if (screen !== 'home' && screen !== 'find') return
    const load = () => {
      void fetchLobbies(lang).then((res) => setLobbies(res.lobbies ?? []))
    }
    load()
    const id = window.setInterval(load, 12_000)
    return () => window.clearInterval(id)
  }, [screen, lang])

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
    const join = params.get('join')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    const unlock = params.get('unlock')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    const deepLink = (join || unlock || '').slice(0, 4)
    if (deepLink.length === 4) {
      setJoinCode(deepLink)
      setJoinStep(loadPreferredName() ? 'name' : 'code')
      setScreen('join')
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      url.searchParams.delete('unlock')
      window.history.replaceState({}, '', url.pathname + url.search)
    }

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
    savePreferredName(name)
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
    if (joinStep === 'code') {
      if (joinCode.length < 4) return
      setError(null)
      setJoinStep('name')
      return
    }
    setError(null)
    setBusy(true)
    savePreferredName(name)
    const res = await joinGame(joinCode, name)
    setBusy(false)
    if (res.code === 'ROOM_FULL' || (res.error && res.error.toLowerCase().includes('fullt'))) {
      setError(res.error || s.roomFullUpsell)
      return
    }
    if (res.error || !res.room || !res.playerId) {
      setError(res.error || 'Error')
      return
    }
    saveSession({ code: res.room.code, playerId: res.playerId, name: name.trim() || 'Spelare' })
    setPlayerId(res.playerId)
    setRoom(res.room)
    setScreen(res.room.status === 'lobby' ? 'lobby' : 'play')
  }

  function openJoin(code?: string) {
    setError(null)
    if (code) {
      setJoinCode(code)
      setJoinStep('name')
    } else {
      setJoinCode('')
      setJoinStep('code')
    }
    setScreen('join')
  }

  function openFind() {
    setError(null)
    setScreen('find')
  }

  function leave() {
    clearSession()
    setRoom(null)
    setPlayerId(null)
    setTvMode(false)
    setJoinStep('code')
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
        {!connected && <div className="banner">{s.offline}</div>}

        {screen === 'home' && (
          <Home
            s={s}
            name={name}
            setName={setName}
            rounds={rounds}
            setRounds={setRounds}
            roundOptions={ROUND_OPTIONS}
            lang={lang}
            setLang={setLang}
            hostPlays={hostPlays}
            setHostPlays={setHostPlaysLocal}
            error={error}
            busy={busy}
            onCreate={handleCreate}
            onOpenJoin={() => openJoin()}
            onOpenFind={openFind}
            lobbyCount={lobbies.length}
            onOpenSavedGang={(code) => openJoin(code)}
          />
        )}

        {screen === 'join' && (
          <JoinScreen
            s={s}
            name={name}
            setName={setName}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            joinStep={joinStep}
            setJoinStep={setJoinStep}
            error={error}
            busy={busy}
            onJoin={() => void handleJoin()}
            onBack={() => {
              setError(null)
              if (joinStep === 'name') setJoinStep('code')
              else if (joinStep === 'scan') setJoinStep('code')
              else setScreen('home')
            }}
          />
        )}

        {screen === 'find' && (
          <FindScreen
            s={s}
            lobbies={lobbies}
            onPick={(code) => openJoin(code)}
            onQuickJoin={() => {
              if (lobbies[0]) openJoin(lobbies[0].code)
            }}
            onBack={() => setScreen('home')}
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
            onError={setError}
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
  rounds,
  setRounds,
  roundOptions,
  lang,
  setLang,
  hostPlays,
  setHostPlays,
  error,
  busy,
  onCreate,
  onOpenJoin,
  onOpenFind,
  lobbyCount,
  onOpenSavedGang,
}: {
  s: ReturnType<typeof t>
  name: string
  setName: (v: string) => void
  rounds: number
  setRounds: (v: number) => void
  roundOptions: number[]
  lang: Lang
  setLang: (v: Lang) => void
  hostPlays: boolean
  setHostPlays: (v: boolean) => void
  error: string | null
  busy: boolean
  onCreate: () => void
  onOpenJoin: () => void
  onOpenFind: () => void
  lobbyCount: number
  onOpenSavedGang: (code: string) => void
}) {
  const [homeData, setHomeData] = useState<HomePayload | null>(null)
  const [tipFlash, setTipFlash] = useState('')
  const [savedGang] = useState(() => loadGang())

  useEffect(() => {
    void fetchHome(lang).then(setHomeData)
  }, [lang])

  async function tipFriend() {
    const text = s.tipFriendText
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext', text, url: 'https://sabotext.com' })
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setTipFlash(s.copied)
      setTimeout(() => setTipFlash(''), 2000)
    } catch {
      // ignore
    }
  }

  const examples = homeData?.examples?.slice(0, 2) ?? []
  const gamesTonight = homeData?.activity?.gamesTonight ?? 0

  return (
    <main className="home">
      <header className="hero">
        <p className="brand">Sabotext</p>
        <h1>{s.tagline}</h1>
        <p className="lede">{s.subtitle}</p>
      </header>

      {gamesTonight > 0 && (
        <p className="activity-line">{s.activityLine.replace('{n}', String(gamesTonight))}</p>
      )}

      {homeData?.theme?.label && (
        <div className="theme-chip">
          <span className="theme-chip-label">{s.todaysTheme}</span>
          <strong>{homeData.theme.label}</strong>
          {homeData.theme.blurb && <p>{homeData.theme.blurb}</p>}
        </div>
      )}

      {examples.length > 0 && (
        <div className="examples-stack">
          {examples.map((ex, i) => (
            <article key={i} className="example-card">
              <span className="example-label">{s.exampleLabel}</span>
              <p className="example-task">{ex.task}</p>
              <div className="example-flow">
                <div>
                  <em>{s.exampleOriginal}</em>
                  <p>{ex.original}</p>
                </div>
                <span className="example-arrow" aria-hidden>
                  →
                </span>
                <div>
                  <em>{s.exampleSabotage}</em>
                  <p>{ex.sabotage}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ol className="how-to">
        <li>{s.howTo1}</li>
        <li>{s.howTo2}</li>
        <li>{s.howTo3}</li>
      </ol>

      {savedGang && (
        <div className="gang-banner">
          <div>
            <strong>{s.sameGang}</strong>
            <span className="gang-code">{savedGang.code}</span>
          </div>
          <button type="button" className="btn secondary sm" onClick={() => onOpenSavedGang(savedGang.code)}>
            {s.openSavedGang}
          </button>
        </div>
      )}

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
              {roundOptions.map((n) => (
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
          <span>{s.orDivider}</span>
        </div>

        <button type="button" className="btn secondary" onClick={onOpenJoin}>
          {s.join}
        </button>

        <button type="button" className="btn accent" onClick={onOpenFind}>
          {s.findGame}
          {lobbyCount > 0 ? ` · ${lobbyCount}` : ''}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      <button type="button" className="btn tip-friend" onClick={() => void tipFriend()}>
        {tipFlash || s.tipFriend}
      </button>

      <p className="footer-note dns-hint">{s.dnsHint}</p>

      <SisterLinks s={s} />
    </main>
  )
}

function JoinScreen({
  s,
  name,
  setName,
  joinCode,
  setJoinCode,
  joinStep,
  setJoinStep,
  error,
  busy,
  onJoin,
  onBack,
}: {
  s: ReturnType<typeof t>
  name: string
  setName: (v: string) => void
  joinCode: string
  setJoinCode: (v: string) => void
  joinStep: 'code' | 'name' | 'scan'
  setJoinStep: (v: 'code' | 'name' | 'scan') => void
  error: string | null
  busy: boolean
  onJoin: () => void
  onBack: () => void
}) {
  const title = joinStep === 'scan' ? s.scanQr : joinStep === 'code' ? s.enterCode : s.enterName

  return (
    <main className="home">
      <header className="hero compact">
        <p className="brand">Sabotext</p>
        <h1>{title}</h1>
      </header>
      <div className="panel">
        {joinStep === 'scan' && (
          <>
            <QrJoinScanner
              scanningLabel={s.scanningQr}
              unsupportedHint={s.qrUnsupported}
              onError={() => {}}
              onCode={(code) => {
                setJoinCode(code)
                setJoinStep('name')
              }}
            />
            <button type="button" className="btn secondary" onClick={() => setJoinStep('code')}>
              {s.enterCodeInstead}
            </button>
          </>
        )}

        {joinStep === 'code' && (
          <>
            <label className="field">
              <span>{s.enterCode}</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                maxLength={4}
                placeholder="ABCD"
                className="code-input"
                autoCapitalize="characters"
                autoFocus
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={busy || joinCode.length < 4}
              onClick={() => setJoinStep('name')}
            >
              {s.continueCode}
            </button>
            <button type="button" className="btn secondary" onClick={() => setJoinStep('scan')}>
              {s.scanQr}
            </button>
          </>
        )}

        {joinStep === 'name' && (
          <>
            <label className="field">
              <span>{s.yourName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="Alex"
                autoComplete="nickname"
                autoFocus
              />
            </label>
            <p className="footer-note">
              {s.code}: <strong className="big-code inline">{joinCode}</strong>
            </p>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !name.trim() || joinCode.length < 4}
              onClick={onJoin}
            >
              {s.join}
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button type="button" className="btn ghost" onClick={onBack}>
          {s.back}
        </button>
      </div>
    </main>
  )
}

function FindScreen({
  s,
  lobbies,
  onPick,
  onQuickJoin,
  onBack,
}: {
  s: ReturnType<typeof t>
  lobbies: PublicLobbyCard[]
  onPick: (code: string) => void
  onQuickJoin: () => void
  onBack: () => void
}) {
  return (
    <main className="home">
      <header className="hero compact">
        <p className="brand">Sabotext</p>
        <h1>{s.findGame}</h1>
      </header>
      <div className="panel">
        <p className="section-title">{s.openLobbies}</p>
        {lobbies.length === 0 ? (
          <p className="footer-note">{s.noOpenLobbies}</p>
        ) : (
          <ul className="lobby-list">
            {lobbies.map((lobby) => {
              const seats =
                lobby.seatsLeft == null ? s.seatsUnlimited : `${lobby.seatsLeft} ${s.seatsLeft}`
              return (
                <li key={lobby.code}>
                  <button type="button" className="lobby-card" onClick={() => onPick(lobby.code)}>
                    <div className="lobby-card-top">
                      <strong>{lobby.code}</strong>
                    </div>
                    <span>
                      {lobby.playerCount} {s.participants.toLowerCase()} · {seats}
                    </span>
                    <span className="lobby-meta">
                      {lobby.language.toUpperCase()} · {lobby.roundCount} {s.roundsShort}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {lobbies[0] && (
          <button type="button" className="btn primary" onClick={onQuickJoin}>
            {s.quickJoin}
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onBack}>
          {s.back}
        </button>
      </div>
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
  const inviteUrl = joinUrl(room.code)
  const playing = room.players.filter((p) => p.playing)
  const canStart = playing.filter((p) => p.connected).length >= 2
  const waitlist = room.waitlist ?? []
  const roundOptions = room.limits?.roundCounts ?? ROUND_OPTIONS

  useEffect(() => {
    if (!isHost || tvMode) return
    playLobbyChime()
    setShowQr(true)
  }, [isHost, tvMode, room.code])

  useEffect(() => {
    if (!canStart || !showQr) return
    const timer = window.setTimeout(() => setShowQr(false), 2200)
    return () => window.clearTimeout(timer)
  }, [canStart, showQr])

  async function copy(text: string = inviteUrl) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  async function shareInvite() {
    const text =
      room.language === 'en'
        ? `Join my Sabotext game: ${room.code}\n${inviteUrl}`
        : `Gå med i mitt Sabotext-spel: ${room.code}\n${inviteUrl}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext', text, url: inviteUrl })
        return
      }
    } catch {
      // fall through
    }
    void copy(text)
  }

  async function changePublic(next: boolean) {
    const res = await setPublicLobby(next)
    if (res.error) onError(res.error)
  }

  return (
    <main className={`lobby${tvMode ? ' tv-lobby' : ''}`}>
      {showQr && (
        <div className="qr-overlay" role="dialog" aria-label={s.showQr}>
          <JoinQr url={inviteUrl} size={320} alt={`QR ${room.code}`} />
          <div className="big-code">{room.code}</div>
          <p className="muted">{s.scanToJoin}</p>
          <button type="button" className="btn secondary" onClick={() => void shareInvite()}>
            {copied ? s.copied : s.shareInvite}
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
            <div className="share-row hide-on-tv">
              <button type="button" className="btn ghost dark" onClick={() => void shareInvite()}>
                {s.shareInvite}
              </button>
              <button type="button" className="btn ghost dark" onClick={() => void copy()}>
                {copied ? s.copied : s.copyLink}
              </button>
            </div>
          </>
        )}
      </header>

      {playing.length > 0 && playing.length < 3 && isHost && !tvMode && (
        <p className="recommend-hint hide-on-tv">{s.recommend3}</p>
      )}

      {isHost && !tvMode && (
        <div className="panel tight hide-on-tv">
          <div className="row">
            <label className="field grow">
              <span>{s.rounds}</span>
              <div className="pills">
                {roundOptions.map((n) => (
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
          <div className="public-toggle">
            <span>{s.makePublic}</span>
            <div className="pills">
              <button
                type="button"
                className={room.isPublic ? 'pill on' : 'pill'}
                onClick={() => void changePublic(true)}
              >
                {s.publicOn}
              </button>
              <button
                type="button"
                className={!room.isPublic ? 'pill on' : 'pill'}
                onClick={() => void changePublic(false)}
              >
                {s.publicOff}
              </button>
            </div>
          </div>
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
        {waitlist.length > 0 && (
          <>
            <p className="waitlist-head">
              <span>{s.waitingToJoin}</span>
              <span>{waitlist.length}</span>
            </p>
            <ul className="player-list waitlist">
              {waitlist.map((w) => (
                <li key={w.id}>
                  <span>{w.name}</span>
                  <span>🔒</span>
                </li>
              ))}
            </ul>
          </>
        )}
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
  onError,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (msg: string | null) => void
}) {
  const isHost = room.hostId === playerId

  if (room.status === 'finished') {
    return (
      <Winner
        room={room}
        playerId={playerId}
        s={s}
        isHost={isHost}
        tvMode={tvMode}
        setTvMode={setTvMode}
        onLeave={onLeave}
        onError={onError}
      />
    )
  }

  return (
    <main className={`play${tvMode ? ' tv-play' : ''}`}>
      <header className="play-bar">
        <p className="brand sm">Sabotext</p>
        <span className="meta">
          {s.round} {room.currentRound}/{room.totalRounds}
        </span>
        <button type="button" className="btn ghost dark sm" onClick={() => setTvMode((v) => !v)}>
          {tvMode ? s.tvModeOff : s.tvMode}
        </button>
        {!tvMode && (
          <button type="button" className="btn ghost dark sm hide-on-tv" onClick={onLeave}>
            {s.leave}
          </button>
        )}
      </header>

      {room.youAreSpectator && !tvMode && <p className="banner soft">{s.spectator}</p>}

      {room.status === 'write' && <WritePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'sabotage' && <SabotagePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'vote' && <VotePhase room={room} s={s} tvMode={tvMode} />}
      {room.status === 'reveal' && <RevealPhase room={room} s={s} playerId={playerId} />}

      {room.status !== 'reveal' && <StandingsTable room={room} playerId={playerId} s={s} compact />}
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

function RoundModeBanner({ room, s }: { room: PublicRoom; s: ReturnType<typeof t> }) {
  const mode = room.roundMode ?? 'normal'
  if (mode === 'normal') return null
  return (
    <p className={`round-mode-banner ${mode}`}>
      {mode === 'finale' ? s.roundFinale : s.roundWouldSend}
    </p>
  )
}

function playLobbyChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    for (const [i, freq] of [523.25, 659.25, 783.99].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02 + i * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.08)
      osc.stop(now + 0.4 + i * 0.08)
    }
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // ignore
  }
}

function WritePhase({ room, s, tvMode }: { room: PublicRoom; s: ReturnType<typeof t>; tvMode?: boolean }) {
  const [text, setText] = useState(room.yourWrite ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const done = Boolean(room.yourWrite)

  useEffect(() => {
    if (room.yourWrite) setText(room.yourWrite)
  }, [room.yourWrite])

  if (room.youAreSpectator || tvMode) {
    return (
      <section className="phase wait">
        <RoundModeBanner room={room} s={s} />
        <PromptCard room={room} s={s} />
        <div className="pulse-dot" />
        <h2>{s.waitingWriter}</h2>
        <p className="muted">
          {room.writeCount}/{room.writeNeeded}
        </p>
      </section>
    )
  }

  if (done) {
    return (
      <section className="phase wait">
        <RoundModeBanner room={room} s={s} />
        <PromptCard room={room} s={s} />
        <p className="ok">{s.submitted}</p>
        <h2>{s.waitingWriter}</h2>
        <p className="muted">
          {room.writeCount}/{room.writeNeeded}
        </p>
      </section>
    )
  }

  return (
    <section className="phase">
      <h2>{s.youWrite}</h2>
      <RoundModeBanner room={room} s={s} />
      <p className="muted">{s.writeHint}</p>
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
    else if (room.originalText) setText((prev) => prev || room.originalText || '')
  }, [room.yourSabotage, room.originalText])

  if (room.youAreSpectator || tvMode) {
    return (
      <section className="phase wait">
        <RoundModeBanner room={room} s={s} />
        <PromptCard room={room} s={s} />
        <div className="pulse-dot" />
        <h2>{s.waitingSabotage}</h2>
        <p className="muted">
          {room.sabotageCount}/{room.sabotageNeeded}
        </p>
      </section>
    )
  }

  if (done) {
    return (
      <section className="phase wait">
        <RoundModeBanner room={room} s={s} />
        <PromptCard room={room} s={s} />
        <p className="ok">{s.submitted}</p>
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
      <RoundModeBanner room={room} s={s} />
      <p className="muted">
        {room.sabotageTargetName
          ? s.sabotageOf.replace('{name}', room.sabotageTargetName)
          : s.sabotageHint}
      </p>
      <PromptCard room={room} s={s} />
      {room.originalText && (
        <div className="bubble original">
          <span>{s.original}{room.sabotageTargetName ? ` · ${room.sabotageTargetName}` : ''}</span>
          <p>{room.originalText}</p>
        </div>
      )}
      <div className="sms">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder={s.sabotagePlaceholder}
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
          const res = await submitSabotage(text)
          setSending(false)
          if (res.error) setErr(res.error)
        }}
      >
        {s.submitSabotage}
      </button>
      {err && <p className="error">{err}</p>}
    </section>
  )
}

function VotePhase({ room, s, tvMode }: { room: PublicRoom; s: ReturnType<typeof t>; tvMode?: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  const waiting = (room.votedCount ?? 0) < (room.voterCount ?? 0)
  const voteTitle = room.roundMode === 'wouldSend' ? s.voteTitleWouldSend : s.voteTitle
  const voteHint =
    room.roundMode === 'wouldSend'
      ? s.voteHintWouldSend
      : room.roundMode === 'finale'
        ? s.voteHintFinale
        : s.voteHint

  return (
    <section className="phase">
      <h2>{voteTitle}</h2>
      <RoundModeBanner room={room} s={s} />
      {!tvMode && <p className="muted">{voteHint}</p>}
      <PromptCard room={room} s={s} />
      <div className="vote-grid">
        {room.submissions.map((sub) => {
          const selected = room.yourVote === sub.id
          const disabled = room.youAreSpectator || Boolean(tvMode)
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
        {waiting ? s.waitingVotes : s.voted} · {room.votedCount}/{room.voterCount}
      </p>
      {err && <p className="error">{err}</p>}
    </section>
  )
}

function RevealPhase({
  room,
  s,
  playerId,
}: {
  room: PublicRoom
  s: ReturnType<typeof t>
  playerId: string
}) {
  const results = room.lastRound ?? []
  const topVotes = results[0]?.votes ?? 0
  const tops = results.filter((r) => r.votes > 0 && r.votes === topVotes)
  const tiedTop = tops.length > 1
  const [shareFlash, setShareFlash] = useState('')
  const invite = joinUrl(room.code)
  const star = tops[0]

  useEffect(() => {
    navigator.vibrate?.([40, 30, 60])
  }, [])

  async function shareRoundMeme() {
    if (!star || !room.prompt) return
    const blob = await renderResultsImage({
      title: `${s.winningSabotage}: ${star.authorName}`,
      subtitle: `+${star.gained} ${s.points}`,
      rows: [],
      meme: {
        task: room.prompt.task,
        original: star.originalText || room.prompt.task,
        sabotage: star.text,
        author: star.authorName,
      },
      footer: invite,
      cta: s.shareImageCta,
    })
    if (!blob) return
    void trackMetric('share_results', `round:${room.code}`)
    const file = new File([blob], 'sabotext-runda.png', { type: 'image/png' })
    const text = s.roundShareText
      .replace('{sabotage}', star.text)
      .replace('{invite}', invite)
    try {
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sabotext', text })
        setShareFlash(s.resultsCopied)
        setTimeout(() => setShareFlash(''), 2000)
        return
      }
    } catch {
      // fall through
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sabotext-runda.png'
    a.click()
    URL.revokeObjectURL(url)
    setShareFlash(s.resultsCopied)
    setTimeout(() => setShareFlash(''), 2000)
  }

  async function copyRoundText() {
    if (!star) return
    const text = s.roundShareText
      .replace('{sabotage}', star.text)
      .replace('{invite}', invite)
    try {
      await navigator.clipboard.writeText(text)
      void trackMetric('share_results', `roundtext:${room.code}`)
      setShareFlash(s.resultsCopied)
      setTimeout(() => setShareFlash(''), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <section className="phase">
      <h2>{s.revealTitle}</h2>
      <RoundModeBanner room={room} s={s} />
      <PromptCard room={room} s={s} />
      {tiedTop && <p className="tie-banner">{s.tieRound}</p>}
      {tops.map((winner) => (
        <div key={winner.submissionId} className="bubble winner-side">
          <span>
            {s.winningSabotage}: {winner.authorName}
          </span>
          <p>{winner.text}</p>
          <em>
            +{winner.gained} {s.points} · {winner.votes} {s.votes}
          </em>
        </div>
      ))}
      {star && (
        <div className="reveal-share hide-on-tv">
          <p className="share-nudge">{s.shareRoundHint}</p>
          <div className="viral-share">
            <button type="button" className="btn accent" onClick={() => void shareRoundMeme()}>
              {shareFlash || s.shareMeme}
            </button>
            <button type="button" className="btn secondary" onClick={() => void copyRoundText()}>
              {s.copyRound}
            </button>
          </div>
        </div>
      )}
      <ul className="results">
        {results.map((r) => (
          <li key={r.submissionId} className={tops.some((t) => t.submissionId === r.submissionId) ? 'top' : undefined}>
            <div>
              <strong>{r.authorName}</strong>
              {r.targetName && (
                <span className="muted sab-of">
                  {' '}
                  → {r.targetName}
                </span>
              )}
              {r.originalText && <p className="muted orig-line">{r.originalText}</p>}
              <p>{r.text}</p>
            </div>
            <span>
              {r.votes} · +{r.gained}
            </span>
          </li>
        ))}
      </ul>
      <StandingsTable room={room} playerId={playerId} s={s} />
      <p className="muted center">{s.nextRound}</p>
    </section>
  )
}

function Winner({
  room,
  playerId,
  s,
  isHost,
  tvMode,
  setTvMode,
  onLeave,
  onError,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  isHost: boolean
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (msg: string | null) => void
}) {
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const topScore = ranked[0]?.score ?? 0
  const champs = ranked.filter((p) => p.score === topScore)
  const isYou = champs.some((p) => p.id === playerId)
  const champTitle =
    champs.length > 1
      ? isYou
        ? s.youTied
        : s.winners
      : isYou
        ? s.youWon
        : s.winner
  const champNames = champs.map((c) => c.name).join(' & ')
  const [busy, setBusy] = useState(false)
  const [shareFlash, setShareFlash] = useState('')
  const [tiktokFlash, setTiktokFlash] = useState('')
  const [gangFlash, setGangFlash] = useState('')
  const [showShareNudge, setShowShareNudge] = useState(true)
  const invite = joinUrl(room.code)
  const topHighlight = room.highlights?.[0]
  const meme = topHighlight
    ? {
        task: topHighlight.promptTask,
        original: topHighlight.originalText,
        sabotage: topHighlight.winnerText,
        author: topHighlight.authorName,
      }
    : undefined

  async function shareResults() {
    const lines = ranked.map((p, i) => `${i + 1}. ${p.name} — ${p.score}`)
    const text = s.shareChallengeText.replace('{lines}', lines.join('\n')).replace('{invite}', invite)
    void trackMetric('share_results', room.code)
    setShowShareNudge(false)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext', text, url: invite })
        setShareFlash(s.resultsCopied)
        setTimeout(() => setShareFlash(''), 2000)
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareFlash(s.resultsCopied)
      setTimeout(() => setShareFlash(''), 2000)
    } catch {
      onError(s.somethingWrong)
    }
  }

  async function shareInviteMore() {
    const text =
      room.language === 'en'
        ? `Join our Sabotext rematch: ${room.code}\n${invite}`
        : `Gå med i vår Sabotext-omstart: ${room.code}\n${invite}`
    void trackMetric('share_results', `invite:${room.code}`)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext', text, url: invite })
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareFlash(s.copied)
      setTimeout(() => setShareFlash(''), 2000)
    } catch {
      onError(s.somethingWrong)
    }
  }

  async function shareImage() {
    const blob = await renderResultsImage({
      title: champs.length
        ? `${champs.length > 1 ? s.winnersAre : s.winnerIs} ${champNames}`
        : s.standings,
      subtitle: `${topScore} ${s.points}`,
      rows: ranked.map((p, i) => ({
        rank: p.score === topScore ? '🥇' : `${i + 1}.`,
        name: p.name,
        score: `${p.score}`,
      })),
      highlight: topHighlight ? `"${topHighlight.winnerText.slice(0, 60)}"` : undefined,
      meme,
      footer: invite,
      cta: s.shareImageCta,
    })
    if (!blob) {
      onError(s.somethingWrong)
      return
    }
    void trackMetric('share_results', `image:${room.code}`)
    setShowShareNudge(false)
    const file = new File([blob], 'sabotext-resultat.png', { type: 'image/png' })
    const text = s.imageShareText.replace('{invite}', invite)
    try {
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sabotext', text })
        return
      }
    } catch {
      // fall through
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sabotext-resultat.png'
    a.click()
    URL.revokeObjectURL(url)
    setShareFlash(s.resultsCopied)
    setTimeout(() => setShareFlash(''), 2000)
  }

  async function copyTikTokScript() {
    if (!topHighlight) return
    const text = s.tiktokScript
      .replace('{task}', topHighlight.promptTask)
      .replace('{original}', topHighlight.originalText)
      .replace('{sabotage}', topHighlight.winnerText)
    try {
      await navigator.clipboard.writeText(text)
      setTiktokFlash(s.tiktokCopied)
      setTimeout(() => setTiktokFlash(''), 2000)
    } catch {
      onError(s.somethingWrong)
    }
  }

  async function saveGangAndShare() {
    saveGang(room.code)
    const text =
      room.language === 'en'
        ? `${s.sameGangTomorrow}\nJoin our Sabotext crew again: ${room.code}\n${invite}`
        : `${s.sameGangTomorrow}\nSamma gäng imorgon — gå med: ${room.code}\n${invite}`
    void trackMetric('share_results', `gang:${room.code}`)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext', text, url: invite })
        setGangFlash(s.saveGang)
        setTimeout(() => setGangFlash(''), 2000)
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setGangFlash(s.saveGang)
      setTimeout(() => setGangFlash(''), 2000)
    } catch {
      onError(s.somethingWrong)
    }
  }

  return (
    <main className="winner-screen">
      <Confetti />
      <div className="lobby-top" style={{ marginBottom: '0.5rem' }}>
        <p className="brand">Sabotext</p>
        <button type="button" className="btn ghost dark sm" onClick={() => setTvMode((v) => !v)}>
          {tvMode ? s.tvModeOff : s.tvMode}
        </button>
      </div>
      <h1>{champTitle}</h1>
      {champs.length > 0 && (
        <p className="champ">
          {champNames}
          <span>
            {topScore} {s.points}
          </span>
        </p>
      )}

      <StandingsTable room={room} playerId={playerId} s={s} />

      {showShareNudge && !tvMode && (
        <p className="share-nudge">{s.shareViralHint}</p>
      )}

      {!tvMode && (
        <div className="viral-share">
          <button type="button" className="btn primary" onClick={() => void shareResults()}>
            {shareFlash || s.challengeShare}
          </button>
          <button type="button" className="btn accent" onClick={() => void shareImage()}>
            {meme ? s.shareMeme : s.shareImage}
          </button>
          {topHighlight && (
            <button type="button" className="btn tiktok-btn" onClick={() => void copyTikTokScript()}>
              {tiktokFlash || s.copyForTikTok}
            </button>
          )}
        </div>
      )}

      {room.highlights && room.highlights.length > 0 && (
        <section className="highlights">
          <h2>{s.highlights}</h2>
          {topHighlight && !tvMode && (
            <p className="highlight-share-hint">{s.highlightShare}</p>
          )}
          <ul>
            {room.highlights.map((h) => (
              <li key={`${h.round}-${h.authorName}`} className="highlight-card">
                <span className="highlight-meta">
                  {s.highlightRound.replace('{n}', String(h.round))} · {h.authorName} · {h.votes} {s.votes}
                </span>
                <p className="highlight-task">{h.promptTask}</p>
                <div className="highlight-compare">
                  <div>
                    <em>{s.task}</em>
                    <p>{h.promptTask}</p>
                  </div>
                  <div>
                    <em>{s.winningSabotage}</em>
                    <p>{h.winnerText}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isHost ? (
        <>
          <button type="button" className="btn primary" disabled={busy} onClick={async () => {
            setBusy(true)
            const res = await rematchGame()
            setBusy(false)
            if (res.error) onError(res.error)
          }}>
            {s.rematch}
          </button>
          {!tvMode && (
            <button type="button" className="btn secondary" onClick={() => void shareInviteMore()}>
              {s.inviteMoreRematch}
            </button>
          )}
          {!tvMode && (
            <button type="button" className="btn secondary" onClick={() => void saveGangAndShare()}>
              {gangFlash || s.sameGangTomorrow}
            </button>
          )}
        </>
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

function StandingsTable({
  room,
  playerId,
  s,
  compact,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  compact?: boolean
}) {
  const ranked = [...room.players]
    .filter((p) => p.playing)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  let displayRank = 0
  let prevScore: number | null = null

  return (
    <div className={`standings${compact ? ' compact' : ''}`}>
      <p className="standings-title">{s.scoreboard}</p>
      <table className="standings-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{s.players}</th>
            <th scope="col">{s.points}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => {
            if (prevScore === null || p.score < prevScore) {
              displayRank += 1
              prevScore = p.score
            }
            const rank = displayRank
            return (
              <tr key={p.id} className={p.id === playerId ? 'you' : undefined}>
                <td>{rank}</td>
                <td>
                  {p.name}
                  {p.id === playerId ? ` (${s.you})` : ''}
                </td>
                <td>{p.score}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
