import { useEffect, useState } from 'react'
import {
  activateParty,
  applyStoredPartyToken,
  bindSocketHandlers,
  castVote,
  claimPartySession,
  clearSession,
  createGame,
  ensureSessionBound,
  fetchHome,
  fetchPartyInfo,
  fetchStripeHint,
  hasPaidBefore,
  joinGame,
  loadGang,
  loadPartyPass,
  loadPreferredName,
  loadSession,
  markPaidBefore,
  rematchGame,
  redeemParty,
  saveGang,
  savePartyPass,
  savePreferredName,
  saveSession,
  setHostPlaying,
  setLanguage,
  setPublicLobby,
  setRoundCount,
  startGame,
  startPartyCheckout,
  submitOriginal,
  submitSabotage,
  trackMetric,
  isWeekend,
  type HomePayload,
  type PartyInfo,
} from './api'
import { t } from './i18n'
import { JoinQr } from './qr'
import { renderResultsImage } from './shareCard'
import type { Lang, PartyPlan, PublicRoom } from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'lobby' | 'play' | 'guest-unlock'

const FREE_ROUND_OPTIONS = [4, 6, 8, 10]
const PARTY_EXTRA_ROUNDS = [12, 16]
const FACTOPIA_URL = 'https://factopia.net'
const PARTY_PATHS_URL = 'https://partypaths.com'
const PENDING_ROOM_KEY = 'sabotext-pending-room'
const RESUME_CHECKOUT_KEY = 'sabotext-resume-checkout'

function joinUrl(code: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('join', code.toUpperCase())
  return url.toString()
}

function formatExpiry(ts: number, lang: Lang) {
  return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
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
    </div>
  )
}

