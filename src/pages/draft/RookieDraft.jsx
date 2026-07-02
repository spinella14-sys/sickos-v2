import { useState, useEffect, useCallback, useRef } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import { useAuth } from '../../context/AuthContext'
import DraftHero       from '../../components/draft/DraftHero'
import DraftOrderPanel from '../../components/draft/DraftOrderPanel'
import PlayerBoard     from '../../components/draft/PlayerBoard'
import TeamPanel       from '../../components/draft/TeamPanel'
import './RookieDraft.css'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '') + '/api'

function getStoredPw() { return localStorage.getItem('adminPw') || '' }
function storePw(pw)   { localStorage.setItem('adminPw', pw) }

const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev || '—'
const getTeamLogo = (abbrev) => LOGOS[abbrev] || ''

const AUTODRAFT_COUNTDOWN = 5   // seconds before auto-pick fires

export default function RookieDraft({ currentTeam, isCommissioner }) {
  const { manager } = useAuth()
  const team = currentTeam || manager?.team_abbrev || ''

  const [draftState,   setDraftState]   = useState(null)
  const [currentPick,  setCurrentPick]  = useState(null)
  const [allPicks,     setAllPicks]     = useState([])
  const [rookies,      setRookies]      = useState([])
  const [activeRound,  setActiveRound]  = useState(1)
  const [timeLeft,     setTimeLeft]     = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [actingAs,     setActingAs]     = useState('')
  const [viewingTeam,  setViewingTeam]  = useState('')
  const [syncing,      setSyncing]      = useState(false)
  const [ownership,    setOwnership]    = useState({})

  // ── Big board + autodraft ─────────────────────────────────────────────────
  const [bigBoard,       setBigBoard]       = useState([])   // [{ sleeper_id, rank }]
  const [autodraftOn,    setAutodraftOn]    = useState(false)
  const [autoCountdown,  setAutoCountdown]  = useState(null) // null | number

  const clockRef     = useRef(null)
  const pollRef      = useRef(null)
  const autoPickRef  = useRef(null)
  const autoClockRef = useRef(null)

  // ── Fetch all draft data ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [stateRes, picksRes, rookiesRes] = await Promise.all([
        fetch(`${API}/draft/state`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/draft/picks`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/draft/rookies`).then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      const state   = stateRes?.state       || null
      const curPick = stateRes?.currentPick || null
      setDraftState(state)
      setCurrentPick(curPick)
      setAllPicks(Array.isArray(picksRes) ? picksRes : [])
      setRookies(Array.isArray(rookiesRes) ? rookiesRes : [])
      if (curPick?.round) setActiveRound(curPick.round)
    } catch (e) { console.error('Draft fetch error:', e) }
    finally { setLoading(false) }
  }, [])

  // ── Load big board for this manager ──────────────────────────────────────
  const fetchBoard = useCallback(async () => {
    if (!team) return
    try {
      const r = await fetch(`${API}/draft/bigboard/${team}`)
      if (r.ok) {
        const data = await r.json()
        setBigBoard(
          data
            .map(b => ({ sleeper_id: b.sleeper_id, rank: b.rank }))
            .sort((a,b) => a.rank - b.rank)
        )
      }
    } catch { }
  }, [team])

  // ── Ownership ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/stats/ownership-bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: ['QB','RB','WR','TE'] }),
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d && typeof d === 'object') setOwnership(d) })
      .catch(() => {})
  }, [])

  // ── Silent pool sync (commissioner) ───────────────────────────────────────
  const silentSync = useCallback(async () => {
    const pw = getStoredPw()
    if (!pw) return
    setSyncing(true)
    try {
      await fetch(`${API}/draft/admin/sync-rookies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ password: pw }),
      })
      const r = await fetch(`${API}/draft/rookies`)
      if (r.ok) setRookies(await r.json())
    } catch { } finally { setSyncing(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchBoard() }, [fetchBoard])
  useEffect(() => { if (isCommissioner) silentSync() }, [isCommissioner, silentSync])

  useEffect(() => {
    if (!viewingTeam && team) setViewingTeam(team)
    else if (!viewingTeam && TEAMS.length) setViewingTeam(TEAMS[0].abbrev)
  }, [team])

  // Poll every 15s while active
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (draftState?.status === 'active') {
      pollRef.current = setInterval(fetchAll, 15000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [draftState?.status, fetchAll])

  // ── Pick clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (clockRef.current) clearInterval(clockRef.current)
    if (!currentPick?.clock_expires_at) { setTimeLeft(null); return }
    const tick = () => setTimeLeft(
      Math.max(0, Math.floor((new Date(currentPick.clock_expires_at) - Date.now()) / 1000))
    )
    tick()
    clockRef.current = setInterval(tick, 1000)
    return () => clearInterval(clockRef.current)
  }, [currentPick?.clock_expires_at])

  // ── Autodraft countdown ───────────────────────────────────────────────────
  // Fires when it's this team's pick AND autodraft is ON
  const effectiveTeam  = isCommissioner && actingAs ? actingAs : team
  const draftIsActive  = draftState?.status === 'active'
  const isMyPick       = draftIsActive &&
                         currentPick?.current_team === effectiveTeam &&
                         currentPick?.status === 'on_clock'

  // Get top available player from big board (or fallback to NFL draft order)
  const getTopBoardPlayer = useCallback(() => {
    const availableMap = {}
    rookies.forEach(r => { availableMap[r.sleeper_id] = r })
    // Try big board order first
    for (const entry of bigBoard) {
      if (availableMap[entry.sleeper_id]) return availableMap[entry.sleeper_id]
    }
    // Fallback: first available by NFL draft pick
    return rookies[0] || null
  }, [bigBoard, rookies])

  useEffect(() => {
    // Clear previous auto-pick timers
    clearTimeout(autoPickRef.current)
    clearInterval(autoClockRef.current)
    setAutoCountdown(null)

    if (!isMyPick || !autodraftOn || submitting) return

    // Start countdown
    setAutoCountdown(AUTODRAFT_COUNTDOWN)
    autoClockRef.current = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(autoClockRef.current)
          return null
        }
        return prev - 1
      })
    }, 1000)

    // Auto-pick after countdown
    autoPickRef.current = setTimeout(async () => {
      const top = getTopBoardPlayer()
      if (top) {
        setAutoCountdown(null)
        await handlePick(top)
      }
    }, AUTODRAFT_COUNTDOWN * 1000)

    return () => {
      clearTimeout(autoPickRef.current)
      clearInterval(autoClockRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyPick, autodraftOn])

  // ── Admin action ──────────────────────────────────────────────────────────
  const adminAction = useCallback(async (endpoint, body = {}, label = 'this action') => {
    let pw = getStoredPw()
    if (!pw) { pw = window.prompt(`Commissioner password required to ${label}:`); if (!pw) return; storePw(pw) }
    setError(null)
    try {
      const r = await fetch(`${API}/draft/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ password: pw, ...body }),
      })
      const data = await r.json()
      if (!r.ok) { if (r.status === 401) localStorage.removeItem('adminPw'); throw new Error(data.error || 'Request failed') }
      await fetchAll()
      return data
    } catch (e) { setError(e.message) }
  }, [fetchAll])

  // ── Pick submission ───────────────────────────────────────────────────────
  const handlePick = useCallback(async (rookie) => {
    // Cancel any pending auto-pick
    clearTimeout(autoPickRef.current)
    clearInterval(autoClockRef.current)
    setAutoCountdown(null)

    setSubmitting(true)
    setError(null)
    const pickingTeam = isCommissioner ? (actingAs || currentPick?.current_team) : team
    let pw = isCommissioner ? getStoredPw() : undefined
    if (isCommissioner && !pw) { pw = window.prompt('Commissioner password required:'); if (!pw) { setSubmitting(false); return }; storePw(pw) }
    try {
      const r = await fetch(`${API}/draft/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw || '' },
        body: JSON.stringify({ team: pickingTeam, sleeper_id: rookie.sleeper_id, overall_pick: currentPick?.overall_pick, password: pw }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Pick failed')
      await fetchAll()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }, [isCommissioner, actingAs, currentPick, team, fetchAll])

  // ── Derived ───────────────────────────────────────────────────────────────
  const draftIsOver = draftState?.status === 'completed'
  const draftIsPre  = !draftIsActive && !draftIsOver

  // Sort rookies by big board order when available, fallback to NFL draft pick
  const sortedRookies = bigBoard.length > 0
    ? (() => {
        const boardMap = {}
        bigBoard.forEach(b => { boardMap[b.sleeper_id] = b.rank })
        return [...rookies].sort((a, b) => {
          const ar = boardMap[a.sleeper_id] ?? 9999
          const br = boardMap[b.sleeper_id] ?? 9999
          if (ar !== br) return ar - br
          return (a.nfl_draft_pick || 999) - (b.nfl_draft_pick || 999)
        })
      })()
    : rookies

  if (loading) return (
    <div className="draft-loading"><div className="draft-loading-spinner"/><span>Loading draft…</span></div>
  )

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'calc(100vh - 56px)',
      background:'var(--draft-bg)', color:'var(--draft-text)', overflow:'hidden',
      fontFamily:"'Barlow Condensed', sans-serif",
    }}>

      {/* Commissioner strip */}
      {isCommissioner && (
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, padding:'8px 16px', flexWrap:'wrap', background:'var(--draft-surface)', borderBottom:'1px solid var(--draft-border)' }}>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.18em', color:'var(--draft-amber)', marginRight:4 }}>COMMISSIONER</span>
          <select value={actingAs} onChange={e => setActingAs(e.target.value)}
            className="team-panel__select" style={{ maxWidth:240 }}>
            <option value="">Acting as self</option>
            {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.abbrev} — {t.name}</option>)}
          </select>
          {draftIsPre && (
            <button className="draft-btn" style={{ padding:'6px 20px', fontSize:12 }}
              onClick={() => { if (window.confirm('Open the 2026 Rookie Draft?')) adminAction('admin/open', {}, 'open draft') }}>
              ▶ OPEN DRAFT
            </button>
          )}
          {draftIsActive && (
            <>
              <button className="draft-btn" style={{ padding:'5px 12px', fontSize:11 }}
                onClick={() => adminAction('admin/autopick', { overall_pick: currentPick?.overall_pick }, 'autopick')}>
                ⚡ AUTOPICK
              </button>
              <button className="draft-btn draft-btn--locked" style={{ padding:'5px 12px', fontSize:11 }}
                onClick={() => { const p = window.prompt('Reset which pick # to pending?'); if (p) adminAction('admin/reset-pick', { overall_pick: parseInt(p) }, 'reset pick') }}>
                ↩ RESET PICK
              </button>
            </>
          )}
          {syncing && <span style={{ fontSize:10, color:'var(--draft-text-muted)', fontStyle:'italic' }}>Syncing pool…</span>}
        </div>
      )}

      {/* Pre-draft banner */}
      {draftIsPre && (
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0, padding:'9px 20px', background:'rgba(245,166,35,0.05)', borderBottom:'1px solid rgba(245,166,35,0.15)' }}>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.18em', padding:'3px 8px', background:'rgba(245,166,35,0.15)', color:'var(--draft-amber)', border:'1px solid rgba(245,166,35,0.3)' }}>PRE-DRAFT</span>
          <span style={{ fontSize:12, color:'var(--draft-text-muted)', letterSpacing:'0.04em' }}>
            Browse the prospect pool below — picks open when the commissioner starts the draft
          </span>
          {bigBoard.length > 0 && (
            <span style={{ fontSize:11, color:'var(--draft-amber)', fontWeight:700, marginLeft:'auto' }}>
              ✓ Big board set ({bigBoard.length} players ranked)
            </span>
          )}
        </div>
      )}

      {draftIsOver && (
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0, padding:'9px 20px', background:'rgba(39,174,96,0.05)', borderBottom:'1px solid rgba(39,174,96,0.15)' }}>
          <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', background:'rgba(39,174,96,0.15)', color:'var(--draft-green)', border:'1px solid rgba(39,174,96,0.3)' }}>COMPLETE</span>
          <span style={{ fontSize:12, color:'var(--draft-text-muted)' }}>All picks submitted</span>
        </div>
      )}

      {/* DraftHero (active only) */}
      {draftIsActive && (
        <DraftHero currentPick={currentPick} timeLeft={timeLeft} isMyPick={isMyPick}
          draftState={draftState} getTeamName={getTeamName} getTeamLogo={getTeamLogo}/>
      )}

      {/* Autodraft toggle + countdown (shown when it's your pick and draft is active) */}
      {draftIsActive && isMyPick && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, flexShrink:0,
          padding:'8px 20px', background:'rgba(245,166,35,0.08)',
          borderBottom:'1px solid rgba(245,166,35,0.2)',
        }}>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', color:'var(--draft-amber)' }}>
            🎯 YOUR PICK
          </span>
          {/* Autodraft toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none', marginLeft:'auto' }}>
            <span style={{ fontSize:11, color:'var(--draft-text-muted)', letterSpacing:'0.06em' }}>AUTODRAFT</span>
            <div
              onClick={() => setAutodraftOn(v => !v)}
              style={{
                width:36, height:20, borderRadius:10, cursor:'pointer', transition:'background 0.2s',
                background: autodraftOn ? 'var(--draft-amber)' : 'rgba(255,255,255,0.15)',
                position:'relative',
              }}
            >
              <div style={{
                position:'absolute', top:2, left: autodraftOn ? 18 : 2,
                width:16, height:16, borderRadius:'50%',
                background:'#fff', transition:'left 0.2s',
              }}/>
            </div>
          </label>
          {autodraftOn && autoCountdown !== null && (
            <span style={{ fontSize:22, fontWeight:800, color:'var(--draft-amber)', fontVariantNumeric:'tabular-nums' }}>
              Auto-picking in {autoCountdown}s
            </span>
          )}
          {autodraftOn && autoCountdown !== null && (
            <button className="draft-btn draft-btn--locked" style={{ fontSize:11, padding:'4px 10px' }}
              onClick={() => { clearTimeout(autoPickRef.current); clearInterval(autoClockRef.current); setAutoCountdown(null); setAutodraftOn(false) }}>
              CANCEL
            </button>
          )}
          {autodraftOn && autoCountdown === null && bigBoard.length > 0 && (
            <span style={{ fontSize:11, color:'var(--draft-text-muted)' }}>
              Will auto-pick from your big board
            </span>
          )}
        </div>
      )}

      {/* Autodraft toggle when not on clock */}
      {draftIsActive && !isMyPick && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, flexShrink:0,
          padding:'6px 20px', borderBottom:'1px solid var(--draft-border)',
        }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none' }}>
            <span style={{ fontSize:10, color:'var(--draft-text-muted)', letterSpacing:'0.08em' }}>AUTODRAFT WHEN ON CLOCK</span>
            <div onClick={() => setAutodraftOn(v => !v)}
              style={{ width:32, height:18, borderRadius:9, cursor:'pointer', transition:'background 0.2s',
                background: autodraftOn ? 'var(--draft-amber)' : 'rgba(255,255,255,0.12)', position:'relative' }}>
              <div style={{ position:'absolute', top:2, left: autodraftOn ? 16 : 2, width:14, height:14,
                borderRadius:'50%', background:'#fff', transition:'left 0.2s' }}/>
            </div>
          </label>
          {autodraftOn && bigBoard.length === 0 && (
            <span style={{ fontSize:10, color:'var(--draft-amber)' }}>⚠ Set your big board at Draft Central for best results</span>
          )}
          {autodraftOn && bigBoard.length > 0 && (
            <span style={{ fontSize:10, color:'var(--draft-amber)' }}>✓ Will pick from your big board ({bigBoard.length} ranked)</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, padding:'8px 16px', background:'rgba(232,69,69,0.1)', borderBottom:'1px solid var(--draft-red)', color:'var(--draft-red)', fontSize:13 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none', color:'var(--draft-red)', fontSize:18, cursor:'pointer' }}>×</button>
        </div>
      )}

      {/* Three-panel body */}
      <div className="draft-body">
        <DraftOrderPanel
          allPicks={allPicks}
          activeRound={activeRound}
          setActiveRound={setActiveRound}
          currentPickNumber={draftIsActive ? currentPick?.overall_pick : null}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
        />
        <PlayerBoard
          rookies={sortedRookies}
          allPicks={allPicks}
          currentPick={draftIsActive ? currentPick : null}
          isMyPick={isMyPick}
          submitting={submitting}
          onPick={handlePick}
          currentTeam={effectiveTeam}
          ownership={ownership}
        />
        <TeamPanel
          viewingTeam={viewingTeam || team || TEAMS[0]?.abbrev}
          setViewingTeam={setViewingTeam}
          teams={TEAMS}
          currentTeam={team}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
        />
      </div>
    </div>
  )
}
