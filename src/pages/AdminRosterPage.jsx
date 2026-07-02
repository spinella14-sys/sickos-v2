import { useState, useEffect, useCallback } from 'react'
import { TEAMS, CAP } from '../data/league'
import { buildContractYears, getSeasonConsts } from '../utils/contractCalc'
import { headshotUrl } from '../hooks/useSleeper'
import { Link } from 'react-router-dom'
import './AdminRosterPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const ADMIN_PW = 'brethart'

const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843', K:'#8a9bb0' }
const STRUCTURES = ['minimum','flat','escalating','descending','max']

function computeConsts(year) {
  const ltl = 110 + (year - 2025) * 10
  return { ltl, hardCap: ltl*1.15, qbMax: ltl/4.5, nonQbMax: ltl/5.5, minSalary: ltl/50 }
}

function calcYears(base, structure, years, nonGuar, startYear, position) {
  return buildContractYears({ baseSalary: base, structure, years, nonGuar, startYear, position: position||'WR' })
    .map(cy => ({ year: cy.year, num: cy.yearNum, salary: cy.salary, guaranteed: cy.isGuaranteed }))
}

// ── Player search component ───────────────────────────────────────────────────
function PlayerSearch({ onSelect, label = 'Search player…' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`${API_BASE}/players?search=${encodeURIComponent(q)}&limit=8`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { setResults(d?.players || []); setLoading(false) })
        .catch(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  function pick(p) {
    onSelect(p)
    setQ('')
    setResults([])
  }

  return (
    <div className="ar-search-wrap">
      <input
        className="ar-input"
        placeholder={label}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {loading && <div className="ar-search-loading">Searching…</div>}
      {results.length > 0 && (
        <div className="ar-search-results">
          {results.map(p => (
            <button key={p.sleeper_id} className="ar-search-row" onClick={() => pick(p)}>
              <img src={headshotUrl(p.sleeper_id)} alt="" className="ar-search-shot"
                onError={e=>e.target.style.opacity=0}/>
              <span className="ar-search-name">{p.full_name}</span>
              <span className="ar-search-pos" style={{color:POS_COLOR[p.position]}}>{p.position}</span>
              <span className="ar-search-nfl">{p.nfl_team || 'FA'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sign Player Panel ─────────────────────────────────────────────────────────
function SignPanel({ onLog, onRosterRefresh }) {
  const [team,       setTeam]       = useState('')
  const [player,     setPlayer]     = useState(null)
  const [salary,     setSalary]     = useState('')
  const [years,      setYears]      = useState(1)
  const [structure,     setStructure]     = useState('flat')
  const [nonGuar,       setNonGuar]       = useState(false)
  const [guaranteedYrs, setGuaranteedYrs] = useState({})
  const [rfaRound,      setRfaRound]      = useState(0)
  const [slot,          setSlot]          = useState('active')
  const [sigBonus,      setSigBonus]      = useState('')
  const [sbBalance,     setSbBalance]     = useState(null)
  const [override,      setOverride]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  const SEASON = new Date().getFullYear()
  const consts = computeConsts(SEASON)
  const salNum = parseFloat(salary)
  const contractYears = player && salary && !isNaN(salNum) && salNum > 0 ? calcYears(salNum, structure, years, nonGuar && years>1, SEASON, player?.position) : []
  const isMin = structure === 'minimum'

  // Fetch SB balance when team changes
  useEffect(() => {
    if (!team) { setSbBalance(null); return }
    fetch(`${API_BASE}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[team] ?? null))
  }, [team])

  function handleYearsChange(y) {
    setYears(y)
    setGuaranteedYrs({})
  }

  function toggleGuaranteed(yearIndex) {
    setGuaranteedYrs(prev => ({ ...prev, [yearIndex]: !prev[yearIndex] }))
  }

  async function handleSign() {
    if (!team || !player || !salary) { onLog('Fill in team, player, and salary', 'error'); return }
    const sb = parseFloat(sigBonus) || 0
    if (sb > 0 && Math.round(sb * 10) !== sb * 10) {
      onLog('Signing bonus must be in $0.10 increments', 'error'); return
    }
    if (!override && sbBalance !== null && sb > sbBalance) {
      onLog(`Signing bonus $${sb} exceeds ${team} budget ($${sbBalance?.toFixed(2)})`, 'error'); return
    }
    setSubmitting(true)

    const guaranteedMap = contractYears.map((cy, i) => {
      if (i in guaranteedYrs) return guaranteedYrs[i]
      if (nonGuar && i === contractYears.length - 1) return false
      return true
    })

    const r = await fetch(`${API_BASE}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({
        sleeper_id:           player.sleeper_id,
        team_abbrev:          team,
        salary:               parseFloat(isMin ? consts.minSalary : salary),
        years:                parseInt(years),
        structure,
        non_guaranteed_final: nonGuar && years > 1,
        guaranteed_map:       guaranteedMap,
        rfa_round:            rfaRound || null,
        signing_bonus:        sb,
        slot,
        season:               SEASON,
        admin_override:       override,
      })
    })
    const data = await r.json()
    setSubmitting(false)
    if (r.ok) {
      onLog(`✓ Signed ${player.full_name} to ${team} — $${data.contract?.salary}${sb ? ` + $${sb} SB` : ''} / ${years}yr`, 'success')
      setPlayer(null); setSalary(''); setYears(1); setStructure('flat')
      setNonGuar(false); setGuaranteedYrs({}); setRfaRound(0); setSigBonus('')
      onRosterRefresh(team)
    } else {
      onLog(`✗ ${data.error || data.violations?.join(' | ')}`, 'error')
    }
  }

  return (
    <div className="ar-panel">
      <div className="ar-panel-title">✍️ Sign Player</div>

      <div className="ar-field">
        <label className="ar-label">Team</label>
        <select className="ar-select" value={team} onChange={e=>setTeam(e.target.value)}>
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name} ({t.manager})</option>)}
        </select>
      </div>

      <div className="ar-field">
        <label className="ar-label">Player</label>
        {player ? (
          <div className="ar-selected-player">
            <img src={headshotUrl(player.sleeper_id)} alt="" className="ar-sel-shot" onError={e=>e.target.style.opacity=0}/>
            <span className="ar-sel-name">{player.full_name}</span>
            <span className="ar-sel-pos" style={{color:POS_COLOR[player.position]}}>{player.position}</span>
            <button className="ar-clear" onClick={()=>setPlayer(null)}>✕</button>
          </div>
        ) : (
          <PlayerSearch onSelect={setPlayer} label="Search player name…" />
        )}
      </div>

      <div className="ar-row">
        <div className="ar-field">
          <label className="ar-label">Contract Type</label>
          <select className="ar-select" value={structure} onChange={e=>{
                const s = e.target.value
                setStructure(s)
                if (s === 'minimum') setSalary(consts.minSalary.toFixed(2))
                if (s === 'max') {
                  const maxSal = player?.position === 'QB' ? consts.qbMax : consts.nonQbMax
                  setSalary(maxSal.toFixed(2))
                }
              }}>
            {STRUCTURES.map(s => {
              const labels = {minimum:'Minimum',flat:'Flat',escalating:'Escalating (+10%/yr)',descending:'Descending (-10%/yr)',max:'Max Contract'}
              return <option key={s} value={s}>{labels[s]||s}</option>
            })}
          </select>
        </div>
        <div className="ar-field">
          <label className="ar-label">Years</label>
          <div className="ar-yr-btns">
            {[1,2,3,4,5].map(y => (
              <button key={y} type="button"
                className={'ar-yr-btn' + (years===y?' ar-yr-btn--active':'')}
                onClick={() => handleYearsChange(y)}>
                {y}yr
              </button>
            ))}
          </div>
        </div>
        <div className="ar-field">
          <label className="ar-label">Slot</label>
          <select className="ar-select" value={slot} onChange={e=>setSlot(e.target.value)}>
            <option value="active">Active</option>
            <option value="ps">Practice Squad</option>
            <option value="ir">IR</option>
          </select>
        </div>
      </div>

      <div className="ar-row">
        <div className="ar-field">
          <label className="ar-label">Salary (Yr 1)</label>
          <div className="ar-input-wrap">
            <span className="ar-prefix">$</span>
            <input className="ar-input ar-input--pre" type="number" step="0.01"
              min={consts.minSalary}
              max={player?.position === 'QB' ? consts.qbMax : consts.nonQbMax}
              placeholder={consts.minSalary.toFixed(2)}
              value={salary} onChange={e=>setSalary(e.target.value)}
              disabled={isMin || structure === 'max'}/>
          </div>
          {structure === 'max' && (
            <span className="ar-hint ar-hint--max">
              Max: ${(player?.position === 'QB' ? consts.qbMax : consts.nonQbMax).toFixed(2)} · Cap hit: ${((player?.position === 'QB' ? consts.qbMax : consts.nonQbMax) * 0.8).toFixed(2)} (20% credit)
            </span>
          )}
        </div>
        <div className="ar-field">
          <label className="ar-label">Signing Bonus ($0.10 increments)</label>
          <div className="ar-input-wrap">
            <span className="ar-prefix">$</span>
            <input className="ar-input ar-input--pre" type="number" step="0.10" min="0"
              placeholder="0.00"
              value={sigBonus} onChange={e=>setSigBonus(e.target.value)}/>
          </div>
          {sbBalance !== null && (
            <span className="ar-hint" style={{color: parseFloat(sigBonus||0) > sbBalance ? 'var(--red)' : 'var(--green)'}}>
              {team} budget: ${sbBalance.toFixed(2)} remaining
            </span>
          )}
          {!sbBalance && team && <span className="ar-hint">Budget: loading…</span>}
        </div>
      </div>

      {/* Contract preview with per-year guaranteed toggles */}
      {contractYears.length > 0 && (
        <div className="ar-preview">
          <div className="ar-preview-header">
            <span>Year</span>
            <span>Salary</span>
            <span className="ar-preview-guar-col">Guaranteed <span className="ar-preview-admin-note">(admin)</span></span>
          </div>
          {contractYears.map((cy, i) => {
            const isGuaranteed = i in guaranteedYrs ? guaranteedYrs[i]
              : !(nonGuar && i === contractYears.length - 1)
            return (
              <div key={cy.year} className={`ar-preview-row ${!isGuaranteed ? 'ar-ng' : ''}`}>
                <span>{cy.year} · Yr {cy.num}</span>
                <span>${cy.salary.toFixed(2)}</span>
                <label className="ar-guar-toggle">
                  <input type="checkbox" checked={isGuaranteed}
                    onChange={() => toggleGuaranteed(i)}/>
                  <span className={isGuaranteed ? 'ar-guar-yes' : 'ar-guar-no'}>
                    {isGuaranteed ? 'Guaranteed' : 'Non-Guaranteed'}
                  </span>
                </label>
              </div>
            )
          })}
          <div className="ar-preview-total">
            <span>Total value</span>
            <span>${contractYears.reduce((s,cy)=>s+cy.salary,0).toFixed(2)}</span>
            <span/>
          </div>
        </div>
      )}

      {/* FA Status */}
      <div className="ar-field">
        <label className="ar-label">FA Status After Contract</label>
        <select className="ar-select" value={rfaRound} onChange={e=>setRfaRound(parseInt(e.target.value))}>
          <option value={0}>UFA — Unrestricted Free Agent</option>
          <option value={1}>RFA — 1st Round Pick</option>
          <option value={2}>RFA — 2nd Round Pick</option>
        </select>
      </div>

      <label className="ar-checkbox ar-override">
        <input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/>
        Override cap validation (for historical data entry)
      </label>

      <button className="ar-btn ar-btn--primary" onClick={handleSign} disabled={submitting}>
        {submitting ? 'Signing…' : 'Sign Player →'}
      </button>
    </div>
  )
}

// ── Release Player Panel ──────────────────────────────────────────────────────
function ReleasePanel({ onLog, onRosterRefresh }) {
  const [team,     setTeam]     = useState('')
  const [roster,   setRoster]   = useState([])
  const [selected, setSelected] = useState(null)
  const [method,   setMethod]   = useState('straight')
  const [preview,  setPreview]  = useState(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!team) return
    fetch(`${API_BASE}/teams/${team}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRoster(d?.roster || []))
  }, [team])

  async function handleRelease() {
    if (!selected) return
    setLoading(true)
    const r = await fetch(`${API_BASE}/contracts/${selected.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ release_method: method })
    })
    const data = await r.json()
    setLoading(false)
    if (r.ok) {
      const dc = data.total_dead_cap ? ` · $${data.total_dead_cap.toFixed(2)} dead cap` : ''
      onLog(`✓ Released ${selected.players?.full_name} via ${method}${dc}`, 'success')
      setSelected(null); setPreview(null)
      onRosterRefresh(team)
      setRoster(prev => prev.filter(r => r.id !== selected.id))
    } else {
      onLog(`✗ ${data.error}`, 'error')
    }
  }

  return (
    <div className="ar-panel">
      <div className="ar-panel-title">❌ Release Player</div>

      <div className="ar-field">
        <label className="ar-label">Team</label>
        <select className="ar-select" value={team} onChange={e=>{setTeam(e.target.value);setSelected(null)}}>
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
        </select>
      </div>

      {roster.length > 0 && (
        <div className="ar-field">
          <label className="ar-label">Player</label>
          <div className="ar-roster-list">
            {roster.map(r => {
              const p = r.players || {}
              return (
                <button key={r.id} className={`ar-roster-row ${selected?.id===r.id?'ar-roster-row--sel':''}`}
                  onClick={()=>setSelected(r)}>
                  <img src={headshotUrl(p.sleeper_id||r.sleeper_id)} alt="" className="ar-search-shot" onError={e=>e.target.style.opacity=0}/>
                  <span className="ar-search-name">{p.full_name}</span>
                  <span className="ar-search-pos" style={{color:POS_COLOR[p.position]}}>{p.position}</span>
                  <span className="ar-search-nfl">${parseFloat(r.salary||0).toFixed(2)} · {r.years}yr</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <>
          <div className="ar-field">
            <label className="ar-label">Release Method</label>
            <div className="ar-method-tabs">
              {[
                {v:'straight',  l:'Straight',       d:'Dead cap mirrors original schedule'},
                {v:'frontload', l:'Frontload',       d:'All guaranteed money hits now'},
                {v:'stretch',   l:'Waive & Stretch', d:'(years×2)+1 spread over future seasons'},
              ].map(m => (
                <button key={m.v} className={`ar-method-tab ${method===m.v?'ar-method-tab--active':''}`}
                  onClick={()=>setMethod(m.v)}>
                  <span>{m.l}</span>
                  <span className="ar-method-desc">{m.d}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ar-release-confirm">
            <div className="ar-release-player">
              Releasing: <strong>{selected.players?.full_name}</strong> · ${parseFloat(selected.salary||0).toFixed(2)} / {selected.years}yr
            </div>
            <button className="ar-btn ar-btn--danger" onClick={handleRelease} disabled={loading}>
              {loading ? 'Releasing…' : `Confirm Release (${method})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Slot Change Panel ─────────────────────────────────────────────────────────
function SlotPanel({ onLog, onRosterRefresh }) {
  const [team,     setTeam]     = useState('')
  const [roster,   setRoster]   = useState([])
  const [selected, setSelected] = useState(null)
  const [newSlot,  setNewSlot]  = useState('active')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!team) return
    fetch(`${API_BASE}/teams/${team}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRoster(d?.roster || []))
  }, [team])

  async function handleSlotChange() {
    if (!selected) return
    setLoading(true)
    const r = await fetch(`${API_BASE}/contracts/${selected.id}/slot`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ new_slot: newSlot, season: SEASON })
    })
    const data = await r.json()
    setLoading(false)
    if (r.ok) {
      onLog(`✓ ${selected.players?.full_name} → ${newSlot.toUpperCase()}`, 'success')
      setSelected(null)
      onRosterRefresh(team)
      setRoster(prev => prev.map(r => r.id===selected.id
        ? {...r, roster_slots:[{slot_type:newSlot}]}
        : r
      ))
    } else {
      onLog(`✗ ${data.error}`, 'error')
    }
  }

  return (
    <div className="ar-panel">
      <div className="ar-panel-title">🔀 Change Roster Slot</div>

      <div className="ar-field">
        <label className="ar-label">Team</label>
        <select className="ar-select" value={team} onChange={e=>{setTeam(e.target.value);setSelected(null)}}>
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
        </select>
      </div>

      {roster.length > 0 && (
        <div className="ar-field">
          <label className="ar-label">Player</label>
          <div className="ar-roster-list">
            {roster.map(r => {
              const p = r.players || {}
              const currentSlot = r.roster_slots?.[0]?.slot_type || 'active'
              return (
                <button key={r.id} className={`ar-roster-row ${selected?.id===r.id?'ar-roster-row--sel':''}`}
                  onClick={()=>{setSelected(r);setNewSlot(currentSlot)}}>
                  <img src={headshotUrl(p.sleeper_id||r.sleeper_id)} alt="" className="ar-search-shot" onError={e=>e.target.style.opacity=0}/>
                  <span className="ar-search-name">{p.full_name}</span>
                  <span className="ar-search-pos" style={{color:POS_COLOR[p.position]}}>{p.position}</span>
                  <span className="ar-slot-badge">{currentSlot.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="ar-row">
          <div className="ar-field">
            <label className="ar-label">Move to slot</label>
            <select className="ar-select" value={newSlot} onChange={e=>setNewSlot(e.target.value)}>
              <option value="active">Active Roster</option>
              <option value="ps">Practice Squad</option>
              <option value="ir">Injured Reserve</option>
            </select>
          </div>
          <div className="ar-field ar-field--end">
            <button className="ar-btn ar-btn--primary" onClick={handleSlotChange} disabled={loading}>
              {loading ? 'Moving…' : 'Move Player →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dead Cap Panel ────────────────────────────────────────────────────────────
function DeadCapPanel({ onLog, onRosterRefresh }) {
  const SEASON = new Date().getFullYear()

  const [team,        setTeam]        = useState('')
  const [playerName,  setPlayerName]  = useState('')
  const [sleeperId,   setSleeperId]   = useState('')
  const [method,      setMethod]      = useState('straight')
  const [entries,     setEntries]     = useState([{ season: SEASON, amount: '' }])
  const [submitting,  setSubmitting]  = useState(false)
  const [existing,    setExisting]    = useState([]) // current dead cap for team
  const [loadingDC,   setLoadingDC]   = useState(false)

  // Load existing dead cap when team selected
  useEffect(() => {
    if (!team) return
    setLoadingDC(true)
    fetch(`${API_BASE}/contracts/dead-cap/${team}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setExisting(d); setLoadingDC(false) })
  }, [team])

  function addEntry() {
    const lastYear = entries[entries.length - 1]?.season || SEASON
    setEntries(prev => [...prev, { season: lastYear + 1, amount: '' }])
  }

  function removeEntry(i) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateEntry(i, field, val) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  }

  // Player search helper
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerResults, setPlayerResults] = useState([])
  useEffect(() => {
    if (playerSearch.length < 2) { setPlayerResults([]); return }
    const t = setTimeout(() => {
      fetch(`${API_BASE}/players?search=${encodeURIComponent(playerSearch)}&limit=6`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setPlayerResults(d?.players || []))
    }, 300)
    return () => clearTimeout(t)
  }, [playerSearch])

  async function handleDelete(dcId) {
    const r = await fetch(`${API_BASE}/contracts/dead-cap/entry/${dcId}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': ADMIN_PW },
    })
    if (r.ok) {
      onLog('Dead cap entry deleted', 'success')
      setExisting(prev => prev.filter(e => e.id !== dcId))
      onRosterRefresh()
    } else {
      const d = await r.json()
      onLog(`Delete failed: ${d.error}`, 'error')
    }
  }

  async function handleSubmit() {
    if (!team || !playerName || !entries.some(e => e.amount)) {
      onLog('Fill in team, player name, and at least one year/amount', 'error')
      return
    }
    const validEntries = entries.filter(e => e.amount && parseFloat(e.amount) > 0)
    if (!validEntries.length) { onLog('At least one amount must be > $0', 'error'); return }

    setSubmitting(true)
    const r = await fetch(`${API_BASE}/contracts/dead-cap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({
        team_abbrev:  team,
        sleeper_id:   sleeperId || null,
        player_name:  playerName,
        release_method: method,
        entries:      validEntries.map(e => ({
          season: parseInt(e.season),
          amount: parseFloat(parseFloat(e.amount).toFixed(2)),
        })),
      }),
    })
    const data = await r.json()
    setSubmitting(false)
    if (r.ok) {
      const total = validEntries.reduce((s,e)=>s+parseFloat(e.amount),0).toFixed(2)
      onLog(`✓ Added dead cap for ${playerName} — $${total} across ${validEntries.length} season${validEntries.length>1?'s':''}`, 'success')
      setPlayerName(''); setSleeperId(''); setPlayerSearch('')
      setEntries([{ season: SEASON, amount: '' }])
      // Refresh dead cap list
      fetch(`${API_BASE}/contracts/dead-cap/${team}`).then(r=>r.json()).then(setExisting)
      onRosterRefresh()
    } else {
      onLog(`✗ ${data.error}`, 'error')
    }
  }

  return (
    <div className="ar-panel">
      <div className="ar-panel-title">💀 Dead Cap Management</div>

      <div className="ar-field">
        <label className="ar-label">Team</label>
        <select className="ar-select" value={team} onChange={e=>setTeam(e.target.value)}>
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name} ({t.manager})</option>)}
        </select>
      </div>

      {/* Player — search or free-type */}
      <div className="ar-field">
        <label className="ar-label">Player Name</label>
        <div className="ar-search-wrap">
          <input className="ar-input" placeholder="Search or type name…"
            value={sleeperId ? playerName : playerSearch}
            onChange={e => {
              if (sleeperId) { setPlayerName(e.target.value); setSleeperId('') }
              else { setPlayerSearch(e.target.value); setPlayerName(e.target.value) }
            }}/>
          {playerResults.length > 0 && !sleeperId && (
            <div className="ar-search-results">
              {playerResults.map(p => (
                <button key={p.sleeper_id} className="ar-search-row"
                  onClick={() => {
                    setPlayerName(p.full_name); setSleeperId(p.sleeper_id)
                    setPlayerSearch(''); setPlayerResults([])
                  }}>
                  <img src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                    alt="" className="ar-search-shot" onError={e=>e.target.style.opacity=0}/>
                  <span className="ar-search-name">{p.full_name}</span>
                  <span className="ar-search-pos">{p.position}</span>
                  <span className="ar-search-nfl">{p.nfl_team||'FA'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="ar-hint">Can search for a player or just type a name (for historical players not in DB)</span>
      </div>

      {/* Release method */}
      <div className="ar-field">
        <label className="ar-label">Release Method</label>
        <select className="ar-select" value={method} onChange={e=>setMethod(e.target.value)}>
          <option value="straight">Straight Release</option>
          <option value="frontload">Frontloaded</option>
          <option value="stretch">Waive &amp; Stretch</option>
          <option value="manual">Manual Entry (historical/override)</option>
        </select>
      </div>

      {/* Year + amount entries */}
      <div className="ar-field">
        <label className="ar-label">Dead Cap By Season</label>
        <div className="ar-dc-entries">
          {entries.map((e, i) => (
            <div key={i} className="ar-dc-entry">
              <select className="ar-select ar-dc-yr" value={e.season}
                onChange={ev => updateEntry(i, 'season', parseInt(ev.target.value))}>
                {Array.from({length:10}, (_,j) => SEASON - 1 + j).map(yr =>
                  <option key={yr} value={yr}>{yr}</option>
                )}
              </select>
              <div className="ar-input-wrap ar-dc-amt">
                <span className="ar-prefix">$</span>
                <input className="ar-input ar-input--pre" type="number" step="0.01" min="0"
                  placeholder="0.00" value={e.amount}
                  onChange={ev => updateEntry(i, 'amount', ev.target.value)}/>
              </div>
              {entries.length > 1 && (
                <button className="ar-dc-remove" onClick={() => removeEntry(i)}>✕</button>
              )}
            </div>
          ))}
          <button className="ar-dc-add" onClick={addEntry}>+ Add Season</button>
        </div>
        <span className="ar-hint">Total: ${entries.reduce((s,e)=>s+(parseFloat(e.amount)||0),0).toFixed(2)}</span>
      </div>

      <button className="ar-btn ar-btn--primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving…' : 'Add Dead Cap →'}
      </button>

      {/* Existing dead cap for this team */}
      {team && (
        <div className="ar-dc-existing">
          <div className="ar-dc-existing-title">
            Current Dead Cap{loadingDC ? ' (loading…)' : ` (${existing.length} entries)`}
          </div>
          {existing.length === 0 && !loadingDC && (
            <div className="ar-empty">No dead cap on this team</div>
          )}
          {existing.map(d => (
            <div key={d.id} className="ar-dc-row">
              <div className="ar-dc-row-info">
                <span className="ar-dc-row-name">{d.player_name}</span>
                <span className="ar-dc-row-meta">{d.season} · ${parseFloat(d.amount).toFixed(2)} · {d.release_method}</span>
              </div>
              <button className="ar-dc-del" onClick={() => handleDelete(d.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── SB Budget Panel ───────────────────────────────────────────────────────────
function SBBudgetPanel({ onLog }) {
  const SEASON    = new Date().getFullYear()
  const [balances, setBalances] = useState({})
  const [editing,  setEditing]  = useState(null)
  const [newVal,   setNewVal]   = useState('')
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(setBalances)
  }, [])

  async function handleSet(abbrev) {
    if (!newVal || isNaN(parseFloat(newVal))) { onLog('Enter a valid amount', 'error'); return }
    setSaving(true)
    const r = await fetch(`${API_BASE}/bids/sb-budget/${abbrev}`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json', 'x-admin-password': ADMIN_PW },
      body: JSON.stringify({ new_balance: parseFloat(newVal), note: note || undefined, season: SEASON }),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      onLog(`✓ ${abbrev} SB budget set to $${parseFloat(newVal).toFixed(2)}`, 'success')
      setBalances(prev => ({ ...prev, [abbrev]: parseFloat(newVal) }))
      setEditing(null); setNewVal(''); setNote('')
    } else {
      onLog(`✗ ${d.error}`, 'error')
    }
  }

  const base = parseFloat(((120 + (SEASON-2026)*10) * 0.2).toFixed(2))

  return (
    <div className="ar-panel">
      <div className="ar-panel-title">💰 Signing Bonus Budgets — {SEASON}</div>
      <p style={{fontFamily:'var(--font-body)',fontSize:12,color:'var(--text-muted)',marginTop:-8,marginBottom:4}}>
        Base: ${base.toFixed(2)} · Adjust for rollover, luxury tax penalty, and playoff bonuses.
      </p>
      <div className="ar-sb-table">
        {TEAMS.map(t => {
          const bal    = balances[t.abbrev] ?? null
          const isEdit = editing === t.abbrev
          const pct    = bal !== null ? Math.max(0, Math.min(100, (bal / base) * 100)) : 0
          return (
            <div key={t.abbrev} className="ar-sb-row">
              <div className="ar-sb-team">
                <span className="ar-sb-abbrev">{t.abbrev}</span>
                <span className="ar-sb-name">{t.manager}</span>
              </div>
              {isEdit ? (
                <div className="ar-sb-edit">
                  <div className="ar-input-wrap" style={{width:120}}>
                    <span className="ar-prefix">$</span>
                    <input className="ar-input ar-input--pre" type="number" step="0.10" min="0"
                      placeholder={bal?.toFixed(2)||'0.00'} value={newVal}
                      onChange={e=>setNewVal(e.target.value)} autoFocus/>
                  </div>
                  <input className="ar-input" style={{flex:1,minWidth:0}} placeholder="Note (optional)"
                    value={note} onChange={e=>setNote(e.target.value)}/>
                  <button className="ar-btn ar-btn--primary" onClick={()=>handleSet(t.abbrev)} disabled={saving}>
                    {saving?'…':'Set'}
                  </button>
                  <button style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'0 4px'}}
                    onClick={()=>{setEditing(null);setNewVal('');setNote('')}}>✕</button>
                </div>
              ) : (
                <div className="ar-sb-balance">
                  <div className="ar-sb-bar-track">
                    <div className="ar-sb-bar-fill" style={{
                      width:`${pct.toFixed(1)}%`,
                      background: !bal ? 'var(--bg4)' : bal < 5 ? 'var(--red)' : bal < 10 ? 'var(--gold)' : 'var(--green)'
                    }}/>
                  </div>
                  <span className={`ar-sb-val ${!bal?'ar-sb-empty':''}`}>
                    {bal !== null ? `$${bal.toFixed(2)}` : '—'}
                  </span>
                  <button className="ar-edit-btn" onClick={()=>{setEditing(t.abbrev);setNewVal(bal?.toFixed(2)||'')}}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


function ViewRoster({ refreshKey }) {
  const [team,   setTeam]   = useState('')
  const [roster, setRoster] = useState([])
  const [cap,    setCap]    = useState(null)
  const [loading,setLoading]= useState(false)

  useEffect(() => {
    if (!team) return
    setLoading(true)
    fetch(`${API_BASE}/teams/${team}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setRoster(d?.roster || [])
        setLoading(false)
      })
  }, [team, refreshKey])

  const liveHit = roster.reduce((s,r) => {
    const sal = parseFloat(r.salary||0)
    const slot = r.roster_slots?.[0]?.slot_type||'active'
    let hit = sal
    if (slot==='ps'||slot==='ir') hit*=0.5
    if (r.is_max_contract) hit*=0.8
    return s+hit
  }, 0)

  const teamData = TEAMS.find(t=>t.abbrev===team)
  const consts = computeConsts(2025)

  return (
    <div className="ar-panel ar-panel--view">
      <div className="ar-panel-title">👁 View Roster</div>
      <div className="ar-field">
        <label className="ar-label">Team</label>
        <select className="ar-select" value={team} onChange={e=>setTeam(e.target.value)}>
          <option value="">Select team…</option>
          {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.name} ({t.manager})</option>)}
        </select>
      </div>

      {loading && <div className="ar-loading">Loading…</div>}

      {roster.length > 0 && (
        <>
          <div className="ar-cap-summary">
            <span>Players: <strong>{roster.length}</strong></span>
            <span>Cap Hit: <strong>${liveHit.toFixed(2)}</strong></span>
            <span>Hard Cap: <strong>${consts.hardCap}</strong></span>
            <span className={liveHit > consts.ltl ? 'ar-over-lux' : 'ar-ok'}>
              {liveHit > consts.ltl ? `$${(liveHit-consts.ltl).toFixed(2)} over lux` : `$${(consts.ltl-liveHit).toFixed(2)} under lux`}
            </span>
          </div>
          <div className="ar-view-table">
            <div className="ar-view-header">
              <span>Player</span><span>Pos</span><span>Salary</span><span>Yrs</span><span>Slot</span>
            </div>
            {[...roster].sort((a,b) => {
              const po = {QB:0,RB:1,WR:2,TE:3}
              return (po[a.players?.position]??9)-(po[b.players?.position]??9)
            }).map(r => {
              const p = r.players||{}
              const sid = p.sleeper_id||r.sleeper_id
              const slot = r.roster_slots?.[0]?.slot_type||'active'
              return (
                <div key={r.id||sid} className="ar-view-row">
                  <span className="ar-view-name">
                    <img src={headshotUrl(sid)} alt="" className="ar-search-shot" onError={e=>e.target.style.opacity=0}/>
                    {p.full_name}
                  </span>
                  <span style={{color:POS_COLOR[p.position],fontFamily:'var(--font-ui)',fontSize:12,fontWeight:700}}>{p.position}</span>
                  <span style={{fontFamily:'var(--font-display)',fontSize:14,color:'var(--orange)'}}>${parseFloat(r.salary||0).toFixed(2)}</span>
                  <span style={{fontFamily:'var(--font-accent)',fontSize:12,color:'var(--text-muted)'}}>{r.years}yr</span>
                  <span className={`ar-slot-badge ar-slot-${slot}`}>{slot.toUpperCase()}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
      {team && !loading && roster.length === 0 && (
        <div className="ar-empty">No players on this roster yet</div>
      )}
    </div>
  )
}

// ── Main Admin Roster Page ────────────────────────────────────────────────────
export default function AdminRosterPage() {
  const [password,    setPassword]    = useState('')
  const [authed,      setAuthed]      = useState(false)
  const [log,         setLog]         = useState([])
  const [activePanel, setActivePanel] = useState('sign')
  const [refreshKey,  setRefreshKey]  = useState(0)

  function addLog(msg, type='info') {
    setLog(l => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...l].slice(0, 50))
  }

  function onRosterRefresh() {
    setRefreshKey(k => k+1)
  }

  function handleAuth(e) {
    e.preventDefault()
    if (password === ADMIN_PW) setAuthed(true)
    else addLog('Wrong password', 'error')
  }

  const PANELS = [
    { id:'sign',      label:'Sign Player' },
    { id:'release',   label:'Release Player' },
    { id:'slot',      label:'Change Slot' },
    { id:'deadcap',   label:'Dead Cap' },
    { id:'sbbudget',  label:'SB Budget' },
    { id:'view',      label:'View Roster' },
  ]

  if (authed && !TEAMS?.length) {
    return <div style={{padding:40,color:'red',fontFamily:'monospace'}}>ERROR: TEAMS data not loaded. Check league.js import.</div>
  }

  return (
    <div className="ar-root">
      <div className="ar-header">
        <div className="ar-header-inner">
          <div>
            <h1 className="ar-title">Roster Management</h1>
            <p className="ar-sub">Commissioner Admin · Sickos Only</p>
          </div>
          <Link to="/admin" className="ar-back">← Admin Panel</Link>
        </div>
      </div>

      <div className="ar-body">
        {!authed ? (
          <form onSubmit={handleAuth} className="ar-auth-form">
            <div className="ar-label">Commissioner Password</div>
            <div className="ar-auth-row">
              <input type="password" className="ar-input" placeholder="Password…"
                value={password} onChange={e=>setPassword(e.target.value)}/>
              <button type="submit" className="ar-btn ar-btn--primary">Login</button>
            </div>
            {log[0]?.type==='error' && <div className="ar-log-err">{log[0].msg}</div>}
          </form>
        ) : (
          <div className="ar-layout">
            {/* Left: tool panels */}
            <div className="ar-left">
              <div className="ar-panel-tabs">
                {PANELS.map(p => (
                  <button key={p.id}
                    className={`ar-panel-tab ${activePanel===p.id?'ar-panel-tab--active':''}`}
                    onClick={()=>setActivePanel(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>

              {activePanel==='sign'     && <SignPanel    onLog={addLog} onRosterRefresh={onRosterRefresh}/>}
              {activePanel==='release'  && <ReleasePanel onLog={addLog} onRosterRefresh={onRosterRefresh}/>}
              {activePanel==='slot'     && <SlotPanel    onLog={addLog} onRosterRefresh={onRosterRefresh}/>}
              {activePanel==='deadcap'  && <DeadCapPanel onLog={addLog} onRosterRefresh={onRosterRefresh}/>}
              {activePanel==='sbbudget' && <SBBudgetPanel onLog={addLog}/>}
              {activePanel==='view'     && <ViewRoster   refreshKey={refreshKey}/>}
            </div>

            {/* Right: log + roster viewer */}
            <div className="ar-right">
              {activePanel !== 'view' && <ViewRoster refreshKey={refreshKey}/>}

              {/* Activity log */}
              <div className="ar-log">
                <div className="ar-log-title">Activity Log</div>
                {log.length === 0
                  ? <div className="ar-log-empty">No activity yet</div>
                  : log.map((l,i) => (
                    <div key={i} className={`ar-log-row ar-log-${l.type}`}>
                      <span className="ar-log-ts">{l.ts}</span>
                      <span className="ar-log-msg">{l.msg}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
