import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { TEAMS } from '../data/league'
import { submitFABid } from '../utils/api'
import { headshotUrl } from '../hooks/useSleeper'
import { buildContractYears, getSeasonConsts, CURRENT_SEASON } from '../utils/contractCalc'
import './FABidPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function FABidPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const preId   = searchParams.get('player') || ''
  const preName = searchParams.get('name')   || ''

  const SEASON = CURRENT_SEASON
  const consts = getSeasonConsts(SEASON)

  const [playerInfo, setPlayerInfo] = useState(null)
  const [roster,     setRoster]     = useState([])
  const [sbBalance,  setSbBalance]  = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState(null)

  const [team,        setTeam]        = useState('')
  const [managerName, setManagerName] = useState('')
  const [salary,      setSalary]      = useState('')
  const [years,       setYears]       = useState(1)
  const [structure,   setStructure]   = useState('flat')
  const [nonGuar,     setNonGuar]     = useState(false)
  const [sigBonus,    setSigBonus]    = useState('')
  const [dropPlayer,  setDropPlayer]  = useState('')
  const [dropName,    setDropName]    = useState('')
  const [notes,       setNotes]       = useState('')

  // Load player info
  useEffect(() => {
    if (!preId) return
    fetch(`${API_BASE}/players/${preId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlayerInfo(d) })
  }, [preId])

  // Load team roster + SB balance when team selected
  useEffect(() => {
    if (!team) return
    fetch(`${API_BASE}/teams/${team}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRoster(d?.roster || []))
    fetch(`${API_BASE}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[team] ?? null))
  }, [team])

  const pos = playerInfo?.position

  // Minimum contract: max 2 years
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

  // Guaranteed money calculation for display
  const guaranteedSalary = contractYears.filter(cy => cy.isGuaranteed !== false).reduce((s, cy) => s + cy.salary, 0)
  const guaranteedMoney  = parseFloat((guaranteedSalary + sbAmount).toFixed(2))
  const nonGuerMoney     = contractYears.filter(cy => cy.isGuaranteed === false).reduce((s, cy) => s + cy.salary, 0)

  // Cap check
  const capCheck = useMemo(() => {
    if (!team || !salary) return null
    const t = TEAMS.find(t => t.abbrev === team)
    if (!t) return null
    const sal = parseFloat(salary) || 0
    const projected = t.salary + sal
    return {
      current: t.salary, projected,
      space: consts.hardCap - projected,
      isOver: projected > consts.hardCap,
      isLux:  projected > consts.ltl,
    }
  }, [team, salary])

  // Validation errors
  const errors = useMemo(() => {
    const errs = []
    const sal = parseFloat(salary)
    if (salary && !isNaN(sal)) {
      if (sal < consts.minSalary) errs.push(`Below minimum ($${consts.minSalary.toFixed(2)})`)
      const max = pos === 'QB' ? consts.qbMax : consts.nonQbMax
      if (sal > max) errs.push(`Exceeds ${pos==='QB'?'QB':'non-QB'} max ($${max.toFixed(2)})`)
    }
    if (nonGuar && years === 1) errs.push('Single-year contracts cannot be non-guaranteed')
    if (!sbIsValid) errs.push('Signing bonus must be in $0.10 increments')
    if (sbOverBudget) errs.push(`Signing bonus exceeds your budget ($${sbBalance?.toFixed(2)} available)`)
    if (capCheck?.isOver) errs.push(`Hard cap violation ($${capCheck.projected.toFixed(2)} > $${consts.hardCap})`)
    return errs
  }, [salary, nonGuar, years, sigBonus, sbIsValid, sbOverBudget, capCheck, pos])

  async function handleSubmit(e) {
    e.preventDefault()
    if (errors.length || !team || !managerName) {
      setResult({ ok: false, msg: !team || !managerName ? 'Fill in team and your name.' : errors[0] })
      return
    }
    setSubmitting(true); setResult(null)

    const r = await submitFABid({
      sleeper_id:           preId || '',
      player_name:          playerInfo?.full_name || preName,
      team_abbrev:          team,
      manager_name:         managerName,
      salary:               parseFloat(structure === 'minimum' ? consts.minSalary : salary),
      years,
      structure,
      non_guaranteed_final: nonGuar && years > 1,
      signing_bonus:        sbAmount,
      contract_years:       contractYears.map(cy => ({
        season:        cy.year,
        salary:        cy.salary,
        is_guaranteed: cy.isGuaranteed !== false,
      })),
      drop_player:  dropPlayer || null,
      drop_name:    dropName   || null,
      notes:        notes      || null,
      season:       SEASON,
    })

    setSubmitting(false)
    if (r?.bid?.id || r?.message) {
      setResult({ ok: true, msg: `Bid submitted for ${playerInfo?.full_name || preName}. The commissioner will review all bids for this player and award based on guaranteed money.` })
    } else {
      setResult({ ok: false, msg: r?.error || 'Submission failed — is the backend running?' })
    }
  }

  const posColor = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }
  const selectedTeam = TEAMS.find(t => t.abbrev === team)

  return (
    <div className="fab-root">
      <div className="fab-header">
        <div className="fab-header-inner">
          <div>
            <h1 className="fab-title">Submit FA Bid</h1>
            <p className="fab-sub">{SEASON} Season · Guaranteed money determines winner</p>
          </div>
          <Link to={preId ? `/player/${preId}` : '/free-agents'} className="fab-back">← Back</Link>
        </div>
      </div>

      <div className="fab-content">
        <div className="fab-form-wrap">

          {/* Player preview */}
          {(playerInfo || preName) && (
            <div className="fab-player-preview">
              {preId && <img src={headshotUrl(preId)} alt="" className="fab-player-shot" onError={e=>e.target.style.display='none'}/>}
              <div className="fab-player-info">
                <div className="fab-player-name">{playerInfo?.full_name || preName}</div>
                <div className="fab-player-meta">
                  {pos && <span className="fab-pos" style={{background:`${posColor[pos]}22`,color:posColor[pos]}}>{pos}</span>}
                  {playerInfo?.nfl_team && <span className="fab-nfl">{playerInfo.nfl_team}</span>}
                  <span className="fab-fa-badge">FREE AGENT</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="fab-form">

            {/* Team + Manager */}
            <div className="fab-row">
              <div className="fab-field">
                <label className="fab-label">Your Team *</label>
                <select className="fab-select" value={team} onChange={e=>setTeam(e.target.value)} required>
                  <option value="">Select team…</option>
                  {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name} ({t.manager})</option>)}
                </select>
              </div>
              <div className="fab-field">
                <label className="fab-label">Your Name *</label>
                <input className="fab-input" placeholder="e.g. Adam Spinella"
                  value={managerName} onChange={e=>setManagerName(e.target.value)} required/>
              </div>
            </div>

            {/* Contract Type */}
            <div className="fab-field">
              <label className="fab-label">Contract Type *</label>
              <div className="fab-type-tabs">
                {['minimum','flat','escalating','descending'].map(t => (
                  <button key={t} type="button"
                    className={`fab-type-tab ${structure===t?'fab-type-tab--active':''}`}
                    onClick={() => {
                      setStructure(t)
                      if (t === 'minimum') { setSalary(consts.minSalary.toFixed(2)); setYears(Math.min(years, 2)) }
                    }}>
                    {t === 'escalating' ? 'Ascending' : t === 'descending' ? 'Descending' : t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary + Years */}
            <div className="fab-row">
              <div className="fab-field">
                <label className="fab-label">Salary (Year 1) *</label>
                <div className="fab-input-wrap">
                  <span className="fab-prefix">$</span>
                  <input className="fab-input fab-input--prefix" type="number" step="0.01"
                    min={consts.minSalary} max={pos==='QB'?consts.qbMax:consts.nonQbMax}
                    value={salary} onChange={e=>setSalary(e.target.value)}
                    disabled={structure==='minimum'} required/>
                </div>
                <span className="fab-hint">Min ${consts.minSalary.toFixed(2)} · Max ${(pos==='QB'?consts.qbMax:consts.nonQbMax).toFixed(2)}</span>
              </div>
              <div className="fab-field">
                <label className="fab-label">Years *</label>
                <div className="fab-yr-btns">
                  {Array.from({length: maxYears}, (_,i) => i+1).map(y => (
                    <button key={y} type="button"
                      className={`fab-yr-btn ${years===y?'fab-yr-btn--active':''}`}
                      onClick={() => setYears(y)}>
                      {y}yr
                    </button>
                  ))}
                </div>
                {structure === 'minimum' && <span className="fab-hint">Minimum contracts: 1-2 years only</span>}
              </div>
            </div>

            {/* Non-guaranteed final year */}
            {years > 1 && (
              <div className="fab-field">
                <label className="fab-checkbox">
                  <input type="checkbox" checked={nonGuar} onChange={e=>setNonGuar(e.target.checked)}/>
                  <span>Final year <span style={{color:'var(--purple)',fontWeight:600}}>non-guaranteed</span> ($0 dead cap if released)</span>
                </label>
              </div>
            )}

            {/* Contract preview */}
            {contractYears.length > 0 && (
              <div className="fab-preview">
                <div className="fab-preview-title">Contract Preview</div>
                {contractYears.map(cy => (
                  <div key={cy.year} className={`fab-preview-row ${cy.isGuaranteed===false?'fab-preview-ng':''}`}>
                    <span className="fab-preview-yr">{cy.year} · Yr {cy.yearNum}</span>
                    <span className="fab-preview-sal" style={cy.isGuaranteed===false?{color:'var(--purple)'}:{}}>${cy.salary.toFixed(2)}</span>
                    {cy.isGuaranteed===false && <span className="fab-preview-ng-tag">Non-Guaranteed</span>}
                  </div>
                ))}
                <div className="fab-preview-total">
                  <span>Total value</span>
                  <span>${contractYears.reduce((s,cy)=>s+cy.salary,0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Signing Bonus */}
            <div className="fab-field">
              <label className="fab-label">Signing Bonus</label>
              <div className="fab-input-wrap">
                <span className="fab-prefix">$</span>
                <input className="fab-input fab-input--prefix" type="number" step="0.10" min="0"
                  placeholder="0.00" value={sigBonus} onChange={e=>setSigBonus(e.target.value)}/>
              </div>
              <span className="fab-hint">
                Must be in $0.10 increments · Does not count against cap ·{' '}
                {sbBalance !== null
                  ? <span style={{color: sbOverBudget ? 'var(--red)' : 'var(--green)'}}>
                      Budget remaining: ${sbBalance.toFixed(2)}
                    </span>
                  : 'Select team to see balance'}
              </span>
            </div>

            {/* Guaranteed money summary */}
            {(guaranteedMoney > 0 || sbAmount > 0) && (
              <div className="fab-guaranteed-summary">
                <div className="fab-gs-title">BID SUMMARY — what determines the winner</div>
                <div className="fab-gs-row">
                  <span>Guaranteed salary</span>
                  <span>${guaranteedSalary.toFixed(2)}</span>
                </div>
                <div className="fab-gs-row">
                  <span>Signing bonus</span>
                  <span>${sbAmount.toFixed(2)}</span>
                </div>
                <div className="fab-gs-row fab-gs-total">
                  <span>Total guaranteed money</span>
                  <span>${guaranteedMoney.toFixed(2)}</span>
                </div>
                {nonGuerMoney > 0 && (
                  <div className="fab-gs-row fab-gs-ng">
                    <span>Non-guaranteed (tiebreaker)</span>
                    <span style={{color:'var(--purple)'}}>${nonGuerMoney.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Cap check */}
            {capCheck && (
              <div className={`fab-cap-check ${capCheck.isOver?'fab-cap-over':capCheck.isLux?'fab-cap-lux':'fab-cap-ok'}`}>
                <div className="fab-cap-row"><span>Current salary</span><span>${capCheck.current.toFixed(2)}</span></div>
                <div className="fab-cap-row"><span>+ Year 1 salary</span><span>+${parseFloat(salary||0).toFixed(2)}</span></div>
                <div className="fab-cap-row fab-cap-total">
                  <span>Projected total</span>
                  <span className={capCheck.isOver?'cap-red':capCheck.isLux?'cap-gold':'cap-green'}>${capCheck.projected.toFixed(2)}</span>
                </div>
                {capCheck.isOver && <div className="fab-cap-warning">⚠ HARD CAP VIOLATION</div>}
                {capCheck.isLux && !capCheck.isOver && <div className="fab-cap-info">Over luxury tax line</div>}
              </div>
            )}

            {/* Drop player */}
            {roster.length > 0 && (
              <div className="fab-field">
                <label className="fab-label">Drop Player (if needed)</label>
                <select className="fab-select" value={dropPlayer}
                  onChange={e => {
                    const p = roster.find(r=>(r.players?.sleeper_id||r.sleeper_id)===e.target.value)
                    setDropPlayer(e.target.value)
                    setDropName(p?.players?.full_name||'')
                  }}>
                  <option value="">No drop</option>
                  {roster.map(r => {
                    const p = r.players||{}
                    const sid = p.sleeper_id||r.sleeper_id
                    return <option key={sid} value={sid}>{p.full_name} ({p.position}) · ${parseFloat(r.salary||0).toFixed(2)}</option>
                  })}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="fab-field">
              <label className="fab-label">Notes (optional)</label>
              <textarea className="fab-textarea" rows={3} placeholder="Any context for the commissioner…"
                value={notes} onChange={e=>setNotes(e.target.value)}/>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="fab-errors">
                {errors.map((e,i) => <div key={i} className="fab-error-item">⚠ {e}</div>)}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`fab-result ${result.ok?'fab-result--ok':'fab-result--err'}`}>
                {result.msg}
                {result.ok && (
                  <div className="fab-result-actions">
                    <button type="button" className="fab-result-btn" onClick={()=>navigate(-1)}>← Go Back</button>
                    <button type="button" className="fab-result-btn" onClick={()=>{
                      setSalary('');setYears(1);setStructure('flat');setNonGuar(false)
                      setSigBonus('');setDropPlayer('');setNotes('');setResult(null)
                    }}>Submit Another</button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="fab-submit" disabled={submitting || errors.length > 0}>
              {submitting ? 'Submitting…' : 'Submit FA Bid →'}
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="fab-sidebar">
          <div className="fab-sidebar-card">
            <div className="fab-sidebar-title">How Bids Are Decided</div>
            <ol className="fab-sidebar-steps">
              <li><strong>Highest guaranteed money wins</strong> (signing bonus + guaranteed salary years)</li>
              <li>Tiebreaker: most total years</li>
              <li>Tiebreaker: most non-guaranteed money</li>
              <li>Tiebreaker: Ascending &gt; Flat &gt; Descending</li>
              <li>True tie: both managers resubmit next window</li>
            </ol>
          </div>
          <div className="fab-sidebar-card">
            <div className="fab-sidebar-title">2026 Cap Rules</div>
            <ul className="fab-sidebar-rules">
              <li>Hard Cap <strong>${consts.hardCap.toFixed(2)}</strong></li>
              <li>Luxury Line <strong>${consts.ltl.toFixed(2)}</strong></li>
              <li>Min Salary <strong>${consts.minSalary.toFixed(2)}</strong></li>
              <li>QB Max <strong>${consts.qbMax.toFixed(2)}</strong></li>
              <li>Non-QB Max <strong>${consts.nonQbMax.toFixed(2)}</strong></li>
            </ul>
          </div>
          {selectedTeam && sbBalance !== null && (
            <div className="fab-sidebar-card">
              <div className="fab-sidebar-title">Signing Bonus Budget</div>
              <div className="fab-sb-meter">
                <div className="fab-sb-bar-track">
                  <div className="fab-sb-bar-fill"
                    style={{width:`${Math.max(0,Math.min(100,(sbBalance/(consts.ltl*0.2))*100)).toFixed(1)}%`,
                      background: sbBalance < 5 ? 'var(--red)' : sbBalance < 10 ? 'var(--gold)' : 'var(--green)'}}/>
                </div>
                <div className="fab-sb-val">${sbBalance.toFixed(2)} remaining</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
