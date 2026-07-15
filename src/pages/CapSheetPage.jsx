import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TEAMS, LOGOS, CAP } from '../data/league'
import { useTeamColors } from '../hooks/useTeamColors'
import { headshotUrl } from '../hooks/useSleeper'
import './CapSheetPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ADMIN_PW = 'Sickos26-Vault!Q7'
const CURRENT_SEASON = new Date().getFullYear()
const YEARS = Array.from({length:6}, (_,i) => CURRENT_SEASON + i)

const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843', K:'#8a9bb0' }

import { getSeasonConsts, getMaxForYear, getMinForYear, buildContractYears, validateContractYears } from '../utils/contractCalc'

function computeConsts(year) { return getSeasonConsts(year) }

function calcSalaryForYear(contract, year) {
  if (!contract) return null
  const startYear = contract.season || CURRENT_SEASON
  const yearNum   = year - startYear
  // Out of contract range
  if (yearNum < 0 || yearNum >= contract.years) return null

  // First check contract_years table — most accurate
  const cy = contract.contract_years?.find(c => c.season === year)
  if (cy) return parseFloat(cy.salary)
  // Fallback: compute from structure
  const base   = parseFloat(contract.base_salary || contract.salary || 0)
  const consts = computeConsts(year)
  const maxSal = contract.players?.position === 'QB' ? consts.qbMax : consts.nonQbMax

  if (contract.structure === 'minimum' || contract.structure === 'min') {
    return consts.minSalary
  }
  if (contract.structure === 'max') {
    return maxSal
  }
  if (contract.structure === 'escalating') {
    const computed = parseFloat((base * Math.pow(1.1, yearNum)).toFixed(2))
    return Math.min(computed, maxSal)
  }
  if (contract.structure === 'descending') {
    const computed = parseFloat((base * Math.pow(0.9, yearNum)).toFixed(2))
    return Math.max(computed, consts.minSalary)
  }
  return base // flat
}

function getFAStatus(contract) {
  if (!contract) return null
  const lastYear = (contract.season || CURRENT_SEASON) + contract.years - 1
  const faYear   = lastYear + 1
  const rfaRound = contract.rfa_round // 1, 2, or null
  const type     = rfaRound ? `RFA (${rfaRound === 1 ? '1st' : '2nd'})` : 'UFA'
  return { year: faYear, type, isRFA: !!rfaRound, round: rfaRound }
}


