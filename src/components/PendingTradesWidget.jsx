import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './PendingTradesWidget.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }

// ─── Asset row ────────────────────────────────────────────────────────────────
function AssetRow({ asset }) {
  if (asset.asset_type === 'player') {
    const p = asset.player_info
    return (
      <div className="ptw-asset">
        <img
          src={`https://sleepercdn.com/content/nfl/players/thumb/${asset.sleeper_id}.jpg`}
          alt="" className="ptw-asset-shot" onError={e=>e.target.style.opacity=0}/>
        <div className="ptw-asset-info">
          <span className="ptw-asset-name">{p?.full_name || '—'}</span>
          {p?.position && (
            <span className="ptw-asset-pos" style={{color:POS_COLOR[p.position]}}>{p.position}</span>
          )}
          {p?.nfl_team && <span className="ptw-asset-nfl">{p.nfl_team}</span>}
        </div>
      </div>
    )
  }
  if (asset.asset_type === 'pick') {
    const dp = asset.draft_picks
    const label = dp
      ? `${dp.season} R${dp.round} (${dp.original_team_abbrev})`
      : 'Draft Pick'
    const val = dp?.cap_value ? `$${parseFloat(dp.cap_value).toFixed(2)}` : '$TBD'
    return (
      <div className="ptw-asset">
        <span className="ptw-asset-pick-icon">🏈</span>
        <div className="ptw-asset-info">
          <span className="ptw-asset-name">{label}</span>
          <span className="ptw-asset-nfl">{val}</span>
        </div>
      </div>
    )
  }
  if (asset.asset_type === 'sb_budget') {
    return (
      <div className="ptw-asset">
        <span className="ptw-asset-pick-icon">💰</span>
        <div className="ptw-asset-info">
          <span className="ptw-asset-name">${parseFloat(asset.sb_amount||0).toFixed(2)} SB Budget</span>
        </div>
      </div>
    )
  }
  return null
}

