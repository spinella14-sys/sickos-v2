import { useState, useEffect, useMemo } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SEASON = new Date().getFullYear()
const STRUCTURES = ['escalating', 'flat', 'descending']
const STRUCTURE_LABELS = { escalating: 'Escalating', flat: 'Flat', descending: 'Descending' }
const RFA_ROUND_LABEL = { 1: 'RFA 1st', 2: 'RFA 2nd' }

const BG = '#14171C'
const CARD_BG = '#1C2028'
const INPUT_BG = '#232833'
const BORDER = 'rgba(255,255,255,0.12)'
const TEXT = '#F0F3F7'
const TEXT_MUTED = '#A8B3C2'
const TEXT_DIM = '#8B949E'
const AMBER = '#F5A623'
const RED = '#E84545'
const GREEN = '#3DBA6E'

function calcSalaries(y1, structure, years) {
  const result = [y1]
  for (let i = 1; i < years; i++) {
    if (structure === 'flat') result.push(y1)
    else if (structure === 'descending') result.push(parseFloat((y1 * Math.pow(0.9, i)).toFixed(2)))
    else result.push(parseFloat((result[i - 1] * 1.1).toFixed(2)))
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

  const labelStyle = { color: TEXT_MUTED, fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }
  const fieldStyle = { marginBottom: 16 }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: INPUT_BG, border: `1px solid ${BORDER}`,
    color: '#000000', borderRadius: 6, padding: '10px 12px', fontSize: 16, outline: 'none',
  }
  const pillBtn = (active) => ({
    background: active ? AMBER : INPUT_BG, color: active ? '#000' : TEXT,
    border: `1px solid ${active ? AMBER : BORDER}`, borderRadius: 6,
    fontSize: 13, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', marginRight: 6,
  })

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: BG, maxWidth: 560, width: '92%', maxHeight: '85vh', overflowY: 'auto',
        borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`,
      }}>
        <h1 style={{ color: TEXT, fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>
          {isWave1 ? 'Set Tender' : 'Set Challenge Offer'}
        </h1>

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ color: '#000000', fontSize: 18, fontWeight: 700 }}>{player.full_name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {player.position && <span style={{ color: AMBER, fontSize: 12, fontWeight: 700 }}>{player.position}</span>}
            {player.nfl_team && <span style={{ color: TEXT_MUTED, fontSize: 12 }}>{player.nfl_team}</span>}
            {roundLabel && <span style={{ color: TEXT_MUTED, fontSize: 12 }}>{roundLabel}</span>}
          </div>
        </div>

        {teamData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: '#000000', fontSize: 11 }}>Cap Used</div>
              <div style={{ color: '#000000', fontSize: 15, fontWeight: 700 }}>${parseFloat(teamData.cap_used || 0).toFixed(2)}</div>
            </div>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: TEXT_DIM, fontSize: 11 }}>Cap Space</div>
              <div style={{ color: GREEN, fontSize: 15, fontWeight: 700 }}>${parseFloat(teamData.cap_space || 0).toFixed(2)}</div>
            </div>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: '#000000', fontSize: 11 }}>SB Budget</div>
              <div style={{ color: '#000000', fontSize: 15, fontWeight: 700 }}>{sbBalance !== null ? `$${sbBalance.toFixed(2)}` : '—'}</div>
            </div>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
              <div style={{ color: '#000000', fontSize: 11 }}>Hard Cap</div>
              <div style={{ color: '#000000', fontSize: 15, fontWeight: 700 }}>${parseFloat(teamData.hard_cap || 138).toFixed(2)}</div>
            </div>
          </div>
        )}

        {floor != null && (
          <div style={{
            fontSize: 13, color: AMBER, fontWeight: 700, marginBottom: 16, padding: '10px 12px',
            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 6,
          }}>
            {isWave1
              ? `${roundLabel || 'RFA'} tender floor: offer must start at $${floor.toFixed(2)} minimum.`
              : <>Estimated minimum to beat this player's tender floor: ${floor.toFixed(2)} total guaranteed.
                 <span style={{ color: TEXT_MUTED, fontWeight: 400 }}> This is the best available estimate before Wave 1 happens live — the real tender may be higher.</span></>}
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>
            Salary (Year 1) {floor != null && <span style={{ color: AMBER, fontWeight: 700 }}> · Floor: ${floor.toFixed(2)}</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: TEXT, fontSize: 16 }}>$</span>
            <input
              type="number" style={inputStyle}
              value={salary} onChange={e => { setSalary(e.target.value); setError('') }}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Years</label>
          {isWave1 ? (
            <div style={{ color: TEXT_MUTED, fontSize: 13 }}>3yr — locked for Wave 1 tenders</div>
          ) : (
            <div>
              {[3, 4].map(y => (
                <button key={y} type="button" style={pillBtn(years === y)} onClick={() => setYears(y)}>{y}yr</button>
              ))}
            </div>
          )}
        </div>

        {!isWave1 && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Structure</label>
            <div>
              {STRUCTURES.map(s => (
                <button key={s} type="button" style={pillBtn(structure === s)} onClick={() => setStructure(s)}>
                  {STRUCTURE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>Contract Preview</label>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            {salaries.map((sal, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: TEXT_MUTED }}>Year {i + 1} {i >= guaranteedCount ? '(non-gtd)' : '(gtd)'}</span>
                <span style={{ color: TEXT, fontWeight: 600 }}>${sal.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ color: TEXT, fontWeight: 700 }}>Total Guaranteed</span>
              <span style={{ color: AMBER, fontWeight: 700 }}>${totalGuaranteed.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {isWave1 ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Guaranteed Years</label>
            <div style={{ color: TEXT_MUTED, fontSize: 13 }}>All 3 years fully guaranteed (required for a tender)</div>
          </div>
        ) : (
          <div style={fieldStyle}>
            <label style={{ color: TEXT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={nonGuaranteedFinal}
                onChange={e => setNonGuaranteedFinal(e.target.checked)} />
              Final year non-guaranteed
            </label>
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>
            Signing Bonus (optional) {sbBalance !== null && <span style={{ color: TEXT_DIM, fontWeight: 400 }}> — ${sbBalance.toFixed(2)} available</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: TEXT, fontSize: 16 }}>$</span>
            <input
              type="number" style={inputStyle}
              value={signingBonus} onChange={e => { setSigningBonus(e.target.value); setError('') }}
            />
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: RED, marginBottom: 12, fontWeight: 700 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${BORDER}`,
            background: 'none', color: TEXT, fontWeight: 700, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
            background: AMBER, color: '#000', fontWeight: 700, cursor: 'pointer',
          }}>Save Offer</button>
        </div>
      </div>
    </div>
  )
}
