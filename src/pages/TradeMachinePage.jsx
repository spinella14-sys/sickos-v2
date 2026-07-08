import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { TEAMS, LOGOS } from '../data/league'
import { getSeasonConsts } from '../utils/contractCalc'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './TradeMachinePage.css'

const API    = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }
const CONSTS = getSeasonConsts(SEASON)

// ─── useTeamAssets ─────────────────────────────────────────────────────────
function useTeamAssets(abbrev, onCapLoaded, slot) {
  const [roster,  setRoster]  = useState([])
  const [picks,   setPicks]   = useState([])
  const [sbBal,   setSbBal]   = useState(0)
  const [stats,   setStats]   = useState({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!abbrev) { onCapLoaded && onCapLoaded(slot, 0, []); return }
    setLoading(true)
    const [rData, pData, sbData, stData] = await Promise.all([
      fetch(`${API}/teams/${abbrev}`).then(r=>r.ok?r.json():null),
      fetch(`${API}/draft-picks?team=${abbrev}&available_only=true`).then(r=>r.ok?r.json():[]),
      fetch(`${API}/bids/sb-balances?season=${SEASON}`).then(r=>r.ok?r.json():{}),
      fetch(`${API}/stats/season?season=${SEASON}&limit=500`).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ])
    const newRoster = rData?.roster || []
    setRoster(newRoster)
    setPicks(pData || [])
    setSbBal(sbData?.[abbrev] ?? 0)
    const sl = {}
    ;(stData||[]).forEach(s => { sl[s.sleeper_id] = s })
    setStats(sl)
    setLoading(false)
    const cap = newRoster.reduce((s,r)=>s+calcCapHit(r),0)
    onCapLoaded && onCapLoaded(slot, parseFloat(cap.toFixed(2)), newRoster)
  }, [abbrev, slot])

  useEffect(() => { load() }, [load])
  return { roster, picks, sbBal, stats, loading, reload: load }
}

// ─── Cap calc ──────────────────────────────────────────────────────────────
function calcCapHit(contract) {
  const sal      = parseFloat(contract.salary||0)
  const slotType = contract.roster_slots?.[0]?.slot_type||'active'
  let hit = sal
  if (slotType==='ps'||slotType==='ir') hit*=0.5
  if (contract.is_max_contract) hit*=0.8
  return parseFloat(hit.toFixed(2))
}

// ─── Player Card ───────────────────────────────────────────────────────────
// PlayerLink wraps the name — stopPropagation so opening the card
// doesn't also toggle the trade selection.
function PlayerCard({ contract, stats, inTrade, onToggle }) {
  const p   = contract.players || {}
  const s   = stats[p.sleeper_id] || {}
  const ppg = s.pts_per_game ? parseFloat(s.pts_per_game).toFixed(1) : '—'
  const own = s.percent_owned != null ? parseFloat(s.percent_owned).toFixed(0) + '%' : '—'
  const rfa = contract.rfa_round ? `RFA ${contract.rfa_round===1?'1st':'2nd'}` : 'UFA'

  const currentYrRow = (contract.contract_years||[]).find(cy => cy.season === SEASON)
  const isNG = currentYrRow
    ? (currentYrRow.is_guaranteed === false || currentYrRow.is_guaranteed === 0)
    : false

  return (
    <div
      className={`tm-player-card ${inTrade?'tm-player-card--selected':''}`}
      onClick={onToggle}
    >
      <img
        src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
        alt="" className="tm-pc-shot"
        onError={e=>e.target.style.opacity=0}
      />
      <div className="tm-pc-info">
        {/* PlayerLink — click opens player card, stopPropagation prevents trade toggle */}
        <PlayerLink
          playerId={p.sleeper_id}
          className="tm-pc-name"
          onClick={e => e.stopPropagation()}
          style={{ textDecoration:'none', color:'inherit', cursor:'pointer' }}
        >
          {p.full_name}
        </PlayerLink>
        <div className="tm-pc-meta">
          <span style={{color:POS_COLOR[p.position]}}>{p.position}</span>
          <span className="tm-pc-nfl">{p.nfl_team}</span>
          {p.injury_status && <span className="tm-pc-inj">{p.injury_status}</span>}
        </div>
      </div>
      <div className="tm-pc-stats">
        <div className="tm-pc-sal" style={isNG?{color:'var(--purple)'}:{}}>
          ${parseFloat(contract.salary).toFixed(2)}
        </div>
        <div className="tm-pc-detail">{contract.years}yr · {rfa}</div>
      </div>
      <div className="tm-pc-pts">
        <div className="tm-pc-ppg">{ppg}</div>
        <div className="tm-pc-rank">{own}</div>
      </div>
      <div className="tm-pc-toggle">{inTrade?'✓':'+'}</div>
    </div>
  )
}

// ─── Pick Card ─────────────────────────────────────────────────────────────
function PickCard({ pick, inTrade, onToggle }) {
  const label   = `${pick.season} R${pick.round} (${pick.original_team_abbrev})`
  const isOwned = pick.original_team_abbrev !== pick.current_owner_abbrev
  const valStr  = pick.cap_value ? `$${parseFloat(pick.cap_value).toFixed(2)}` : '$TBD'

  return (
    <div className={`tm-pick-card ${inTrade?'tm-pick-card--selected':''}`} onClick={onToggle}>
      <div className="tm-pick-icon">🏈</div>
      <div className="tm-pick-info">
        <div className="tm-pick-label">{label}</div>
        {isOwned && <div className="tm-pick-via">via {pick.original_team_abbrev}</div>}
      </div>
      <div className={`tm-pick-val ${!pick.cap_value?'tm-pick-tbd':''}`}>{valStr}</div>
      <div className="tm-pc-toggle">{inTrade?'✓':'+'}</div>
    </div>
  )
}