// ── Signing Bonus Projection Widget ─────────────────────────────────────────
function SBWidget({ abbrev, salary }) {
  const SEASON = CURRENT_SEASON
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!abbrev) return
    fetch(`${API_BASE}/bids/sb-projection/${abbrev}?season=${SEASON}&salary=${salary||0}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
  }, [abbrev, salary])

  if (!data) return null

  const { balance, startBalance, spent, nextSeason } = data
  const pctUsed = startBalance ? Math.min(100, (spent / startBalance) * 100) : 0
  const barColor = balance < 5 ? 'var(--red)' : balance < 10 ? 'var(--gold)' : 'var(--green)'
  const maxNextBudget = Math.max(...(nextSeason?.scenarios||[]).map(s=>s.nextSeasonBudget), 1)

  return (
    <div className="sb-widget">
      <div className="sb-widget-header">
        <span className="sb-widget-title">Signing Bonus Budget</span>
        <span className="sb-widget-season">{SEASON} Season</span>
      </div>
      <div className="sb-widget-body">

        {/* Left: current season */}
        <div className="sb-current">
          <div className="sb-current-title">Current Balance</div>
          <div className="sb-balance-row">
            <span className="sb-balance-val">${balance?.toFixed(2)}</span>
            <span className="sb-balance-sub">of ${startBalance?.toFixed(2)||'—'} starting</span>
          </div>
          <div className="sb-bar-wrap">
            <div className="sb-bar-track">
              <div className="sb-bar-fill"
                style={{width:`${100-pctUsed}%`, background:barColor}}/>
            </div>
            <div className="sb-bar-labels">
              <span>$0</span>
              <span>{(100-pctUsed).toFixed(0)}% remaining</span>
              <span>${startBalance?.toFixed(2)||'—'}</span>
            </div>
          </div>
          <div style={{marginTop:4}}>
            <div className="sb-row">
              <span className="sb-row-label">Starting budget</span>
              <span className="sb-row-val">${startBalance?.toFixed(2)||'—'}</span>
            </div>
            <div className="sb-row">
              <span className="sb-row-label">Spent this season</span>
              <span className="sb-row-val" style={{color:'var(--red)'}}>−${spent?.toFixed(2)||'0.00'}</span>
            </div>
            <div className="sb-row">
              <span className="sb-row-label">Remaining</span>
              <span className="sb-row-val" style={{color:barColor}}>${balance?.toFixed(2)}</span>
            </div>
          </div>
          <div className="sb-proj-formula">
            <div style={{fontFamily:'var(--font-ui)',fontSize:10,fontWeight:700,
              letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4}}>
              {nextSeason?.year} Budget Formula
            </div>
            <div className="sb-formula-row">
              <span>Base ({nextSeason?.year} LTL × 20%)</span>
              <span>${nextSeason?.base?.toFixed(2)}</span>
            </div>
            <div className="sb-formula-row">
              <span>+ Rollover (20% of unused)</span>
              <span style={{color:'var(--green)'}}>+${nextSeason?.atCurrentSpend?.rollover?.toFixed(2)}</span>
            </div>
            <div className="sb-formula-row">
              <span>− Lux tax penalty</span>
              <span style={{color:'var(--red)'}}>−${nextSeason?.atCurrentSpend?.luxPenalty?.toFixed(2)}</span>
            </div>
            <div className="sb-formula-row">
              <span>+ Playoff bonus</span>
              <span style={{color:'var(--gold)'}}>+${nextSeason?.atCurrentSpend?.playoffBonus?.toFixed(2)||'0.00'}</span>
            </div>
            <div className="sb-formula-total">
              <span>Projected {nextSeason?.year} budget</span>
              <span style={{color:'var(--orange)'}}>${nextSeason?.atCurrentSpend?.total?.toFixed(2)}</span>
            </div>
            <div className="sb-formula-note">Based on current spend level. Playoff bonuses applied after season ends.</div>
          </div>
        </div>

        {/* Right: spend scenarios */}
        <div className="sb-projection">
          <div className="sb-proj-title">{nextSeason?.year} Budget — Spend Scenarios</div>
          <div className="sb-scenarios">
            {(nextSeason?.scenarios||[]).map((s,i) => (
              <div key={i} className="sb-scenario">
                <span className="sb-scenario-label">{s.label}</span>
                <div className="sb-scenario-bar">
                  <div className="sb-scenario-fill"
                    style={{width:`${((s.nextSeasonBudget/maxNextBudget)*100).toFixed(1)}%`,
                      background: s.nextSeasonBudget < 20 ? 'var(--red)' :
                                  s.nextSeasonBudget < 24 ? 'var(--gold)' : 'var(--green)'}}/>
                </div>
                <span className="sb-scenario-val">${s.nextSeasonBudget?.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{fontFamily:'var(--font-body)',fontSize:11,color:'var(--text-muted)',marginTop:4,fontStyle:'italic'}}>
            Spending more this season means less rollover → lower {nextSeason?.year} starting budget.
            The base is always ${nextSeason?.base?.toFixed(2)} (LTL × 20%).
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ contract, playerName, onSave, onClose, adminPw }) {
  // contractStartYear = when contract was signed (could be 2025)
  // displayStartYear = first year we show (always >= 2026)
  const contractStartYear = contract.season || CURRENT_SEASON
  const displayStartYear  = Math.max(contractStartYear, 2026)
  const startYear = displayStartYear
  const position  = contract.players?.position || 'WR'
  const slot      = contract.roster_slots?.[0]?.slot_type || 'active'

  // Build initial salary map from existing contract_years or computed values
  const initSalaries = () => YEARS.reduce((acc, yr) => {
    const s = calcSalaryForYear(contract, yr)
    acc[yr] = s != null ? s.toFixed(2) : ''
    return acc
  }, {})

  const [salaries, setSalaries] = useState(initSalaries)
  const [contractYears, setContractYears] = useState(() => {
    // Use actual contract years — count how many seasons are in YEARS window
    const startYear = contract.season || CURRENT_SEASON
    const endYear   = startYear + (contract.years || 1) - 1
    const visibleYears = YEARS.filter(yr => yr >= CURRENT_SEASON && yr <= endYear).length
    return Math.max(1, visibleYears || contract.years || 1)
  })
  const [rfaRound,     setRfaRound]     = useState(contract.rfa_round || 0)
  const [guaranteedMap, setGuaranteedMap] = useState(() => {
    // Pre-populate from existing contract_years data
    const map = {}
    YEARS.forEach(yr => {
      const cy = contract.contract_years?.find(c => c.season === yr)
      if (cy) {
        const guar = cy.is_guaranteed
        map[yr] = !(guar === false || guar === 'false' || guar === 0)
      }
    })
    return map
  })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  function toggleGuaranteed(yr) {
    setGuaranteedMap(prev => ({
      ...prev,
      [yr]: !(prev[yr] !== false) // toggle: undefined/true → false, false → true
    }))
  }

  function isYearGuaranteed(yr) {
    if (yr in guaranteedMap) return guaranteedMap[yr]
    return true // default guaranteed
  }

  // contractYears state = how many years to show FROM 2026
  // regardless of when the contract was originally signed
  const contractEndYear = CURRENT_SEASON + contractYears - 1
  const activeYears = YEARS.filter(yr => yr >= CURRENT_SEASON && yr <= contractEndYear)

  // ── Auto-populate helpers ────────────────────────────────────────────────────
  function applyStructure(structure, baseSalary) {
    // Build from contractStartYear so escalation/descent math is correct
    // but we only populate visible years (2026+)
    const built = buildContractYears({
      baseSalary: parseFloat(baseSalary) || getMinForYear(contractStartYear),
      structure,
      years:     (2026 + contractYears - 1) - contractStartYear + 1, // total years from start to display end
      nonGuar:   false,
      startYear: contractStartYear,
      position,
      slot,
    })
    const next = { ...salaries }
    built.filter(cy => cy.year >= CURRENT_SEASON).forEach(cy => { next[cy.year] = cy.salary.toFixed(2) })
    setSalaries(next)
  }

  // ── Per-year derived metadata ────────────────────────────────────────────────
  function yearMeta(yr) {
    const minSal = getMinForYear(yr)
    const maxSal = getMaxForYear(position, yr)
    const raw    = parseFloat(salaries[yr])
    const val    = isNaN(raw) ? 0 : raw
    const isMax  = val > 0 && val >= maxSal
    const isMin  = val > 0 && val <= minSal
    const isBelowMin = val > 0 && val < minSal
    let capHit = val
    if (slot === 'ps' || slot === 'ir') capHit *= 0.5
    if (isMax) capHit *= 0.8
    return { minSal, maxSal, val, isMax, isMin, isBelowMin, capHit: parseFloat(capHit.toFixed(2)) }
  }

  // Clamp on blur + enforce the dead zone between capHit-equivalent and max
  function handleBlur(yr) {
    const { minSal, maxSal, val } = yearMeta(yr)
    if (val <= 0) return
    // Floor
    if (val < minSal) { setSalaries(p => ({...p, [yr]: minSal.toFixed(2)})); return }
    // Ceiling
    if (val > maxSal) { setSalaries(p => ({...p, [yr]: maxSal.toFixed(2)})); return }
    // Dead zone: anything between maxCapHit and maxSal makes no sense
    // maxCapHit = maxSal * 0.8 (the cap hit at max). If you offer between
    // maxCapHit and maxSal you get a worse cap hit than just offering the max.
    // So snap: if val > maxSal*0.8 and val < maxSal, jump to maxSal.
    const maxCapHitEquiv = parseFloat((maxSal * 0.8).toFixed(2))
    if (val > maxCapHitEquiv && val < maxSal) {
      setSalaries(p => ({...p, [yr]: maxSal.toFixed(2)}))
    }
  }

  const anyYearIsMax = activeYears.some(yr => yearMeta(yr).isMax)

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setError('')

    if (!contract.id) {
      setError('Contract has no ID — reload the page and try again.')
      setSaving(false)
      return
    }

    const updates = activeYears.map(yr => ({
      season:        yr,
      salary:        parseFloat(salaries[yr]) || 0,
      is_guaranteed: isYearGuaranteed(yr),
    }))

    let r, data
    try {
      r = await fetch(`${API_BASE}/contracts/${contract.id}/years`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', 'x-admin-password': adminPw },
        body: JSON.stringify({
          years:                updates,
          rfa_round:            rfaRound || null,
          non_guaranteed_final: !isYearGuaranteed(contractEndYear),
          is_max_contract:      anyYearIsMax,
          contract_years:       contractYears,
        }),
      })
      data = await r.json()
    } catch (e) {
      setError(`Network error: ${e.message}`)
      setSaving(false)
      return
    }

    setSaving(false)
    if (r.ok) { onSave(); onClose() }
    else setError(data.error || `Save failed (${r.status})`)
  }

  // What's the current base (year 1) for re-computing structures
  const currentBase = parseFloat(salaries[CURRENT_SEASON]) || getMinForYear(CURRENT_SEASON)

  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>

        <div className="cs-modal-header">
          <div className="cs-modal-header-left">
            <span className="cs-modal-title">{playerName}</span>
            <span className="cs-modal-pos" style={{color: POS_COLOR[position]}}>{position}</span>
            <span className="cs-modal-years-badge">{contract.years}yr</span>
          </div>
          <button className="cs-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cs-modal-body">

          {/* ── Contract length (top) ── */}
          <div className="cs-modal-top-row">
            <div className="cs-modal-field">
              <label className="cs-modal-label">Contract Length</label>
              <div className="cs-years-select">
                {[1,2,3,4,5].map(y => (
                  <button key={y} type="button"
                    className={'cs-yr-btn' + (contractYears===y ? ' cs-yr-btn--active' : '')}
                    onClick={() => setContractYears(y)}>
                    {y}yr
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Quick-fill buttons ── */}
          <div className="cs-modal-quickfill">
            <span className="cs-modal-quickfill-label">Auto-fill:</span>
            <button className="cs-qf-btn cs-qf-max"   onClick={() => applyStructure('max',     currentBase)}>MAX</button>
            <button className="cs-qf-btn cs-qf-min"   onClick={() => applyStructure('minimum', currentBase)}>MIN</button>
            <button className="cs-qf-btn cs-qf-flat"  onClick={() => applyStructure('flat',    currentBase)}>Flat</button>
            <button className="cs-qf-btn cs-qf-asc"   onClick={() => applyStructure('escalating',  currentBase)}>Ascending</button>
            <button className="cs-qf-btn cs-qf-desc"  onClick={() => applyStructure('descending', currentBase)}>Descending</button>
            <span className="cs-modal-quickfill-hint">Uses Year 1 as base</span>
          </div>

          {/* ── Year inputs ── */}
          <div className="cs-modal-years-grid">
            {activeYears.map(yr => {
              const { minSal, maxSal, val, isMax, isMin, isBelowMin, capHit } = yearMeta(yr)
              const isGuaranteed = isYearGuaranteed(yr)
              const isNG = !isGuaranteed
              return (
                <div key={yr} className={[
                  'cs-modal-year',
                  isMax  ? 'cs-modal-year--max' : '',
                  isNG   ? 'cs-modal-year--ng'  : '',
                  isBelowMin ? 'cs-modal-year--err' : '',
                ].filter(Boolean).join(' ')}>

                  <div className="cs-modal-year-header">
                    <label className="cs-modal-label">{yr}</label>
                    <div className="cs-modal-year-badges">
                      {isMax && <span className="cs-badge-max">MAX</span>}
                      {isBelowMin && <span className="cs-badge-err">BELOW MIN</span>}
                    </div>
                  </div>

                  <div className="cs-modal-sal-wrap">
                    <span className="cs-modal-prefix">$</span>
                    <input
                      className="cs-modal-input"
                      type="number" step="0.01"
                      min={minSal} max={maxSal}
                      value={salaries[yr]}
                      onChange={e => setSalaries(p => ({...p, [yr]: e.target.value}))}
                      onBlur={() => handleBlur(yr)}
                      style={isMax ? {color:'var(--gold)',fontWeight:700} : isNG ? {color:'var(--purple)'} : isBelowMin ? {color:'var(--red)'} : {}}
                    />
                  </div>

                  {/* Guaranteed toggle */}
                  <label className="cs-modal-guar-toggle">
                    <input type="checkbox" checked={isGuaranteed}
                      onChange={() => toggleGuaranteed(yr)}/>
                    <span className={isGuaranteed ? 'cs-guar-yes' : 'cs-guar-no'}>
                      {isGuaranteed ? 'Guaranteed' : 'Non-Guaranteed'}
                    </span>
                  </label>

                  {val > 0 && (
                    <div className="cs-modal-cap-line">
                      {isMax
                        ? <span className="cs-cap-note cs-cap-max">cap: ${capHit.toFixed(2)} <em>(20% credit)</em></span>
                        : (slot==='ps'||slot==='ir')
                          ? <span className="cs-cap-note">cap: ${capHit.toFixed(2)} (50%)</span>
                          : <span className="cs-cap-note">cap: ${capHit.toFixed(2)}</span>
                      }
                    </div>
                  )}

                  <div className="cs-modal-range-hint">
                    floor ${minSal.toFixed(2)} · ceiling ${maxSal.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>

          {anyYearIsMax && (
            <div className="cs-modal-max-notice">
              ★ 80% cap hit (20% credit applied). Years at max are tethered to the LTL formula.
            </div>
          )}

          {/* ── Options ── */}
          <div className="cs-modal-options">
            <div className="cs-modal-field">
              <label className="cs-modal-label">FA Status after contract</label>
              <select className="cs-modal-select" value={rfaRound} onChange={e => setRfaRound(parseInt(e.target.value))}>
                <option value={0}>UFA — Unrestricted</option>
                <option value={1}>RFA — 1st Round Pick</option>
                <option value={2}>RFA — 2nd Round Pick</option>
              </select>
            </div>
          </div>

          {error && <div className="cs-modal-error">{error}</div>}
        </div>

        <div className="cs-modal-footer">
          <button className="cs-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="cs-modal-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Cap Sheet Page ───────────────────────────────────────────────────────
export default function CapSheetPage() {
  const { abbrev } = useParams()
  const [roster,    setRoster]    = useState([])
  const [deadCap,   setDeadCap]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [adminPw,   setAdminPw]   = useState('')
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [refreshKey,setRefreshKey]= useState(0)

  const team   = TEAMS.find(t => t.abbrev === abbrev?.toUpperCase())
  const colors = useTeamColors(LOGOS[abbrev?.toUpperCase()])

  useEffect(() => {
    if (!abbrev) return
    setLoading(true)
    const upper = abbrev.toUpperCase()
    Promise.all([
      fetch(`${API_BASE}/teams/${upper}`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/contracts/dead-cap/${upper}`).then(r => r.ok ? r.json() : []),
    ]).then(([teamData, dcData]) => {
      setRoster(teamData?.roster || [])
      setDeadCap(dcData || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [abbrev, refreshKey])

  if (!team) return <div style={{padding:40,color:'var(--text-muted)',fontFamily:'var(--font-ui)'}}>Team not found</div>

  // Group by slot
  const active = roster.filter(r => (r.roster_slots?.[0]?.slot_type||'active') === 'active')
  const ps     = roster.filter(r => r.roster_slots?.[0]?.slot_type === 'ps')
  const ir     = roster.filter(r => r.roster_slots?.[0]?.slot_type === 'ir')

  // Year totals — includes live roster cap hits + dead cap
  const yearTotals = YEARS.reduce((acc, yr) => {
    const rosterHit = roster.reduce((s, r) => {
      const sal = calcSalaryForYear(r, yr)
      if (sal == null) return s
      const slot = r.roster_slots?.[0]?.slot_type || 'active'
      let hit = sal
      if (slot === 'ps' || slot === 'ir') hit *= 0.5
      if (r.is_max_contract) hit *= 0.8
      return s + hit
    }, 0)
    const dcHit = deadCap
      .filter(d => d.season === yr)
      .reduce((s, d) => s + parseFloat(d.amount), 0)
    acc[yr] = rosterHit + dcHit
    return acc
  }, {})

  function PlayerRow({ contract, slotTag, slotColor }) {
    const p   = contract.players || {}
    const sid = p.sleeper_id || contract.sleeper_id
    const fa  = getFAStatus(contract)
    const lastContractYear = (contract.season || CURRENT_SEASON) + contract.years - 1

    return (
      <tr className="cs-row">
        {/* Slot */}
        <td className="cs-slot">
          <span style={{borderLeftColor: slotColor || POS_COLOR[p.position] || 'var(--border)'}}>
            {slotTag}
          </span>
        </td>

        {/* Player */}
        <td className="cs-player">
          <Link to={`/player/${sid}`} className="cs-player-link">
            <img src={headshotUrl(sid)} alt="" className="cs-shot" onError={e=>e.target.style.opacity=0}/>
            <div className="cs-pinfo">
              <span className="cs-pname">{p.full_name || '—'}</span>
              <span className="cs-ppos" style={{color:POS_COLOR[p.position]}}>{p.position} · {p.nfl_team||'FA'}</span>
            </div>
          </Link>
        </td>

        {/* Year columns */}
        {YEARS.map(yr => {
          const sal      = calcSalaryForYear(contract, yr)
          const slot     = contract.roster_slots?.[0]?.slot_type || 'active'
          const isMax    = contract.is_max_contract
          const isFAYear = fa && fa.year === yr

          // Check per-year guaranteed status — three fallback levels:
          // 1. contract_years row with explicit is_guaranteed flag (most accurate)
          // 2. non_guaranteed_final flag for the last contract year
          // 3. Default: guaranteed
          const cyRow = contract.contract_years?.find(c => c.season === yr)
          let isNG = false
          if (cyRow) {
            // Handle boolean false, string "false", integer 0 — all mean non-guaranteed
            const guar = cyRow.is_guaranteed
            isNG = guar === false || guar === 'false' || guar === 0
          } else if (contract.non_guaranteed_final) {
            isNG = (yr === lastContractYear)
          }

          // FA status cell — appears the year AFTER last contract year
          if (isFAYear) {
            return (
              <td key={yr} className="cs-year-cell">
                <span className={`cs-fa-badge ${fa.isRFA ? 'cs-fa-rfa' : 'cs-fa-ufa'}`}>
                  {fa.type}
                </span>
              </td>
            )
          }

          if (sal == null) {
            return <td key={yr} className="cs-year-cell cs-year-empty">—</td>
          }

          let capHit = sal
          if (slot === 'ps' || slot === 'ir') capHit *= 0.5
          if (isMax) capHit *= 0.8
          capHit = parseFloat(capHit.toFixed(2))

          // For max contracts: show cap hit (gold, large) + full salary (small, below)
          // For PS/IR: show cap hit (small) below salary
          // For NG years: purple text, no badge
          const salStyle = isNG ? { color: 'var(--purple)' } : {}

          return (
            <td key={yr} className={`cs-year-cell cs-year-has-val ${isNG ? 'cs-ng-cell' : ''}`}>
              {isMax ? (
                <>
                  <span className="cs-sal cs-sal--cap-hit" style={salStyle}>${capHit.toFixed(2)}</span>
                  <span className="cs-cap-hit cs-cap-hit--full" style={isNG ? {color:'var(--purple)',opacity:0.6} : {}}>${sal.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span className="cs-sal" style={salStyle}>${sal.toFixed(2)}</span>
                  {(slot==='ps'||slot==='ir') && (
                    <span className="cs-cap-hit" style={isNG ? {color:'var(--purple)',opacity:0.6} : {}}>${capHit.toFixed(2)}</span>
                  )}
                </>
              )}
            </td>
          )
        })}

        {/* Edit button (admin only) */}
        {isAdmin && (
          <td className="cs-edit-cell">
            <button className="cs-edit-btn" onClick={() => setEditing(contract)}>Edit</button>
          </td>
        )}
      </tr>
    )
  }

  function SectionRows({ players, label, color }) {
    if (!players.length) return null
    return (
      <>
        <tr className="cs-section-header">
          <td colSpan={YEARS.length + 3} style={{borderLeftColor: color}}>
            {label} ({players.length})
          </td>
        </tr>
        {[...players]
          .sort((a,b) => {
            const po = {QB:0,RB:1,WR:2,TE:3,K:4}
            return (po[a.players?.position]??9)-(po[b.players?.position]??9)
          })
          .map((r,i) => (
            <PlayerRow key={r.id||i} contract={r} slotTag={label.split(' ')[0]} slotColor={color}/>
          ))
        }
      </>
    )
  }

  return (
    <div className="cs-root">
      {/* Header */}
      <div className="cs-header" style={{
        background: colors?.primary || 'var(--bg2)',
        borderBottom: `1px solid ${colors?.primary || 'var(--border)'}`,
      }}>
        <div className="cs-header-inner">
          <div className="cs-identity">
            <img src={LOGOS[abbrev?.toUpperCase()]} alt={team.name} className="cs-logo"
              style={{filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.4))'}}/>
            <div>
              <h1 className="cs-title" style={{
                color: colors?.text || 'var(--text-primary)',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>{team.name}</h1>
              <p className="cs-sub" style={{color: colors ? `${colors.text}88` : 'var(--text-muted)'}}>
                {team.manager} · Multi-Year Cap Sheet · {new Date().getFullYear()}–{new Date().getFullYear()+5}
              </p>
            </div>
          </div>
          <div className="cs-header-right">
            {!isAdmin ? (
              <div className="cs-admin-auth">
                <input type="password" className="cs-admin-input" placeholder="Admin password"
                  value={adminPw} onChange={e=>setAdminPw(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter' && adminPw===ADMIN_PW) setIsAdmin(true) }}/>
                <button className="cs-admin-btn" style={{
                  background: colors?.accent || 'var(--orange)',
                  color: colors ? (colors.text === '#ffffff' ? '#000' : '#fff') : '#000',
                }} onClick={()=>{ if(adminPw===ADMIN_PW) setIsAdmin(true) }}>
                  Edit Mode
                </button>
              </div>
            ) : (
              <div className="cs-admin-badge" style={{color: colors?.text}}>
                ✓ Admin Mode
                <button className="cs-admin-exit" style={{
                  borderColor: colors ? `${colors.text}44` : 'var(--border)',
                  color: colors?.text,
                }} onClick={()=>setIsAdmin(false)}>Exit</button>
              </div>
            )}
            <Link to={`/team/${abbrev}`} className="cs-back" style={{
              color: colors?.text,
              borderColor: colors ? `${colors.text}44` : 'var(--border)',
            }}>← Roster</Link>
          </div>
        </div>

        {/* Year header summaries */}
        <div className="cs-year-summary">
          <div className="cs-ys-label">CAP HIT</div>
          {YEARS.map(yr => {
            const c   = computeConsts(yr)
            const hit = yearTotals[yr] || 0
            const isLux  = hit > c.ltl
            const isOver = hit > c.hardCap
            return (
              <div key={yr} className="cs-ys-col">
                <div className="cs-ys-year">{yr}</div>
                <div className={`cs-ys-val ${isOver?'cs-over':isLux?'cs-lux':''}`}>${hit.toFixed(2)}</div>
                <div className="cs-ys-space">
                  <span className={isOver?'cs-over':''}>
                    {isOver ? `$${(hit-c.hardCap).toFixed(2)} OVER` : `$${(c.hardCap-hit).toFixed(2)} left`}
                  </span>
                </div>
                {/* Mini bar */}
                <div className="cs-ys-bar-wrap">
                  <div className="cs-ys-bar-track">
                    <div className={`cs-ys-bar-fill ${isLux?'cs-ys-lux':''}`}
                      style={{width:`${Math.min(100,(hit/c.hardCap)*100).toFixed(1)}%`}}/>
                    <div className="cs-ys-lux-line" style={{left:`${((c.ltl/c.hardCap)*100).toFixed(1)}%`}}/>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="cs-content">
        {loading ? (
          <div className="cs-loading">Loading cap sheet…</div>
        ) : roster.length === 0 ? (
          <div className="cs-empty">No roster data · Add players via Admin → Roster Management</div>
        ) : (
          <div className="cs-table-wrap">
            <table className="cs-table">
              <thead>
                <tr className="cs-thead-row">
                  <th className="th-slot">SLOT</th>
                  <th className="th-player">PLAYER</th>
                  {YEARS.map(yr => <th key={yr} className="th-year">{yr}</th>)}
                  {isAdmin && <th className="th-edit">EDIT</th>}
                </tr>
              </thead>
              <tbody>
                <SectionRows players={active} label="Active Roster" color="var(--orange)"/>
                <SectionRows players={ps}     label="Practice Squad" color="var(--blue)"/>
                <SectionRows players={ir}     label="Injured Reserve" color="var(--red)"/>

                {/* ── DEAD CAP ── */}
                {deadCap.length > 0 && (() => {
                  // Group dead cap by player (sleeper_id) — show one row per released player
                  const byPlayer = {}
                  deadCap.forEach(d => {
                    if (!byPlayer[d.sleeper_id]) {
                      byPlayer[d.sleeper_id] = { ...d, byYear: {} }
                    }
                    byPlayer[d.sleeper_id].byYear[d.season] = parseFloat(d.amount)
                  })
                  return (
                    <>
                      <tr className="cs-section-header cs-section-dc">
                        <td colSpan={YEARS.length + 3} style={{borderLeftColor:'var(--text-muted)'}}>
                          DEAD CAP ({Object.keys(byPlayer).length} released)
                        </td>
                      </tr>
                      {Object.values(byPlayer).map(p => (
                        <tr key={p.sleeper_id} className="cs-row cs-row-dc">
                          <td className="cs-slot">
                            <span style={{borderLeftColor:'var(--text-muted)', color:'var(--text-muted)'}}>
                              CUT
                            </span>
                          </td>
                          <td className="cs-player">
                            <div className="cs-player-link cs-dc-player">
                              <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                                alt={p.player_name} className="cs-shot cs-shot-dc"
                                onError={e=>e.target.style.opacity=0}/>
                              <div className="cs-pinfo">
                                <span className="cs-pname cs-pname-dc">{p.player_name}</span>
                                <span className="cs-ppos cs-ppos-dc">
                                  {p.release_method === 'frontload' ? 'Frontloaded' :
                                   p.release_method === 'stretch'   ? 'Stretch'    : 'Straight'} Release
                                </span>
                              </div>
                            </div>
                          </td>
                          {YEARS.map(yr => {
                            const amt = p.byYear[yr]
                            return (
                              <td key={yr} className="cs-year-cell cs-dc-cell">
                                {amt ? (
                                  <span className="cs-sal cs-sal-dc">${amt.toFixed(2)}</span>
                                ) : (
                                  <span className="cs-year-empty">—</span>
                                )}
                              </td>
                            )
                          })}
                          {isAdmin && <td/>}
                        </tr>
                      ))}
                    </>
                  )
                })()}
              </tbody>
              <tfoot>
                <tr className="cs-totals">
                  <td colSpan={2}>TOTAL CAP HIT</td>
                  {YEARS.map(yr => {
                    const c   = computeConsts(yr)
                    const hit = yearTotals[yr] || 0
                    const isLux  = hit > c.ltl
                    const isOver = hit > c.hardCap
                    return (
                      <td key={yr} className={`cs-total-cell ${isOver?'cs-over':isLux?'cs-lux':''}`}>
                        ${hit.toFixed(2)}
                      </td>
                    )
                  })}
                  {isAdmin && <td/>}
                </tr>
                <tr className="cs-limits">
                  <td colSpan={2}>HARD CAP</td>
                  {YEARS.map(yr => {
                    const c = computeConsts(yr)
                    return <td key={yr} className="cs-limit-cell">${c.hardCap}</td>
                  })}
                  {isAdmin && <td/>}
                </tr>
                <tr className="cs-limits cs-lux-row">
                  <td colSpan={2}>LUXURY LINE</td>
                  {YEARS.map(yr => {
                    const c = computeConsts(yr)
                    return <td key={yr} className="cs-limit-cell cs-lux">${c.ltl}</td>
                  })}
                  {isAdmin && <td/>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="cs-legend">
          <div className="cs-legend-item"><span className="cs-fa-badge cs-fa-rfa cs-fa-rfa-1">RFA (1st)</span>1st Round Restricted FA</div>
          <div className="cs-legend-item"><span className="cs-fa-badge cs-fa-rfa cs-fa-rfa-2">RFA (2nd)</span>2nd Round Restricted FA</div>
          <div className="cs-legend-item"><span className="cs-fa-badge cs-fa-ufa">UFA</span>Unrestricted Free Agent</div>
          <div className="cs-legend-item"><span className="cs-ng-dot">NG</span>Non-Guaranteed year</div>
          <div className="cs-legend-item cs-legend-sub">Smaller number in cell = actual cap hit (PS/IR at 50%, MAX at 80%)</div>
        </div>
      </div>

      {/* SB Projection Widget */}
      <SBWidget abbrev={abbrev?.toUpperCase()} salary={team?.salary || 0} />

      {/* Edit modal */}
      {editing && (
        <EditModal
          contract={editing}
          playerName={editing.players?.full_name}
          adminPw={ADMIN_PW}
          onSave={() => setRefreshKey(k=>k+1)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
