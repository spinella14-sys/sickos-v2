import { useState } from 'react';

// Shown once when a new RFA wave opens: last wave's league-wide results,
// plus this team's own personalized action items (open match windows with
// their deadline, and a summary of their own pending bids).
export default function RFAWaveSummaryModal({
  closedWave, currentWave, lastWaveResults, matchWindows, myBids, onClose,
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const handleClose = () => { setVisible(false); onClose?.(); };
  const activeBids = (myBids || []).filter(b => b.status === 'active');

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
          League Results
        </div>
        {(lastWaveResults || []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>Nothing to report from last wave.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {lastWaveResults.map(ev => (
              <div key={ev.id} style={{
                fontSize: 13, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                background: ev.event_type === 'tie_void' ? 'rgba(232,69,69,0.08)' : 'rgba(255,255,255,0.04)',
              }}>
                <strong>{ev.player_name}</strong>{ev.team_abbrev ? ` → ${ev.team_abbrev}` : ''}
                <div style={{ color: '#8B949E', fontSize: 12 }}>{ev.detail}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8B949E' }}>
          Your Action Items
        </div>

        {(matchWindows || []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {matchWindows.map(p => {
              const deadlineWave = (p.match_window_wave || 0) + 1;
              const isLastChance = currentWave >= deadlineWave;
              return (
                <div key={p.id} style={{
                  fontSize: 13, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                  background: 'rgba(232,69,69,0.1)', border: '1px solid rgba(232,69,69,0.3)',
                }}>
                  ⚠ <strong>{p.full_name}</strong> — match decision needed
                  <div style={{ color: isLastChance ? 'var(--draft-red)' : 'var(--draft-amber)', fontSize: 12, fontWeight: 700 }}>
                    {isLastChance ? `LAST CHANCE — locks in when Wave ${currentWave} closes` : `Act before Wave ${deadlineWave} closes`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>
          {activeBids.length === 0
            ? 'No standing bids right now.'
            : `${activeBids.length} standing bid${activeBids.length === 1 ? '' : 's'} still active.`}
        </div>

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
