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
  fetchLobbies,
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
  type PublicLobbyCard,
} from './api'
import { t } from './i18n'
import { JoinQr } from './qr'
import { QrJoinScanner } from './qrScan'
import { renderResultsImage } from './shareCard'
import type { Lang, PartyPlan, PublicRoom } from './types'
import { Confetti } from './ui'

type Screen = 'home' | 'join' | 'find' | 'lobby' | 'play' | 'guest-unlock'

const FREE_ROUND_OPTIONS = [8, 10, 12, 15]
const PARTY_EXTRA_ROUNDS = [20, 25]
const FACTOPIA_URL = 'https://factopia.net'
const PARTY_PATHS_URL = 'https://partypaths.com'
const PENDING_ROOM_KEY = 'sabotext-pending-room'
const RESUME_CHECKOUT_KEY = 'sabotext-resume-checkout'

function joinUrl(code: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('join', code.toUpperCase())
  return url.toString()
}

function unlockUrl(code: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('unlock', code.toUpperCase())
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
  firstTime,
  dayWas,
  weekWas,
}: {
  s: ReturnType<typeof t>
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
  urgent?: boolean
  primaryLabel?: string
  firstTime?: boolean
  dayWas?: string
  weekWas?: string
}) {
  const [open, setOpen] = useState(Boolean(urgent))
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
        {firstTime && dayWas && (
          <p className="party-flash">
            {s.firstPartyDeal} · {s.firstPartyWas.replace('{price}', dayWas)}
          </p>
        )}
        <p className="footer-note">{s.payWithSwish}</p>
      </div>
    )
  }
  return (
    <div className={`party-plans${urgent ? ' urgent' : ''}`}>
      <p className="party-hint">{s.choosePlan}</p>
      {firstTime && <p className="party-flash">{s.firstPartyDeal}</p>}
      <button
        type="button"
        className="btn party"
        disabled={checkoutBusy}
        onClick={() => onBuyParty(weekend ? 'week' : 'day')}
      >
        {checkoutBusy ? s.buyPartyBusy : weekend ? buyWeekLabel : buyDayLabel}
      </button>
      {firstTime && (weekend ? weekWas : dayWas) && (
        <p className="footer-note price-was">
          {s.regularPrice} {weekend ? weekWas : dayWas}
        </p>
      )}
      <button
        type="button"
        className="btn secondary"
        disabled={checkoutBusy}
        onClick={() => onBuyParty(weekend ? 'day' : 'week')}
      >
        {weekend ? buyDayLabel : buyWeekLabel}
      </button>
      <p className="footer-note">{s.partyValueLine}</p>
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
  const [joinStep, setJoinStep] = useState<'code' | 'name' | 'scan'>('code')
  const [rounds, setRounds] = useState(10)
  const [lang, setLang] = useState<Lang>('sv')
  const [lobbies, setLobbies] = useState<PublicLobbyCard[]>([])
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
  const dayList = partyInfo.amountLabel
  const weekList = partyInfo.weekAmountLabel ?? '99 kr'
  const dayPrice =
    firstTime && partyInfo.firstPartyDayLabel ? partyInfo.firstPartyDayLabel : dayList
  const weekPrice =
    firstTime && partyInfo.firstPartyWeekLabel ? partyInfo.firstPartyWeekLabel : weekList
  const buyDayLabel = firstTime
    ? `Party · ${dayPrice} · 24 h (−30%)`
    : `Party · ${dayPrice} · 24 h`
  const buyWeekLabel = firstTime
    ? `Party · ${weekPrice} · 7 ${uiLang === 'en' ? 'days' : 'dagar'} (−30%)`
    : `Party · ${weekPrice} · 7 ${uiLang === 'en' ? 'days' : 'dagar'}`
  const dayWas = firstTime ? dayList : undefined
  const weekWas = firstTime ? weekList : undefined
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
    if (unlock && unlock.length === 4) {
      setFullRoomCode(unlock)
      setFullWaitlistCount(0)
      setScreen('guest-unlock')
      const url = new URL(window.location.href)
      url.searchParams.delete('unlock')
      window.history.replaceState({}, '', url.pathname + url.search)
    } else if (join && join.length === 4) {
      setJoinCode(join)
      setJoinStep(loadPreferredName() ? 'name' : 'code')
      setScreen('join')
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
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
      } else if (targetRoom) {
        // Guest (or other device) paid — auto-join so waitlist clears for them
        const joinName = (session?.name || loadPreferredName() || name || 'Spelare').trim()
        setName(joinName)
        setJoinCode(targetRoom)
        setBusy(true)
        const joined = await joinGame(targetRoom, joinName)
        setBusy(false)
        if (!joined.error && joined.room && joined.playerId) {
          saveSession({ code: joined.room.code, playerId: joined.playerId, name: joinName })
          setPlayerId(joined.playerId)
          setRoom(joined.room)
          setScreen(joined.room.status === 'lobby' ? 'lobby' : 'play')
          setPartyFlash(s.partyUnlockedBanner)
        } else {
          setFullRoomCode(targetRoom)
          setScreen('guest-unlock')
          setPartyFlash(s.partyUnlocked)
        }
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
            roundOptions={homeRoundOptions}
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
            partyInfo={partyInfo}
            hasParty={hasParty}
            partyPass={partyPass}
            partyFlash={partyFlash}
            firstTime={firstTime}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={(plan) => void onBuyParty(undefined, plan || defaultPlan)}
            dayWas={dayWas}
            weekWas={weekWas}
            resumeCheckout={resumeCheckout}
            onResumeCheckout={(plan) =>
              void onBuyParty(resumeCheckout?.roomCode, plan || resumeCheckout?.plan || defaultPlan)
            }
            showOwnerCode={showOwnerCode}
            setShowOwnerCode={setShowOwnerCode}
            ownerCode={ownerCode}
            setOwnerCode={setOwnerCode}
            onRedeemOwnerCode={onRedeemOwnerCode}
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

        {screen === 'guest-unlock' && (
          <main className="home">
            <div className="panel">
              <p className="section-title">{s.guestUnlockTitle}</p>
              <p className="party-pitch">{s.guestUnlockBody}</p>
              {fullWaitlistCount > 0 && (
                <p className="party-flash">
                  {s.guestUnlockWaiting.replace('{n}', String(fullWaitlistCount))}
                </p>
              )}
              <p className="footer-note">
                {s.code}: <strong className="big-code inline">{fullRoomCode}</strong>
              </p>
              <p className="footer-note">{s.partyValueLine}</p>
              <p className="footer-note">{s.partyRoundsHint}</p>
              {firstTime && (
                <p className="party-flash">
                  {s.firstPartyDeal}
                  {dayWas ? ` · ${s.firstPartyWas.replace('{price}', dayWas)}` : ''}
                </p>
              )}
              <PartyBuyPanel
                s={s}
                buyDayLabel={buyDayLabel}
                buyWeekLabel={buyWeekLabel}
                checkoutBusy={checkoutBusy}
                onBuyParty={(plan) => void onBuyParty(fullRoomCode, plan || defaultPlan)}
                urgent
                primaryLabel={s.unlockForEveryone}
                firstTime={firstTime}
                dayWas={dayWas}
                weekWas={weekWas}
              />
              {partyFlash && <p className="party-flash">{partyFlash}</p>}
              {partyFlash && fullRoomCode && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !(name.trim() || loadPreferredName())}
                  onClick={async () => {
                    const joinName = (name.trim() || loadPreferredName() || 'Spelare').slice(0, 20)
                    setName(joinName)
                    setBusy(true)
                    setError(null)
                    const res = await joinGame(fullRoomCode, joinName)
                    setBusy(false)
                    if (res.error || !res.room || !res.playerId) {
                      if (res.code === 'ROOM_FULL' || /fullt|full/i.test(res.error || '')) {
                        setFullWaitlistCount(res.waitlistCount ?? fullWaitlistCount)
                        setError(res.error || s.roomFullUpsell)
                        return
                      }
                      setError(res.error || 'Error')
                      return
                    }
                    saveSession({ code: res.room.code, playerId: res.playerId, name: joinName })
                    setPlayerId(res.playerId)
                    setRoom(res.room)
                    setScreen(res.room.status === 'lobby' ? 'lobby' : 'play')
                  }}
                >
                  {s.joinAfterUnlock}
                </button>
              )}
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
            dayWas={dayWas}
            weekWas={weekWas}
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
            firstTime={firstTime}
            dayWas={dayWas}
            weekWas={weekWas}
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
  partyInfo,
  hasParty,
  partyPass,
  partyFlash,
  firstTime,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  dayWas,
  weekWas,
  resumeCheckout,
  onResumeCheckout,
  showOwnerCode,
  setShowOwnerCode,
  ownerCode,
  setOwnerCode,
  onRedeemOwnerCode,
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
  partyInfo: PartyInfo
  hasParty: boolean
  partyPass: { expiresAt: number } | null
  partyFlash: string
  firstTime: boolean
  buyDayLabel: string
  buyWeekLabel: string
  checkoutBusy: boolean
  onBuyParty: (plan?: PartyPlan) => void
  dayWas?: string
  weekWas?: string
  resumeCheckout: { roomCode?: string; plan: PartyPlan } | null
  onResumeCheckout: (plan?: PartyPlan) => void
  showOwnerCode: boolean
  setShowOwnerCode: (v: boolean) => void
  ownerCode: string
  setOwnerCode: (v: string) => void
  onRedeemOwnerCode: (code: string) => void
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
              <p className="footer-note">{s.partyValueLine}</p>
              <p className="footer-note">{s.partyRoundsHint}</p>
              {firstTime && (
                <p className="party-flash">
                  {s.firstPartyDeal}
                  {dayWas ? ` · ${s.firstPartyWas.replace('{price}', dayWas)}` : ''}
                </p>
              )}
              <PartyBuyPanel
                s={s}
                buyDayLabel={buyDayLabel}
                buyWeekLabel={buyWeekLabel}
                checkoutBusy={checkoutBusy}
                onBuyParty={onBuyParty}
                firstTime={firstTime}
                dayWas={dayWas}
                weekWas={weekWas}
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
                      {lobby.party && <span className="party-pill">{s.partyBadge}</span>}
                    </div>
                    <span>
                      {lobby.playerCount} {s.participants.toLowerCase()} · {seats}
                    </span>
                    <span className="lobby-meta">
                      {lobby.language.toUpperCase()} · {lobby.roundCount} {s.roundsShort}
                      {lobby.party ? ` · ${s.partyRoundsHint}` : ''}
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
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  firstTime,
  dayWas,
  weekWas,
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
  dayWas?: string
  weekWas?: string
}) {
  const isHost = room.hostId === playerId
  const isParty = room.premiumTier === 'party'
  const [copied, setCopied] = useState(false)
  const [buyCopied, setBuyCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [partyCode, setPartyCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)
  const inviteUrl = joinUrl(room.code)
  const buyLink = unlockUrl(room.code)
  const playing = room.players.filter((p) => p.playing)
  const canStart = playing.filter((p) => p.connected).length >= 2
  const waitlist = room.waitlist ?? []
  const maxPlayers = room.limits?.maxPlayers ?? 5
  const almostFull = !isParty && maxPlayers > 0 && playing.length >= maxPlayers - 1
  const isFull = !isParty && maxPlayers > 0 && playing.length >= maxPlayers
  const needsUpsell = !isParty && (almostFull || isFull || waitlist.length > 0)
  const blockStart = isHost && !isParty && waitlist.length > 0
  const roundOptions = room.limits?.roundCounts ?? FREE_ROUND_OPTIONS

  useEffect(() => {
    if (isHost) void applyStoredPartyToken()
  }, [isHost])

  useEffect(() => {
    if (!needsUpsell || tvMode) return
    void trackMetric(waitlist.length > 0 ? 'waitlist_upsell_shown' : 'lobby_almost_full', room.code)
  }, [needsUpsell, waitlist.length, room.code, tvMode])

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

  async function shareBuy() {
    void trackMetric('share_buy_click', room.code)
    const text = s.buyLinkShareText.replace('{code}', room.code).replace('{url}', buyLink)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sabotext Party', text, url: buyLink })
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setBuyCopied(true)
      setTimeout(() => setBuyCopied(false), 2000)
    } catch {
      // ignore
    }
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

      {isParty && !tvMode && (
        <div className="party-banner on hide-on-tv">
          <strong>{s.partyActive}</strong>
          <p>
            {room.premiumExpiresAt
              ? `${s.partyActiveUntil} ${formatExpiry(room.premiumExpiresAt, room.language)}`
              : s.partyActive}
          </p>
        </div>
      )}

      {needsUpsell && !tvMode && (
        <div className="party-banner urgent-inline hide-on-tv">
          <p className="party-hint">
            {waitlist.length > 0
              ? s.waitlistSocial.replace('{n}', String(waitlist.length))
              : isFull
                ? s.roomFullUpsell
                : s.roomAlmostFull
                    .replace('{n}', String(playing.length))
                    .replace('{max}', String(maxPlayers))}
          </p>
          <p className="footer-note">{s.partyValueLine}</p>
          <p className="footer-note">{s.partyRoundsHint}</p>
          {firstTime && (
            <p className="party-flash">
              {s.firstPartyDeal}
              {dayWas ? ` · ${s.firstPartyWas.replace('{price}', dayWas)}` : ''}
            </p>
          )}
          <PartyBuyPanel
            s={s}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={onBuyParty}
            urgent
            primaryLabel={
              waitlist.length > 0
                ? s.unlockThenStart
                : s.unlockForEveryone
            }
            firstTime={firstTime}
            dayWas={dayWas}
            weekWas={weekWas}
          />
          <button type="button" className="btn secondary sm" onClick={() => void shareBuy()}>
            {buyCopied ? s.buyLinkCopied : s.shareBuyLink}
          </button>
          {isHost && (
            <>
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
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={localBusy}
                    onClick={() => void onUnlockParty()}
                  >
                    {s.activate}
                  </button>
                </div>
              )}
            </>
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
        <>
          {blockStart && (
            <button
              type="button"
              className="btn party"
              disabled={checkoutBusy}
              onClick={() => onBuyParty()}
            >
              {s.unlockThenStart}
            </button>
          )}
          {blockStart && (
            <p className="party-hint center">
              {s.startBlockedWaitlist.replace('{n}', String(waitlist.length))}
            </p>
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
            {blockStart ? s.needPlayers : canStart ? s.start : s.needPlayers}
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
  firstTime,
  dayWas,
  weekWas,
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
  firstTime: boolean
  dayWas?: string
  weekWas?: string
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
        partyInfo={partyInfo}
        buyDayLabel={buyDayLabel}
        buyWeekLabel={buyWeekLabel}
        checkoutBusy={checkoutBusy}
        onBuyParty={onBuyParty}
        firstTime={firstTime}
        dayWas={dayWas}
        weekWas={weekWas}
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

  return (
    <section className="phase">
      <h2>{s.voteTitle}</h2>
      {!tvMode && <p className="muted">{s.voteHint}</p>}
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
  const winner = results[0]
  const topVotes = winner?.votes ?? 0
  const tied = topVotes > 0 && results.filter((r) => r.votes === topVotes).length > 1

  useEffect(() => {
    navigator.vibrate?.([40, 30, 60])
  }, [])

  return (
    <section className="phase">
      <h2>{s.revealTitle}</h2>
      <PromptCard room={room} s={s} />
      {tied ? (
        <p className="tie-banner">{s.tieRound}</p>
      ) : (
        winner &&
        winner.votes > 0 &&
        winner.gained > 0 && (
          <div className="bubble winner-side">
            <span>
              {s.winningSabotage}: {winner.authorName}
            </span>
            <p>{winner.text}</p>
            <em>
              +{winner.gained} {s.points} · {winner.votes} {s.votes}
            </em>
          </div>
        )
      )}
      <ul className="results">
        {results.map((r) => (
          <li key={r.submissionId}>
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
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  checkoutBusy,
  onBuyParty,
  firstTime,
  dayWas,
  weekWas,
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
  firstTime: boolean
  dayWas?: string
  weekWas?: string
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
  const partyExpiringSoon =
    room.premiumTier === 'party' &&
    Boolean(room.premiumExpiresAt) &&
    (room.premiumExpiresAt as number) - Date.now() < 6 * 60 * 60 * 1000
  const showPartyOffer = partyInfo.enabled && !tvMode && (room.premiumTier !== 'party' || partyExpiringSoon)
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

      <StandingsTable room={room} playerId={playerId} s={s} />

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

      {showPartyOffer && (
        <div className="party-banner urgent-inline hide-on-tv">
          <p className="party-hint">
            {partyExpiringSoon ? s.renewPartyPitch : s.unlockAfterMatch}
          </p>
          {partyExpiringSoon && <p className="party-flash">{s.partyExpiringSoon}</p>}
          <PartyBuyPanel
            s={s}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            checkoutBusy={checkoutBusy}
            onBuyParty={(plan) => {
              void trackMetric('party_renew_click', room.code)
              onBuyParty(plan)
            }}
            urgent={partyExpiringSoon || room.premiumTier !== 'party'}
            primaryLabel={partyExpiringSoon ? s.renewParty : s.unlockPartyFrom}
            firstTime={firstTime && room.premiumTier !== 'party'}
            dayWas={dayWas}
            weekWas={weekWas}
          />
        </div>
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
          {ranked.map((p, i) => (
            <tr key={p.id} className={p.id === playerId ? 'you' : undefined}>
              <td>{i + 1}</td>
              <td>
                {p.name}
                {p.id === playerId ? ` (${s.you})` : ''}
              </td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