function PartyBuyPanel({
  s,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  urgent,
  primaryLabel,
}: {
  s: ReturnType<typeof t>
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
  urgent?: boolean
  primaryLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const weekend = isWeekend()
  if (!open) {
    return (
      <div className={`party-plans${urgent ? ' urgent' : ''}`}>
        <button
          type="button"
          className="btn party"
          disabled={checkoutBusy}
          onClick={() => setOpen(true)}
        >
          {checkoutBusy ? s.buyPartyBusy : primaryLabel || s.unlockPartyFrom}
        </button>
        <p className="footer-note">{s.payWithSwish}</p>
      </div>
    )
  }
  return (
    <div className={`party-plans${urgent ? ' urgent' : ''}`}>
      <p className="party-hint">{s.choosePlan}</p>
      <button
        type="button"
        className="btn party"
        disabled={checkoutBusy}
        onClick={() => onBuyParty(weekend ? 'week' : 'day')}
      >
        {checkoutBusy ? s.buyPartyBusy : weekend ? buyWeekLabel : buyDayLabel}
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={checkoutBusy}
        onClick={() => onBuyParty(weekend ? 'day' : 'week')}
      >
        {weekend ? buyDayLabel : buyWeekLabel}
      </button>
      <p className="footer-note">{s.payWithSwish}</p>
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
  const [rounds, setRounds] = useState(6)
  const [lang, setLang] = useState<Lang>('sv')
  const [hostPlays, setHostPlaysLocal] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [partyPass, setPartyPass] = useState(() => loadPartyPass())
  const [partyInfo, setPartyInfo] = useState<PartyInfo>({
    enabled: false,
    amountOre: 3900,
    amountLabel: '39 kr',
    durationHours: 24,
    weekAmountOre: 9900,
    weekAmountLabel: '99 kr',
    weekDurationHours: 168,
  })
  const [partyFlash, setPartyFlash] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [ownerCode, setOwnerCode] = useState('')
  const [showOwnerCode, setShowOwnerCode] = useState(false)
  const [stripeHint, setStripeHint] = useState<string | null>(null)
  const [fullRoomCode, setFullRoomCode] = useState('')
  const [fullWaitlistCount, setFullWaitlistCount] = useState(0)
  const [resumeCheckout, setResumeCheckout] = useState<{
    roomCode?: string
    plan: PartyPlan
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_CHECKOUT_KEY)
      return raw ? (JSON.parse(raw) as { roomCode?: string; plan: PartyPlan }) : null
    } catch {
      return null
    }
  })

  const uiLang = room?.language ?? lang
  const s = t(uiLang)
  const hasParty = Boolean(partyPass && partyPass.expiresAt > Date.now())
  const firstTime = !hasPaidBefore()
  const weekend = isWeekend()
  const defaultPlan: PartyPlan = weekend ? 'week' : 'day'
  const dayPrice =
    firstTime && partyInfo.firstPartyDayLabel ? partyInfo.firstPartyDayLabel : partyInfo.amountLabel
  const weekPrice =
    firstTime && partyInfo.firstPartyWeekLabel
      ? partyInfo.firstPartyWeekLabel
      : partyInfo.weekAmountLabel ?? '99 kr'
  const buyDayLabel = `Party · ${dayPrice} · 24 h${firstTime ? ' (−30%)' : ''}`
  const buyWeekLabel = `Party · ${weekPrice} · 7 ${uiLang === 'en' ? 'days' : 'dagar'}${firstTime ? ' (−30%)' : ''}`
  const homeRoundOptions = hasParty
    ? [...FREE_ROUND_OPTIONS, ...PARTY_EXTRA_ROUNDS]
    : FREE_ROUND_OPTIONS

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
    void fetchPartyInfo().then(setPartyInfo)
    void fetchStripeHint().then(setStripeHint)
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('party_session')
    const cancelled = params.get('party_cancel')
    const roomFromUrl = params.get('room')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    if (!sessionId && !cancelled) return

    const clean = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('party_session')
      url.searchParams.delete('party_cancel')
      url.searchParams.delete('room')
      window.history.replaceState({}, '', url.pathname + url.search)
    }

    const pendingRoom =
      roomFromUrl ||
      (() => {
        try {
          return sessionStorage.getItem(PENDING_ROOM_KEY) || ''
        } catch {
          return ''
        }
      })()

    if (cancelled) {
      setPartyFlash(s.checkoutCancelledHint)
      void trackMetric('checkout_cancel', pendingRoom || undefined)
      clean()
      if (pendingRoom) {
        try {
          sessionStorage.setItem(
            RESUME_CHECKOUT_KEY,
            JSON.stringify({ roomCode: pendingRoom, plan: defaultPlan }),
          )
        } catch {
          // ignore
        }
        setResumeCheckout({ roomCode: pendingRoom, plan: defaultPlan })
        try {
          sessionStorage.removeItem(PENDING_ROOM_KEY)
        } catch {
          // ignore
        }
      }
      return
    }

    setCheckoutBusy(true)
    void claimPartySession(sessionId!).then(async (res) => {
      setCheckoutBusy(false)
      clean()
      if (res.error || !res.token || !res.expiresAt) {
        setError(res.error || s.somethingWrong)
        return
      }
      const pass = { token: res.token, expiresAt: res.expiresAt }
      savePartyPass(pass)
      setPartyPass(pass)
      markPaidBefore()
      setPartyFlash(s.partyUnlocked)
      setResumeCheckout(null)
      try {
        sessionStorage.removeItem(RESUME_CHECKOUT_KEY)
      } catch {
        // ignore
      }
      void fetchPartyInfo().then(setPartyInfo)

      const targetRoom = (res.roomCode || pendingRoom || '').toUpperCase()
      try {
        sessionStorage.removeItem(PENDING_ROOM_KEY)
      } catch {
        // ignore
      }

      const session = loadSession()
      if (targetRoom && session?.code === targetRoom) {
        setBusy(true)
        const bound = await ensureSessionBound(5)
        setBusy(false)
        if (bound && !bound.error && bound.room) {
          setPlayerId(bound.playerId)
          setRoom(bound.room)
          setScreen(bound.room.status === 'lobby' ? 'lobby' : 'play')
          await applyStoredPartyToken()
        }
      } else if (targetRoom && !session) {
        setJoinCode(targetRoom)
        setPartyFlash(s.partyUnlocked)
      } else if (session) {
        await applyStoredPartyToken()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onBuyParty(roomCode?: string, plan: PartyPlan = defaultPlan) {
    setError(null)
    setCheckoutBusy(true)
    if (roomCode) {
      try {
        sessionStorage.setItem(PENDING_ROOM_KEY, roomCode.toUpperCase())
        sessionStorage.setItem(RESUME_CHECKOUT_KEY, JSON.stringify({ roomCode, plan }))
      } catch {
        // ignore
      }
    } else {
      try {
        sessionStorage.setItem(RESUME_CHECKOUT_KEY, JSON.stringify({ plan }))
      } catch {
        // ignore
      }
    }
    if (roomCode && !loadSession()) {
      void trackMetric('guest_unlock_click', roomCode)
    }
    const res = await startPartyCheckout(uiLang, roomCode, plan, firstTime)
    if (res.error || !res.url) {
      setCheckoutBusy(false)
      const hint = stripeHint || (await fetchStripeHint())
      setError(partyInfo.enabled ? res.error || s.somethingWrong : hint || s.stripeMissing)
      return
    }
    window.location.href = res.url
  }

  async function onRedeemOwnerCode(code: string) {
    setError(null)
    setCheckoutBusy(true)
    const res = await redeemParty(code.trim())
    setCheckoutBusy(false)
    if (res.error || !res.token || !res.expiresAt) {
      setError(res.error || s.somethingWrong)
      return
    }
    const pass = { token: res.token, expiresAt: res.expiresAt }
    savePartyPass(pass)
    setPartyPass(pass)
    setPartyFlash(s.partyUnlocked)
  }

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
    setError(null)
    setBusy(true)
    savePreferredName(name)
    const res = await joinGame(joinCode, name)
    setBusy(false)
    if (res.code === 'ROOM_FULL' || (res.error && res.error.toLowerCase().includes('fullt'))) {
      const roomCode = (res.roomCode || joinCode).toUpperCase()
      setFullRoomCode(roomCode)
      setFullWaitlistCount(res.waitlistCount ?? 1)
      setScreen('guest-unlock')
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
        {!connected && <div className="banner">{s.offline}</div>}

        {screen === 'home' && (
          <Home
            s={s}
            name={name}
            setName={setName}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            rounds={rounds}
            setRounds={setRounds}
            roundOptions={homeRoundOptions}
            lang={lang}
            setLang={setLang}
            hostPlays={hostPlays}
            setHostPlays={setHostPlaysLocal}
            error={error}
            busy={busy}
            onCreate={handleCreate}
            onJoin={handleJoin}
            partyInfo={partyInfo}
            hasParty={hasParty}
            partyPass={partyPass}
            partyFlash={partyFlash}
            firstTime={firstTime}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={(plan) => void onBuyParty(undefined, plan || defaultPlan)}
            resumeCheckout={resumeCheckout}
            onResumeCheckout={(plan) =>
              void onBuyParty(resumeCheckout?.roomCode, plan || resumeCheckout?.plan || defaultPlan)
            }
            showOwnerCode={showOwnerCode}
            setShowOwnerCode={setShowOwnerCode}
            ownerCode={ownerCode}
            setOwnerCode={setOwnerCode}
            onRedeemOwnerCode={onRedeemOwnerCode}
          />
        )}

        {screen === 'guest-unlock' && (
          <main className="home">
            <div className="panel">
              <p className="section-title">{s.guestUnlockTitle}</p>
              <p className="party-pitch">{s.guestUnlockBody}</p>
              <p className="footer-note">
                {s.code}: <strong className="big-code inline">{fullRoomCode}</strong>
                {fullWaitlistCount > 0 ? ` · ${fullWaitlistCount} ${s.waitingToJoin.toLowerCase()}` : ''}
              </p>
              <p className="footer-note">{s.priceAnchorDay}</p>
              {firstTime && <p className="party-flash">{s.firstPartyDeal}</p>}
              <PartyBuyPanel
                s={s}
                buyDayLabel={buyDayLabel}
                buyWeekLabel={buyWeekLabel}
                checkoutBusy={checkoutBusy}
                onBuyParty={(plan) => void onBuyParty(fullRoomCode, plan || defaultPlan)}
                urgent
                primaryLabel={s.unlockForEveryone}
              />
              {error && <p className="error">{error}</p>}
              <button type="button" className="btn ghost" onClick={() => setScreen('home')}>
                {s.back}
              </button>
            </div>
          </main>
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
            partyInfo={partyInfo}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={(plan) => void onBuyParty(room.code, plan || defaultPlan)}
            firstTime={firstTime}
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
            partyInfo={partyInfo}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={(plan) => void onBuyParty(room.code, plan || defaultPlan)}
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
  roundOptions,
  lang,
  setLang,
  hostPlays,
  setHostPlays,
  error,
  busy,
  onCreate,
  onJoin,
  partyInfo,
  hasParty,
  partyPass,
  partyFlash,
  firstTime,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  resumeCheckout,
  onResumeCheckout,
  showOwnerCode,
  setShowOwnerCode,
  ownerCode,
  setOwnerCode,
  onRedeemOwnerCode,
}: {
  s: ReturnType<typeof t>
  name: string
  setName: (v: string) => void
  joinCode: string
  setJoinCode: (v: string) => void
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
  onJoin: () => void
  partyInfo: PartyInfo
  hasParty: boolean
  partyPass: { expiresAt: number } | null
  partyFlash: string
  firstTime: boolean
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
  resumeCheckout: { roomCode?: string; plan: PartyPlan } | null
  onResumeCheckout: (plan?: PartyPlan) => void
  showOwnerCode: boolean
  setShowOwnerCode: (v: boolean) => void
  ownerCode: string
  setOwnerCode: (v: string) => void
  onRedeemOwnerCode: (code: string) => void
}) {
  const [homeData, setHomeData] = useState<HomePayload | null>(null)
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code')
  const [tipFlash, setTipFlash] = useState('')
  const [savedGang] = useState(() => loadGang())
  const hasSavedName = Boolean(name.trim())

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

  function openSavedGang() {
    if (!savedGang) return
    setJoinCode(savedGang.code)
    if (hasSavedName) setJoinStep('code')
    else setJoinStep('name')
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
          <button type="button" className="btn secondary sm" onClick={openSavedGang}>
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
          <span>eller</span>
        </div>

        <div className="join-steps">
          {!hasSavedName && joinStep === 'name' && (
            <p className="footer-note join-hint">{s.joinThenName}</p>
          )}

          {(hasSavedName || joinStep === 'code') && (
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
          )}

          {!hasSavedName && joinStep === 'name' && (
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
          )}

          {hasSavedName ? (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || !name.trim() || joinCode.length < 4}
              onClick={onJoin}
            >
              {s.join}
            </button>
          ) : joinStep === 'code' ? (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || joinCode.length < 4}
              onClick={() => setJoinStep('name')}
            >
              {s.continueJoin}
            </button>
          ) : (
            <>
              <button type="button" className="btn-tiny" onClick={() => setJoinStep('code')}>
                ← {s.code}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || !name.trim() || joinCode.length < 4}
                onClick={onJoin}
              >
                {s.join}
              </button>
            </>
          )}
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      <button type="button" className="btn tip-friend" onClick={() => void tipFriend()}>
        {tipFlash || s.tipFriend}
      </button>

      {partyInfo.enabled && (
        <div className="panel party-home">
          <p className="section-title">{s.party}</p>
          <p className="party-pitch">{s.partyPitch}</p>
          <p className="footer-note">{s.freeTierOk}</p>
          {hasParty && partyPass ? (
            <p className="footer-note">
              {s.partyActive} · {s.partyUntil} {formatExpiry(partyPass.expiresAt, lang)}
            </p>
          ) : (
            <>
              <p className="party-hint">{s.buyPartyHint}</p>
              <p className="footer-note">{s.priceAnchorDay}</p>
              {firstTime && <p className="party-flash">{s.firstPartyDeal}</p>}
              <PartyBuyPanel
                s={s}
                buyDayLabel={buyDayLabel}
                buyWeekLabel={buyWeekLabel}
                checkoutBusy={checkoutBusy}
                onBuyParty={onBuyParty}
              />
              {resumeCheckout && (
                <button
                  type="button"
                  className="btn accent"
                  disabled={checkoutBusy}
                  onClick={() => onResumeCheckout(resumeCheckout.plan)}
                >
                  {s.resumeCheckout}
                </button>
              )}
              <button type="button" className="btn-tiny" onClick={() => setShowOwnerCode(!showOwnerCode)}>
                {showOwnerCode ? s.hideCode : s.haveCode}
              </button>
              {showOwnerCode && (
                <div className="party-redeem">
                  <input
                    value={ownerCode}
                    onChange={(e) => setOwnerCode(e.target.value)}
                    placeholder={s.partyCode}
                    maxLength={64}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={checkoutBusy || !ownerCode.trim()}
                    onClick={() => onRedeemOwnerCode(ownerCode)}
                  >
                    {s.activate}
                  </button>
                </div>
              )}
            </>
          )}
          {partyFlash && <p className="party-flash">{partyFlash}</p>}
        </div>
      )}

      <p className="footer-note dns-hint">{s.dnsHint}</p>

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
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  firstTime,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (e: string | null) => void
  error: string | null
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
  firstTime: boolean
}) {
  const isHost = room.hostId === playerId
  const isParty = room.premiumTier === 'party'
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [partyCode, setPartyCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)
  const inviteUrl = joinUrl(room.code)
  const playing = room.players.filter((p) => p.playing)
  const canStart = playing.filter((p) => p.connected).length >= 2
  const waitlist = room.waitlist ?? []
  const maxPlayers = room.limits?.maxPlayers ?? 5
  const almostFull = !isParty && maxPlayers > 0 && playing.length >= maxPlayers - 1
  const isFull = !isParty && maxPlayers > 0 && playing.length >= maxPlayers
  const blockStart = isHost && !isParty && waitlist.length > 0
  const roundOptions = room.limits?.roundCounts ?? FREE_ROUND_OPTIONS

  useEffect(() => {
    if (isHost) void applyStoredPartyToken()
  }, [isHost])

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

  async function onUnlockParty() {
    setLocalBusy(true)
    onError(null)
    const res = await activateParty(partyCode.trim())
    setLocalBusy(false)
    if (res.error || !res.token || !res.expiresAt) {
      onError(res.error || s.somethingWrong)
      return
    }
    savePartyPass({ token: res.token, expiresAt: res.expiresAt })
    await applyStoredPartyToken()
  }

  async function changePublic(next: boolean) {
    if (next && !isParty) {
      onError(s.publicNeedsParty)
      void trackMetric('public_requires_party', room.code)
      return
    }
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
          {isParty && (
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
          )}
        </div>
      )}

      {isHost && isParty && !tvMode && (
        <div className="party-banner on hide-on-tv">
          <strong>{s.partyActive}</strong>
          <p>
            {room.premiumExpiresAt
              ? `${s.partyActiveUntil} ${formatExpiry(room.premiumExpiresAt, room.language)}`
              : s.partyActive}
          </p>
        </div>
      )}

      {isHost && !isParty && !tvMode && (almostFull || isFull || waitlist.length > 0) && (
        <div className={`party-banner urgent-inline hide-on-tv`}>
          <p className="party-hint">
            {waitlist.length > 0 || isFull ? s.roomFullUpsell : s.roomAlmostFull}
          </p>
          <p className="footer-note">{s.priceAnchorDay}</p>
          {firstTime && <p className="party-flash">{s.firstPartyDeal}</p>}
          <PartyBuyPanel
            s={s}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={onBuyParty}
            urgent
          />
          <button type="button" className="btn-tiny" onClick={() => setShowCode((v) => !v)}>
            {showCode ? s.hideCode : s.haveCode}
          </button>
          {showCode && (
            <div className="party-redeem">
              <input
                value={partyCode}
                onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                placeholder={s.partyCode}
                maxLength={64}
              />
              <button type="button" className="btn secondary" disabled={localBusy} onClick={() => void onUnlockParty()}>
                {s.activate}
              </button>
            </div>
          )}
          {!partyInfo.enabled && <p className="footer-note">{s.buyPartySoon}</p>}
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
        {isHost && waitlist.length > 0 && (
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
        <>
          {blockStart && (
            <p className="party-hint center">{s.startBlockedWaitlist.replace('{n}', String(waitlist.length))}</p>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={!canStart || blockStart}
            onClick={async () => {
              onError(null)
              const res = await startGame()
              if (res.error) onError(res.error)
            }}
          >
            {blockStart ? s.unlockThenStart : canStart ? s.start : s.needPlayers}
          </button>
        </>
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
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (msg: string | null) => void
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
}) {
  const isHost = room.hostId === playerId
  const totalMs = (room.phaseSeconds || 30) * 1000
  const { seconds, ratio } = useCountdown(room.endsAt || null, totalMs)

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
        partyInfo={partyInfo}
        buyDayLabel={buyDayLabel}
        buyWeekLabel={buyWeekLabel}
        checkoutBusy={checkoutBusy}
        onBuyParty={onBuyParty}
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

  useEffect(() => {
    navigator.vibrate?.([40, 30, 60])
  }, [])

  return (
    <section className="phase">
      <h2>{s.revealTitle}</h2>
      {winner && winner.votes > 0 && (
        <div className="reveal-compare">
          <div className="bubble original">
            <span>{s.original}</span>
            <p>{room.originalText}</p>
          </div>
          <div className="bubble winner-side">
            <span>
              {s.winningSabotage}: {winner.authorName}
            </span>
            <p>{winner.text}</p>
            <em>
              +{winner.gained} {s.points} · {winner.votes} {s.votes}
            </em>
          </div>
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
  playerId,
  s,
  isHost,
  tvMode,
  setTvMode,
  onLeave,
  onError,
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
}: {
  room: PublicRoom
  playerId: string
  s: ReturnType<typeof t>
  isHost: boolean
  tvMode: boolean
  setTvMode: (v: boolean | ((prev: boolean) => boolean)) => void
  onLeave: () => void
  onError: (msg: string | null) => void
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
}) {
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score)
  const champ = ranked[0]
  const isYou = champ?.id === playerId
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
      title: champ ? `${s.winnerIs} ${champ.name}` : s.standings,
      subtitle: `${champ?.score ?? 0} ${s.points}`,
      rows: ranked.map((p, i) => ({
        rank: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`,
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
      <h1>{isYou ? s.youWon : s.winner}</h1>
      {champ && (
        <p className="champ">
          {champ.name}
          <span>
            {champ.score} {s.points}
          </span>
        </p>
      )}

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
                    <em>{s.original}</em>
                    <p>{h.originalText}</p>
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

      <p className="section-title">{s.standings}</p>
      <ul className="player-list">
        {ranked.map((p, i) => (
          <li key={p.id}>
            <span>
              {i + 1}. {p.name}
              {p.id === playerId ? ` (${s.you})` : ''}
            </span>
            <span className="score">{p.score}</span>
          </li>
        ))}
      </ul>

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

      {room.premiumTier !== 'party' && isHost && partyInfo.enabled && !tvMode && (
        <PartyBuyPanel
          s={s}
          buyDayLabel={buyDayLabel}
          buyWeekLabel={buyWeekLabel}
          checkoutBusy={checkoutBusy}
          onBuyParty={onBuyParty}
        />
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
