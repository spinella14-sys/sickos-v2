import { useState, useEffect } from 'react'
import { TEAMS } from '../data/league'
import './AdminBulkEditPage.css'

const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ADMIN_PW  = 'Sickos26-Vault!Q7'
const CURRENT_SEASON = new Date().getFullYear()

const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843' }

export default function AdminBulkEditPage() {
  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState({})   // contractId → true/false
  const [saved,     setSaved]     = useState({})   // contractId → true (flash)
  const [errors,    setErrors]    = useState({})
  const [filter,    setFilter]    = useState('')   // search filter
  const [teamFilter,setTeamFilter]= useState('ALL')
  const [showOnly,  setShowOnly]  = useState('all') // all | ng | rfa

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    // Fetch all teams' rosters in parallel
    const results = await Promise.all(
      TEAMS.map(t =>
        fetch(`${API_BASE}/teams/${t.abbrev}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => (d?.roster || []).map(c => ({ ...c, _team: t })))
          .catch(() => [])
      )
    )
    const all = results.flat().sort((a, b) => {
      const ta = a._team.abbrev, tb = b._team.abbrev
      if (ta !== tb) return ta.localeCompare(tb)
      return (b.salary || 0) - (a.salary || 0)
    })
    setContracts(all)
    setLoading(false)
  }

  // Local state for edits — keyed by contract id
  const [edits, setEdits] = useState({})

  function getEdit(contract, field) {
    const id = contract.id
    if (edits[id] && field in edits[id]) return edits[id][field]
    // Defaults from contract
    if (field === 'rfa_round') return contract.rfa_round || 0
    if (field.startsWith('ng_')) {
      const yr = parseInt(field.replace('ng_', ''))
      const cyRow = contract.contract_years?.find(c => c.season === yr)
      if (cyRow) {
        const g = cyRow.is_guaranteed
        return g === false || g === 'false' || g === 0 ? true : false  // true = is NG
      }
      return false
    }
    return null
  }

  function setEdit(contractId, field, value) {
    setEdits(prev => ({
      ...prev,
      [contractId]: { ...(prev[contractId] || {}), [field]: value }
    }))
  }

  function isDirty(contract) {
    return !!edits[contract.id]
  }

  async function saveContract(contract) {
    const id  = contract.id
    const e   = edits[id] || {}
    setSaving(p => ({...p, [id]: true}))
    setErrors(p => ({...p, [id]: null}))

    // Build year updates from current contract_years + any NG edits
    const activeYears = (contract.contract_years || [])
      .filter(cy => cy.season >= CURRENT_SEASON)
      .sort((a,b) => a.season - b.season)

    const yearUpdates = activeYears.map(cy => {
      const ngKey = `ng_${cy.season}`
      const isNGEdited = ngKey in e
      let isGuaranteed
      if (isNGEdited) {
        isGuaranteed = !e[ngKey]  // ng_=true means non-guaranteed
      } else {
        const g = cy.is_guaranteed
        isGuaranteed = !(g === false || g === 'false' || g === 0)
      }
      return { season: cy.season, salary: parseFloat(cy.salary), is_guaranteed: isGuaranteed }
    })

    const rfaRound = 'rfa_round' in e ? e.rfa_round : (contract.rfa_round || null)
    const lastYr   = activeYears.length ? activeYears[activeYears.length-1].season : null
    const nonGuar  = lastYr ? !yearUpdates.find(y=>y.season===lastYr)?.is_guaranteed : false

    const r = await fetch(`${API_BASE}/contracts/${id}/years`, {
      method:  'PATCH',
      headers: { 'Content-Type':'application/json', 'x-admin-password': ADMIN_PW },
      body:    JSON.stringify({
        years:                yearUpdates,
        rfa_round:            rfaRound || null,
        non_guaranteed_final: nonGuar,
        is_max_contract:      contract.is_max_contract || false,
      }),
    })
    const data = await r.json()
    setSaving(p => ({...p, [id]: false}))

    if (r.ok) {
      setSaved(p => ({...p, [id]: true}))
      setTimeout(() => setSaved(p => ({...p, [id]: false})), 2000)
      // Clear edits for this contract
      setEdits(p => { const n={...p}; delete n[id]; return n })
      // Update local contract data
      setContracts(prev => prev.map(c => {
        if (c.id !== id) return c
        return {
          ...c,
          rfa_round: rfaRound || null,
          non_guaranteed_final: nonGuar,
          contract_years: (c.contract_years || []).map(cy => {
            const upd = yearUpdates.find(y => y.season === cy.season)
            return upd ? { ...cy, is_guaranteed: upd.is_guaranteed } : cy
          })
        }
      }))
    } else {
      setErrors(p => ({...p, [id]: data.error || 'Save failed'}))
    }
  }

  // Filtered view
  const filtered = contracts.filter(c => {
    const p = c.players || {}
    const name = (p.full_name || '').toLowerCase()
    const team = c._team?.abbrev || ''

    if (teamFilter !== 'ALL' && team !== teamFilter) return false
    if (filter && !name.includes(filter.toLowerCase())) return false

    if (showOnly === 'ng') {
      const hasNG = c.non_guaranteed_final ||
        (c.contract_years || []).some(cy => {
          const g = cy.is_guaranteed; return g===false||g==='false'||g===0
        })
      if (!hasNG) return false
    }
    if (showOnly === 'rfa') {
      if (!c.rfa_round) return false
    }
    return true
  })

  // Group by team
  const byTeam = {}
  filtered.forEach(c => {
    const k = c._team.abbrev
    if (!byTeam[k]) byTeam[k] = { team: c._team, contracts: [] }
    byTeam[k].contracts.push(c)
  })

  return (
    <div className="abe-root">
      <div className="abe-header">
        <div className="abe-header-inner">
          <div>
            <h1 className="abe-title">Bulk Contract Editor</h1>
            <p className="abe-sub">Set RFA status and non-guaranteed years across all 16 teams</p>
          </div>
          <button className="abe-reload" onClick={loadAll}>↺ Reload</button>
        </div>

        <div className="abe-filters">
          <input className="abe-search" placeholder="Search player…"
            value={filter} onChange={e=>setFilter(e.target.value)}/>
          <select className="abe-select" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}>
            <option value="ALL">All Teams</option>
            {TEAMS.map(t=><option key={t.abbrev} value={t.abbrev}>{t.abbrev} — {t.manager}</option>)}
          </select>
          <div className="abe-toggle-group">
            {['all','ng','rfa'].map(v=>(
              <button key={v} className={`abe-toggle ${showOnly===v?'abe-toggle--active':''}`}
                onClick={()=>setShowOnly(v)}>
                {v==='all'?'All Contracts':v==='ng'?'NG Only':'RFA Only'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="abe-loading">Loading all rosters…</div>
      ) : (
        <div className="abe-body">
          {Object.values(byTeam).map(({ team, contracts: tContracts }) => (
            <div key={team.abbrev} className="abe-team-block">
              <div className="abe-team-header">
                <span className="abe-team-abbrev">{team.abbrev}</span>
                <span className="abe-team-name">{team.name}</span>
                <span className="abe-team-manager">{team.manager}</span>
                <span className="abe-team-count">{tContracts.length} players</span>
              </div>

              <table className="abe-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Yrs</th>
                    <th>FA Status</th>
                    {[CURRENT_SEASON, CURRENT_SEASON+1, CURRENT_SEASON+2, CURRENT_SEASON+3, CURRENT_SEASON+4].map(yr=>(
                      <th key={yr}>{yr}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tContracts.map(contract => {
                    const p        = contract.players || {}
                    const id       = contract.id
                    const dirty    = isDirty(contract)
                    const isSaving = saving[id]
                    const wasSaved = saved[id]
                    const err      = errors[id]
                    const rfa      = getEdit(contract, 'rfa_round')

                    // Contract years for this contract
                    const cyByYear = {}
                    ;(contract.contract_years||[]).forEach(cy => { cyByYear[cy.season] = cy })

                    const slot = contract.roster_slots?.[0]?.slot_type || 'active'

                    return (
                      <tr key={id} className={`abe-row ${dirty?'abe-row--dirty':''} ${wasSaved?'abe-row--saved':''}`}>
                        {/* Player */}
                        <td className="abe-player">
                          <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                            alt="" className="abe-shot" onError={e=>e.target.style.opacity=0}/>
                          <div>
                            <div className="abe-pname">{p.full_name}</div>
                            <div className="abe-pmeta">
                              <span style={{color:POS_COLOR[p.position]}}>{p.position}</span>
                              <span className="abe-slot-tag">{slot.toUpperCase()}</span>
                            </div>
                          </div>
                        </td>

                        {/* Years */}
                        <td className="abe-years">{contract.years}yr</td>

                        {/* RFA status */}
                        <td className="abe-rfa-cell">
                          <select className="abe-rfa-select"
                            value={rfa}
                            onChange={e => setEdit(id, 'rfa_round', parseInt(e.target.value))}
                            style={{
                              color: rfa===1||rfa===2 ? 'var(--red)' : 'var(--green)',
                              borderColor: rfa===1||rfa===2 ? 'var(--red)' : 'var(--border)'
                            }}>
                            <option value={0}>UFA</option>
                            <option value={1}>RFA 1st</option>
                            <option value={2}>RFA 2nd</option>
                          </select>
                        </td>

                        {/* Per-year NG toggles */}
                        {[CURRENT_SEASON, CURRENT_SEASON+1, CURRENT_SEASON+2, CURRENT_SEASON+3, CURRENT_SEASON+4].map(yr => {
                          const cy = cyByYear[yr]
                          if (!cy) return <td key={yr} className="abe-yr-empty">—</td>

                          const sal   = parseFloat(cy.salary)
                          const isNG  = getEdit(contract, `ng_${yr}`)

                          return (
                            <td key={yr} className={`abe-yr-cell ${isNG?'abe-yr-ng':''}`}>
                              <div className="abe-yr-sal" style={isNG?{color:'var(--purple)'}:{}}>
                                ${sal.toFixed(2)}
                              </div>
                              <label className="abe-ng-label">
                                <input type="checkbox" checked={isNG}
                                  onChange={e => setEdit(id, `ng_${yr}`, e.target.checked)}/>
                                <span style={{color: isNG?'var(--purple)':'var(--text-muted)'}}>
                                  {isNG ? 'NG' : 'G'}
                                </span>
                              </label>
                            </td>
                          )
                        })}

                        {/* Save */}
                        <td className="abe-action">
                          {err && <div className="abe-err">{err}</div>}
                          <button
                            className={`abe-save ${wasSaved?'abe-save--done':''} ${!dirty?'abe-save--clean':''}`}
                            onClick={() => saveContract(contract)}
                            disabled={isSaving || !dirty}>
                            {isSaving ? '…' : wasSaved ? '✓' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="abe-empty">No contracts match the current filter.</div>
          )}
        </div>
      )}
    </div>
  )
}
