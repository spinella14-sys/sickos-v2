export default function UFAMyBids({ myBids, wave, isWaveOpen, onRerank, onWithdraw }) {
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const reordered = [...myBids];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    onRerank(reordered.map((b, i) => ({ bid_id: b.id, priority_rank: i + 1 })));
  };

  const handleMoveDown = (index) => {
    if (index === myBids.length - 1) return;
    const reordered = [...myBids];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    onRerank(reordered.map((b, i) => ({ bid_id: b.id, priority_rank: i + 1 })));
  };

  return (
    <aside className="rfa-my-bids">
      <div className="rfa-my-bids__header">
        <span className="rfa-my-bids__title">My Bids</span>
        <span className="rfa-my-bids__count">{myBids.length}/3</span>
      </div>

      <div className="rfa-my-bids__list">
        {myBids.length === 0 && (
          <div className="rfa-my-bids__empty">
            {isWaveOpen
              ? 'Submit up to 3 bids this wave using the BID button'
              : 'Wave is not currently open'}
          </div>
        )}

        {myBids.map((bid, index) => {
          const player = bid.ufa_pool;
          return (
            <div key={bid.id} className="rfa-bid-card">
              <div className="rfa-bid-card__top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button onClick={() => handleMoveUp(index)} disabled={index === 0}
                    style={{ background: 'none', border: 'none', color: index === 0 ? 'var(--draft-border)' : 'var(--draft-text-muted)', cursor: index === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                  <span className="rfa-bid-card__rank">#{index + 1}</span>
                  <button onClick={() => handleMoveDown(index)} disabled={index === myBids.length - 1}
                    style={{ background: 'none', border: 'none', color: index === myBids.length - 1 ? 'var(--draft-border)' : 'var(--draft-text-muted)', cursor: index === myBids.length - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                </div>

                <div className="rfa-bid-card__player">
                  <span className="rfa-bid-card__name">{player?.full_name || 'Unknown'}</span>
                  <span className="rfa-bid-card__meta">{player?.position} · {bid.years}yr {bid.structure}</span>
                </div>
              </div>

              <div className="rfa-bid-card__contract">
                ${bid.y1_salary}
                {bid.y2_salary ? ` · $${bid.y2_salary}` : ''}
                {bid.y3_salary ? ` · $${bid.y3_salary}` : ''}
                {bid.y4_salary ? ` · $${bid.y4_salary}` : ''}
                <br />
                {bid.guaranteed_years}yr gtd
                {bid.signing_bonus > 0 ? ` + $${bid.signing_bonus} SB` : ''}
                <br />
                Total gtd: <span>${bid.total_guaranteed}</span>
              </div>

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

              {isWaveOpen && (
                <div className="rfa-bid-card__actions">
                  <button className="rfa-bid-card__withdraw"
                    onClick={() => window.confirm('Withdraw this bid?') && onWithdraw(bid.id)}>
                    WITHDRAW
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
