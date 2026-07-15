import { useState, useEffect, useMemo, useCallback } from 'react'
import { TEAMS, LOGOS } from '../data/league'
import PlayerLink from '../components/PlayerCard/PlayerLink'
import './TransactionsPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const MAX_YEAR_COLS = 5

const TYPE_META = {
  signing:     { label: 'Signing',     color: 'var(--green)' },
  release:     { label: 'Release',     color: 'var(--text-muted)' },
  trade:       { label: 'Trade',       color: 'var(--blue)' },
  bid_lost:    { label: 'Failed Bid',  color: 'var(--gold)' },
  draft_batch: { label: 'Draft',       color: 'var(--text-primary)' },
}
const CHIP_TYPES = ['signing', 'release', 'trade', 'bid_lost']

function TeamLogo({ abbrev, size = 18 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }} loading="lazy" />
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtMoney(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return `$${parseFloat(v).toFixed(2)}`
}

// Turns { "2025": {...}, "2026": {...} } into an ordered array of {label:'Y1', ...} up to MAX_YEAR_COLS
function toYearCells(contractYears) {
  if (!contractYears) return []
  const keys = Object.keys(contractYears).sort()
  return keys.slice(0, MAX_YEAR_COLS).map((k, i) => ({
    label: `Y${i + 1}`,
    salary: contractYears[k].salary,
    guaranteed: contractYears[k].guaranteed,
    isMax: contractYears[k].is_max,
  }))
}

function contractTotal(contractYears) {
  if (!contractYears) return null
  return Object.values(contractYears).reduce((s, y) => s + (parseFloat(y.salary) || 0), 0)
}

// ── One line of the table: a single player or pick asset ──
function AssetRow({ txn, asset, isSubRow = false }) {
  const meta = TYPE_META[txn.type] || { label: txn.type, color: 'var(--text-muted)' }
  const isPick = asset.asset_type === 'pick'
  const yearCells = isPick ? [] : toYearCells(asset.contract_years)
  const total = isPick ? null : contractTotal(asset.contract_years)

  return (
    <tr className={`wire-row ${isSubRow ? 'wire-subrow' : ''}`}>
      {!isSubRow && (
        <td className="wire-td-date">{fmtDate(txn.transaction_date)}</td>
      )}
      {!isSubRow && (
        <td className="wire-td-type">
          <span className="wire-type-badge" style={{ color: meta.color, borderColor: meta.color }}>
            {meta.label}
          </span>
        </td>
      )}
      {isSubRow && <td className="wire-td-date" />}
      {isSubRow && <td className="wire-td-type" />}
      <td className="wire-td-team">
        <TeamLogo abbrev={asset.team_abbrev} />
        <span>{asset.team_abbrev}</span>
      </td>
      <td className="wire-td-player">
        {isPick ? (
          <span className="wire-pick">{asset.pick_year} Rd {asset.pick_round} Pick</span>
        ) : asset.player ? (
          <PlayerLink playerId={asset.player.sleeper_id} className="wire-player-link">
            {asset.player.full_name || asset.player.sleeper_id}
          </PlayerLink>
        ) : (
          <span className="wire-player-unlinked">Unknown</span>
        )}
      </td>
      <td className="wire-td-pos">{!isPick && asset.player?.position ? asset.player.position : '—'}</td>
      <td className="wire-td-total">{isPick ? '—' : fmtMoney(total)}</td>
      <td className="wire-td-years">{isPick ? '—' : (yearCells.length || '—')}</td>
      <td className="wire-td-sb">{isPick ? '—' : (asset.sign_bonus ? fmtMoney(asset.sign_bonus) : '—')}</td>
      {Array.from({ length: MAX_YEAR_COLS }).map((_, i) => {
        const yc = yearCells[i]
        if (!yc) return <td key={i} className="wire-td-year wire-year-empty">—</td>
        const flagClass = yc.isMax ? 'wire-year-max' : !yc.guaranteed ? 'wire-year-ng' : ''
        return (
          <td key={i} className={`wire-td-year ${flagClass}`}>
            {fmtMoney(yc.salary)}
          </td>
        )
      })}
    </tr>
  )
}

