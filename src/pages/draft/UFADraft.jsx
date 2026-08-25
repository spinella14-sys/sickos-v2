import { useState, useEffect, useCallback, useRef } from 'react'
import UFAHero        from '../../components/ufa/UFAHero'
import UFAPlayerBoard from '../../components/ufa/UFAPlayerBoard'
import UFAMyBids      from '../../components/ufa/UFAMyBids'
import UFAWaveSummaryModal from '../../components/ufa/UFAWaveSummaryModal'
import DraftTradeModal from '../../components/draft/DraftTradeModal'
import TeamPanel from '../../components/draft/TeamPanel'
import { TEAMS, LOGOS } from '../../data/league'
import './RFADraft.css'

const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const getTeamName = (abbrev) => TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
const getTeamLogo = (abbrev) => LOGOS[abbrev] || null
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
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [waveSummary, setWaveSummary] = useState(null)
  const [viewingTeam, setViewingTeam] = useState(currentTeam)
  const [statsView, setStatsView] = useState('2026') // '2026' | '2025' -- 2026 projections is the default
  const [trendWindow, setTrendWindow] = useState('last_week') // 'last_week' | '3week' | 'season'
  const [poolStats, setPoolStats] = useState([])
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

      // Show the wave-summary popup once per new wave — tracked in
      // localStorage per-team so it doesn't repeat on every page load.
      // Mirrors RFA's exact same pattern.
      const currentWave = stateRes?.current_wave
      if (currentWave && currentWave > 1) {
        const seenKey = `ufa_last_seen_wave_${currentTeam}`
        const lastSeen = parseInt(localStorage.getItem(seenKey) || '0')
        if (currentWave > lastSeen) {
          const closedWave = currentWave - 1
          fetch(`${API}/ufa/wave-summary?team=${currentTeam}&closedWave=${closedWave}`)
            .then(r => r.ok ? r.json() : null)
            .then(summary => {
              if (!summary) return
              setWaveSummary({
                closedWave, currentWave,
                myBids: summary.myBids || [],
                leagueWins: summary.leagueWins || [],
              })
              localStorage.setItem(seenKey, String(currentWave))
            })
            .catch(() => {})
        }
      }
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

  // ── Load pool-stats (bye week, ADP, ownership trend, swappable season
  // stats) -- separate from the main load() above, since switching the
  // stats view/trend toggle shouldn't re-fetch bids/state/team data.
  const loadPoolStats = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/ufa/pool-stats?season=${SEASON}&view=${statsView}&trend=${trendWindow}`
      )
      const data = res.ok ? await res.json() : null
      setPoolStats(Array.isArray(data?.players) ? data.players : [])
    } catch (e) {
      console.error('UFA pool-stats load error', e)
    }
  }, [statsView, trendWindow])

  useEffect(() => { loadPoolStats() }, [loadPoolStats])

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

  // Merge pool-stats (bye week, ADP, ownership, view-swappable stat line)
  // onto the existing pool by sleeper_id -- additive only, never touches
  // pool's own fields (id, status, etc.) that bid logic depends on.
  const statsBySleeperId = {}
  ;(poolStats || []).forEach(p => { statsBySleeperId[p.sleeper_id] = p })
  const enrichedPool = pool.map(p => {
    const s = statsBySleeperId[p.sleeper_id]
    return s ? {
      ...p,
      bye_week: s.bye_week,
      adp_dynasty_2qb: s.adp_dynasty_2qb,
      owned_pct: s.owned_pct,
      owned_trend: s.owned_trend,
      stats: s.stats,
    } : p
  })

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
        onOpenTrade={() => setShowTradeModal(true)}
      />
      <DraftTradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <UFAMyBids
          myBids={myBids}
          wave={wave}
          isWaveOpen={isOpen}
          onRerank={handleRerank}
          onWithdraw={handleWithdraw}
        />

        <UFAPlayerBoard
          players={enrichedPool}
          wave={wave}
          tier={tier}
          isWaveOpen={isOpen}
          isPreUFA={isPreUFA}
          currentTeam={currentTeam}
          statsView={statsView}
          setStatsView={setStatsView}
          trendWindow={trendWindow}
          setTrendWindow={setTrendWindow}
          myBids={myBids}
          myCapData={myCapData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onBidSubmit={handleBidSubmit}
          bidsRemaining={bidsRemaining}
        />

        <TeamPanel
          viewingTeam={viewingTeam || currentTeam}
          setViewingTeam={setViewingTeam}
          teams={TEAMS}
          currentTeam={currentTeam}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          showDraftPicks={false}
        />
      </div>

      {waveSummary && (
        <UFAWaveSummaryModal
          closedWave={waveSummary.closedWave}
          currentWave={waveSummary.currentWave}
          myBids={waveSummary.myBids}
          leagueWins={waveSummary.leagueWins}
          onClose={() => setWaveSummary(null)}
        />
      )}
    </div>
  )
}
