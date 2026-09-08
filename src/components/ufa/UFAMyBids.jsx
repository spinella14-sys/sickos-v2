import { useState } from 'react';

const ALL_WAVES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Sidebar of a manager's bids, grouped into collapsible wave sections rather
// than one flat list.
//
// The flat version showed every bid ever submitted with a single running
// priority order, so wave 1 max-contract bids on players who had already been
// awarded sat above the current wave's bids and made the "3/3" count
// meaningless. Grouping by wave keeps the history available without letting it
// masquerade as live.
//
// Structure follows RFAMyBids, which reads well: every wave is listed, the
// current one is open by default, prior ones collapse to a header and a count.
export default function UFAMyBids({ myBids: allBids, wave, isWaveOpen, onRerank, onWithdraw }) {
  const [expandedWaves, setExpandedWaves] = useState({ [wave]: true });

  const toggleWave = (w) =>
    setExpandedWaves(prev => ({ ...prev, [w]: !prev[w] }));

  const bidsByWave = {};
  for (const w of ALL_WAVES) bidsByWave[w] = [];
  for (const b of (allBids || [])) {
    if (bidsByWave[b.wave]) bidsByWave[b.wave].push(b);
  }

  // Reordering only ever applies within a wave, so the indices handed to the
  // handlers are indices into THAT wave's list.
  const handleMoveUp = (waveBids, index) => {
    if (index === 0) return;
    const reordered = [...waveBids];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    onRerank(reordered.map(b => b.id));
  };

  const handleMoveDown = (waveBids, index) => {
    if (index === waveBids.length - 1) return;
    const reordered = [...waveBids];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    onRerank(reordered.map(b => b.id));
  };

  function renderBidCard(bid, index, waveBids, isCurrentWave) {
    const player = bid.ufa_pool;
    // Reordering and withdrawing only make sense for a live bid in the open
    // wave. A resolved bid is a record, not something to act on.
    const canAct = isCurrentWave && isWaveOpen;

    return (
      <div key={bid.id} className="rfa-bid-card">
        <div className="rfa-bid-card__top">
          {canAct ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button onClick={() => handleMoveUp(waveBids, index)} disabled={index === 0}
                style={{ background: 'none', border: 'none', color: index === 0 ? 'var(--draft-border)' : 'var(--draft-text-muted)', cursor: index === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>&#9650;</button>
              <span className="rfa-bid-card__rank">#{index + 1}</span>
              <button onClick={() => handleMoveDown(waveBids, index)} disabled={index === waveBids.length - 1}
                style={{ background: 'none', border: 'none', color: index === waveBids.length - 1 ? 'var(--draft-border)' : 'var(--draft-text-muted)', cursor: index === waveBids.length - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>&#9660;</button>
            </div>
          ) : (
            <span className="rfa-bid-card__rank">#{index + 1}</span>
          )}

          <div className="rfa-bid-card__player">
            <span className="rfa-bid-card__name">{player?.full_name || 'Unknown'}</span>
            <span className="rfa-bid-card__meta">{player?.position} &middot; {bid.years}yr {bid.structure}</span>
          </div>
        </div>

        <div className="rfa-bid-card__contract">
          ${bid.y1_salary}
          {bid.y2_salary ? ` \u00b7 $${bid.y2_salary}` : ''}
          {bid.y3_salary ? ` \u00b7 $${bid.y3_salary}` : ''}
          {bid.y4_salary ? ` \u00b7 $${bid.y4_salary}` : ''}
          <br />
          {bid.guaranteed_years}yr gtd
          {bid.signing_bonus > 0 ? ` + $${bid.signing_bonus} SB` : ''}
          <br />
          Total gtd: <span>${bid.total_guaranteed}</span>
        </div>

        {/* Outcome, once the wave has resolved. rejection_reason carries the
            specific cause -- roster full, QB limit, walkaway ceiling -- rather
            than leaving a manager to guess why a bid did nothing. */}
        {bid.status && bid.status !== 'pending' && bid.status !== 'active' && (
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '4px 0',
            color: bid.status === 'won' ? 'var(--draft-green, #3dba6e)'
              : bid.status === 'withdrawn' ? 'var(--draft-text-muted, #8B949E)'
              : 'var(--draft-red, #e84545)',
          }}>
            {bid.status === 'won' ? 'WON'
              : bid.status === 'withdrawn' ? 'Withdrawn'
              : bid.rejection_reason || 'Lost the bid'}
          </div>
        )}

        {canAct && (
          <>
            <div className="rfa-bid-card__toggles">
              <label className="rfa-bid-card__toggle">
                <input type="checkbox" checked={bid.withdraw_if_higher_wins} readOnly />
                Withdraw if higher priority wins
              </label>
              <label className="rfa-bid-card__toggle">
                <input type="checkbox" checked={bid.conditional_on_cap} readOnly />
                Conditional on cap space
              </label>
            </div>

            <div className="rfa-bid-card__actions">
              <button className="rfa-bid-card__withdraw"
                onClick={() => window.confirm('Withdraw this bid?') && onWithdraw(bid.id)}>
                WITHDRAW
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const currentCount = (bidsByWave[wave] || []).length;

  return (
    <aside className="rfa-my-bids">
      <div className="rfa-my-bids__header">
        <span className="rfa-my-bids__title">My Bids</span>
        <span className="rfa-my-bids__count">{currentCount}/3</span>
      </div>

      <div className="rfa-my-bids__list">
        {(allBids || []).length === 0 && (
          <div className="rfa-my-bids__empty">
            {isWaveOpen
              ? 'Submit up to 3 bids this wave using the BID button'
              : 'Wave is not currently open'}
          </div>
        )}

        {ALL_WAVES.map(w => {
          const waveBids = bidsByWave[w];
          // Past and current waves only -- a manager cannot have bid in a wave
          // that has not happened, so listing empty future waves is noise.
          if (w > wave) return null;

          const isOpen = !!expandedWaves[w];
          const isCurrent = w === wave;

          return (
            <div key={w} className="rfa-my-bids__wave-section">
              <button
                className="rfa-my-bids__wave-header"
                onClick={() => toggleWave(w)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  padding: '8px 0',
                }}
              >
                <span style={{ color: 'var(--draft-amber, #F5A623)', fontWeight: 700 }}>
                  {isOpen ? '\u25be' : '\u25b8'} Wave {w}{isCurrent ? ' (current)' : ''}
                </span>
                <span className="rfa-my-bids__wave-count" style={{ color: '#FFFFFF' }}>
                  {waveBids.length}
                </span>
              </button>

              {isOpen && (
                <div className="rfa-my-bids__wave-body">
                  {waveBids.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--draft-text-muted, #8B949E)', padding: '6px 2px' }}>
                      No bids this wave.
                    </div>
                  ) : (
                    waveBids.map((bid, i) => renderBidCard(bid, i, waveBids, isCurrent))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
