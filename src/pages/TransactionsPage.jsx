import { useState, useEffect, useMemo, useCallback } from 'react'
import { TEAMS, LOGOS } from '../data/league'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './TransactionsPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const TYPE_META = {
  signing:     { label: 'Signing',     color: 'var(--green)' },
  release:     { label: 'Release',     color: 'var(--text-muted)' },
  trade:       { label: 'Trade',       color: 'var(--blue)' },
  bid_lost:    { label: 'Failed Bid',  color: 'var(--gold)' },
  draft_batch: { label: 'Draft',       color: 'var(--text-primary)' },
}
const ALL_TYPES = Object.keys(TYPE_META)

function TeamLogo({ abbrev, size = 18 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }} loading="lazy" />
}

function teamName(abbrev) {
  return TEAMS.find(t => t.abbrev === abbrev)?.display_name || TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return `$${parseFloat(v).toFixed(2)}`
}

// ── Multi-year contract breakdown — the thing Adam specifically wants visible ──
function ContractYearsTable({ contractYears, signBonus, totalGtd }) {
  if (!contractYears || !Object.keys(contractYears).length) return null
  const years = Object.keys(contractYears).sort()
  return (
    <div className="wire-contract">
      <div className="wire-contract-years">
        {years.map(y => {
          const yr = contractYears[y]
          const flag = yr.is_max ? 'max' : !yr.guaranteed ? 'ng' : 'normal'
          const flagLabel = yr.is_max ? 'MAX' : !yr.guaranteed ? 'NON-GTD' : null
          return (
            <div key={y} className={`wire-contract-year wire-flag-${flag}`} title={flagLabel || 'Guaranteed'}>
              <span className="wire-contract-yr-label">'{y.slice(2)}</span>
              <span className="wire-contract-yr-val">{fmtMoney(yr.salary)}</span>
              {flagLabel && <span className="wire-contract-yr-flag">{flagLabel}</span>}
            </div>
          )
        })}
      </div>
      {(signBonus || totalGtd) && (
        <div className="wire-contract-meta">
          {signBonus ? <span>Sign bonus: <strong>{fmtMoney(signBonus)}</strong></span> : null}
          {totalGtd ? <span>Total GTD: <strong>{fmtMoney(totalGtd)}</strong></span> : null}
        </div>
      )}
    </div>
  )
}

// ── SB (signing bonus) budget utilized — fetched + cached per team/season ──
const sbCache = new Map()
function useSbBudget(abbrev, season) {
  const [data, setData] = useState(() => sbCache.get(`${abbrev}-${season}`) || null)

  useEffect(() => {
    if (!abbrev || !season) return
    const key = `${abbrev}-${season}`
    if (sbCache.has(key)) { setData(sbCache.get(key)); return }
    fetch(`${API_BASE}/bids/sb-projection/${abbrev}?season=${season}&salary=0`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { sbCache.set(key, d); setData(d) } })
      .catch(() => {})
  }, [abbrev, season])

  return data
}

function SBBudgetTag({ abbrev, season }) {
  const data = useSbBudget(abbrev, season)
  if (!data || data.startBalance == null) return null
  const pctUsed = data.startBalance ? Math.min(100, (data.spent / data.startBalance) * 100) : 0
  const color = data.balance < 5 ? 'var(--red)' : data.balance < 10 ? 'var(--gold)' : 'var(--green)'
  return (
    <div className="wire-sb-tag" style={{ color }}>
      SB budget: {fmtMoney(data.spent)} used of {fmtMoney(data.startBalance)} ({pctUsed.toFixed(0)}%)
    </div>
  )
}

function AssetPlayerLine({ asset, showContract = true }) {
  const season = asset.contract_years ? Object.keys(asset.contract_years).sort()[0] : null
  return (
    <div className="wire-asset-line">
      <div className="wire-asset-head">
        <TeamLogo abbrev={asset.team_abbrev} />
        {asset.player ? (
          <PlayerLink playerId={asset.player.sleeper_id} className="wire-player-link">
            {asset.player.full_name || asset.player.sleeper_id}
          </PlayerLink>
        ) : (
          <span className="wire-player-link wire-player-unlinked">Unknown player</span>
        )}
        {asset.player?.position && <span className="wire-pos">{asset.player.position}</span>}
        <span className="wire-arrow">→</span>
        <span className="wire-team-name">{teamName(asset.team_abbrev)}</span>
      </div>
      {showContract && (
        <ContractYearsTable
          contractYears={asset.contract_years}
          signBonus={asset.sign_bonus}
          totalGtd={asset.total_gtd}
        />
      )}
      {showContract && asset.sign_bonus && season && (
        <SBBudgetTag abbrev={asset.team_abbrev} season={season} />
      )}
    </div>
  )
}

