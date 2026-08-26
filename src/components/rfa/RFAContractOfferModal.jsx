import { useState, useEffect, useMemo } from 'react'
import '../../pages/FABidPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const STRUCTURES = ['escalating', 'flat', 'descending']
const STRUCTURE_LABELS = { escalating: 'Escalating', flat: 'Flat', descending: 'Descending' }
const RFA_ROUND_LABEL = { 1: 'RFA 1st', 2: 'RFA 2nd' }

function calcSalaries(y1, structure, years) {
  const result = [y1]
  for (let i = 1; i < years; i++) {
    if (structure === 'flat') result.push(y1)
    else if (structure === 'descending') result.push(parseFloat((y1 * Math.pow(0.9, i)).toFixed(2)))
    else result.push(parseFloat((result[i - 1] * 1.1).toFixed(2))) // escalating
  }
  return result
}

export default function RFAContractOfferModal({
  player, wave, currentTeam, existingTerms, onSave, onClose,
}) {
  const isWave1 = wave === 1
  const [teamData, setTeamData] = useState(null)
  const [sbBalance, setSbBalance] = useState(null)

  const [salary, setSalary] = useState(existingTerms?.y1_salary ?? (player?.tender_floor ?? 0))
  const [years, setYears] = useState(isWave1 ? 3 : (existingTerms?.years ?? 3))
  const [structure, setStructure] = useState(isWave1 ? 'escalating' : (existingTerms?.structure ?? 'escalating'))
  const [nonGuaranteedFinal, setNonGuaranteedFinal] = useState(isWave1 ? false : (existingTerms?.non_guaranteed_final ?? false))
  const [signingBonus, setSigningBonus] = useState(existingTerms?.signing_bonus ?? 0)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/teams/${currentTeam}`).then(r => r.ok ? r.json() : null).then(setTeamData)
    fetch(`${API}/bids/sb-balances?season=${SEASON}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d[currentTeam] ?? null))
  }, [currentTeam])

  const effectiveYears = isWave1 ? 3 : years
  const effectiveStructure = isWave1 ? 'escalating' : structure

  const salaries = useMemo(() => {
    const y1 = parseFloat(salary) || 0
    return calcSalaries(y1, effectiveStructure, effectiveYears)
  }, [salary, effectiveStructure, effectiveYears])

  const guaranteedCount = (isWave1 || !nonGuaranteedFinal) ? effectiveYears : effectiveYears - 1

  const totalGuaranteed = useMemo(() => {
    const guaranteedSalary = salaries.slice(0, guaranteedCount).reduce((s, v) => s + v, 0)
    return parseFloat((guaranteedSalary + (parseFloat(signingBonus) || 0)).toFixed(2))
  }, [salaries, guaranteedCount, signingBonus])

  const floor = player?.tender_floor ?? null
  const belowFloor = !isWave1 && floor != null && totalGuaranteed <= floor
  const roundLabel = player?.draft_round ? (RFA_ROUND_LABEL[player.draft_round] || `RFA Round ${player.draft_round}`) : null

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
      years: effectiveYears,
      structure: effectiveStructure,
      non_guaranteed_final: isWave1 ? false : nonGuaranteedFinal,
      guaranteed_years: guaranteedCount,
      signing_bonus: parseFloat(signingBonus) || 0,
    })
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
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
              {roundLabel && <span className="fab-pos">{roundLabel}</span>}
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
          {floor != null && (
            <div style={{ fontSize: 12, color: 'var(--draft-amber, #e8a933)', marginBottom: 12, fontWeight: 600 }}>
              {isWave1
                ? `${roundLabel || 'RFA'} tender floor: $${floor.toFixed(2)} minimum.`
                : <>Estimated minimum to beat this player's tender floor: ${floor.toFixed(2)} total guaranteed.
                   This is the best available estimate before Wave 1 happens live — the real tender may be higher.</>}
            </div>
          )}

          <div className="fab-field">
            <label className="fab-label">
              Salary (Year 1) {floor != null && <span className="fab-max-hint">Floor: ${floor.toFixed(2)}</span>}
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
            <label className="fab-label">Years</label>
            {isWave1 ? (
              <div className="fab-years-row">
                <span className="fab-year-btn fab-year-btn--active" style={{ cursor: 'default', opacity: 0.85 }}>
                  3yr — locked for Wave 1 tenders
                </span>
              </div>
            ) : (
              <div className="fab-years-row">
                {[3, 4].map(y => (
                  <button
                    key={y} type="button"
                    className={`fab-year-btn ${years === y ? 'fab-year-btn--active' : ''}`}
                    onClick={() => setYears(y)}
                  >{y}yr</button>
                ))}
              </div>
            )}
          </div>

          {!isWave1 && (
            <div className="fab-field">
              <label className="fab-label">Structure</label>
              <div className="fab-years-row">
                {STRUCTURES.map(s => (
                  <button
                    key={s} type="button"
                    className={`fab-year-btn ${structure === s ? 'fab-year-btn--active' : ''}`}
                    onClick={() => setStructure(s)}
                  >{STRUCTURE_LABELS[s]}</button>
                ))}
              </div>
            </div>
          )}

          <div className="fab-field">
            <label className="fab-label">Contract Preview</label>
            <div style={{ fontSize: 12, color: 'var(--draft-text-muted, #8B949E)', lineHeight: 1.8 }}>
              {salaries.map((sal, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Year {i + 1} {i >= guaranteedCount ? '(non-gtd)' : '(gtd)'}</span>
                  <span>${sal.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--draft-border)', marginTop: 4, paddingTop: 4, fontWeight: 700, color: 'inherit' }}>
                <span>Total Guaranteed</span>
                <span>${totalGuaranteed.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {isWave1 ? (
            <div className="fab-field">
              <label className="fab-label">Guaranteed Years</label>
              <div className="fab-max-hint">All 3 years fully guaranteed (required for a tender)</div>
            </div>
          ) : (
            <div className="fab-field fab-field--inline">
              <label className="fab-label">
                <input type="checkbox" className="fab-checkbox" checked={nonGuaranteedFinal}
                  onChange={e => setNonGuaranteedFinal(e.target.checked)} />
                {' '}Final year non-guaranteed
              </label>
            </div>
          )}

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
