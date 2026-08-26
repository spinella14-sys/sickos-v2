import { useState, useEffect, useCallback, useRef } from 'react'
import { TEAMS, LOGOS } from '../../data/league'
import RFAHero        from '../../components/rfa/RFAHero'
import RFAPool        from '../../components/rfa/RFAPool'
import RFAMyBids      from '../../components/rfa/RFAMyBids'
import RFAMatchWindow from '../../components/rfa/RFAMatchWindow'
import RFAWaveSummaryModal from '../../components/rfa/RFAWaveSummaryModal'
import DraftTradeModal from '../../components/draft/DraftTradeModal'
import TeamPanel from '../../components/draft/TeamPanel'
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
  const [waveSummary,    setWaveSummary]   = useState(null)
  const [loading,        setLoading]       = useState(true)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [viewingTeam, setViewingTeam] = useState(currentTeam)
  const [statsView, setStatsView] = useState('2026') // '2026' | '2025' -- 2026 projections is the default
  const [trendWindow, setTrendWindow] = useState('last_week') // 'last_week' | '3week' | 'season'
  const [poolStats, setPoolStats] = useState([])
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

      // Show the wave-summary popup once per new wave — tracked in
      // localStorage per-team so it doesn't repeat on every page load.
      const currentWave = stateRes?.current_wave
      if (currentWave && currentWave > 1) {
        const seenKey = `rfa_last_seen_wave_${currentTeam}`
        const lastSeen = parseInt(localStorage.getItem(seenKey) || '0')
        if (currentWave > lastSeen) {
          const closedWave = currentWave - 1
          fetch(`${API}/rfa/wave-summary?team=${currentTeam}&closedWave=${closedWave}`)
            .then(r => r.ok ? r.json() : null)
            .then(summary => {
              if (!summary) return
              setWaveSummary({
                closedWave, currentWave,
                myBids: summary.myBids || [],
                myPending: summary.myPending || [],
                leagueWins: summary.leagueWins || [],
              })
              localStorage.setItem(seenKey, String(currentWave))
            })
            .catch(() => {})
        }
      }
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

  // ── Load pool-stats (bye week, ADP, ownership trend, swappable season
  // stats) -- separate from the main load() above, since switching the
  // stats view/trend toggle shouldn't re-fetch bids/state/team data.
  const loadPoolStats = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/rfa/pool-stats?season=${SEASON}&view=${statsView}&trend=${trendWindow}`
      )
      const data = res.ok ? await res.json() : null
      setPoolStats(Array.isArray(data?.players) ? data.players : [])
    } catch (e) {
      console.error('RFA pool-stats load error', e)
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
  // pool's own fields (id, bid_count, etc.) that bid/status logic depends on.
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

  const wave     = rfaState?.current_wave || 1
  const isOpen   = rfaState?.status === 'wave_open'
  const isPreRfa = rfaState?.status === 'pre_rfa'

  async function handleBidSubmit(payload) {
    const r = await fetch(`${API}/rfa/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: SEASON, team_abbrev: currentTeam, ...payload }),
    })
    if (r.ok) {
      setSelectedPlayer(null)
      await load()
      return { success: true }
    }
    // RFABidForm's handleSubmit expects { success, error } to display a
    // real error message -- previously this returned the raw Response
    // object (.ok, not .success), so a failed submission silently showed
    // no explanation at all. Parse the real backend error message here.
    const data = await r.json().catch(() => ({}))
    return { success: false, error: data.error || 'Failed to submit bid' }
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
        onOpenTrade={() => setShowTradeModal(true)}
      />
      <DraftTradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />

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
          pool={enrichedPool}
          wave={wave}
          isWaveOpen={isOpen}
          isPreRfa={isPreRfa}
          currentTeam={currentTeam}
          statsView={statsView}
          setStatsView={setStatsView}
          trendWindow={trendWindow}
          setTrendWindow={setTrendWindow}
          myBids={myBids}
          myTeamData={myTeamData}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onBidSubmit={handleBidSubmit}
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

      {matchModal && (
        <RFAMatchWindow
          player={matchModal.player}
          offer={matchModal.offer}
          onMatch={handleMatch}
          onDecline={() => setMatchModal(null)}
          onClose={() => setMatchModal(null)}
        />
      )}

      {waveSummary && (
        <RFAWaveSummaryModal
          closedWave={waveSummary.closedWave}
          currentWave={waveSummary.currentWave}
          myBids={waveSummary.myBids}
          myPending={waveSummary.myPending}
          leagueWins={waveSummary.leagueWins}
          onClose={() => setWaveSummary(null)}
        />
      )}
    </div>
  )
}
