import { useState, useEffect, useMemo, useRef } from 'react'
import { LOGOS } from '../../data/league'
import '../../pages/SalaryCapPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const HARD_CAP = 138
const TAX_LINE = 120

function CapBar({ capUsed }) {
  const pct = Math.min(100, (capUsed / HARD_CAP) * 100)
  const ltlPct = (TAX_LINE / HARD_CAP) * 100
  const color = capUsed > HARD_CAP ? 'var(--red,#d94f4f)' : capUsed > TAX_LINE ? 'var(--gold,#f0b429)' : 'var(--green,#3dba6e)'
  return (
    <div className="scp-bar-wrap">
      <div className="scp-bar-track">
        <div className="scp-bar-fill" style={{ width: `${pct.toFixed(1)}%`, background: color }} />
        <div className="scp-bar-ltl" style={{ left: `${ltlPct.toFixed(1)}%` }} title="Luxury Tax Line" />
      </div>
      <span className="scp-bar-pct">{pct.toFixed(1)}%</span>
    </div>
  )
}

// Compact version of SalaryCapPage.jsx's "League Overview" tab (the same
// two data sources: GET /api/teams + GET /api/bids/sb-balances, same
// enrichment/columns for cap_used/cap_space/tax_position). Trimmed to the
// columns most relevant during a draft -- rank/team/salary/usage bar/
// space/SB budget -- dropping Tax Pmt/EOS Pmt/Max Space (season-end
// reconciliation detail). Defaults to highlighting + scrolling to the
// viewer's own team; full 16-team table browsable underneath.
export default function RFACapOverviewTab({ myTeam }) {
  const [teams, setTeams] = useState([])
  const [sbBal, setSbBal] = useState({})
  const [loading, setLoading] = useState(true)
  const myRowRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/teams`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/bids/sb-balances?season=${SEASON}`).then(r => r.ok ? r.json() : {}),
    ]).then(([teamsData, sbData]) => {
      setTeams(Array.isArray(teamsData) ? teamsData : [])
      setSbBal(sbData || {})
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const enriched = useMemo(() => teams.map(t => {
    const capUsed = parseFloat(t.cap_used || 0)
    const sbBalance = parseFloat(sbBal[t.abbrev] || 0)
    const taxPosition = parseFloat((capUsed - TAX_LINE).toFixed(2))
    return { ...t, cap_used: capUsed, sb_balance: sbBalance, tax_position: taxPosition }
  }).sort((a, b) => b.cap_used - a.cap_used), [teams, sbBal])

  useEffect(() => {
    if (!loading && myRowRef.current) {
      myRowRef.current.scrollIntoView({ block: 'center' })
    }
  }, [loading])

  if (loading) {
    return (
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">Loading Cap Overview…</div>
      </div>
    )
  }

  return (
    <div className="scp-table-wrap" style={{ padding: 16, overflowY: 'auto' }}>
      <table className="scp-table">
        <thead>
          <tr>
            <th className="scp-th scp-th--rank">#</th>
            <th className="scp-th scp-th--team">Team</th>
            <th className="scp-th">Salary</th>
            <th className="scp-th">Cap Usage</th>
            <th className="scp-th">Space</th>
            <th className="scp-th">SB Budget</th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((t, i) => {
            const overTax = t.cap_used > TAX_LINE
            const overCap = t.cap_used > HARD_CAP
            const isMine = t.abbrev === myTeam
            return (
              <tr
                key={t.abbrev}
                ref={isMine ? myRowRef : null}
                className={`scp-row ${overTax ? 'scp-row--tax' : ''} ${overCap ? 'scp-row--over' : ''}`}
                style={isMine ? { outline: '2px solid var(--draft-amber)', outlineOffset: '-2px' } : {}}
              >
                <td className="scp-td scp-td--rank">{i + 1}</td>
                <td className="scp-td scp-td--team">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {LOGOS[t.abbrev] && <img src={LOGOS[t.abbrev]} alt={t.abbrev} className="scp-logo" />}
                    <div>
                      <div className="scp-team-name">{t.name || t.abbrev}{isMine ? ' (You)' : ''}</div>
                      <div className="scp-team-mgr">{t.manager}</div>
                    </div>
                  </div>
                </td>
                <td className="scp-td scp-td--num">
                  <span style={{ color: overCap ? 'var(--red)' : overTax ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 700 }}>
                    ${t.cap_used.toFixed(2)}
                  </span>
                </td>
                <td className="scp-td scp-td--bar">
                  <CapBar capUsed={t.cap_used} />
                </td>
                <td className="scp-td scp-td--num" style={{ color: 'var(--green,#3dba6e)' }}>
                  ${parseFloat(t.cap_space || 0).toFixed(2)}
                </td>
                <td className="scp-td scp-td--num">
                  ${t.sb_balance.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
