import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { submitFABid } from '../utils/api'
import { headshotUrl } from '../hooks/useSleeper'
import { buildContractYears, getSeasonConsts, CURRENT_SEASON } from '../utils/contractCalc'
import './FABidPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function useSeasonMode() {
  const [mode, setMode] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/system/season-mode`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMode(d?.season_mode || null))
      .catch(() => setMode(null))
  }, [])
  return mode
}

export default function FABidPage() {
  const seasonMode = useSeasonMode()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { manager }    = useAuth()

  const preId   = searchParams.get('player') || ''
  const preName = searchParams.get('name')   || ''

  // Team and manager name come from auth — no manual input needed
  const team        = manager?.team_abbrev || ''
  const managerName = manager?.display_name || ''

  const SEASON = CURRENT_SEASON
  const consts = getSeasonConsts(SEASON)

  const [playerInfo, setPlayerInfo] = useState(null)
  const [roster,     setRoster]     = useState([])
  const [teamData,   setTeamData]   = useState(null)  // live team data from API
  const [sbBalance,  setSbBalance]  = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState(null)

  const [salary,     setSalary]     = useState('')
  const [years,      setYears]      = useState(1)
  const [structure,  setStructure]  = useState('flat')
  const [nonGuar,    setNonGuar]    = useState(false)
  const [sigBonus,   setSigBonus]   = useState('')
  const [dropPlayer, setDropPlayer] = useState('')
  const [dropName,   setDropName]   = useState('')

  // Load player info
  useEffect(() => {
    if (!preId) return
    fetch(`${API_BASE}/players/${preId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlayerInfo(d) })
  }, [preId])

  // Load team roster + SB balance from live API (not hardcoded TEAMS constant)
  useEffect(() => {
    if (!team) return
    fetch(`${API_BASE}/teams/${team}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setTeamData(d)
        setRoster(d?.roster || [])
      })
    fetch(`${API_BASE}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[team] ?? null))
  }, [team])

  const pos = playerInfo?.player?.position || playerInfo?.position

  // Max 2 years for minimum contracts
  const maxYears = structure === 'minimum' || structure === 'min' ? 2 : 5

  // Contract year preview
  const contractYears = useMemo(() => {
    const sal = parseFloat(salary)
    if ((!salary || isNaN(sal)) && structure !== 'minimum') return []
    return buildContractYears({
      baseSalary: structure === 'minimum' ? consts.minSalary : sal,
      structure,
      years,
      nonGuar: nonGuar && years > 1,
      startYear: SEASON,
      position: pos || 'WR',
    })
  }, [salary, structure, years, nonGuar, pos])

  // Signing bonus validation
  const sbAmount     = parseFloat(sigBonus) || 0
  const sbIsValid    = sbAmount === 0 || Math.round(sbAmount * 10) === sbAmount * 10
  const sbOverBudget = sbBalance !== null && sbAmount > sbBalance

  // Cap check using LIVE team data from API, not hardcoded constant
  const capCheck = useMemo(() => {
    if (!team || !salary || !teamData) return null
    const sal       = parseFloat(salary) || 0
    const capUsed   = parseFloat(teamData.cap_used || teamData.salary || 0)
    const hardCap   = parseFloat(teamData.hard_cap || consts.hardCap || 138)
    const projected = capUsed + sal
    return { current: capUsed, projected, hardCap, overCap: projected > hardCap }
  }, [team, salary, teamData])

  // Max salary for this position
  const maxSalary = pos === 'QB' ? consts.qbMax : consts.nonQbMax

  // Fill salary with max for this position
  function fillMax() {
    setSalary(maxSalary.toFixed(2))
  }

  // Guaranteed money for display
  const guaranteedSalary = contractYears
    .filter(cy => cy.isGuaranteed !== false)
    .reduce((s, cy) => s + cy.salary, 0)
  const nonGuarMoney = contractYears
    .filter(cy => cy.isGuaranteed === false)
    .reduce((s, cy) => s + cy.salary, 0)

  // Validation
  const errors = useMemo(() => {
    const errs = []
    const sal = parseFloat(salary)
    if (salary && !isNaN(sal)) {
      if (sal < consts.minSalary) errs.push(`Minimum salary is $${consts.minSalary.toFixed(2)}`)
      if (sal > maxSalary) errs.push(`Exceeds ${pos === 'QB' ? 'QB' : 'non-QB'} max ($${maxSalary.toFixed(2)})`)
    }
    if (nonGuar && years <= 1) errs.push('Non-guaranteed year requires multi-year deal')
    if (sigBonus && !sbIsValid) errs.push('Signing bonus must be in $0.10 increments')
    if (sbOverBudget) errs.push(`Signing bonus exceeds budget ($${sbBalance?.toFixed(2)} available)`)
    if (capCheck?.overCap) errs.push(`Would exceed hard cap ($${capCheck.projected.toFixed(2)} / $${capCheck.hardCap})`)
    return errs
  }, [salary, nonGuar, years, sigBonus, sbIsValid, sbOverBudget, capCheck, pos])

  async function handleSubmit() {
    if (errors.length || !team || !salary) {
      setResult({ ok: false, msg: errors[0] || 'Fill in all required fields.' })
      return
    }
    setSubmitting(true)
    try {
      await submitFABid({
        player_id:            preId,
        player_name:          playerInfo?.player?.full_name || playerInfo?.full_name || preName,
        team_abbrev:          team,
        manager_name:         managerName,
        salary:               parseFloat(structure === 'minimum' ? consts.minSalary : salary),
        years:                parseInt(years),
        structure,
        non_guaranteed_final: nonGuar && years > 1,
        contract_years:       contractYears.map(cy => ({
          season:        cy.season,
          year_number:   cy.yearNumber || cy.year_number,
          salary:        cy.salary,
          is_guaranteed: cy.isGuaranteed !== false,
        })),
        signing_bonus: sbAmount || null,
        drop_player:   dropPlayer || null,
        drop_name:     dropName   || null,
        season:        SEASON,
      })
      setResult({ ok: true, msg: `Bid submitted for ${playerInfo?.player?.full_name || preName}. All bids are sealed — winner is determined when the window closes.` })
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Submission failed' })
    }
    setSubmitting(false)
  }

  const p = playerInfo?.player || playerInfo

  return (
    <div className="fab-root">
      <div className="fab-header">
        <h1 className="fab-title">Submit FA Bid</h1>
        {team && (
          <div className="fab-team-badge">
            <span className="fab-team-abbrev">{team}</span>
            <span className="fab-manager-name">{managerName}</span>
          </div>
        )}
      </div>

      {seasonMode && seasonMode !== 'regular_season' && (
        <div style={{
          margin: '0 0 20px', padding: '12px 16px',
          border: '1px solid var(--red)', borderRadius: 6,
          background: 'rgba(217,79,79,0.08)', color: 'var(--red)',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        }}>
          Free agent bidding is closed for the offseason. It opens automatically once the RFA, Rookie, and UFA drafts have all completed.
        </div>
      )}

      {/* Player card */}
      {(preId || preName) && (
        <div className="fab-player-card">
          {preId && (
            <img src={headshotUrl(preId)} alt="" className="fab-headshot"
              onError={e => e.target.style.opacity = 0}/>
          )}
          <div className="fab-player-info">
            <div className="fab-player-name">{p?.full_name || preName}</div>
            <div className="fab-player-meta">
              {p?.position && <span className="fab-pos">{p.position}</span>}
              {p?.nfl_team  && <span className="fab-nfl">{p.nfl_team}</span>}
            </div>
          </div>
        </div>
      )}

      {!preId && (
        <div className="fab-no-player">
          No player selected. <a href="/free-agents">Browse free agents →</a>
        </div>
      )}

      {/* Cap snapshot — live from API */}
      {teamData && (
        <div className="fab-cap-row">
          <div className="fab-cap-item">
            <span className="fab-cap-label">Cap Used</span>
            <span className="fab-cap-val">${parseFloat(teamData.cap_used || 0).toFixed(2)}</span>
          </div>
          <div className="fab-cap-item">
            <span className="fab-cap-label">Cap Space</span>
            <span className="fab-cap-val fab-cap-val--green">${parseFloat(teamData.cap_space || 0).toFixed(2)}</span>
          </div>
          <div className="fab-cap-item">
            <span className="fab-cap-label">SB Budget</span>
            <span className="fab-cap-val">{sbBalance !== null ? `$${sbBalance.toFixed(2)}` : '—'}</span>
          </div>
          <div className="fab-cap-item">
            <span className="fab-cap-label">Hard Cap</span>
            <span className="fab-cap-val">${parseFloat(teamData.hard_cap || 138).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Contract form */}
      <div className="fab-form">

        {/* Salary */}
        <div className="fab-field">
          <label className="fab-label">
            Salary
            <span className="fab-max-hint">
              {pos === 'QB' ? `QB Max: $${consts.qbMax?.toFixed(2)}` : `Non-QB Max: $${consts.nonQbMax?.toFixed(2)}`}
            </span>
          </label>
          <div className="fab-salary-row">
            <span className="fab-dollar">$</span>
            <input
              className="fab-input fab-salary-input"
              type="number"
              step="0.01"
              min={consts.minSalary}
              max={maxSalary}
              value={salary}
              onChange={e => setSalary(e.target.value)}
              placeholder={`${consts.minSalary?.toFixed(2)} – ${maxSalary?.toFixed(2)}`}
              disabled={structure === 'minimum'}
            />
            {/* MAX button — fills salary with the position-appropriate max */}
            <button
              className="fab-max-btn"
              type="button"
              onClick={fillMax}
              disabled={structure === 'minimum'}
              title={`Fill with ${pos === 'QB' ? 'QB' : 'non-QB'} max salary`}
            >
              MAX
            </button>
          </div>
        </div>

        {/* Years */}
        <div className="fab-field">
          <label className="fab-label">Years</label>
          <div className="fab-years-row">
            {[1, 2, 3, 4, 5].filter(y => y <= maxYears).map(y => (
              <button
                key={y}
                type="button"
                className={`fab-year-btn ${years === y ? 'fab-year-btn--active' : ''}`}
                onClick={() => { setYears(y); if (y === 1) setNonGuar(false) }}
              >
                {y}yr
              </button>
            ))}
          </div>
        </div>

        {/* Structure */}
        <div className="fab-field">
          <label className="fab-label">Structure</label>
          <div className="fab-structure-row">
            {['flat','ascending','descending','minimum'].map(s => (
              <button
                key={s}
                type="button"
                className={`fab-structure-btn ${structure === s ? 'fab-structure-btn--active' : ''}`}
                onClick={() => {
                  setStructure(s)
                  if (s === 'minimum') { setSalary(''); setYears(Math.min(years, 2)) }
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Non-guaranteed final year */}
        {years > 1 && structure !== 'minimum' && (
          <div className="fab-field fab-field--inline">
            <label className="fab-label">Non-guaranteed final year</label>
            <input type="checkbox" checked={nonGuar} onChange={e => setNonGuar(e.target.checked)}
              className="fab-checkbox"/>
          </div>
        )}

        {/* Signing bonus */}
        <div className="fab-field">
          <label className="fab-label">
            Signing Bonus (optional)
            {sbBalance !== null && <span className="fab-sb-hint"> — ${sbBalance.toFixed(2)} available</span>}
          </label>
          <div className="fab-salary-row">
            <span className="fab-dollar">$</span>
            <input
              className="fab-input"
              type="number"
              step="0.1"
              min="0"
              max={sbBalance ?? undefined}
              value={sigBonus}
              onChange={e => setSigBonus(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Drop a player */}
        <div className="fab-field">
          <label className="fab-label">Drop a player to make room (optional)</label>
          <select
            className="fab-select"
            value={dropPlayer}
            onChange={e => {
              const sid = e.target.value
              setDropPlayer(sid)
              const r = roster.find(r => (r.players?.sleeper_id || r.sleeper_id) === sid)
              setDropName(r?.players?.full_name || r?.full_name || '')
            }}
          >
            <option value="">— None —</option>
            {roster.map(r => {
              const sid  = r.players?.sleeper_id || r.sleeper_id
              const name = r.players?.full_name  || r.full_name || sid
              return <option key={sid} value={sid}>{name}</option>
            })}
          </select>
        </div>

        {/* Contract preview */}
        {contractYears.length > 0 && (
          <div className="fab-preview">
            <div className="fab-preview-title">Contract Preview</div>
            <table className="fab-preview-table">
              <thead>
                <tr><th>Year</th><th>Season</th><th>Salary</th><th>Guaranteed</th></tr>
              </thead>
              <tbody>
                {contractYears.map((cy, i) => (
                  <tr key={i} className={cy.isGuaranteed === false ? 'fab-row--ng' : ''}>
                    <td>Y{i + 1}</td>
                    <td>{cy.season}</td>
                    <td>${cy.salary.toFixed(2)}</td>
                    <td>{cy.isGuaranteed === false ? <span className="fab-ng-label">Non-GTD</span> : '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="fab-preview-summary">
              <span>Guaranteed: <strong>${guaranteedSalary.toFixed(2)}</strong></span>
              {nonGuarMoney > 0 && <span>Non-GTD: <strong>${nonGuarMoney.toFixed(2)}</strong></span>}
            </div>
          </div>
        )}

        {/* Cap impact */}
        {capCheck && (
          <div className={`fab-cap-impact ${capCheck.overCap ? 'fab-cap-impact--over' : ''}`}>
            <span>Projected cap: <strong>${capCheck.projected.toFixed(2)}</strong> / ${capCheck.hardCap}</span>
            {capCheck.overCap && <span className="fab-cap-over"> ⚠ Over hard cap</span>}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="fab-errors">
            {errors.map((e, i) => <div key={i} className="fab-error">⚠ {e}</div>)}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`fab-result ${result.ok ? 'fab-result--ok' : 'fab-result--err'}`}>
            {result.msg}
            {result.ok && (
              <button className="fab-back-btn" onClick={() => navigate('/free-agents')}>
                Back to Free Agents
              </button>
            )}
          </div>
        )}

        {/* Submit */}
        {!result?.ok && (
          <button
            className="fab-submit"
            onClick={handleSubmit}
            disabled={submitting || !preId || !salary || errors.length > 0 || (seasonMode && seasonMode !== 'regular_season')}
          >
            {submitting ? 'Submitting…' : 'Submit Sealed Bid'}
          </button>
        )}

      </div>
    </div>
  )
}