// ─── Main Widget ─────────────────────────────────────────────────────────────
export default function PendingTradesWidget() {
  const { manager, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [trades,     setTrades]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [processing, setProcessing] = useState({})
  const [expanded,   setExpanded]   = useState({})
  const [waitingTrades, setWaitingTrades] = useState([])

  const team = manager?.team_abbrev

  const loadTrades = useCallback(async () => {
    if (!team) return
    setLoading(true)
    const requests = [
      fetch(`${API}/trades?team=${team}&status=proposed`).then(r=>r.ok?r.json():[]),
    ]
    if (isAdmin) {
      requests.push(fetch(`${API}/trades?status=pending_admin`).then(r=>r.ok?r.json():[]))
    }
    const [myTrades, adminTrades=[]] = await Promise.all(requests)

    // Filter to trades where my team hasn't accepted yet
    const pendingForMe = (myTrades||[]).filter(trade => {
      const myTT = trade.trade_teams?.find(t=>t.team_abbrev===team)
      return myTT && !myTT.has_accepted
    })

    // Trades I proposed and already accepted, waiting on other team(s)
    const waitingOnOthers = (myTrades||[]).filter(trade => {
      const myTT = trade.trade_teams?.find(t=>t.team_abbrev===team)
      return myTT && myTT.has_accepted && trade.proposed_by === team && trade.status === 'proposed'
    })
    setWaitingTrades(waitingOnOthers)

    // Admin pending: trades all parties accepted, awaiting commissioner
    const adminPending = isAdmin
      ? (adminTrades||[]).filter(t => t.status === 'pending_admin')
      : []

    // Merge, deduplicate by id
    const seen = new Set()
    const all = [...pendingForMe, ...adminPending].filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })

    setTrades(all)
    // Auto-expand if only one trade
    if (all.length === 1) setExpanded({ [all[0].id]: true })
    setLoading(false)
  }, [team, isAdmin])

  useEffect(() => { loadTrades() }, [loadTrades])

  async function handleAccept(tradeId) {
    setProcessing(p=>({...p,[tradeId]:'accepting'}))
    const r = await fetch(`${API}/trades/${tradeId}/accept`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ team_abbrev: team })
    })
    if (r.ok) await loadTrades()
    setProcessing(p=>({...p,[tradeId]:null}))
  }

  async function handleDecline(tradeId) {
    setProcessing(p=>({...p,[tradeId]:'declining'}))
    const r = await fetch(`${API}/trades/${tradeId}/decline`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ team_abbrev: team })
    })
    if (r.ok) await loadTrades()
    setProcessing(p=>({...p,[tradeId]:null}))
  }

  async function handleAdminProcess(tradeId, action) {
    setProcessing(p=>({...p,[tradeId]:action}))
    const r = await fetch(`${API}/trades/${tradeId}/process`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json','x-admin-password':'Sickos26-Vault!Q7'},
      body: JSON.stringify({ action })
    })
    if (r.ok) await loadTrades()
    else {
      const d = await r.json()
      alert(d.error || 'Processing failed')
    }
    setProcessing(p=>({...p,[tradeId]:null}))
  }

  function handleCounter(trade) {
    const allTeams = trade.trade_teams?.map(t=>t.team_abbrev) || []
    // Put my team first
    const ordered = [team, ...allTeams.filter(t=>t!==team)]
    const threeWay = ordered.length === 3
    navigate(`/trade?counter=${trade.id}&teams=${ordered.join(',')}${threeWay?'&three=1':''}`)
  }

  if (loading || trades.length === 0) return null

  return (
    <div className="ptw-root">
      {/* Notification bar */}
      <div className="ptw-notify-bar">
        <div className="ptw-notify-left">
          <span className="ptw-notify-dot"/>
          <span className="ptw-notify-text">
            {trades.length === 1
              ? 'You have 1 pending trade offer'
              : trades.length > 0
                ? `You have ${trades.length} pending trade offer${trades.length>1?'s':''}`
                : waitingTrades.length > 0
                  ? `${waitingTrades.length} trade proposal${waitingTrades.length>1?'s':''} awaiting response`
                  : 'No pending trades'}
          </span>
        </div>
        <span className="ptw-notify-count">{trades.length}</span>
      </div>

      {/* Trade cards */}
      {trades.map(trade => {
        const isAdminPending = trade.status === 'pending_admin'
        const teamsList = trade.trade_teams?.map(t=>t.team_abbrev) || []
        const proposer  = trade.proposed_by
        const proc      = processing[trade.id]
        const isOpen    = expanded[trade.id]

        // Assets from my perspective
        const iReceive = (trade.trade_assets||[]).filter(a=>a.to_team===team)
        const iSend    = (trade.trade_assets||[]).filter(a=>a.from_team===team)

        // For admin view, show full picture
        const teamsWithAssets = isAdminPending
          ? [...new Set((trade.trade_assets||[]).map(a=>a.from_team))]
          : null

        return (
          <div key={trade.id} className={`ptw-card ${isAdminPending?'ptw-card--admin':''}`}>
            {/* Card header */}
            <div className="ptw-card-header" onClick={()=>setExpanded(p=>({...p,[trade.id]:!p[trade.id]}))}>
              <div className="ptw-card-header-left">
                {isAdminPending
                  ? <span className="ptw-badge ptw-badge--admin">⚡ Commissioner Review</span>
                  : <span className="ptw-badge ptw-badge--offer">Trade Offer</span>
                }
                <span className="ptw-card-teams">{teamsList.join(' ↔ ')}</span>
                {!isAdminPending && <span className="ptw-card-from">from {proposer}</span>}
              </div>
              <div className="ptw-card-header-right">
                <span className="ptw-card-date">{new Date(trade.created_at).toLocaleDateString()}</span>
                <span className="ptw-expand-btn">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <>
                {trade.notes && <div className="ptw-card-note">"{trade.notes}"</div>}

                {/* 2-team layout: you receive / you send */}
                {!isAdminPending ? (
                  <div className="ptw-card-body">
                    <div className="ptw-side">
                      <div className="ptw-side-label ptw-side-label--receive">You Receive</div>
                      <div className="ptw-side-assets">
                        {iReceive.length === 0
                          ? <div className="ptw-side-empty">Nothing</div>
                          : iReceive.map((a,i) => <AssetRow key={i} asset={a}/>)
                        }
                      </div>
                    </div>
                    <div className="ptw-arrow">↔</div>
                    <div className="ptw-side">
                      <div className="ptw-side-label ptw-side-label--send">You Send</div>
                      <div className="ptw-side-assets">
                        {iSend.length === 0
                          ? <div className="ptw-side-empty">Nothing</div>
                          : iSend.map((a,i) => <AssetRow key={i} asset={a}/>)
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Admin layout: show all sides */
                  <div className="ptw-card-body ptw-card-body--admin">
                    {trade.trade_teams?.map(tt => {
                      const sending = (trade.trade_assets||[]).filter(a=>a.from_team===tt.team_abbrev)
                      if (!sending.length) return null
                      return (
                        <div key={tt.team_abbrev} className="ptw-side">
                          <div className="ptw-side-label">{tt.team_abbrev} sends</div>
                          <div className="ptw-side-assets">
                            {sending.map((a,i)=><AssetRow key={i} asset={a}/>)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Acceptance status for multi-party trades */}
                {trade.trade_teams?.length > 1 && (
                  <div className="ptw-acceptance">
                    {trade.trade_teams.map(tt => (
                      <span key={tt.team_abbrev}
                        className={`ptw-accept-badge ${tt.has_accepted?'ptw-accept-badge--yes':'ptw-accept-badge--pending'}`}>
                        {tt.team_abbrev} {tt.has_accepted ? '✓' : '…'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="ptw-actions">
                  {!isAdminPending ? (
                    <>
                      <button className="ptw-btn ptw-btn--accept"
                        disabled={!!proc} onClick={()=>handleAccept(trade.id)}>
                        {proc==='accepting' ? 'Accepting…' : '✓ Accept Trade'}
                      </button>
                      <button className="ptw-btn ptw-btn--counter"
                        onClick={()=>handleCounter(trade)}>
                        ↩ Counter Proposal
                      </button>
                      <button className="ptw-btn ptw-btn--decline"
                        disabled={!!proc} onClick={()=>handleDecline(trade.id)}>
                        {proc==='declining' ? 'Declining…' : '✕ Decline'}
                      </button>
                    </>
                  ) : isAdmin ? (
                    <>
                      <span className="ptw-admin-label">Commissioner action:</span>
                      <button className="ptw-btn ptw-btn--accept"
                        disabled={!!proc} onClick={()=>handleAdminProcess(trade.id,'approve')}>
                        {proc==='approve' ? 'Processing…' : '✓ Approve & Execute'}
                      </button>
                      <button className="ptw-btn ptw-btn--decline"
                        disabled={!!proc} onClick={()=>handleAdminProcess(trade.id,'deny')}>
                        {proc==='deny' ? 'Denying…' : '✕ Deny'}
                      </button>
                    </>
                  ) : (
                    <span className="ptw-waiting">All parties agreed — awaiting commissioner approval</span>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
      {/* Waiting on others section */}
      {waitingTrades.length > 0 && (
        <div className="ptw-waiting-section">
          <div className="ptw-waiting-label">Waiting on response ({waitingTrades.length})</div>
          {waitingTrades.map(trade => {
            const teamsList = trade.trade_teams?.map(t=>t.team_abbrev) || []
            const pending   = trade.trade_teams?.filter(t => !t.has_accepted && t.team_abbrev !== team).map(t=>t.team_abbrev) || []
            return (
              <div key={trade.id} className="ptw-waiting-card">
                <div className="ptw-waiting-teams">{teamsList.join(' ↔ ')}</div>
                <div className="ptw-waiting-status">
                  Waiting on: <strong>{pending.join(', ')}</strong>
                </div>
                <div className="ptw-waiting-date">{new Date(trade.created_at).toLocaleDateString()}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}