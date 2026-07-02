import { useState, useEffect, useCallback, useRef } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import RFAHero        from '../../components/rfa/RFAHero'
import RFAPool        from '../../components/rfa/RFAPool'
import RFAMyBids      from '../../components/rfa/RFAMyBids'
import RFAMatchWindow from '../../components/rfa/RFAMatchWindow'
import './RFADraft.css'

const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()

const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
const getTeamLogo = (abbrev) => LOGOS[abbrev] || null

export default function RFADraft({ currentTeam, isCommissioner }) {
  const [rfaState,       setRfaState]      = useState(null)
  const [pool,           setPool]          = useState([])
  const [myBids,         setMyBids]        = useState([])
  const [matchWindows,   setMatchWindows]  = useState([])
  const [myTeamData,     setMyTeamData]    = useState(null)
  const [waveCloseTime,  setWaveCloseTime] = useState(null)
  const [timeLeft,       setTimeLeft]      = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [matchModal,     setMatchModal]    = useState(null)
  const [loading,        setLoading]       = useState(true)
  const clockRef = useRef(null)

  // ── Load all RFA data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [stateRes, poolRes, bidsRes, matchRes, teamRes] = await Promise.all([
        fetch(`${API}/rfa/state?season=${SEASON}`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/rfa/pool?season=${SEASON}&team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/rfa/my-bids?season=${SEASON}&team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/rfa/match-windows?season=${SEASON}&team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        // Always use /api/teams/:abbrev — the authoritative calcTeamCap source
        fetch(`${API}/teams/${currentTeam}`).then(r => r.ok ? r.json() : null),
      ])
      setRfaState(stateRes)
      setPool(Array.isArray(poolRes) ? poolRes : [])
      setMyBids(Array.isArray(bidsRes) ? bidsRes : [])
      setMatchWindows(Array.isArray(matchRes) ? matchRes : [])
      setMyTeamData(teamRes)
      // FIX: field is wave_closes_at, not wave_end_time
      setWaveCloseTime(stateRes?.wave_closes_at || null)
    } catch (e) {
      console.error('RFA load error', e)
    } finally {
      setLoading(false)
    }
  }, [currentTeam])

  useEffect(() => { load() }, [load])

  // Poll every 30s
  useEffect(() => {
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [load])

  // ── Countdown clock — recalculates from timestamp each second ────────────
  useEffect(() => {
    if (clockRef.current) clearInterval(clockRef.current)
    if (!waveCloseTime) { setTimeLeft(null); return }
    const tick = () => setTimeLeft(
      Math.max(0, Math.floor((new Date(waveCloseTime) - Date.now()) / 1000))
    )
    tick()
    clockRef.current = setInterval(tick, 1000)
    return () => clearInterval(clockRef.current)
  }, [waveCloseTime])

  const wave     = rfaState?.current_wave || 1
  const isOpen   = rfaState?.status === 'wave_open'
  const isPreRfa = rfaState?.status === 'pre_rfa'

  async function handleBidSubmit(payload) {
    const r = await fetch(`${API}/rfa/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: SEASON, team_abbrev: currentTeam, ...payload }),
    })
    if (r.ok) { setSelectedPlayer(null); await load() }
    return r
  }

  async function handleRerank(rankings) {
    await fetch(`${API}/rfa/rerank`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rankings }),
    })
    await load()
  }

  async function handleWithdraw(bidId) {
    await fetch(`${API}/rfa/bids/${bidId}`, { method: 'DELETE' })
    await load()
  }

  async function handleMatch(matchData) {
    const r = await fetch(`${API}/rfa/match/${matchData.sleeper_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_abbrev: currentTeam, season: SEASON, ...matchData }),
    })
    setMatchModal(null)
    if (r.ok) await load()
    return r
  }

  if (loading) {
    return (
      <div className="rfa-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, color: 'var(--draft-amber, #d4a843)', letterSpacing: '0.08em' }}>
          Loading RFA Draft Room…
        </div>
      </div>
    )
  }

  return (
    <div className="rfa-room">
      <RFAHero
        rfaState={rfaState}
        timeLeft={timeLeft}
        matchWindows={matchWindows}
        currentTeam={currentTeam}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
        isCommissioner={isCommissioner}
        onRefresh={load}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <RFAMyBids
          myBids={myBids}
          matchWindows={matchWindows}
          wave={wave}
          isWaveOpen={isOpen}
          currentTeam={currentTeam}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onRerank={handleRerank}
          onWithdraw={handleWithdraw}
          onMatch={(player, offer) => setMatchModal({ player, offer })}
        />

        <RFAPool
          pool={pool}
          wave={wave}
          isWaveOpen={isOpen}
          isPreRfa={isPreRfa}
          currentTeam={currentTeam}
          myBids={myBids}
          myTeamData={myTeamData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onBidSubmit={handleBidSubmit}
        />
      </div>

      {matchModal && (
        <RFAMatchWindow
          player={matchModal.player}
          offer={matchModal.offer}
          onMatch={handleMatch}
          onDecline={() => setMatchModal(null)}
          onClose={() => setMatchModal(null)}
        />
      )}
    </div>
  )
}