// ── Trade: collapsed summary row, expands to show every asset leg ──
function TradeRow({ txn }) {
  const [open, setOpen] = useState(false)
  const teams = [...new Set((txn.assets || []).map(a => a.team_abbrev))]

  return (
    <>
      <tr className="wire-row wire-trade-summary" onClick={() => setOpen(o => !o)}>
        <td className="wire-td-date">{fmtDate(txn.transaction_date)}</td>
        <td className="wire-td-type">
          <span className="wire-type-badge" style={{ color: TYPE_META.trade.color, borderColor: TYPE_META.trade.color }}>
            Trade
          </span>
        </td>
        <td className="wire-td-trade-summary" colSpan={9}>
          <span className="wire-trade-caret">{open ? '▾' : '▸'}</span>
          Trade Executed Between{' '}
          {teams.map((t, i) => (
            <span key={t} className="wire-trade-team">
              <TeamLogo abbrev={t} size={16} /> {t}{i < teams.length - 1 ? ' ↔ ' : ''}
            </span>
          ))}
        </td>
      </tr>
      {open && (txn.assets || []).map((a, i) => (
        <AssetRow key={i} txn={txn} asset={a} isSubRow />
      ))}
    </>
  )
}

function TransactionRows({ txn }) {
  if (txn.type === 'trade') return <TradeRow txn={txn} />
  const assets = txn.assets || []
  if (!assets.length) return null
  // Signing/release/bid_lost/draft_batch: one asset = one row; multi-asset draft
  // batches render each asset as its own labeled row (date/type only on first).
  return assets.map((a, i) => (
    <AssetRow key={i} txn={txn} asset={a} isSubRow={i > 0} />
  ))
}

// ── Filters — click a chip to filter TO that type; empty selection = show all ──
function Filters({ activeTypes, toggleType, clearTypes, team, setTeam, from, setFrom, to, setTo, onReset }) {
  const allActive = activeTypes.size === 0
  return (
    <div className="wire-filters">
      <select value={team} onChange={e => setTeam(e.target.value)} className="wire-filter-select">
        <option value="ALL">All Teams</option>
        {TEAMS.map(t => <option key={t.abbrev} value={t.abbrev}>{t.display_name || t.name}</option>)}
      </select>

      <div className="wire-type-chips">
        <button
          className={`wire-chip ${allActive ? 'active' : ''}`}
          onClick={clearTypes}
        >
          All
        </button>
        {CHIP_TYPES.map(t => (
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
  const [activeTypes, setActiveTypes] = useState(new Set()) // empty = show all
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const toggleType = useCallback((t) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }, [])
  const clearTypes = useCallback(() => setActiveTypes(new Set()), [])

  const resetFilters = useCallback(() => {
    setTeam('ALL')
    setActiveTypes(new Set())
    setFrom('')
    setTo('')
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '500')
    if (team !== 'ALL') params.set('team', team)
    if (activeTypes.size > 0) params.set('type', [...activeTypes].join(','))
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
        activeTypes={activeTypes} toggleType={toggleType} clearTypes={clearTypes}
        team={team} setTeam={setTeam}
        from={from} setFrom={setFrom} to={to} setTo={setTo}
        onReset={resetFilters}
      />

      <div className="wire-feed">
        {loading && <div className="wire-empty">Loading the wire…</div>}
        {!loading && !sorted.length && <div className="wire-empty">No transactions match these filters.</div>}
        {!loading && sorted.length > 0 && (
          <div className="wire-table-wrap">
            <table className="wire-table">
              <thead>
                <tr>
                  <th className="th-date">Date</th>
                  <th className="th-type">Type</th>
                  <th className="th-team">Team</th>
                  <th className="th-player">Player</th>
                  <th className="th-pos">Pos</th>
                  <th className="th-total">Total</th>
                  <th className="th-years">Yrs</th>
                  <th className="th-sb">Sign Bonus</th>
                  <th className="th-year">Y1</th>
                  <th className="th-year">Y2</th>
                  <th className="th-year">Y3</th>
                  <th className="th-year">Y4</th>
                  <th className="th-year">Y5</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(txn => <TransactionRows key={txn.id} txn={txn} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
