import { useState } from 'react';

const STATUS_LABEL = {
  won: 'WON', lost: 'Lost the bid', lost_cap_invalid: 'Lost — insufficient cap/SB',
  withdrawn: 'Withdrawn', voided_tie: 'Voided — tied bid', active: 'Still pending',
};
const STATUS_COLOR = {
  won: 'var(--draft-green, #3dba6e)', lost: '#8B949E', lost_cap_invalid: 'var(--draft-red, #e84545)',
  withdrawn: '#8B949E', voided_tie: 'var(--draft-amber, #e8a933)', active: 'var(--draft-amber, #e8a933)',
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

// Shown once when a new RFA wave opens (localStorage-gated per team, per
// wave, in RFADraft.jsx): this team's own bids from the wave that just
// closed (with real outcome + full contract terms on any win), this
// team's currently-standing bids, and every league-wide win from that
// closed wave — all with full contract terms (years, salary per year,
// signing bonus), per Adam's explicit spec.
export default function RFAWaveSummaryModal({
  closedWave, currentWave, myBids, myPending, mustRespond, leagueWins, onClose,
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

        {(mustRespond || []).length > 0 && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, border: '1px solid var(--draft-red, #e84545)', background: 'rgba(232,69,69,0.08)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--draft-red, #e84545)' }}>
              WARNING You must respond this wave
            </div>
            {mustRespond.map((m, i) => (
              <div key={i} style={{
                fontSize: 13, padding: '8px 10px', marginBottom: i === mustRespond.length - 1 ? 0 : 6, borderRadius: 6,
                background: 'rgba(255,255,255,0.05)',
              }}>
                <strong>{m.player_name}</strong> — {m.challenger_team} offered
                <ContractLine years={m.years} y1Salary={m.y1_salary} y2Salary={m.y2_salary} y3Salary={m.y3_salary} signingBonus={m.signing_bonus} />
                {m.is_tie && (
                  <div style={{ color: 'var(--draft-amber, #e8a933)', fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                    Tied your own tender — this defaults to YOU if you don't act
                  </div>
                )}
                {m.walkaway_comparison && (
                  <div style={{ color: '#8B949E', fontSize: 12, marginTop: 2 }}>
                    This offer is {m.walkaway_comparison}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                  Match it this wave or lose the player.
                </div>
              </div>
            ))}
          </div>
        )}

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
          Your Standing Bids
        </div>
        {(myPending || []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>No standing bids right now.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {myPending.map((b, i) => (
              <div key={i} style={{
                fontSize: 13, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                background: b.is_leading_challenger ? 'rgba(232,169,51,0.08)' : 'rgba(255,255,255,0.04)',
              }}>
                <strong>{b.player_name}</strong>
                <span style={{ color: 'var(--draft-amber, #e8a933)', fontWeight: 700, marginLeft: 8 }}>
                  {b.is_leading_challenger ? 'Leading — awaiting match decision' : 'Pending'}
                </span>
                <ContractLine years={b.years} y1Salary={b.y1_salary} signingBonus={b.signing_bonus} />
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