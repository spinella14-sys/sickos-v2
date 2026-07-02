import { useState } from 'react';

const CAP_YEAR = 120;
const MAX_SALARY = 21.82;
const QB_MAX = 26.67;
const HARD_CAP = 138;
const RFA_MINS = { 1: 13.33, 2: 8.00 };

function getWaveMin(wave, draftRound) {
  switch (wave) {
    case 1: return RFA_MINS[draftRound];
    case 2: return null; // must touch max
    case 3: return RFA_MINS[1] + 3; // 16.33
    case 4: return RFA_MINS[1];     // 13.33
    case 5: return RFA_MINS[2];     // 8.00
    default: return RFA_MINS[2];
  }
}

function calcSalaries(y1) {
  const y2 = parseFloat((y1 * 1.1).toFixed(2));
  const y3 = parseFloat((y2 * 1.1).toFixed(2));
  return [y1, y2, y3];
}

function touchesMax(y1, y2, y3, isQB) {
  const max = isQB ? QB_MAX : MAX_SALARY;
  return y1 >= max || y2 >= max || y3 >= max;
}

export default function RFABidForm({
  player, wave, currentTeam, myTeamData, myBids, onSubmit, onClose,
}) {
  const isIncumbent = player.incumbent_team === currentTeam;
  const isQB = player.position === 'QB';
  const maxSal = isQB ? QB_MAX : MAX_SALARY;
  const waveMin = getWaveMin(wave, player.draft_round);
  const existingBid = myBids.find(b => b.player_id === player.id);

  const [y1, setY1] = useState(existingBid?.y1_salary || waveMin || RFA_MINS[player.draft_round]);
  const [guaranteedYears, setGuaranteedYears] = useState(existingBid?.guaranteed_years || 2);
  const [signingBonus, setSigningBonus] = useState(existingBid?.signing_bonus || 0);
  const [withdrawIfHigher, setWithdrawIfHigher] = useState(existingBid?.withdraw_if_higher_wins || false);
  const [conditionalOnCap, setConditionalOnCap] = useState(existingBid?.conditional_on_cap || false);
  const [priorityRank, setPriorityRank] = useState(existingBid?.priority_rank || myBids.length + 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const y1Num = parseFloat(y1) || 0;
  const [, y2, y3] = calcSalaries(y1Num);
  const salaries = [y1Num, y2, y3];

  let guaranteedSalary = 0;
  for (let i = 0; i < guaranteedYears; i++) guaranteedSalary += salaries[i];
  const totalGuaranteed = parseFloat((guaranteedSalary + parseFloat(signingBonus || 0)).toFixed(2));

  // Cap space and hard cap validation
  const capSpace = myTeamData?.cap_space || 0;
  const capUsed = myTeamData?.cap_used || 0;
  const wouldExceedHardCap = (capUsed + y1Num) > HARD_CAP;
  const insufficientCap = y1Num > capSpace;

  const validate = () => {
    if (!y1Num || y1Num <= 0) return 'Please enter a Y1 salary';
    if (waveMin && y1Num < waveMin) return `Y1 salary must be at least $${waveMin} in Wave ${wave}`;
    if (y1Num > maxSal) return `Y1 salary cannot exceed the max ($${maxSal})`;
    if (wave === 2 && !touchesMax(y1Num, y2, y3, isQB)) return `Wave 2 offers must touch the max ($${maxSal}) at some point`;
    if (wouldExceedHardCap) return `This offer would exceed the hard cap ($${HARD_CAP}). Hard cap can never be crossed.`;
    if (insufficientCap) return `Insufficient cap space. You have $${capSpace.toFixed(2)} available, offer requires $${y1Num.toFixed(2)}.`;
    if (signingBonus > (myTeamData?.sb_budget_remaining || 0)) return `Signing bonus exceeds your remaining budget ($${(myTeamData?.sb_budget_remaining || 0).toFixed(2)})`;
    return null;
  };

  const validationError = validate();

  const handleMax = () => {
    setY1(parseFloat(maxSal.toFixed(2)));
    setGuaranteedYears(3);
  };

  const handleSubmit = async () => {
    if (validationError) return;
    setSubmitting(true);
    setError('');
    const result = await onSubmit({
      player_id: player.id,
      y1_salary: y1Num,
      guaranteed_years: guaranteedYears,
      signing_bonus: parseFloat(signingBonus || 0),
      withdraw_if_higher_wins: withdrawIfHigher,
      conditional_on_cap: conditionalOnCap,
      priority_rank: priorityRank,
    });
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', background: '#1C2330',
    border: '1px solid rgba(255,255,255,0.07)',
    color: '#E6EDF3', fontFamily: 'Barlow Condensed, sans-serif',
    fontSize: 16, padding: '10px 12px', borderRadius: 6,
    outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
  };

  return (
    <div className="rfa-bid-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rfa-bid-form">
        {/* Header */}
        <div className="rfa-bid-form__header">
          <div>
            <div className="rfa-bid-form__title">
              {wave === 1 ? 'Retention Tag' : isIncumbent ? 'Your Offer' : 'Submit Bid'}
            </div>
            <div className="rfa-bid-form__player">
              {player.full_name} · {player.position} · R{player.draft_round} RFA
            </div>
          </div>
          <button className="rfa-bid-form__close" onClick={onClose}>×</button>
        </div>

        {/* Contract structure info */}
        <div style={{ background: '#1C2330', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#8B949E', lineHeight: 1.6 }}>
          All RFA offers are <strong style={{ color: '#E6EDF3' }}>3-year ascending contracts</strong>.
          Y2 = Y1 × 1.10, Y3 = Y2 × 1.10.
          {wave === 2 && <> Must touch max (${maxSal}) at some point.</>}
          {wave === 3 && <> Min Y1: $16.33.</>}
          {wave === 4 && <> Min Y1: $13.33.</>}
          {wave === 5 && <> Min Y1: $8.00.</>}
        </div>

        {/* Cap space summary */}
        <div style={{
          background: wouldExceedHardCap ? 'rgba(232,69,69,0.1)' : insufficientCap ? 'rgba(232,69,69,0.06)' : 'rgba(39,174,96,0.08)',
          border: `1px solid ${wouldExceedHardCap || insufficientCap ? '#E84545' : '#27AE60'}`,
          borderRadius: 6, padding: '10px 12px', fontSize: 12,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#8B949E' }}>Cap Space Available</span>
            <span style={{ fontWeight: 700, color: insufficientCap ? '#E84545' : '#27AE60' }}>
              ${capSpace.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#8B949E' }}>Hard Cap</span>
            <span style={{ fontWeight: 700, color: wouldExceedHardCap ? '#E84545' : '#8B949E' }}>
              ${HARD_CAP}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#8B949E' }}>SB Budget Remaining</span>
            <span style={{ fontWeight: 700, color: '#8B949E' }}>
              ${(myTeamData?.sb_budget_remaining || 0).toFixed(2)}
            </span>
          </div>
          {wouldExceedHardCap && (
            <div style={{ color: '#E84545', fontWeight: 700, fontSize: 11, marginTop: 4 }}>
              ⚠ This offer crosses the hard cap — invalid
            </div>
          )}
          {!wouldExceedHardCap && insufficientCap && (
            <div style={{ color: '#E84545', fontWeight: 700, fontSize: 11, marginTop: 4 }}>
              ⚠ Insufficient cap space for this offer
            </div>
          )}
        </div>

        {/* Y1 Salary + MAX button */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">
            Year 1 Salary
            {waveMin && <span style={{ color: '#F5A623', marginLeft: 6 }}>(min ${waveMin})</span>}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              style={{ ...inputStyle, flex: 1, borderColor: validationError?.includes('Y1') || validationError?.includes('cap') ? '#E84545' : 'rgba(255,255,255,0.07)' }}
              value={y1}
              onChange={e => setY1(e.target.value)}
              min={waveMin || RFA_MINS[player.draft_round]}
              max={maxSal}
              step={0.01}
            />
            <button
              onClick={handleMax}
              style={{
                background: 'rgba(245,166,35,0.15)', color: '#F5A623',
                border: '1px solid #F5A623', fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: 13, fontWeight: 800, letterSpacing: '0.06em',
                padding: '0 16px', borderRadius: 6, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              MAX
            </button>
          </div>
          <span style={{ fontSize: 11, color: '#8B949E' }}>
            Max salary: ${maxSal} ({isQB ? 'QB' : 'non-QB'})
          </span>
        </div>

        {/* Contract preview */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Contract Preview</label>
          <div className="rfa-bid-form__contract-preview">
            {salaries.map((sal, i) => (
              <div key={i} className={`rfa-bid-form__contract-row ${i >= guaranteedYears ? 'non-gtd' : ''}`}>
                <span>Year {i + 1} {i >= guaranteedYears ? '(non-gtd)' : '(gtd)'}</span>
                <span>${sal.toFixed(2)}</span>
              </div>
            ))}
            <div className="rfa-bid-form__contract-row" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 6, paddingTop: 6 }}>
              <span>Total Guaranteed</span>
              <span>${totalGuaranteed.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Guaranteed years */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Guaranteed Years</label>
          <div className="rfa-bid-form__gtd-toggle">
            {[2, 3].map(yr => (
              <button
                key={yr}
                className={`rfa-bid-form__gtd-btn ${guaranteedYears === yr ? 'rfa-bid-form__gtd-btn--active' : ''}`}
                onClick={() => setGuaranteedYears(yr)}
              >
                {yr} Year{yr > 1 ? 's' : ''} Guaranteed
              </button>
            ))}
          </div>
          <span className="rfa-bid-form__hint">Only the final year can be non-guaranteed</span>
        </div>

        {/* Signing bonus */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">
            Signing Bonus
            <span style={{ color: '#8B949E', marginLeft: 6 }}>
              (budget: ${(myTeamData?.sb_budget_remaining || 0).toFixed(2)})
            </span>
          </label>
          <input
            type="number"
            style={inputStyle}
            value={signingBonus}
            onChange={e => setSigningBonus(e.target.value)}
            min={0}
            max={myTeamData?.sb_budget_remaining || 0}
            step={0.1}
          />
          <span className="rfa-bid-form__hint">
            Does not count against cap. Counts toward total guaranteed.
          </span>
        </div>

        {/* Priority rank */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Priority Rank</label>
          <input
            type="number"
            style={inputStyle}
            value={priorityRank}
            onChange={e => setPriorityRank(parseInt(e.target.value))}
            min={1}
            max={20}
            step={1}
          />
          <span className="rfa-bid-form__hint">Lower = higher priority. Bids processed in this order.</span>
        </div>

        {/* Toggles */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Options</label>
          <label className="rfa-bid-form__toggle-row">
            <input type="checkbox" checked={withdrawIfHigher} onChange={e => setWithdrawIfHigher(e.target.checked)} />
            Withdraw this bid if a higher-priority bid wins
          </label>
          <label className="rfa-bid-form__toggle-row">
            <input type="checkbox" checked={conditionalOnCap} onChange={e => setConditionalOnCap(e.target.checked)} />
            Only process if cap space remains after higher-priority bids
          </label>
        </div>

        {error && <div className="rfa-bid-form__error">{error}</div>}
        {validationError && !error && (
          <div className="rfa-bid-form__error">{validationError}</div>
        )}

        <button
          className="rfa-bid-form__submit"
          onClick={handleSubmit}
          disabled={submitting || !!validationError}
        >
          {submitting ? 'Submitting...' : existingBid ? 'Update Bid' : wave === 1 ? 'Submit Retention Tag' : 'Submit Bid'}
        </button>
      </div>
    </div>
  );
}