import { useState, useEffect, useMemo } from 'react'
import { QB_MAX, NON_QB_MAX } from '../../constants/ufaTiers'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const STRUCTURE_LABELS = {
  escalating: 'Escalating',
  ascending:  'Ascending',
  flat:       'Flat',
  descending: 'Descending',
}

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

/**
 * Shared contract-offer modal for the RFA and UFA draft boards.
 *
 * GUARANTEE MODEL -- the important part.
 * The league rule is that every contract must be guaranteed in all years
 * except optionally the last. This modal stores that as a BOOLEAN
 * (nonGuaranteedFinal), never as a guaranteed-years number, so an
 * under-guaranteed offer is not representable in the UI at all. The derived
 * guaranteed_years is always either `years` or `years - 1`.
 *
 * The RFA and UFA modules genuinely differ, so the differences are props
 * rather than pretended away:
 *
 *   floorMode           'total_guaranteed' (RFA: beat the tender) or
 *                       'y1' (UFA: meet the tier minimum)
 *   salaryFixed         UFA wave 1 -- salary IS the position max, not typed
 *   yearsLocked         RFA wave 1 -- tenders are always 3 years
 *   structureLocked     RFA wave 1 -- tenders are always escalating
 *   guaranteeLocked     RFA wave 1 -- tenders are always fully guaranteed
 */
