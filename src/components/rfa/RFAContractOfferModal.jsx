import { useState, useEffect, useMemo } from 'react'
import '../../pages/FABidPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()

export default function RFAContractOfferModal({
  player, wave, currentTeam, existingTerms, onSave, onClose,
}) {
  const isWave1 = wave === 1
  const [teamData, setTeamData] = useState(null)
  const [sbBalance, setSbBalance] = useState(null)

  const [salary, setSalary] = useState(existingTerms?.y1_salary ?? (player?.tender_floor ?? 0))
  const [guaranteedYears, setGuaranteedYears] = useState(isWave1 ? 3 : (existingTerms?.guaranteed_years ?? 3))
  const [signingBonus, setSigningBonus] = useState(existingTerms?.signing_bonus ?? 0)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/teams/${currentTeam}`).then(r => r.ok ? r.json() : null).then(setTeamData)
    fetch(`${API}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[currentTeam] ?? null))
  }, [currentTeam])

  const totalGuaranteed = useMemo(() => {
    const y1 = parseFloat(salary) || 0
    const y2 = parseFloat((y1 * 1.1).toFixed(2))
    const y3 = parseFloat((y2 * 1.1).toFixed(2))
    const years = [y1, y2, y3]
    const guaranteedSalary = years.slice(0, guaranteedYears).reduce((s, v) => s + v, 0)
    return parseFloat((guaranteedSalary + (parseFloat(signingBonus) || 0)).toFixed(2))
  }, [salary, guaranteedYears, signingBonus])

  const floor = player?.tender_floor ?? null
  const belowFloor = !isWave1 && floor != null && totalGuaranteed <= floor

  function handleSave() {
    if (belowFloor) {
      setError(`Total guaranteed money ($${totalGuaranteed.toFixed(2)}) must exceed the tender floor ($${floor.toFixed(2)}) to have any chance of winning.`)
      return
    }
    if (!salary || parseFloat(salary) <= 0) {
      setError('Enter a salary amount.')
      return
    }
    onSave({
      sleeper_id: player.sleeper_id,
      y1_salary: parseFloat(salary),
      guaranteed_years: guaranteedYears,
      signing_bonus: parseFloat(signingBonus) || 0,
      years: 3,
      structure: 'ascending',
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="fab-root" style={{ maxWidth: 560, width: '92%', maxHeight: '85vh', overflowY: 'auto', borderRadius: 12 }}>
        <div className="fab-header">
          <h1 className="fab-title">{isWave1 ? 'Set Tender' : 'Set Challenge Offer'}</h1>
        </div>

        <div className="fab-player-card">
          <div className="fab-player-info">
            <div className="fab-player-name">{player.full_name}</div>
            <div className="fab-player-meta">
              {player.position && <span className="fab-pos">{player.position}</span>}
              {player.nfl_team && <span className="fab-nfl">{player.nfl_team}</span>}
            </div>
          </div>
        </div>

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

        <div className="fab-form">
          {!isWave1 && floor != null && (
            <div style={{ fontSize: 12, color: 'var(--draft-amber, #e8a933)', marginBottom: 12, fontWeight: 600 }}>
              Estimated minimum to beat this player's tender floor: ${floor.toFixed(2)} total guaranteed.
              This is the best available estimate before Wave 1 happens live — the real tender may be higher.
            </div>
          )}

          <div className="fab-field">
            <label className="fab-label">
              Salary (Year 1) {!isWave1 && floor != null && <span className="fab-max-hint">Floor: ${floor.toFixed(2)}</span>}
            </label>
            <div className="fab-salary-row">
              <span className="fab-dollar">$</span>
              <input
                type="number" className="fab-input fab-salary-input"
                value={salary} onChange={e => { setSalary(e.target.value); setError('') }}
              />
            </div>
          </div>

          <div className="fab-field">
            <label className="fab-label">Guaranteed Years</label>
            {isWave1 ? (
              <div className="fab-years-row">
                <span className="fab-year-btn fab-year-btn--active" style={{ cursor: 'default', opacity: 0.85 }}>
                  3yr (Fully Guaranteed — locked for Wave 1 tenders)
                </span>
              </div>
            ) : (
              <div className="fab-years-row">
                {[1, 2, 3].map(y => (
                  <button
                    key={y} type="button"
                    className={`fab-year-btn ${guaranteedYears === y ? 'fab-year-btn--active' : ''}`}
                    onClick={() => setGuaranteedYears(y)}
                  >{y}yr</button>
                ))}
              </div>
            )}
          </div>

          <div className="fab-field">
            <label className="fab-label">
              Signing Bonus (optional) {sbBalance !== null && <span className="fab-sb-hint"> — ${sbBalance.toFixed(2)} available</span>}
            </label>
            <div className="fab-salary-row">
              <span className="fab-dollar">$</span>
              <input
                type="number" className="fab-input"
                value={signingBonus} onChange={e => { setSigningBonus(e.target.value); setError('') }}
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--draft-red, #e84545)', marginBottom: 12, fontWeight: 600 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--draft-border)',
              background: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleSave} style={{
              flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
              background: 'var(--draft-amber)', color: '#000', fontWeight: 700, cursor: 'pointer',
            }}>Save Offer</button>
          </div>
        </div>
      </div>
    </div>
  )
}
