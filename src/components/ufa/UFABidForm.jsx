import { useState } from 'react';

// Dynamic caps — pulled from myCapData when available, sensible fallbacks otherwise
const TIER_MINS  = { 1: 18.00, 2: 9.60, 3: 2.40 };
const MIN_SALARY = 2.40;

function calcSalaries(y1, years, structure) {
  const salaries = [parseFloat(y1)];
  for (let i = 1; i < years; i++) {
    const prev = salaries[i - 1];
    if (structure === 'ascending')  salaries.push(parseFloat((prev * 1.1).toFixed(2)));
    else if (structure === 'descending') salaries.push(parseFloat((prev * 0.9).toFixed(2)));
    else salaries.push(parseFloat(prev.toFixed(2)));
  }
  return salaries;
}

function calcTotalGuaranteed(salaries, guaranteedYears) {
  let total = 0;
  for (let i = 0; i < Math.min(guaranteedYears, salaries.length); i++) total += salaries[i];
  return parseFloat(total.toFixed(2));
}

export default function UFABidForm({ player, wave, tier, currentTeam, myCapData, myBids, onSubmit, onClose }) {
  const isQB    = player.position === 'QB';

  // Always use authoritative cap data from /api/teams/:abbrev
  const hardCap  = myCapData?.hard_cap   || 138;
  const capUsed  = myCapData?.cap_used   || 0;
  const capSpace = myCapData?.cap_space  || 0;
  const taxLine  = myCapData?.tax_line   || 120;
  const maxSal   = isQB
    ? parseFloat((taxLine / 4.5).toFixed(2))   // QB max = LTL / 4.5
    : parseFloat((taxLine / 5.5).toFixed(2));  // non-QB max = LTL / 5.5
  const tierMin  = TIER_MINS[tier] || MIN_SALARY;

  const existingBid = myBids.find(b =>
    b.player_sleeper_id === player.sleeper_id || b.ufa_pool?.sleeper_id === player.sleeper_id
  );

  const [y1,            setY1]          = useState(existingBid?.y1_salary    || tierMin);
  const [years,         setYears]       = useState(existingBid?.years        || 1);
  const [structure,     setStructure]   = useState(existingBid?.structure    || 'ascending');
  const [gtdYears,      setGtdYears]    = useState(existingBid?.guaranteed_years || 1);
  const [signingBonus,  setSB]          = useState(existingBid?.signing_bonus || 0);
  const [withdrawIf,    setWithdraw]    = useState(existingBid?.withdraw_if_higher_wins || false);
  const [condOnCap,     setCondOnCap]   = useState(existingBid?.conditional_on_cap || false);
  const [priority,      setPriority]    = useState(existingBid?.priority_rank || myBids.length + 1);
  const [submitting,    setSubmitting]  = useState(false);
  const [error,         setError]       = useState('');

  const y1Num   = parseFloat(y1) || 0;
  const salaries = calcSalaries(y1Num, years, structure);
  const totalGtd = calcTotalGuaranteed(salaries, gtdYears);

  const wouldOverCap = (capUsed + y1Num) > hardCap;
  const underCap     = y1Num > capSpace;

  const validate = () => {
    if (!y1Num || y1Num <= 0)       return 'Please enter a Y1 salary';
    if (y1Num < tierMin)            return `Y1 salary must be at least $${tierMin} (Tier ${tier} minimum)`;
    if (y1Num > maxSal)             return `Y1 salary cannot exceed $${maxSal.toFixed(2)} (${isQB ? 'QB' : 'non-QB'} max)`;
    if (years < 1 || years > 4)     return 'Contract must be 1–4 years';
    if (gtdYears > years)           return 'Guaranteed years cannot exceed contract length';
    if (wouldOverCap)               return `Bid crosses the hard cap ($${hardCap})`;
    if (underCap)                   return `Insufficient cap space ($${capSpace.toFixed(2)} available)`;
    return null;
  };

  const validationError = validate();

  const handleSubmit = async () => {
    if (validationError) return;
    setSubmitting(true);
    setError('');
    const result = await onSubmit({
      player_sleeper_id: player.sleeper_id,
      years, structure,
      y1_salary:         y1Num,
      guaranteed_years:  gtdYears,
      signing_bonus:     parseFloat(signingBonus || 0),
      withdraw_if_higher_wins: withdrawIf,
      conditional_on_cap:      condOnCap,
      priority_rank:     priority,
    });
    if (result && !result.ok && !result.success) {
      const data = result.json ? await result.json().catch(() => ({})) : result;
      setError(data.error || 'Submission failed');
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', background: '#1C2330', border: '1px solid rgba(255,255,255,0.07)',
    color: '#E6EDF3', fontFamily: 'Barlow Condensed, sans-serif',
    fontSize: 16, padding: '10px 12px', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
  };

  const capStatus = wouldOverCap ? 'error' : underCap ? 'warn' : 'ok';
  const capBg     = { error: 'rgba(232,69,69,0.1)', warn: 'rgba(232,69,69,0.06)', ok: 'rgba(39,174,96,0.08)' }[capStatus];
  const capBorder = { error: '#E84545', warn: '#E84545', ok: '#27AE60' }[capStatus];

  return (
    <div className="rfa-bid-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rfa-bid-form">

        {/* Header */}
        <div className="rfa-bid-form__header">
          <div>
            <div className="rfa-bid-form__title">Submit UFA Bid</div>
            <div className="rfa-bid-form__player">
              {player.full_name} · {player.position} · Tier {tier} UFA
            </div>
          </div>
          <button className="rfa-bid-form__close" onClick={onClose}>×</button>
        </div>

        {/* Tier info */}
        <div style={{ background:'#1C2330', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:'10px 12px', fontSize:12, color:'#8B949E', lineHeight:1.6 }}>
          Tier {tier} minimum: <strong style={{color:'#F5A623'}}>${tierMin}</strong> · Max: <strong style={{color:'#F5A623'}}>${maxSal.toFixed(2)}</strong> · 1–4 year contracts
        </div>

        {/* Cap summary — uses live data from /api/teams/:abbrev */}
        <div style={{ background:capBg, border:`1px solid ${capBorder}`, borderRadius:6, padding:'10px 12px', fontSize:12, display:'flex', flexDirection:'column', gap:3 }}>
          {[
            { label:'Cap Space Available', value:`$${capSpace.toFixed(2)}`,  color: underCap ? '#E84545' : '#27AE60' },
            { label:'Cap Used',            value:`$${capUsed.toFixed(2)}`,   color:'#8B949E' },
            { label:'Hard Cap',            value:`$${hardCap.toFixed(2)}`,   color: wouldOverCap ? '#E84545' : '#8B949E' },
            { label:'Luxury Tax Line',     value:`$${taxLine.toFixed(2)}`,   color:'#F5A623' },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{color:'#8B949E'}}>{r.label}</span>
              <span style={{fontWeight:700, color:r.color}}>{r.value}</span>
            </div>
          ))}
          {wouldOverCap && <div style={{color:'#E84545',fontWeight:700,fontSize:11,marginTop:4}}>⚠ Crosses hard cap — invalid</div>}
          {!wouldOverCap && underCap && <div style={{color:'#E84545',fontWeight:700,fontSize:11,marginTop:4}}>⚠ Insufficient cap space</div>}
        </div>

        {/* Y1 Salary */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">
            Year 1 Salary <span style={{color:'#F5A623',marginLeft:6}}>(min ${tierMin})</span>
          </label>
          <div style={{display:'flex',gap:8}}>
            <input type="number" style={{...inputStyle,flex:1}} value={y1}
              onChange={e => setY1(e.target.value)} min={tierMin} max={maxSal} step={0.01}/>
            <button onClick={() => setY1(maxSal.toFixed(2))} style={{
              background:'rgba(245,166,35,0.15)', color:'#F5A623', border:'1px solid #F5A623',
              fontFamily:'Barlow Condensed, sans-serif', fontSize:13, fontWeight:800,
              letterSpacing:'0.06em', padding:'0 16px', borderRadius:6, cursor:'pointer',
            }}>MAX</button>
          </div>
          <span style={{fontSize:11,color:'#8B949E'}}>Max: ${maxSal.toFixed(2)} ({isQB?'QB':'non-QB'})</span>
        </div>

        {/* Contract length */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Contract Length</label>
          <div style={{display:'flex',gap:8}}>
            {[1,2,3,4].map(yr => (
              <button key={yr}
                className={`rfa-bid-form__gtd-btn ${years===yr?'rfa-bid-form__gtd-btn--active':''}`}
                onClick={() => { setYears(yr); if (gtdYears > yr) setGtdYears(yr) }}>
                {yr}yr
              </button>
            ))}
          </div>
        </div>

        {/* Structure */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Contract Structure</label>
          <div style={{display:'flex',gap:8}}>
            {['ascending','flat','descending'].map(s => (
              <button key={s}
                className={`rfa-bid-form__gtd-btn ${structure===s?'rfa-bid-form__gtd-btn--active':''}`}
                onClick={() => setStructure(s)} style={{textTransform:'capitalize'}}>
                {s}
              </button>
            ))}
          </div>
          <span className="rfa-bid-form__hint">Tiebreaker: ascending &gt; flat &gt; descending</span>
        </div>

        {/* Contract preview */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Contract Preview</label>
          <div className="rfa-bid-form__contract-preview">
            {salaries.map((sal, i) => (
              <div key={i} className={`rfa-bid-form__contract-row ${i >= gtdYears ? 'non-gtd' : ''}`}>
                <span>Year {i+1} {i >= gtdYears ? '(non-gtd)' : '(gtd)'}</span>
                <span>${sal.toFixed(2)}</span>
              </div>
            ))}
            <div className="rfa-bid-form__contract-row" style={{borderTop:'1px solid rgba(255,255,255,0.07)',marginTop:6,paddingTop:6}}>
              <span>Total Guaranteed</span>
              <span>${totalGtd.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Guaranteed years */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Guaranteed Years</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {Array.from({length:years},(_,i)=>i+1).map(yr => (
              <button key={yr}
                className={`rfa-bid-form__gtd-btn ${gtdYears===yr?'rfa-bid-form__gtd-btn--active':''}`}
                onClick={() => setGtdYears(yr)}>
                {yr}yr gtd
              </button>
            ))}
          </div>
          <span className="rfa-bid-form__hint">Only the final year can be non-guaranteed</span>
        </div>

        {/* Signing bonus */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Signing Bonus <span style={{color:'#8B949E',marginLeft:6}}>(optional)</span></label>
          <input type="number" style={inputStyle} value={signingBonus}
            onChange={e => setSB(e.target.value)} min={0} step={0.1}/>
        </div>

        {/* Priority */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Priority Rank</label>
          <input type="number" style={inputStyle} value={priority}
            onChange={e => setPriority(parseInt(e.target.value))} min={1} max={3} step={1}/>
          <span className="rfa-bid-form__hint">1 = highest priority. You have 3 bids per wave.</span>
        </div>

        {/* Options */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Options</label>
          <label className="rfa-bid-form__toggle-row">
            <input type="checkbox" checked={withdrawIf} onChange={e => setWithdraw(e.target.checked)}/>
            Withdraw if a higher-priority bid wins
          </label>
          <label className="rfa-bid-form__toggle-row">
            <input type="checkbox" checked={condOnCap} onChange={e => setCondOnCap(e.target.checked)}/>
            Only process if cap space remains after higher-priority bids
          </label>
        </div>

        {error && <div className="rfa-bid-form__error">{error}</div>}
        {validationError && !error && <div className="rfa-bid-form__error">{validationError}</div>}

        <button className="rfa-bid-form__submit" onClick={handleSubmit}
          disabled={submitting || !!validationError}>
          {submitting ? 'Submitting…' : existingBid ? 'Update Bid' : 'Submit Bid'}
        </button>
      </div>
    </div>
  );
}