export default function ContractOfferModal({
  player,
  currentTeam,
  existingTerms,
  onSave,
  onClose,

  title = 'Set Offer',
  subtitle = null,

  // Floor
  floor = null,                       // number | null
  floorMode = 'total_guaranteed',     // 'total_guaranteed' | 'y1'
  floorNote = null,                   // extra explanation under the floor banner

  // Locks / options
  salaryFixed = false,                // salary is the position max, not editable
  yearsLocked = null,                 // number | null
  yearsOptions = [1, 2, 3, 4],
  structureLocked = null,             // string | null
  structureOptions = ['escalating', 'flat', 'descending'],
  guaranteeLocked = false,            // force fully guaranteed

  showWithdrawIfHigher = false,
  showCarryOver = false,
  saveLabel = 'Save Offer',
}) {
  const isQB   = player?.position === 'QB'
  const maxSal = isQB ? QB_MAX : NON_QB_MAX

  const [teamData, setTeamData]   = useState(null)
  const [sbBalance, setSbBalance] = useState(null)

  const initialSalary = salaryFixed
    ? maxSal
    : (existingTerms?.y1_salary ?? (floorMode === 'y1' && floor != null ? floor : 0))

  const [salary, setSalary]       = useState(initialSalary)
  const [years, setYears]         = useState(yearsLocked ?? existingTerms?.years ?? 3)
  const [structure, setStructure] = useState(
    structureLocked ?? existingTerms?.structure ?? structureOptions[0]
  )
  const [nonGuaranteedFinal, setNonGuaranteedFinal] = useState(
    guaranteeLocked ? false : (existingTerms?.non_guaranteed_final ?? true)
  )
  const [signingBonus, setSigningBonus] = useState(existingTerms?.signing_bonus ?? 0)
  const [withdrawIfHigher, setWithdrawIfHigher] = useState(
    existingTerms?.withdraw_if_higher_wins ?? false
  )
  const [noCarryOver, setNoCarryOver] = useState(existingTerms?.no_carry_over ?? false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentTeam) return
    fetch(`${API}/teams/${currentTeam}`).then(r => r.ok ? r.json() : null).then(setTeamData).catch(() => {})
    fetch(`${API}/bids/sb-balances`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSbBalance(d?.[currentTeam] ?? null))
      .catch(() => {})
  }, [currentTeam])

  // A fixed-salary tier (UFA wave 1) recalculates if the player changes.
  useEffect(() => {
    if (salaryFixed) setSalary(maxSal)
  }, [salaryFixed, maxSal])

  const effectiveYears     = yearsLocked ?? Number(years)
  const effectiveStructure = structureLocked ?? structure

  const salaries = useMemo(() => {
    const y1 = parseFloat(salary) || 0
    return calcSalaries(y1, effectiveStructure, effectiveYears)
  }, [salary, effectiveStructure, effectiveYears])

  // Always years or years-1. The illegal middle ground does not exist.
  const guaranteedCount = (guaranteeLocked || !nonGuaranteedFinal)
    ? effectiveYears
    : Math.max(1, effectiveYears - 1)

  const totalGuaranteed = useMemo(() => {
    const gtd = salaries.slice(0, guaranteedCount).reduce((s, v) => s + v, 0)
    return parseFloat((gtd + (parseFloat(signingBonus) || 0)).toFixed(2))
  }, [salaries, guaranteedCount, signingBonus])

  const y1Num = parseFloat(salary) || 0
  const belowFloor = floor != null && (
    floorMode === 'y1' ? y1Num < floor : totalGuaranteed <= floor
  )

  function handleSave() {
    if (!salaryFixed && (!salary || y1Num <= 0)) {
      setError('Enter a salary amount.')
      return
    }
    if (y1Num > maxSal + 0.001) {
      setError(`Salary cannot exceed the ${isQB ? 'QB' : 'non-QB'} max of $${maxSal.toFixed(2)}.`)
      return
    }
    if (belowFloor) {
      setError(floorMode === 'y1'
        ? `Year 1 salary must be at least $${floor.toFixed(2)}.`
        : `Total guaranteed money ($${totalGuaranteed.toFixed(2)}) must exceed the floor ($${floor.toFixed(2)}) to have any chance of winning.`)
      return
    }

    onSave({
      sleeper_id: player.sleeper_id,
      y1_salary: parseFloat(y1Num.toFixed(2)),
      years: effectiveYears,
      structure: effectiveStructure,
      non_guaranteed_final: guaranteeLocked ? false : nonGuaranteedFinal,
      guaranteed_years: guaranteedCount,
      signing_bonus: parseFloat(signingBonus) || 0,
      ...(showWithdrawIfHigher ? { withdraw_if_higher_wins: withdrawIfHigher } : {}),
      ...(showCarryOver ? { no_carry_over: noCarryOver } : {}),
    })
  }

  const labelStyle = { color: TEXT_MUTED, fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }
  const fieldStyle = { marginBottom: 16 }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: INPUT_BG, border: `1px solid ${BORDER}`,
    color: TEXT, borderRadius: 6, padding: '10px 12px', fontSize: 16, outline: 'none',
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
        <h1 style={{ color: TEXT, fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{title}</h1>
        {subtitle && <div style={{ color: TEXT_MUTED, fontSize: 13, marginBottom: 14 }}>{subtitle}</div>}

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, margin: '12px 0 16px' }}>
          <div style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>{player.full_name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {player.position && <span style={{ color: AMBER, fontSize: 12, fontWeight: 700 }}>{player.position}</span>}
            {player.nfl_team && <span style={{ color: TEXT_MUTED, fontSize: 12 }}>{player.nfl_team}</span>}
          </div>
        </div>

        {teamData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['Cap Used',  `$${parseFloat(teamData.cap_used || 0).toFixed(2)}`, TEXT],
              ['Cap Space', `$${parseFloat(teamData.cap_space || 0).toFixed(2)}`, GREEN],
              ['SB Budget', sbBalance !== null ? `$${sbBalance.toFixed(2)}` : '--', TEXT],
              ['Hard Cap',  `$${parseFloat(teamData.hard_cap || 0).toFixed(2)}`, TEXT],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                <div style={{ color: TEXT_DIM, fontSize: 11 }}>{label}</div>
                <div style={{ color, fontSize: 15, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {floor != null && (
          <div style={{
            fontSize: 13, color: AMBER, fontWeight: 700, marginBottom: 16, padding: '10px 12px',
            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 6,
          }}>
            {floorMode === 'y1'
              ? `Minimum Year 1 salary this wave: $${floor.toFixed(2)}.`
              : `Minimum to beat: $${floor.toFixed(2)} total guaranteed.`}
            {floorNote && <span style={{ color: TEXT_MUTED, fontWeight: 400 }}> {floorNote}</span>}
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>Salary (Year 1)</label>
          {salaryFixed ? (
            <div style={{
              padding: '10px 12px', borderRadius: 6, border: `1px solid ${AMBER}`,
              background: 'rgba(245,166,35,0.10)', color: TEXT, fontSize: 18, fontWeight: 800,
            }}>
              ${maxSal.toFixed(2)}
              <div style={{ fontSize: 11, fontWeight: 500, color: TEXT_MUTED, marginTop: 2 }}>
                Max contract for a {player.position} -- fixed, no other salary is legal this wave.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: TEXT, fontSize: 16 }}>$</span>
                <input
                  type="number" step="0.01" style={{ ...inputStyle, flex: 1 }}
                  value={salary} onChange={e => { setSalary(e.target.value); setError('') }}
                />
                <button
                  type="button" onClick={() => setSalary(parseFloat(maxSal.toFixed(2)))}
                  style={{
                    background: 'rgba(245,166,35,0.15)', color: AMBER, border: `1px solid ${AMBER}`,
                    fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', padding: '10px 14px',
                    borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >MAX</button>
              </div>
              <span style={{ fontSize: 11, color: TEXT_DIM }}>
                Max salary: ${maxSal.toFixed(2)} ({isQB ? 'QB' : 'non-QB'})
              </span>
            </>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Years</label>
          {yearsLocked ? (
            <div style={{ color: TEXT_MUTED, fontSize: 13 }}>{yearsLocked}yr -- locked for this wave</div>
          ) : (
            <div>
              {yearsOptions.map(y => (
                <button key={y} type="button" style={pillBtn(Number(years) === y)} onClick={() => setYears(y)}>
                  {y}yr
                </button>
              ))}
            </div>
          )}
        </div>

        {!structureLocked && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Structure</label>
            <div>
              {structureOptions.map(s => (
                <button key={s} type="button" style={pillBtn(structure === s)} onClick={() => setStructure(s)}>
                  {STRUCTURE_LABELS[s] || s}
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

        <div style={fieldStyle}>
          {guaranteeLocked ? (
            <>
              <label style={labelStyle}>Guaranteed Years</label>
              <div style={{ color: TEXT_MUTED, fontSize: 13 }}>
                All {effectiveYears} years fully guaranteed (required this wave)
              </div>
            </>
          ) : (
            <>
              <label style={{ color: TEXT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={nonGuaranteedFinal}
                  onChange={e => setNonGuaranteedFinal(e.target.checked)}
                  disabled={effectiveYears === 1}
                />
                Final year non-guaranteed
              </label>
              <span style={{ fontSize: 11, color: TEXT_DIM }}>
                {effectiveYears === 1
                  ? 'A 1-year deal is always fully guaranteed.'
                  : 'League rule: only the final year may be non-guaranteed.'}
              </span>
            </>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            Signing Bonus (optional)
            {sbBalance !== null && <span style={{ color: TEXT_DIM, fontWeight: 400 }}> -- ${sbBalance.toFixed(2)} available</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: TEXT, fontSize: 16 }}>$</span>
            <input
              type="number" step="0.01" style={inputStyle}
              value={signingBonus} onChange={e => { setSigningBonus(e.target.value); setError('') }}
            />
          </div>
        </div>

        {showWithdrawIfHigher && (
          <div style={fieldStyle}>
            <label style={{ color: TEXT, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={withdrawIfHigher} onChange={e => setWithdrawIfHigher(e.target.checked)} />
              Withdraw this bid if I win a higher-priority target in the same wave
            </label>
          </div>
        )}

        {showCarryOver && (
          <div style={fieldStyle}>
            <label style={{ color: TEXT, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={noCarryOver} onChange={e => setNoCarryOver(e.target.checked)} />
              Do not carry this target to the next wave
            </label>
            <span style={{ fontSize: 11, color: TEXT_DIM, display: 'block', marginTop: 4 }}>
              By default an unawarded target moves down one wave at this same price,
              ranked ahead of your pre-set targets there. Check this to bid only at this wave.
            </span>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: RED, marginBottom: 12, fontWeight: 700 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${BORDER}`,
            background: 'none', color: TEXT, fontWeight: 700, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
            background: AMBER, color: '#000', fontWeight: 700, cursor: 'pointer',
          }}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
