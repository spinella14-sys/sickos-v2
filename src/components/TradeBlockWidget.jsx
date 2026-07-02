import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TEAMS, LOGOS } from '../data/league'
import './TradeBlockWidget.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }
const PICK_PHIL = {
  very_open: { icon:'🟢', short:'Very Open', color:'var(--green)' },
  open:      { icon:'🟩', short:'Open',      color:'#7bc67e' },
  neutral:   { icon:'⚪', short:'Neutral',   color:'var(--text-muted)' },
  cautious:  { icon:'🟡', short:'Cautious',  color:'var(--gold)' },
  closed:    { icon:'🔴', short:'Closed',    color:'var(--red)' },
}

export default function TradeBlockWidget({ colors }) {
  const { manager } = useAuth()
  const navigate    = useNavigate()
  const [blocks,  setBlocks]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/trade-block`)
      .then(r=>r.ok?r.json():[])
      .then(d=>{ setBlocks(Array.isArray(d)?d:[]); setLoading(false) })
      .catch(()=>setLoading(false))
  }, [])

  const myTeam = manager?.team_abbrev

  // Group by team, find teams with available players
  const teamsWithBlock = TEAMS.map(t => {
    const teamBlocks = blocks.filter(b => b.team_abbrev === t.abbrev)
    const available  = teamBlocks.filter(b => b.asset_type==='player' && ['available','listening'].includes(b.status))
    const pickPhil   = teamBlocks.find(b => b.asset_type==='picks')
    return { team: t, available, pickPhil }
  }).filter(({ available, pickPhil }) =>
    available.length > 0 || (pickPhil && pickPhil.status !== 'neutral')
  ).slice(0, 4) // show up to 4 teams in the widget

  const totalAvailable = blocks.filter(b =>
    b.asset_type==='player' && ['available','listening'].includes(b.status) &&
    b.team_abbrev !== myTeam
  ).length

  return (
    <div className="tbw-root">
      <div className="tbw-header">
        <div className="tbw-header-left">
          {totalAvailable > 0 && <span className="tbw-dot"/>}
          <span className="tbw-title" style={{color: colors?.primary||'var(--orange)'}}>
            Trade Block {totalAvailable > 0 ? `· ${totalAvailable} available` : ''}
          </span>
        </div>
        <div className="tbw-header-actions">
          <button className="tbw-action-btn" onClick={()=>navigate('/trade-block')}>
            Edit My Block
          </button>
          <Link to="/trade-block" className="tbw-action-btn tbw-action-btn--view">
            View All →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="tbw-loading">Loading…</div>
      ) : teamsWithBlock.length === 0 ? (
        <div className="tbw-empty">
          <span>No players on the block yet</span>
          <Link to="/trade-block" className="tbw-empty-link">Add yours →</Link>
        </div>
      ) : (
        <div className="tbw-list">
          {teamsWithBlock.map(({ team, available, pickPhil }) => {
            const isMyTeam = team.abbrev === myTeam
            const phil = PICK_PHIL[pickPhil?.status]
            return (
              <div key={team.abbrev} className={`tbw-team-row ${isMyTeam?'tbw-team-row--mine':''}`}>
                {/* Team identity */}
                <div className="tbw-team-ident">
                  <img src={LOGOS[team.abbrev]} alt="" className="tbw-team-logo"/>
                  <div>
                    <div className="tbw-team-abbrev">{team.abbrev}</div>
                    {phil && (
                      <div className="tbw-pick-badge" style={{color:phil.color}}>
                        {phil.icon} Picks: {phil.short}
                      </div>
                    )}
                  </div>
                </div>
                {/* Available players */}
                <div className="tbw-players">
                  {available.slice(0,3).map(b => {
                    const p = b.player || {}
                    const posColor = POS_COLOR[p.position]
                    return (
                      <div key={b.id} className="tbw-player-chip">
                        <span style={{color:posColor, fontSize:9, fontWeight:800}}>{p.position}</span>
                        <span className="tbw-player-chip-name">
                          {p.full_name?.split(' ').slice(-1)[0] || b.sleeper_id}
                        </span>
                        {b.status === 'listening' && (
                          <span className="tbw-listening-dot" title="Will Listen">🟡</span>
                        )}
                      </div>
                    )
                  })}
                  {available.length > 3 && (
                    <div className="tbw-player-chip tbw-player-chip--more">
                      +{available.length-3}
                    </div>
                  )}
                </div>
                {/* Propose button */}
                {!isMyTeam && myTeam && (
                  <button className="tbw-propose-btn"
                    style={{borderColor:colors?.primary||'var(--orange)',color:colors?.primary||'var(--orange)'}}
                    onClick={()=>navigate(`/trade?teams=${myTeam},${team.abbrev}`)}>
                    Propose →
                  </button>
                )}
              </div>
            )
          })}
          {teamsWithBlock.length > 0 && (
            <Link to="/trade-block" className="tbw-view-all">
              View full trade block →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