function AssetPickLine({ asset }) {
  return (
    <div className="wire-asset-line">
      <div className="wire-asset-head">
        <TeamLogo abbrev={asset.team_abbrev} />
        <span className="wire-pick">{asset.pick_year} Round {asset.pick_round} Pick</span>
        <span className="wire-arrow">→</span>
        <span className="wire-team-name">{teamName(asset.team_abbrev)}</span>
      </div>
    </div>
  )
}

// ── Individual transaction card ──
function TransactionCard({ txn }) {
  const meta = TYPE_META[txn.type] || { label: txn.type, color: 'var(--text-muted)' }

  if (txn.type === 'draft_batch') {
    return (
      <div className="wire-bulletin">
        <div className="wire-bulletin-header">
          <span className="wire-bulletin-icon">🏈</span>
          <span className="wire-bulletin-title">{txn.notes || 'Draft Complete'}</span>
          <span className="wire-bulletin-date">{fmtDate(txn.transaction_date)}</span>
        </div>
        <div className="wire-bulletin-body">
          {(txn.assets || []).map((a, i) => (
            a.asset_type === 'pick'
              ? <AssetPickLine key={i} asset={a} />
              : <AssetPlayerLine key={i} asset={a} showContract={true} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="wire-tick">
      <div className="wire-tick-dot" style={{ background: meta.color }} />
      <div className="wire-tick-content">
        <div className="wire-tick-header">
          <span className="wire-type-badge" style={{ color: meta.color, borderColor: meta.color }}>
            {meta.label}
          </span>
          <span className="wire-tick-date">{fmtDate(txn.transaction_date)}</span>
        </div>
        {txn.notes && <div className="wire-tick-notes">{txn.notes}</div>}
        <div className="wire-tick-assets">
          {(txn.assets || []).map((a, i) => (
            a.asset_type === 'pick'
              ? <AssetPickLine key={i} asset={a} />
              : <AssetPlayerLine key={i} asset={a} showContract={txn.type !== 'trade' ? true : true} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Filters ──
function Filters({ team, setTeam, activeTypes, toggleType, from, setFrom, to, setTo, onReset }) {
  return (
    <div className="wire-filters">
      <select value={team} onChange={e => setTeam(e.target.value)} className="wire-filter-select">
        <option value="ALL">All Teams</option>
        {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.display_name || t.name}</option>)}
      </select>

      <div className="wire-type-chips">
        {ALL_TYPES.filter(t => t !== 'draft_batch' || true).map(t => (
          <button
            key={t}
            className={`wire-chip ${activeTypes.has(t) ? 'active' : ''}`}
            style={activeTypes.has(t) ? { borderColor: TYPE_META[t].color, color: TYPE_META[t].color } : {}}
            onClick={() => toggleType(t)}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div className="wire-date-range">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <span>to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      <button className="wire-reset-btn" onClick={onReset}>Reset</button>
    </div>
  )
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState('ALL')
  const [activeTypes, setActiveTypes] = useState(new Set(ALL_TYPES))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const toggleType = useCallback((t) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }, [])

  const resetFilters = useCallback(() => {
    setTeam('ALL')
    setActiveTypes(new Set(ALL_TYPES))
    setFrom('')
    setTo('')
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '500')
    if (team !== 'ALL') params.set('team', team)
    if (activeTypes.size && activeTypes.size < ALL_TYPES.length) {
      params.set('type', [...activeTypes].join(','))
    }
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (!from && !to) params.set('season', 'all')

    fetch(`${API_BASE}/transactions?${params.toString()}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [team, activeTypes, from, to])

  const sorted = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const d = (b.transaction_date || '').localeCompare(a.transaction_date || '')
      if (d !== 0) return d
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
  }, [transactions])

  return (
    <div className="wire-root">
      <div className="wire-header">
        <h1 className="wire-title">The Wire</h1>
        <p className="wire-sub">Every signing, release, trade, and failed bid — as it happens</p>
      </div>

      <Filters
        team={team} setTeam={setTeam}
        activeTypes={activeTypes} toggleType={toggleType}
        from={from} setFrom={setFrom} to={to} setTo={setTo}
        onReset={resetFilters}
      />

      <div className="wire-feed">
        {loading && <div className="wire-empty">Loading the wire…</div>}
        {!loading && !sorted.length && <div className="wire-empty">No transactions match these filters.</div>}
        {!loading && sorted.length > 0 && (
          <div className="wire-spine">
            {sorted.map(txn => <TransactionCard key={txn.id} txn={txn} />)}
          </div>
        )}
      </div>
    </div>
  )
}
