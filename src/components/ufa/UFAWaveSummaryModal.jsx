import { useState } from 'react';

const STATUS_LABEL = {
  won: 'WON', lost: 'Lost the bid', lost_cap_invalid: 'Lost — insufficient cap/SB',
  withdrawn: 'Withdrawn', tied_pending_review: 'Tied — pending review', active: 'Still pending',
};
const STATUS_COLOR = {
  won: 'var(--draft-green, #3dba6e)', lost: '#8B949E', lost_cap_invalid: 'var(--draft-red, #e84545)',
  withdrawn: '#8B949E', tied_pending_review: 'var(--draft-amber, #e8a933)', active: 'var(--draft-amber, #e8a933)',
};

function ContractLine({ years, y1Salary, y2Salary, y3Salary, signingBonus }) {
  if (years == null || y1Salary == null) return null;
  const parts = [`${years}yr`, `Y1 $${y1Salary.toFixed(2)}`];
  if (y2Salary != null) parts.push(`Y2 $${y2Salary.toFixed(2)}`);
  if (y3Salary != null) parts.push(`Y3 $${y3Salary.toFixed(2)}`);
  if (signingBonus > 0) parts.push(`SB $${signingBonus.toFixed(2)}`);
  return (
    <div style={{ color: '#8B949E', fontSize: 12, marginTop: 2 }}>{parts.join(' · ')}</div>
  );
}

// Shown once when a new UFA wave opens (localStorage-gated per team, per
// wave, in UFADraft.jsx): this team's own bids from the wave that just
// closed (with real outcome + full contract terms on any win), and every
// league-wide win from that closed wave — all with full contract terms.
// No "pending" section, unlike RFA's version -- UFA has no match-window
// mechanism, every bid resolves in the exact same wave it's submitted in.
export default function UFAWaveSummaryModal({
  closedWave, currentWave, myBids, leagueWins, onClose,
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const handleClose = () => { setVisible(false); onClose?.(); };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--draft-bg, #14171c)', borderRadius: 12, padding: 24,
        maxWidth: 520, width: '92%', maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          Wave {closedWave} Results
        </div>
        <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>
          Wave {currentWave} is now open
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8B949E' }}>
          Your Bids From Last Wave
        </div>
        {(myBids || []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>You didn't submit any bids last wave.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {myBids.map((b, i) => (
              <div key={i} style={{
                fontSize: 13, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
              }}>
                <strong>{b.player_name}</strong>
                <span style={{ color: STATUS_COLOR[b.status] || '#8B949E', fontWeight: 700, marginLeft: 8 }}>
                  {STATUS_LABEL[b.status] || b.status}
                </span>
                {b.status === 'won' && (
                  <ContractLine years={b.years} y1Salary={b.y1_salary} y2Salary={b.y2_salary} y3Salary={b.y3_salary} signingBonus={b.signing_bonus} />
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8B949E' }}>
          League Results
        </div>
        {(leagueWins || []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>Nothing to report from last wave.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {leagueWins.map((w, i) => (
              <div key={i} style={{
                fontSize: 13, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
              }}>
                <strong>{w.player_name}</strong> → {w.team_abbrev}
                <ContractLine years={w.years} y1Salary={w.y1_salary} y2Salary={w.y2_salary} y3Salary={w.y3_salary} signingBonus={w.signing_bonus} />
              </div>
            ))}
          </div>
        )}

        <button onClick={handleClose} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: 'var(--draft-amber)', color: '#000', fontWeight: 700, cursor: 'pointer',
        }}>
          Got it
        </button>
      </div>
    </div>
  );
}
