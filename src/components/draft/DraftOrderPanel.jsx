// DraftOrderPanel.jsx
// FIX: removed the client-side getPickContract() function which had a hardcoded
// CAP_YEAR = 130 (wrong — 2026 LTL is 120), causing pick values to show $8.67
// instead of the correct $8.00 for pick 1. Contract values now come directly
// from pick.cap_value (stored in the database via seed-cap-values) so the
// draft board and the team Draft Picks tab always agree exactly.
// Years and RFA/UFA status are derived from pick.round — no formula needed.

function pickMeta(round) {
  if (round === 1) return { years: 4, rfa: 'RFA 1st' }
  if (round === 2) return { years: 3, rfa: 'RFA 2nd' }
  return { years: 3, rfa: 'UFA' }
}

export default function DraftOrderPanel({
  allPicks,
  activeRound,
  setActiveRound,
  currentPickNumber,
  getTeamName,
  getTeamLogo,
}) {
  const roundPicks = allPicks.filter(p => p.round === activeRound);

  function getPickStatusClass(pick) {
    if (pick.status === 'completed') return 'pick-slot--done';
    if (pick.status === 'on_clock')  return 'pick-slot--clock';
    return 'pick-slot--pending';
  }

  return (
    <aside className="draft-order-panel">
      <div className="draft-order-panel__header">
        <span className="draft-order-panel__title">DRAFT ORDER</span>
        <div className="draft-order-panel__round-tabs">
          {[1, 2, 3].map(r => (
            <button
              key={r}
              className={`round-tab ${activeRound === r ? 'round-tab--active' : ''}`}
              onClick={() => setActiveRound(r)}
            >
              R{r}
            </button>
          ))}
        </div>
      </div>

      <div className="draft-order-panel__list">
        {roundPicks.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--draft-text-muted)', fontSize: 12 }}>
            Draft order not yet seeded.<br/>
            Commissioner: seed picks from Admin panel.
          </div>
        )}
        {roundPicks.map(pick => {
          const isOnClock = pick.overall_pick === currentPickNumber && pick.status === 'on_clock';
          const isDone    = pick.status === 'completed';
          const wasTraded = pick.current_team !== pick.original_team;
          const { years, rfa } = pickMeta(pick.round);
          const capLabel  = pick.cap_value ? `$${parseFloat(pick.cap_value).toFixed(2)}` : '$TBD';

          return (
            <div
              key={pick.overall_pick}
              className={`pick-slot ${getPickStatusClass(pick)} ${isOnClock ? 'pick-slot--on-clock' : ''}`}
            >
              <div className="pick-slot__num">{pick.pick_in_round}</div>

              <div className="pick-slot__team">
                <img
                  src={getTeamLogo(pick.current_team)}
                  alt={getTeamName(pick.current_team)}
                  className="pick-slot__logo"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                  <span className="pick-slot__abbr">{getTeamName(pick.current_team)}</span>
                  {wasTraded && (
                    <span className="pick-slot__via" title={`Originally ${getTeamName(pick.original_team)}`}>
                      VIA {pick.original_team}
                    </span>
                  )}
                  {!isDone && (
                    <span style={{
                      fontSize: 9, color: 'var(--draft-text-muted)',
                      letterSpacing: '0.04em', marginTop: 1,
                    }}>
                      {capLabel} · {years}yr · {rfa}
                    </span>
                  )}
                </div>
              </div>

              <div className="pick-slot__status">
                {isDone ? (
                  <div style={{ textAlign: 'right' }}>
                    <span className="pick-slot__player">{pick.player_name}</span>
                    {pick.auto_picked && (
                      <span className="pick-slot__autopick-badge" style={{ display: 'block', marginTop: 2 }}>AUTO</span>
                    )}
                  </div>
                ) : isOnClock ? (
                  <span className="pick-slot__on-clock-label">ON CLOCK</span>
                ) : (
                  <span className="pick-slot__pending">Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