// ─── Team Panel ────────────────────────────────────────────────────────────
function TeamPanel({ slot, selectedTeam, onSelectTeam, tradingPlayers, tradingPicks, tradingSb,
  onTogglePlayer, onTogglePick, onSbChange, posFilter, otherTeams, allTeams, threeWay,
  onCapLoaded, projectedCap, sendTo, onSetSendTo, activeSlots }) {

  const colors = useTeamColors(selectedTeam ? LOGOS[selectedTeam] : null)
  const { roster, picks, sbBal, stats, loading } = useTeamAssets(selectedTeam, onCapLoaded, slot)

  const filteredRoster = useMemo(()=>{
    if (posFilter==='ALL') return roster
    return roster.filter(r=>r.players?.position===posFilter)
  },[roster,posFilter])

  const currentCap  = roster.reduce((s,r)=>s+calcCapHit(r),0)
  const displayCap  = (projectedCap !== null && projectedCap !== undefined) ? projectedCap : currentCap
  const capSpace    = parseFloat((CONSTS.hardCap - displayCap).toFixed(2))
  const isOver      = displayCap > CONSTS.hardCap
  const capChanged  = Math.abs(displayCap - currentCap) > 0.01
  const otherSlots  = activeSlots.filter(s => s !== slot)

  return (
    <div className="tm-panel" style={colors ? {
      '--tp-primary': colors.primary, '--tp-accent': colors.accent,
      '--tp-dim': colors.dim, '--tp-text': colors.text,
    } : {}}>
      <div className="tm-panel-header" style={{background:colors?.primary||'var(--bg2)'}}>
        <div className="tm-panel-header-left">
          {selectedTeam && <img src={LOGOS[selectedTeam]} alt="" className="tm-panel-logo"
            style={{filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.4))'}}/>}
          <select className="tm-team-select" value={selectedTeam||''}
            onChange={e=>onSelectTeam(e.target.value||null)}
            style={{color:colors?.text||'var(--text-primary)'}}>
            <option value="">Select team…</option>
            {TEAMS.filter(t=>!otherTeams.includes(t.abbrev)||t.abbrev===selectedTeam)
              .map(t=><option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
          </select>
        </div>
        {selectedTeam && (
          <div className="tm-panel-cap" style={{color:colors?.text}}>
            <div className="tm-panel-cap-row">
              <span className={`tm-panel-cap-val ${isOver?'tm-cap-over-text':''}`}>
                ${displayCap.toFixed(2)}
              </span>
              {capChanged && (
                <span className={`tm-panel-cap-delta ${displayCap>currentCap?'tm-delta-up':'tm-delta-down'}`}>
                  {displayCap > currentCap ? '▲' : '▼'} ${Math.abs(displayCap-currentCap).toFixed(2)}
                </span>
              )}
            </div>
            <div className="tm-panel-space-row">
              <span className={`tm-cap-space ${isOver?'tm-space-over':capSpace<10?'tm-space-warn':'tm-space-ok'}`}>
                {isOver ? `$${Math.abs(capSpace).toFixed(2)} OVER CAP` : `$${capSpace.toFixed(2)} cap space`}
              </span>
            </div>
          </div>
        )}
      </div>

      {!selectedTeam ? (
        <div className="tm-panel-empty">Select a team to view their assets</div>
      ) : loading ? (
        <div className="tm-panel-empty">Loading…</div>
      ) : (
        <div className="tm-panel-body">
          {/* Sending zone */}
          {(tradingPlayers.length > 0 || tradingPicks.length > 0 || tradingSb > 0) && (
            <div className="tm-sending-zone">
              <div className="tm-section-label tm-sending-label">SENDING</div>
              {tradingPlayers.map(c => {
                const key = `p_${c.id}`
                const dest = sendTo[key]
                return (
                  <div key={c.id} className="tm-sending-item">
                    <span style={{color:POS_COLOR[c.players?.position],fontSize:10,fontWeight:800}}>{c.players?.position}</span>
                    <span className="tm-sending-name">{c.players?.full_name}</span>
                    <span className="tm-sending-sal">${parseFloat(c.salary).toFixed(2)}</span>
                    {threeWay && (
                      <div className="tm-dest-btns">
                        {otherSlots.map(os => (
                          <button key={os}
                            className={`tm-dest-btn ${dest===os?'tm-dest-btn--active':''}`}
                            onClick={e=>{e.stopPropagation(); onSetSendTo(key, os)}}>
                            → {allTeams[os] || `Team ${os+1}`}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="tm-sending-remove" onClick={()=>onTogglePlayer(slot,c)}>✕</span>
                  </div>
                )
              })}
              {tradingPicks.map(p => {
                const key = `pk_${p.id}`
                const dest = sendTo[key]
                return (
                  <div key={p.id} className="tm-sending-item">
                    <span>🏈</span>
                    <span className="tm-sending-name">{p.season} R{p.round} ({p.original_team_abbrev})</span>
                    <span className="tm-sending-sal">{p.cap_value ? `$${parseFloat(p.cap_value).toFixed(2)}` : '$TBD'}</span>
                    {threeWay && (
                      <div className="tm-dest-btns">
                        {otherSlots.map(os => (
                          <button key={os}
                            className={`tm-dest-btn ${dest===os?'tm-dest-btn--active':''}`}
                            onClick={e=>{e.stopPropagation(); onSetSendTo(key, os)}}>
                            → {allTeams[os] || `Team ${os+1}`}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="tm-sending-remove" onClick={()=>onTogglePick(slot,p)}>✕</span>
                  </div>
                )
              })}
              {tradingSb > 0 && (
                <div className="tm-sending-item">
                  <span>💰</span>
                  <span className="tm-sending-name">Signing Bonus Budget</span>
                  <span className="tm-sending-sal">${tradingSb.toFixed(2)}</span>
                  {threeWay && (
                    <div className="tm-dest-btns">
                      {otherSlots.map(os => (
                        <button key={os}
                          className={`tm-dest-btn ${sendTo[`sb_${slot}`]===os?'tm-dest-btn--active':''}`}
                          onClick={e=>{e.stopPropagation(); onSetSendTo(`sb_${slot}`, os)}}>
                          → {allTeams[os] || `Team ${os+1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="tm-section-label">ROSTER</div>
          <div className="tm-roster-list">
            {filteredRoster.map(c=>(
              <PlayerCard key={c.id} contract={c} stats={stats}
                inTrade={tradingPlayers.some(p=>p.id===c.id)}
                onToggle={()=>onTogglePlayer(slot,c)}/>
            ))}
          </div>

          {picks.length > 0 && <>
            <div className="tm-section-label">DRAFT PICKS</div>
            <div className="tm-picks-list">
              {picks.map(p=>(
                <PickCard key={p.id} pick={p}
                  inTrade={tradingPicks.some(tp=>tp.id===p.id)}
                  onToggle={()=>onTogglePick(slot,p)}/>
              ))}
            </div>
          </>}

          <div className="tm-section-label">SIGNING BONUS BUDGET</div>
          <div className="tm-sb-row">
            <span className="tm-sb-bal">Available: ${sbBal.toFixed(2)}</span>
            <div className="tm-sb-input-wrap">
              <span>Include $</span>
              <input className="tm-sb-input" type="number" step="0.10" min="0" max={sbBal}
                placeholder="0.00" value={tradingSb||''}
                onChange={e=>onSbChange(slot, Math.min(parseFloat(e.target.value)||0, sbBal))}/>
              <span>in trade</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
// ── Trade Review Modal ────────────────────────────────────────────────────────
// Fanspo-style two-panel trade review. Shows what each team sends/receives
// with headshots, salary, cap impact, and action buttons.
const API_BASE_TRM = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function TradeReviewModal({ trade, myTeam, onClose, onAccept, onDecline, onCancel, isAdmin, onAdminProcess }) {
  const [rosterData, setRosterData] = React.useState({})

  React.useEffect(() => {
    if (!trade) return
    const teams = [...new Set(trade.trade_teams?.map(t => t.team_abbrev) || [])]
    Promise.all(teams.map(abbrev =>
      fetch(`${API_BASE_TRM}/teams/${abbrev}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )).then(results => {
      const map = {}
      teams.forEach((abbrev, i) => { if (results[i]) map[abbrev] = results[i] })
      setRosterData(map)
    })
  }, [trade?.id])

  if (!trade) return null

  const myTT       = trade.trade_teams?.find(t => t.team_abbrev === myTeam)
  const needsAction = (trade.status === 'pending' || trade.status === 'proposed') && myTT && !myTT.has_accepted
  const iProposed  = trade.proposed_by === myTeam
  const canCancel  = iProposed && (trade.status === 'pending' || trade.status === 'proposed')
  const isAdminPending = isAdmin && trade.status === 'pending_admin'

  // Build salary lookup from roster data
  const salaryMap = {}
  Object.values(rosterData).forEach(td => {
    ;(td.roster || []).forEach(c => {
      const sid = c.players?.sleeper_id || c.sleeper_id
      if (sid) salaryMap[sid] = { salary: parseFloat(c.salary || 0), years: c.years, position: c.players?.position }
    })
  })

  // Cap impact per team
  const capImpact = {}
  trade.trade_teams?.forEach(tt => { capImpact[tt.team_abbrev] = 0 })
  trade.trade_assets?.forEach(a => {
    const sal = parseFloat(a.salary || salaryMap[a.sleeper_id]?.salary || 0)
    if (sal) {
      if (capImpact[a.from_team] !== undefined) capImpact[a.from_team] -= sal
      if (capImpact[a.to_team]   !== undefined) capImpact[a.to_team]   += sal
    }
  })

  const teams = trade.trade_teams || []

  return (
    <div className="trm-backdrop" onClick={onClose}>
      <div className="trm-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="trm-header">
          <div className="trm-header-left">
            <span className="trm-title">Trade Review</span>
            <span className="trm-teams">{teams.map(t => t.team_abbrev).join(' ↔ ')}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{
              fontFamily:'var(--font-ui)', fontSize:11, fontWeight:800,
              color: trade.status === 'pending' || trade.status === 'proposed' ? 'var(--gold)' :
                     trade.status === 'pending_admin' ? 'var(--orange)' :
                     trade.status === 'approved' ? 'var(--green)' : 'var(--red)',
            }}>
              {trade.status === 'pending' || trade.status === 'proposed' ? 'PENDING' :
               trade.status === 'pending_admin' ? 'AWAITING COMMISSIONER' :
               trade.status === 'approved' ? 'APPROVED ✓' :
               trade.status === 'declined' || trade.status === 'denied' ? 'DECLINED ✗' : trade.status.toUpperCase()}
            </span>
            <button className="trm-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="trm-panels">
          {teams.map(tt => {
            const abbrev    = tt.team_abbrev
            const teamInfo  = rosterData[abbrev]
            const receives  = trade.trade_assets?.filter(a => a.to_team === abbrev) || []
            const sends     = trade.trade_assets?.filter(a => a.from_team === abbrev) || []
            const impact    = capImpact[abbrev] || 0
            const capBefore = parseFloat(teamInfo?.cap_used || 0)
            const capSpace  = parseFloat(teamInfo?.cap_space || 0)
            const capAfter  = capBefore + impact
            const sign      = impact >= 0 ? '+' : ''
            const impColor  = impact > 0 ? 'var(--red,#d94f4f)' : impact < 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)'
            const accepted  = tt.has_accepted

            return (
              <div key={abbrev} className="trm-panel">
                {/* Team header */}
                <div className="trm-panel-header">
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {LOGOS[abbrev] && <img src={LOGOS[abbrev]} alt={abbrev} className="trm-team-logo"/>}
                    <div>
                      <div className="trm-team-name">
                        {TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev}
                        {accepted && <span className="trm-accepted-badge">✓ Accepted</span>}
                      </div>
                      <div style={{fontFamily:'var(--font-ui)',fontSize:11,color:impColor,fontWeight:700}}>
                        {sign}${Math.abs(impact).toFixed(2)} cap impact
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sends section */}
                {sends.length > 0 && (
                  <div className="trm-section">
                    <div className="trm-section-label">Sends</div>
                    {sends.map((a, i) => {
                      const contractInfo = salaryMap[a.sleeper_id]
                      const sal  = parseFloat(a.salary || contractInfo?.salary || 0)
                      const yrs  = a.years || contractInfo?.years
                      const pos  = contractInfo?.position
                      return (
                        <div key={i} className="trm-asset-row">
                          {a.asset_type === 'player' && <>
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${a.sleeper_id}.jpg`}
                              alt="" className="trm-headshot"
                              onError={e => e.target.style.opacity = 0}
                            />
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">{a.player_name || a.sleeper_id}</div>
                              <div className="trm-asset-meta">
                                {pos && <span className="trm-pos">{pos}</span>}
                                {sal > 0 && <span>${sal.toFixed(2)}</span>}
                                {yrs && <span>{yrs}yr</span>}
                              </div>
                            </div>
                            <div className="trm-asset-to">→ {a.to_team}</div>
                          </>}
                          {a.asset_type === 'pick' && <>
                            <div className="trm-pick-icon">🏈</div>
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">{a.pick_label || 'Draft Pick'}</div>
                              {a.cap_value && <div className="trm-asset-meta">${parseFloat(a.cap_value).toFixed(2)} cap value</div>}
                            </div>
                            <div className="trm-asset-to">→ {a.to_team}</div>
                          </>}
                          {a.asset_type === 'sb_budget' && <>
                            <div className="trm-pick-icon">💰</div>
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">${parseFloat(a.sb_amount).toFixed(2)} SB Budget</div>
                            </div>
                            <div className="trm-asset-to">→ {a.to_team}</div>
                          </>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Receives section */}
                {receives.length > 0 && (
                  <div className="trm-section">
                    <div className="trm-section-label trm-section-label--receives">Receives</div>
                    {receives.map((a, i) => {
                      const contractInfo = salaryMap[a.sleeper_id]
                      const sal = parseFloat(a.salary || contractInfo?.salary || 0)
                      const yrs = a.years || contractInfo?.years
                      const pos = contractInfo?.position
                      return (
                        <div key={i} className="trm-asset-row trm-asset-row--receives">
                          {a.asset_type === 'player' && <>
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${a.sleeper_id}.jpg`}
                              alt="" className="trm-headshot"
                              onError={e => e.target.style.opacity = 0}
                            />
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">{a.player_name || a.sleeper_id}</div>
                              <div className="trm-asset-meta">
                                {pos && <span className="trm-pos">{pos}</span>}
                                {sal > 0 && <span>${sal.toFixed(2)}</span>}
                                {yrs && <span>{yrs}yr</span>}
                              </div>
                            </div>
                          </>}
                          {a.asset_type === 'pick' && <>
                            <div className="trm-pick-icon">🏈</div>
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">{a.pick_label || 'Draft Pick'}</div>
                            </div>
                          </>}
                          {a.asset_type === 'sb_budget' && <>
                            <div className="trm-pick-icon">💰</div>
                            <div className="trm-asset-info">
                              <div className="trm-asset-name">${parseFloat(a.sb_amount).toFixed(2)} SB Budget</div>
                            </div>
                          </>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Financial summary */}
                <div className="trm-financials">
                  <div className="trm-fin-row">
                    <span>Cap Before</span>
                    <span>${capBefore.toFixed(2)}</span>
                  </div>
                  <div className="trm-fin-row">
                    <span>Cap After</span>
                    <span style={{color: capAfter > 138 ? 'var(--red)' : 'var(--text-primary)', fontWeight:700}}>
                      ${capAfter.toFixed(2)}
                    </span>
                  </div>
                  <div className="trm-fin-row">
                    <span>Space Remaining</span>
                    <span style={{color: (138 - capAfter) < 0 ? 'var(--red)' : 'var(--green,#3dba6e)', fontWeight:700}}>
                      ${Math.max(0, 138 - capAfter).toFixed(2)}
                    </span>
                  </div>
                  {impact !== 0 && (
                    <div className="trm-fin-row">
                      <span>Net Cap Change</span>
                      <span style={{color: impColor, fontWeight:700}}>{sign}${Math.abs(impact).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        {trade.notes && (
          <div className="trm-notes">"{trade.notes}"</div>
        )}
        <div className="trm-actions">
          {needsAction && <>
            <button className="trm-btn trm-btn--accept" onClick={() => { onAccept(trade.id); onClose() }}>Accept Trade</button>
            <button className="trm-btn trm-btn--counter"
              onClick={() => { onClose(); window.location.href = `/trade?counter=${trade.id}&teams=${trade.trade_teams?.map(t=>t.team_abbrev).join(',')}` }}>
              Counter
            </button>
            <button className="trm-btn trm-btn--decline" onClick={() => { onDecline(trade.id); onClose() }}>Decline</button>
          </>}
          {canCancel && !needsAction && (
            <button className="trm-btn trm-btn--decline" onClick={() => { onCancel(trade.id); onClose() }}>Cancel Proposal</button>
          )}
          {isAdminPending && <>
            <button className="trm-btn trm-btn--accept" onClick={() => { onAdminProcess(trade.id,'approve'); onClose() }}>Approve & Execute</button>
            <button className="trm-btn trm-btn--decline" onClick={() => { onAdminProcess(trade.id,'deny'); onClose() }}>Deny</button>
          </>}
          <button className="trm-btn trm-btn--cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Trade Chat Sidebar ────────────────────────────────────────────────────────
// Shows the live conversation with the team(s) being traded with.
// Uses the same /api/conversations endpoint as the inbox.
const API_BASE_TM = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function TradeChatSidebar({ myTeam, otherTeams }) {
  const [convId,   setConvId]   = React.useState(null)
  const [messages, setMessages] = React.useState([])
  const [input,    setInput]    = React.useState('')
  const [loading,  setLoading]  = React.useState(false)
  const endRef = React.useRef(null)

  React.useEffect(() => {
    if (!myTeam || !otherTeams?.length) { setConvId(null); setMessages([]); return }
    // Find or create conversation with these teams
    fetch(`${API_BASE_TM}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': myTeam },
      body: JSON.stringify({ participants: otherTeams }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setConvId(d.id) })
      .catch(() => {})
  }, [myTeam, otherTeams?.join(',')])

  React.useEffect(() => {
    if (!convId || !myTeam) return
    const load = () => {
      fetch(`${API_BASE_TM}/conversations/${convId}/messages`, {
        headers: { 'x-team-abbrev': myTeam }
      }).then(r => r.ok ? r.json() : []).then(setMessages).catch(() => {})
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [convId, myTeam])

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || !convId || !myTeam) return
    await fetch(`${API_BASE_TM}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-team-abbrev': myTeam },
      body: JSON.stringify({ body: input.trim() }),
    })
    setInput('')
    fetch(`${API_BASE_TM}/conversations/${convId}/messages`, {
      headers: { 'x-team-abbrev': myTeam }
    }).then(r => r.ok ? r.json() : []).then(setMessages).catch(() => {})
  }

  if (!otherTeams?.length) return (
    <div className="tm-sidebar-placeholder">
      <div className="tm-sidebar-icon">💬</div>
      <div className="tm-sidebar-msg">Select a team to start chatting</div>
    </div>
  )

  return (
    <div className="tm-chat-live">
      <div className="tm-chat-messages">
        {messages.length === 0 && (
          <div className="tm-chat-empty">No messages yet. Start the conversation.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`tm-chat-bubble ${m.sender_team === myTeam ? 'tm-chat-bubble--me' : 'tm-chat-bubble--them'}`}>
            {m.sender_team !== myTeam && (
              <div className="tm-chat-sender">{m.sender_team}</div>
            )}
            <div className="tm-chat-text">{m.body}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="tm-chat-input-row">
        <input
          className="tm-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
        />
        <button className="tm-chat-send" onClick={send} disabled={!input.trim()}>↑</button>
      </div>
    </div>
  )
}

// ── Confirm Trade Modal ────────────────────────────────────────────────────────
function ConfirmTradeModal({ teams, assets, notes, onConfirm, onCancel, submitting }) {
  const playerAssets = assets.filter(a => a.asset_type === 'player')
  const pickAssets   = assets.filter(a => a.asset_type === 'pick')
  const sbAssets     = assets.filter(a => a.asset_type === 'sb_budget')

  // Salary impact per team: positive = gaining cap, negative = losing cap
  const salaryImpact = {}
  teams.forEach(t => { if (t) salaryImpact[t] = 0 })
  playerAssets.forEach(a => {
    if (a.salary) {
      if (salaryImpact[a.from_team] !== undefined) salaryImpact[a.from_team] -= a.salary
      if (salaryImpact[a.to_team]   !== undefined) salaryImpact[a.to_team]   += a.salary
    }
  })

  return (
    <div className="tm-confirm-backdrop" onClick={onCancel}>
      <div className="tm-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="tm-confirm-header">
          <span className="tm-confirm-title">Confirm Trade Proposal</span>
          <button className="tm-confirm-close" onClick={onCancel}>✕</button>
        </div>
        <div className="tm-confirm-body">

          {/* Team badges with salary impact */}
          <div className="tm-confirm-teams">
            {teams.map((t, i) => {
              if (!t) return null
              const impact = salaryImpact[t] || 0
              const sign   = impact > 0 ? '+' : ''
              const color  = impact > 0 ? 'var(--red,#d94f4f)' : impact < 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)'
              return (
                <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <span className="tm-confirm-team-badge">{t}</span>
                  {impact !== 0 && (
                    <span style={{fontFamily:'var(--font-ui)',fontSize:10,fontWeight:700,color}}>
                      {sign}${Math.abs(impact).toFixed(2)} cap
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {playerAssets.length > 0 && (
            <div className="tm-confirm-section">
              <div className="tm-confirm-section-label">Players</div>
              {playerAssets.map((a, i) => (
                <div key={i} className="tm-confirm-asset">
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    <span className="tm-confirm-asset-name">{a.player_name || a.sleeper_id}</span>
                    {a.salary && <span style={{fontFamily:'var(--font-ui)',fontSize:10,color:'var(--text-muted)'}}>
                      ${a.salary.toFixed(2)}{a.years ? ` · ${a.years}yr` : ''}
                    </span>}
                  </div>
                  <span className="tm-confirm-asset-move">{a.from_team} → {a.to_team}</span>
                </div>
              ))}
            </div>
          )}

          {pickAssets.length > 0 && (
            <div className="tm-confirm-section">
              <div className="tm-confirm-section-label">Picks</div>
              {pickAssets.map((a, i) => (
                <div key={i} className="tm-confirm-asset">
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    <span className="tm-confirm-asset-name">{a.pick_label || 'Pick'}</span>
                    {a.cap_value && <span style={{fontFamily:'var(--font-ui)',fontSize:10,color:'var(--text-muted)'}}>
                      ${parseFloat(a.cap_value).toFixed(2)} cap value
                    </span>}
                  </div>
                  <span className="tm-confirm-asset-move">{a.from_team} → {a.to_team}</span>
                </div>
              ))}
            </div>
          )}

          {sbAssets.length > 0 && (
            <div className="tm-confirm-section">
              <div className="tm-confirm-section-label">Signing Bonus Budget</div>
              {sbAssets.map((a, i) => (
                <div key={i} className="tm-confirm-asset">
                  <span className="tm-confirm-asset-name">${parseFloat(a.sb_amount).toFixed(2)}</span>
                  <span className="tm-confirm-asset-move">{a.from_team} → {a.to_team}</span>
                </div>
              ))}
            </div>
          )}

          {notes && (
            <div className="tm-confirm-section">
              <div className="tm-confirm-section-label">Note</div>
              <div className="tm-confirm-notes">{notes}</div>
            </div>
          )}
          <p className="tm-confirm-warning">
            Once submitted, all parties must accept before it goes to the commissioner for approval.
          </p>
        </div>
        <div className="tm-confirm-footer">
          <button className="tm-confirm-cancel" onClick={onCancel}>Go Back</button>
          <button className="tm-confirm-submit" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Proposal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TradeMachinePage() {
  const { manager, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const counterTradeId    = searchParams.get('counter')
  const counterTeamsParam = searchParams.get('teams')
  const counterThreeWay   = searchParams.get('three') === '1'

  const [threeWay,   setThreeWay]   = useState(counterThreeWay)
  const [teams,      setTeams]      = useState(() => {
    if (counterTeamsParam) {
      const arr = counterTeamsParam.split(',')
      return [arr[0]||null, arr[1]||null, arr[2]||null]
    }
    return [manager?.team_abbrev||null, null, null]
  })
  const [posFilter,  setPosFilter]  = useState('ALL')
  const [submitting,   setSubmitting]   = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [result,     setResult]     = useState(null)
  const tabParam = searchParams.get('tab')
  const [activeTab,  setActiveTab]  = useState(tabParam || 'build')
  const [trades,     setTrades]     = useState([])
  const [notes,      setNotes]      = useState('')
  const [teamCaps,   setTeamCaps]   = useState({ 0:0, 1:0, 2:0 })

  const [tradingPlayers, setTradingPlayers] = useState({ 0:[], 1:[], 2:[] })
  const [tradingPicks,   setTradingPicks]   = useState({ 0:[], 1:[], 2:[] })
  const [tradingSb,      setTradingSb]      = useState({ 0:0, 1:0, 2:0 })
  const [sendTo,         setSendTo]         = useState({})

  const activeSlots = threeWay ? [0,1,2] : [0,1]

  function handleCapLoaded(slot, cap) {
    setTeamCaps(prev => ({ ...prev, [slot]: cap }))
  }

  function handleSetSendTo(key, targetSlot) {
    setSendTo(prev => ({ ...prev, [key]: targetSlot }))
  }

  const projectedCaps = useMemo(() => {
    const proj = {}
    activeSlots.forEach(slot => {
      const outgoing = tradingPlayers[slot].reduce((s,c) => s+calcCapHit(c), 0)
      let incoming = 0
      if (!threeWay) {
        const other = slot === 0 ? 1 : 0
        incoming = tradingPlayers[other].reduce((s,c) => s+calcCapHit(c), 0)
      } else {
        activeSlots.filter(s=>s!==slot).forEach(s => {
          tradingPlayers[s].forEach(c => {
            if (sendTo[`p_${c.id}`] === slot) incoming += calcCapHit(c)
          })
        })
      }
      proj[slot] = parseFloat((teamCaps[slot] - outgoing + incoming).toFixed(2))
    })
    return proj
  }, [teamCaps, tradingPlayers, sendTo, threeWay, activeSlots])

  const capViolations = activeSlots.filter(s => projectedCaps[s] > CONSTS.hardCap && teams[s])

  function togglePlayer(slot, contract) {
    setTradingPlayers(prev => {
      const cur    = prev[slot]
      const exists = cur.some(c=>c.id===contract.id)
      return { ...prev, [slot]: exists ? cur.filter(c=>c.id!==contract.id) : [...cur, contract] }
    })
  }

  function togglePick(slot, pick) {
    setTradingPicks(prev => {
      const cur    = prev[slot]
      const exists = cur.some(p=>p.id===pick.id)
      return { ...prev, [slot]: exists ? cur.filter(p=>p.id!==pick.id) : [...cur, pick] }
    })
  }

  function setSbAmount(slot, amount) {
    setTradingSb(prev => ({ ...prev, [slot]: amount }))
  }

  function setTeamSlot(slot, abbrev) {
    setTeams(prev => { const n=[...prev]; n[slot]=abbrev||null; return n })
    setTradingPlayers(prev => ({ ...prev, [slot]:[] }))
    setTradingPicks(prev => ({ ...prev, [slot]:[] }))
    setTradingSb(prev => ({ ...prev, [slot]:0 }))
    setTeamCaps(prev => ({ ...prev, [slot]:0 }))
  }

  const assets = useMemo(() => {
    const a = []
    if (!threeWay) {
      const [t0,t1] = teams
      if (!t0||!t1) return []
      tradingPlayers[0].forEach(c=>a.push({asset_type:'player',from_team:t0,to_team:t1,sleeper_id:c.players?.sleeper_id,contract_id:c.id,player_name:c.players?.full_name||c.players?.sleeper_id,salary:parseFloat(c.salary||0),years:c.years}))
      tradingPlayers[1].forEach(c=>a.push({asset_type:'player',from_team:t1,to_team:t0,sleeper_id:c.players?.sleeper_id,contract_id:c.id,player_name:c.players?.full_name||c.players?.sleeper_id,salary:parseFloat(c.salary||0),years:c.years}))
      tradingPicks[0].forEach(p=>a.push({asset_type:'pick',from_team:t0,to_team:t1,pick_id:p.id,pick_label:`${p.season} Round ${p.round}${p.original_team_abbrev&&p.original_team_abbrev!==t0?` (via ${p.original_team_abbrev})`:''}`,cap_value:p.cap_value}))
      tradingPicks[1].forEach(p=>a.push({asset_type:'pick',from_team:t1,to_team:t0,pick_id:p.id,pick_label:`${p.season} Round ${p.round}${p.original_team_abbrev&&p.original_team_abbrev!==t1?` (via ${p.original_team_abbrev})`:''}`,cap_value:p.cap_value}))
      if(tradingSb[0]>0) a.push({asset_type:'sb_budget',from_team:t0,to_team:t1,sb_amount:tradingSb[0]})
      if(tradingSb[1]>0) a.push({asset_type:'sb_budget',from_team:t1,to_team:t0,sb_amount:tradingSb[1]})
    } else {
      activeSlots.forEach(slot => {
        const fromTeam = teams[slot]
        if (!fromTeam) return
        tradingPlayers[slot].forEach(c => {
          const toSlot = sendTo[`p_${c.id}`]
          const toTeam = teams[toSlot]
          if (toTeam) a.push({asset_type:'player',from_team:fromTeam,to_team:toTeam,sleeper_id:c.players?.sleeper_id,contract_id:c.id,player_name:c.players?.full_name||c.players?.sleeper_id,salary:parseFloat(c.salary||0),years:c.years})
        })
        tradingPicks[slot].forEach(p => {
          const toSlot = sendTo[`pk_${p.id}`]
          const toTeam = teams[toSlot]
          if (toTeam) a.push({asset_type:'pick',from_team:fromTeam,to_team:toTeam,pick_id:p.id})
        })
        if(tradingSb[slot]>0) {
          const toSlot = sendTo[`sb_${slot}`]
          const toTeam = teams[toSlot]
          if(toTeam) a.push({asset_type:'sb_budget',from_team:fromTeam,to_team:toTeam,sb_amount:tradingSb[slot]})
        }
      })
    }
    return a
  }, [tradingPlayers, tradingPicks, tradingSb, teams, threeWay, sendTo, activeSlots])

  const hasAnyAssets       = activeSlots.some(s => tradingPlayers[s].length > 0 || tradingPicks[s].length > 0 || tradingSb[s] > 0)
  const threeWayMissingDest = threeWay && assets.some(a => a.asset_type === 'player' && !a.to_team)

  const canSubmit = useMemo(() => {
    const validTeams    = activeSlots.every(s => teams[s])
    const hasAssets     = assets.length > 0
    const noViolation   = capViolations.length === 0
    const noMissingDest = !threeWayMissingDest
    return validTeams && hasAssets && noViolation && noMissingDest && !submitting
  }, [activeSlots, teams, assets, capViolations, threeWayMissingDest, submitting])

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true); setResult(null)
    const validTeams = activeSlots.map(s=>teams[s]).filter(Boolean)
    const r = await fetch(`${API}/trades`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ teams: validTeams, assets, notes: notes||null, proposed_by: manager?.team_abbrev })
    })
    const data = await r.json()
    setSubmitting(false)
    if (r.ok) {
      setResult({ ok:true, msg:'Trade proposal submitted! The other team(s) will need to accept before it goes to the commissioner.' })
      setTradingPlayers({0:[],1:[],2:[]}); setTradingPicks({0:[],1:[],2:[]}); setTradingSb({0:0,1:0,2:0}); setNotes(''); setSendTo({})
    } else {
      setResult({ ok:false, msg: data.error||'Submission failed' })
    }
  }

  useEffect(() => {
    if (activeTab==='history' && manager?.team_abbrev) {
      fetch(`${API}/trades?team=${manager.team_abbrev}`)
        .then(r=>r.ok?r.json():[]).then(setTrades)
    }
  },[activeTab, manager])

  async function handleAccept(tradeId) {
    const r = await fetch(`${API}/trades/${tradeId}/accept`,{
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({team_abbrev:manager?.team_abbrev})
    })
    const d = await r.json()
    if (r.ok) setTrades(prev=>prev.map(t=>t.id===tradeId?{...t,status:d.trade?.status||t.status}:t))
  }

  async function handleCancel(tradeId) {
    if (!window.confirm('Cancel this trade proposal?')) return
    await fetch(`${API}/trades/${tradeId}/decline`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_abbrev: manager?.team_abbrev })
    })
    fetch(`${API}/trades?team=${manager.team_abbrev}`)
      .then(r => r.ok ? r.json() : []).then(setTrades)
  }

  async function handleDecline(tradeId) {
    await fetch(`${API}/trades/${tradeId}/decline`,{
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({team_abbrev:manager?.team_abbrev})
    })
    setTrades(prev=>prev.map(t=>t.id===tradeId?{...t,status:'declined'}:t))
  }

  async function handleAdminProcess(tradeId, action) {
    const r = await fetch(`${API}/trades/${tradeId}/process`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json','x-admin-password':'brethart'},
      body:JSON.stringify({action})
    })
    const d = await r.json()
    if (r.ok) setTrades(prev=>prev.map(t=>t.id===tradeId?{...t,status:action==='approve'?'approved':'denied'}:t))
    else alert(d.error)
  }

  const STATUS_LABEL = {
    pending:'Pending Response', proposed:'Pending Response', pending_admin:'Awaiting Commissioner',
    approved:'Approved ✓', denied:'Denied ✗', declined:'Declined ✗', countered:'Countered'
  }
  const STATUS_COLOR = {
    pending:'var(--gold)', proposed:'var(--gold)', pending_admin:'var(--orange)',
    approved:'var(--green)', denied:'var(--red)', declined:'var(--red)', countered:'var(--blue)'
  }

  return (
    <div className="tm-root">
      <div className="tm-header">
        <div>
          <h1 className="tm-title">Trade Machine</h1>
          <p className="tm-sub">Build, propose, accept or counter trades</p>
        </div>
        <div className="tm-tabs">
          <button className={`tm-tab ${activeTab==='build'?'tm-tab--active':''}`} onClick={()=>setActiveTab('build')}>Propose Trade</button>
          <button className={`tm-tab ${activeTab==='history'?'tm-tab--active':''}`} onClick={()=>setActiveTab('history')}>Trade History</button>
        </div>
      </div>

      {activeTab === 'build' ? (<>
        <div className="tm-controls">
          <div className="tm-way-toggle">
            <button className={`tm-way-btn ${!threeWay?'tm-way-btn--active':''}`}
              onClick={()=>{setThreeWay(false);setTeams(t=>[t[0],t[1],null])}}>2-Team Trade</button>
            <button className={`tm-way-btn ${threeWay?'tm-way-btn--active':''}`}
              onClick={()=>setThreeWay(true)}>3-Team Trade</button>
          </div>
          <div className="tm-pos-filter">
            {['ALL','QB','RB','WR','TE'].map(pos=>(
              <button key={pos} className={`tm-pos-btn ${posFilter===pos?'tm-pos-btn--active':''}`}
                onClick={()=>setPosFilter(pos)}>{pos}</button>
            ))}
          </div>
        </div>

        {counterTradeId && (
          <div className="tm-counter-banner">
            ↩ Counter proposal mode — build your offer below and submit to send it back
          </div>
        )}

        <div className={`tm-panels ${threeWay?'tm-panels--3':'tm-panels--2'}`}>
          {activeSlots.map(slot=>(
            <TeamPanel key={slot} slot={slot}
              selectedTeam={teams[slot]}
              onSelectTeam={abbrev=>setTeamSlot(slot,abbrev)}
              tradingPlayers={tradingPlayers[slot]}
              tradingPicks={tradingPicks[slot]}
              tradingSb={tradingSb[slot]}
              onTogglePlayer={togglePlayer}
              onTogglePick={togglePick}
              onSbChange={setSbAmount}
              posFilter={posFilter}
              otherTeams={activeSlots.filter(s=>s!==slot).map(s=>teams[s]).filter(Boolean)}
              allTeams={teams}
              threeWay={threeWay}
              onCapLoaded={handleCapLoaded}
              projectedCap={projectedCaps[slot]}
              sendTo={sendTo}
              onSetSendTo={handleSetSendTo}
              activeSlots={activeSlots}
            />
          ))}
          {/* Trade Chat sidebar — wired to live conversations */}
          <div className="tm-sidebar">
            <div className="tm-sidebar-title">Trade Chat</div>
            <TradeChatSidebar
              myTeam={manager?.team_abbrev}
              otherTeams={activeSlots.map(s=>teams[s]).filter(t=>t&&t!==manager?.team_abbrev)}
            />
          </div>
        </div>

        <div className="tm-footer">
          {hasAnyAssets && (
            <div className="tm-cap-bars">
              {activeSlots.map(slot => {
                const t = teams[slot]
                if (!t) return null
                const before = teamCaps[slot]
                const after  = projectedCaps[slot]
                const isOver = after > CONSTS.hardCap
                const isLux  = after > CONSTS.ltl
                const pctB   = Math.min(100,(before/CONSTS.hardCap)*100)
                const pctA   = Math.min(100,(after/CONSTS.hardCap)*100)
                return (
                  <div key={slot} className={`tm-cap-bar-wrap ${isOver?'tm-cap-over':''}`}>
                    <div className="tm-cap-bar-team">{t}</div>
                    <div className="tm-cap-bar-track">
                      <div className="tm-cap-bar-before" style={{width:`${pctB.toFixed(1)}%`}}/>
                      <div className={`tm-cap-bar-after ${isOver?'tm-bar-over':isLux?'tm-bar-lux':'tm-bar-ok'}`}
                        style={{width:`${pctA.toFixed(1)}%`}}/>
                      <div className="tm-cap-bar-ltl" style={{left:`${(CONSTS.ltl/CONSTS.hardCap*100).toFixed(1)}%`}}/>
                    </div>
                    <div className="tm-cap-bar-nums">
                      <span className={isOver?'tm-num-red':isLux?'tm-num-gold':''}>${after.toFixed(2)}</span>
                      <span className="tm-cap-bar-delta" style={{color:after>before?'var(--red)':'var(--green)'}}>
                        {after>before?'+':''}{(after-before).toFixed(2)}
                      </span>
                      {isOver && <span className="tm-cap-bar-warn">⚠ CAP VIOLATION</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="tm-submit-section">
            <div className="tm-submit-left">
              <textarea className="tm-notes" placeholder="Add a note to your trade proposal (optional)…"
                value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/>
              {capViolations.length > 0 && (
                <div className="tm-warn-msg">⚠ {capViolations.map(s=>teams[s]).join(', ')} would exceed the hard cap — trade cannot be submitted</div>
              )}
              {threeWayMissingDest && (
                <div className="tm-warn-msg">⚠ In a 3-team trade, select a destination team for each asset in the SENDING zone</div>
              )}
              {result && (
                <div className={`tm-result ${result.ok?'tm-result--ok':'tm-result--err'}`}>{result.msg}</div>
              )}
            </div>
            <button className="tm-submit" onClick={() => setShowConfirm(true)}
              disabled={!canSubmit || !hasAnyAssets}>
              {!hasAnyAssets ? 'Add players or picks to trade' : 'Propose Trade →'}
            </button>
          </div>
        </div>
      </>) : (
        <div className="tm-history">
          {trades.length === 0 ? (
            <div className="tm-history-empty">No trades found for your team.</div>
          ) : trades.map(trade => {
            const myTeam         = manager?.team_abbrev
            const myTT           = trade.trade_teams?.find(t=>t.team_abbrev===myTeam)
            const needsAction    = (trade.status==='proposed'||trade.status==='pending') && myTT && !myTT.has_accepted
            const isAdminPending = isAdmin && trade.status==='pending_admin'
            // Cap impact per team for this trade
            const capImpact = {}
            trade.trade_teams?.forEach(tt => { capImpact[tt.team_abbrev] = 0 })
            trade.trade_assets?.forEach(a => {
              if (a.asset_type === 'player' && a.salary) {
                if (capImpact[a.from_team] !== undefined) capImpact[a.from_team] -= parseFloat(a.salary)
                if (capImpact[a.to_team]   !== undefined) capImpact[a.to_team]   += parseFloat(a.salary)
              }
            })

            // Is this a trade I proposed and can cancel?
            const iProposed = trade.proposed_by === myTeam
            const canCancel = iProposed && (trade.status === 'pending' || trade.status === 'proposed')
            const waitingOnTeams = trade.trade_teams?.filter(t => !t.has_accepted && t.team_abbrev !== myTeam).map(t=>t.team_abbrev) || []

            return (
              <div key={trade.id}
                className={`tm-trade-card ${needsAction?'tm-trade-card--action':''} ${iProposed&&!needsAction?'tm-trade-card--proposed':''}`}
                onClick={() => setSelectedTrade(trade)}
                style={{cursor:'pointer'}}>
                {/* Header */}
                <div className="tm-tc-header">
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div className="tm-tc-teams">{trade.trade_teams?.map(t=>t.team_abbrev).join(' ↔ ')}</div>
                    {needsAction && (
                      <span style={{fontFamily:'var(--font-ui)',fontSize:10,fontWeight:800,
                        color:'#fff',background:'var(--orange)',padding:'2px 8px',borderRadius:4}}>
                        ACTION NEEDED
                      </span>
                    )}
                    {canCancel && waitingOnTeams.length > 0 && (
                      <span style={{fontFamily:'var(--font-ui)',fontSize:10,color:'var(--text-muted)'}}>
                        Waiting on: {waitingOnTeams.join(', ')}
                      </span>
                    )}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div className="tm-tc-status" style={{color:STATUS_COLOR[trade.status]||'var(--text-muted)'}}>
                      {STATUS_LABEL[trade.status]||trade.status}
                    </div>
                    <div className="tm-tc-date">{new Date(trade.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {trade.notes       && <div className="tm-tc-notes">"{trade.notes}"</div>}
                {trade.admin_notes && <div className="tm-tc-admin-notes">Commissioner: {trade.admin_notes}</div>}

                {/* Assets — one column per team */}
                <div className="tm-tc-assets">
                  {trade.trade_teams?.map(tt => {
                    const sending = trade.trade_assets?.filter(a => a.from_team === tt.team_abbrev)
                    if (!sending?.length) return null
                    const impact = capImpact[tt.team_abbrev] || 0
                    const sign   = impact >= 0 ? '+' : ''
                    const impColor = impact > 0 ? 'var(--red,#d94f4f)' : impact < 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)'
                    return (
                      <div key={tt.team_abbrev} className="tm-tc-side">
                        <div className="tm-tc-side-team">
                          {tt.team_abbrev} sends
                          {tt.has_accepted && <span className="tm-tc-accepted"> ✓</span>}
                          {impact !== 0 && (
                            <span style={{marginLeft:8,fontFamily:'var(--font-ui)',fontSize:10,fontWeight:700,color:impColor}}>
                              {sign}${Math.abs(impact).toFixed(2)} cap
                            </span>
                          )}
                        </div>
                        {sending.map((a, i) => (
                          <div key={i} className="tm-tc-asset">
                            {a.asset_type === 'player' && (
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}>
                                <div>
                                  <span style={{fontWeight:600}}>{a.player_name || a.sleeper_id}</span>
                                  {a.salary && (
                                    <span style={{marginLeft:8,fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>
                                      ${parseFloat(a.salary).toFixed(2)}{a.years ? ` · ${a.years}yr` : ''}
                                    </span>
                                  )}
                                </div>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                            {a.asset_type === 'pick' && (
                              <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                                <span>🏈 {a.pick_label || 'Draft Pick'}</span>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                            {a.asset_type === 'sb_budget' && (
                              <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                                <span>💰 ${parseFloat(a.sb_amount).toFixed(2)} SB budget</span>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* Action buttons */}
                {needsAction && (
                  <div className="tm-tc-actions" onClick={e => e.stopPropagation()}>
                    <button className="tm-tc-btn tm-tc-btn--accept" onClick={()=>handleAccept(trade.id)}>Accept</button>
                    <button className="tm-tc-btn tm-tc-btn--counter"
                      onClick={()=>navigate(`/trade?counter=${trade.id}&teams=${trade.trade_teams?.map(t=>t.team_abbrev).join(',')}`)}>
                      Counter
                    </button>
                    <button className="tm-tc-btn tm-tc-btn--decline" onClick={()=>handleDecline(trade.id)}>Decline</button>
                  </div>
                )}
                {canCancel && (
                  <div className="tm-tc-actions" onClick={e => e.stopPropagation()}>
                    <button className="tm-tc-btn tm-tc-btn--decline" onClick={()=>handleCancel(trade.id)}>
                      Cancel Proposal
                    </button>
                  </div>
                )}
                {isAdminPending && (
                  <div className="tm-tc-actions" onClick={e => e.stopPropagation()}>
                    <span className="tm-tc-admin-label">Admin:</span>
                    <button className="tm-tc-btn tm-tc-btn--accept" onClick={()=>handleAdminProcess(trade.id,'approve')}>Approve & Execute</button>
                    <button className="tm-tc-btn tm-tc-btn--decline" onClick={()=>handleAdminProcess(trade.id,'deny')}>Deny</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {selectedTrade && (
        <TradeReviewModal
          trade={selectedTrade}
          myTeam={manager?.team_abbrev}
          isAdmin={isAdmin}
          onClose={() => setSelectedTrade(null)}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onAdminProcess={handleAdminProcess}
        />
      )}
      {showConfirm && (
        <ConfirmTradeModal
          teams={activeSlots.map(s=>teams[s]).filter(Boolean)}
          assets={assets}
          notes={notes}
          submitting={submitting}
          onConfirm={() => { setShowConfirm(false); handleSubmit() }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}