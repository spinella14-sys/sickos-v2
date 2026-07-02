import { useState, useEffect, useCallback, useRef } from 'react'
import UFAHero        from '../../components/ufa/UFAHero'
import UFAPlayerBoard from '../../components/ufa/UFAPlayerBoard'
import UFAMyBids      from '../../components/ufa/UFAMyBids'
import './RFADraft.css'

const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const MAX_BIDS_PER_WAVE = 3

export default function UFADraft({ currentTeam, isCommissioner }) {
  const [ufaState,       setUfaState]       = useState(null)
  const [pool,           setPool]           = useState([])
  const [myBids,         setMyBids]         = useState([])
  const [myCapData,      setMyCapData]      = useState(null)
  const [waveCloseTime,  setWaveCloseTime]  = useState(null)
  const [timeLeft,       setTimeLeft]       = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [loading,        setLoading]        = useState(true)
  const clockRef = useRef(null)

  // ── Load all UFA data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [stateRes, poolRes, bidsRes, teamRes] = await Promise.all([
        fetch(`${API}/ufa/state?season=${SEASON}`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/ufa/pool?season=${SEASON}&team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/ufa/my-bids?season=${SEASON}&team=${currentTeam}`).then(r => r.ok ? r.json() : []),
        // Always use /api/teams/:abbrev — the authoritative calcTeamCap source
        fetch(`${API}/teams/${currentTeam}`).then(r => r.ok ? r.json() : null),
      ])
      setUfaState(stateRes)
      setPool(Array.isArray(poolRes) ? poolRes : [])
      setMyBids(Array.isArray(bidsRes) ? bidsRes : [])
      setMyCapData(teamRes)
      // FIX: field is wave_closes_at, not wave_end_time
      setWaveCloseTime(stateRes?.wave_closes_at || null)
    } catch (e) {
      console.error('UFA load error', e)
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

  const wave          = ufaState?.current_wave || 1
  const tier          = ufaState?.current_tier || 1
  const isOpen        = ufaState?.status === 'wave_open'
  const isPreUFA      = ufaState?.status === 'pre_ufa'
  const bidsThisWave  = myBids.filter(b => b.wave === wave).length
  const bidsRemaining = Math.max(0, MAX_BIDS_PER_WAVE - bidsThisWave)

  async function handleBidSubmit(payload) {
    const r = await fetch(`${API}/ufa/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: SEASON, team_abbrev: currentTeam, ...payload }),
    })
    if (r.ok) { setSelectedPlayer(null); await load() }
    return r
  }

  async function handleRerank(rankings) {
    await fetch(`${API}/ufa/rerank`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rankings }),
    })
    await load()
  }

  async function handleWithdraw(bidId) {
    await fetch(`${API}/ufa/bids/${bidId}`, { method: 'DELETE' })
    await load()
  }

  if (loading) {
    return (
      <div className="rfa-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, color: 'var(--draft-amber, #d4a843)', letterSpacing: '0.08em' }}>
          Loading UFA Draft Room…
        </div>
      </div>
    )
  }

  return (
    <div className="rfa-room">
      <UFAHero
        ufaState={ufaState}
        timeLeft={timeLeft}
        currentTeam={currentTeam}
        bidsThisWave={bidsThisWave}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <UFAMyBids
          myBids={myBids}
          wave={wave}
          isWaveOpen={isOpen}
          onRerank={handleRerank}
          onWithdraw={handleWithdraw}
        />

        <UFAPlayerBoard
          players={pool}
          wave={wave}
          tier={tier}
          isWaveOpen={isOpen}
          isPreUFA={isPreUFA}
          currentTeam={currentTeam}
          myBids={myBids}
          myCapData={myCapData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onBidSubmit={handleBidSubmit}
          bidsRemaining={bidsRemaining}
        />
      </div>
    </div>
  )
}
