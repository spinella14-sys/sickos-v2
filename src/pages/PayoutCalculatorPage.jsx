import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LOGOS } from '../data/league'
import { useAuth } from '../context/AuthContext'
import './PayoutCalculatorPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const CURRENT_SEASON = 2026

function PotCard({ title, total, rows, accent }) {
  return (
    <div className="pcp-pot-card">
      <div className="pcp-pot-header" style={{ borderLeftColor: accent }}>
        <div className="pcp-pot-title">{title}</div>
        <div className="pcp-pot-total" style={{ color: accent }}>${total.toFixed(2)}</div>
      </div>
      <div className="pcp-pot-rows">
        {rows.map((r, i) => (
          <div key={i} className="pcp-pot-row">
            <span className="pcp-pot-row-label">{r.label}</span>
            <span className="pcp-pot-row-val" style={{ color: r.color || 'var(--text-primary)' }}>
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PayoutCalculatorPage() {
  const navigate  = useNavigate()
  const { isAdmin } = useAuth()
  const adminPw   = 'brethart'

  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [websiteFees, setWebsiteFees] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [newExpName,  setNewExpName]  = useState('')
  const [newExpAmt,   setNewExpAmt]   = useState('')
  const [expSaving,   setExpSaving]   = useState({})
  const [saveMsg,     setSaveMsg]     = useState(null)

  function load() {
    setLoading(true)
    fetch(`${API}/payouts/${CURRENT_SEASON}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setWebsiteFees(d?.config?.website_fees?.toString() || '0'); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function saveWebsiteFees() {
    setSaving(true); setSaveMsg(null)
    const r = await fetch(`${API}/payouts/${CURRENT_SEASON}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
      body: JSON.stringify({ website_fees: parseFloat(websiteFees) || 0 }),
    })
    setSaving(false)
    if (r.ok) { setSaveMsg('Saved'); load() }
    else setSaveMsg('Error saving')
  }

  async function toggleBuyIn(abbrev, current) {
    await fetch(`${API}/payouts/${CURRENT_SEASON}/payment/${abbrev}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
      body: JSON.stringify({ buy_in_paid: !current }),
    })
    load()
  }

  async function updateSbCredits(abbrev, val) {
    await fetch(`${API}/payouts/${CURRENT_SEASON}/sb-credits/${abbrev}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
      body: JSON.stringify({ sb_credits_purchased: parseInt(val) || 0 }),
    })
    load()
  }

  async function updateExpense(id, amount) {
    setExpSaving(s => ({ ...s, [id]: true }))
    await fetch(`${API}/payouts/${CURRENT_SEASON}/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
      body: JSON.stringify({ amount: parseFloat(amount) || 0 }),
    })
    setExpSaving(s => ({ ...s, [id]: false }))
    load()
  }

  async function addExpense() {
    if (!newExpName.trim()) return
    await fetch(`${API}/payouts/${CURRENT_SEASON}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
      body: JSON.stringify({ name: newExpName.trim(), amount: parseFloat(newExpAmt) || 0 }),
    })
    setNewExpName(''); setNewExpAmt('')
    load()
  }

  async function deleteExpense(id) {
    if (!window.confirm('Remove this expense?')) return
    await fetch(`${API}/payouts/${CURRENT_SEASON}/expenses/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': adminPw },
    })
    load()
  }

  if (loading) return <div className="pcp-loading">Loading payout data…</div>
  if (!data)   return <div className="pcp-loading">Failed to load payout data.</div>

  const { pot1, pot2, pot3, constants, teams, paid_count, weekly_leaders, weekly_earnings, rs_leader, playoff } = data
  const weeksPlayed = Object.keys(weekly_leaders || {}).length

  return (
    <div className="pcp-root">

      {/* ── Header ── */}
      <div className="pcp-header">
        <div>
          <h1 className="pcp-title">Payout Calculator</h1>
          <p className="pcp-sub">{CURRENT_SEASON} Season · LTL ${constants.ltl} · Buy-In ${constants.buyIn.toFixed(2)}</p>
        </div>
        <div className="pcp-buy-in-status">
          <span className="pcp-bi-label">Buy-Ins Paid</span>
          <span className="pcp-bi-count" style={{ color: paid_count === 16 ? 'var(--green,#3dba6e)' : 'var(--gold,#f0b429)' }}>
            {paid_count} / 16
          </span>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <div className="pcp-nav-tabs">
        <button className="pcp-nav-tab" onClick={() => navigate('/salary-cap')}>League Overview</button>
        <button className="pcp-nav-tab" onClick={() => navigate('/salary-cap/multi-year')}>Multi-Year View</button>
        <button className="pcp-nav-tab pcp-nav-tab--active">Payout Calculator</button>
      </div>

      {/* ── Website Expenses section — visible to all, editable by admin ── */}
      <div className="pcp-expenses-section">
        <div className="pcp-expenses-header">
          <div className="pcp-expenses-title">League Website Expenses</div>
          <div className="pcp-expenses-total">
            Total: <strong>${(data.config.website_fees || 0).toFixed(2)}</strong>
            <span className="pcp-expenses-per"> · ${((data.config.website_fees || 0) / 16).toFixed(2)} per manager</span>
          </div>
        </div>
        <table className="pcp-exp-table">
          <thead>
            <tr>
              <th className="pcp-exp-th">Service</th>
              <th className="pcp-exp-th">Notes</th>
              <th className="pcp-exp-th pcp-exp-th--num">Cost</th>
              {isAdmin && <th className="pcp-exp-th"/>}
            </tr>
          </thead>
          <tbody>
            {(data.expenses || []).map(e => (
              <tr key={e.id} className="pcp-exp-row">
                <td className="pcp-exp-td pcp-exp-name">{e.name}</td>
                <td className="pcp-exp-td pcp-exp-notes">{e.notes || '—'}</td>
                <td className="pcp-exp-td pcp-exp-num">
                  {isAdmin ? (
                    <div className="pcp-exp-input-row">
                      <span className="pcp-dollar">$</span>
                      <input
                        className="pcp-exp-input"
                        type="number" step="0.01" min="0"
                        defaultValue={parseFloat(e.amount || 0).toFixed(2)}
                        onBlur={ev => updateExpense(e.id, ev.target.value)}
                      />
                      {expSaving[e.id] && <span className="pcp-exp-saving">…</span>}
                    </div>
                  ) : (
                    `$${parseFloat(e.amount || 0).toFixed(2)}`
                  )}
                </td>
                {isAdmin && (
                  <td className="pcp-exp-td">
                    <button className="pcp-exp-del" onClick={() => deleteExpense(e.id)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
            {isAdmin && (
              <tr className="pcp-exp-row pcp-exp-row--new">
                <td className="pcp-exp-td">
                  <input
                    className="pcp-exp-input pcp-exp-input--name"
                    placeholder="Service name…"
                    value={newExpName}
                    onChange={e => setNewExpName(e.target.value)}
                  />
                </td>
                <td className="pcp-exp-td pcp-exp-notes">—</td>
                <td className="pcp-exp-td">
                  <div className="pcp-exp-input-row">
                    <span className="pcp-dollar">$</span>
                    <input
                      className="pcp-exp-input"
                      type="number" step="0.01" min="0"
                      placeholder="0.00"
                      value={newExpAmt}
                      onChange={e => setNewExpAmt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addExpense()}
                    />
                  </div>
                </td>
                <td className="pcp-exp-td">
                  <button className="pcp-admin-save" onClick={addExpense} disabled={!newExpName.trim()}>+ Add</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Three pots ── */}
      <div className="pcp-pots">
        <PotCard
          title="Pot 1 — Buy-In"
          total={pot1.total}
          accent="var(--orange)"
          rows={[
            { label: 'Buy-In × 16 teams', val: `$${pot1.total.toFixed(2)}` },
            { label: 'Website Fees', val: `-$${pot1.website_fees.toFixed(2)}`, color: 'var(--red,#d94f4f)' },
            { label: 'Remainder', val: `$${pot1.remainder.toFixed(2)}`, color: 'var(--text-primary)' },
            { label: `Weekly Leader Pool (60%) — $${pot1.weekly_per_week.toFixed(2)}/wk`, val: `$${pot1.weekly_pool.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: 'Commissioner Fee (10%)', val: `$${pot1.commissioner_fee.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: 'RS Points Leader (15%)', val: `$${pot1.rs_leader_prize.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: '→ Championship Pot (15%)', val: `$${pot1.to_championship.toFixed(2)}`, color: 'var(--blue,#3a9fd4)' },
          ]}
        />
        <PotCard
          title="Pot 2 — In-Season Spending"
          total={pot2.total}
          accent="var(--gold,#f0b429)"
          rows={[
            { label: 'Total contributions', val: `$${pot2.total.toFixed(2)}` },
            { label: '4th Place (10%)', val: `$${pot2.fourth_place.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: '3rd Place (15%)', val: `$${pot2.third_place.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: 'Runner-Up (25%)', val: `$${pot2.runner_up.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
            { label: 'Champion (50%)', val: `$${pot2.champion.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
          ]}
        />
        <PotCard
          title="Pot 3 — Championship"
          total={pot3.total}
          accent="var(--purple,#a78bfa)"
          rows={[
            { label: 'From Pot 1 (15%)', val: `$${pot3.from_pot1.toFixed(2)}` },
            { label: 'Luxury Tax Payments', val: `$${pot3.luxury_tax.toFixed(2)}` },
            { label: 'SB Credits Purchased', val: `$${pot3.sb_credits.toFixed(2)}` },
            { label: 'Champion Gets All', val: `$${pot3.total.toFixed(2)}`, color: 'var(--green,#3dba6e)' },
          ]}
        />
      </div>

      {/* ── Season progress ── */}
      {rs_leader && (
        <div className="pcp-leaders">
          <div className="pcp-leader-item">
            <span className="pcp-leader-label">RS Points Leader</span>
            <span className="pcp-leader-val">{rs_leader}</span>
          </div>
          {weeksPlayed > 0 && (
            <div className="pcp-leader-item">
              <span className="pcp-leader-label">Weekly Leader Payouts</span>
              <span className="pcp-leader-val">{weeksPlayed} / 14 weeks</span>
            </div>
          )}
          {playoff.champion && (
            <div className="pcp-leader-item">
              <span className="pcp-leader-label">Champion</span>
              <span className="pcp-leader-val" style={{ color: 'var(--gold)' }}>🏆 {playoff.champion}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Per-team table ── */}
      <div className="pcp-table-wrap">
        <table className="pcp-table">
          <thead>
            <tr>
              <th className="pcp-th pcp-th--team">Team</th>
              <th className="pcp-th">Paid</th>
              <th className="pcp-th">Salary</th>
              <th className="pcp-th">Pot 2</th>
              <th className="pcp-th">Tax Pmt</th>
              <th className="pcp-th">EOS Addl</th>
              <th className="pcp-th">Total Paid</th>
              <th className="pcp-th">Wkly $</th>
              <th className="pcp-th">Playoff $</th>
              <th className="pcp-th" style={{color:'var(--green,#3dba6e)'}}>Total Earned</th>
              {isAdmin && <th className="pcp-th">SB Credits</th>}
            </tr>
          </thead>
          <tbody>
            {(teams || []).sort((a, b) => b.cap_used - a.cap_used).map(t => {
              const wEarnings = parseFloat(weekly_earnings?.[t.abbrev] || 0)
              const overTax   = t.cap_used > constants.ltl

              // Playoff earnings
              let playoffEarnings = 0
              if (playoff.champion      === t.abbrev) playoffEarnings = pot2.champion    + pot3.total
              else if (playoff.runner_up    === t.abbrev) playoffEarnings = pot2.runner_up
              else if (playoff.third_place  === t.abbrev) playoffEarnings = pot2.third_place
              else if (playoff.fourth_place === t.abbrev) playoffEarnings = pot2.fourth_place

              // RS points leader prize
              const rsEarnings = rs_leader === t.abbrev ? pot1.rs_leader_prize : 0

              // Total earnings
              const totalEarnings = wEarnings + playoffEarnings + rsEarnings

              return (
                <tr key={t.abbrev} className={`pcp-row ${overTax ? 'pcp-row--tax' : ''}`}>
                  <td className="pcp-td pcp-td--team">
                    {LOGOS[t.abbrev] && <img src={LOGOS[t.abbrev]} alt={t.abbrev} className="pcp-logo"/>}
                    <div>
                      <div className="pcp-team-name">{t.name || t.abbrev}</div>
                      <div className="pcp-team-mgr">{t.manager}</div>
                    </div>
                  </td>
                  <td className="pcp-td pcp-td--center">
                    {isAdmin ? (
                      <input
                        type="checkbox"
                        className="pcp-checkbox"
                        checked={t.buy_in_paid}
                        onChange={() => toggleBuyIn(t.abbrev, t.buy_in_paid)}
                      />
                    ) : (
                      <span style={{ color: t.buy_in_paid ? 'var(--green,#3dba6e)' : 'var(--red,#d94f4f)', fontWeight:700 }}>
                        {t.buy_in_paid ? '✓' : '✗'}
                      </span>
                    )}
                  </td>
                  <td className="pcp-td pcp-td--num" style={{ color: overTax ? 'var(--gold)' : 'var(--text-primary)' }}>
                    ${t.cap_used.toFixed(2)}
                  </td>
                  <td className="pcp-td pcp-td--num">${t.pot2_contribution.toFixed(2)}</td>
                  <td className="pcp-td pcp-td--num" style={{ color: t.tax_payment > 0 ? 'var(--red,#d94f4f)' : 'var(--text-muted)' }}>
                    {t.tax_payment > 0 ? `$${t.tax_payment.toFixed(2)}` : '—'}
                  </td>
                  <td className="pcp-td pcp-td--num">${t.eos_additional.toFixed(2)}</td>
                  <td className="pcp-td pcp-td--num" style={{ fontWeight:700 }}>${t.total_paid.toFixed(2)}</td>
                  <td className="pcp-td pcp-td--num" style={{ color: wEarnings > 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)' }}>
                    {wEarnings > 0 ? `$${wEarnings.toFixed(2)}` : '—'}
                  </td>
                  <td className="pcp-td pcp-td--num" style={{ color: playoffEarnings > 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)' }}>
                    {playoffEarnings > 0 ? `$${playoffEarnings.toFixed(2)}` : '—'}
                  </td>
                  <td className="pcp-td pcp-td--num" style={{
                    color: totalEarnings > 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)',
                    fontWeight: totalEarnings > 0 ? 800 : 400,
                  }}>
                    {totalEarnings > 0 ? `$${totalEarnings.toFixed(2)}` : '—'}
                  </td>
                  {isAdmin && (
                    <td className="pcp-td pcp-td--center">
                      <select
                        className="pcp-sb-select"
                        value={t.sb_credits}
                        onChange={e => updateSbCredits(t.abbrev, e.target.value)}
                      >
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>${n}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pcp-footnote">
        EOS Additional = amount owed beyond the buy-in based on final season salary + tax penalties. Total Paid = Buy-In + EOS Additional.
        All amounts are projections based on current salary — final figures determined at end of regular season.
      </div>
    </div>
  )
}
