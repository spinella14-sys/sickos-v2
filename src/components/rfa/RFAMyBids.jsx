export default function RFAMyBids({
  myBids, matchWindows, wave, isWaveOpen,
  currentTeam, getTeamName, getTeamLogo,
  onRerank, onWithdraw, onMatch,
}) {
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const reordered = [...myBids];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const rankings = reordered.map((b, i) => ({ bid_id: b.id, priority_rank: i + 1 }));
    onRerank(rankings);
  };

  const handleMoveDown = (index) => {
    if (index === myBids.length - 1) return;
    const reordered = [...myBids];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    const rankings = reordered.map((b, i) => ({ bid_id: b.id, priority_rank: i + 1 }));
    onRerank(rankings);
  };

  const handleMatch = async (playerId, decision) => {
    const confirmed = window.confirm(
      decision === 'match'
        ? 'Match this offer and retain the player?'
        : 'Decline this offer? The player will sign with the other team.'
    );
    if (!confirmed) return;
    await onMatch(playerId, decision);
  };

  return (
    <aside className="rfa-my-bids">
      <div className="rfa-my-bids__header">
        <span className="rfa-my-bids__title">My Bids</span>
        {myBids.length > 0 && (
          <span className="rfa-my-bids__count">{myBids.length}</span>
        )}
      </div>

      <div className="rfa-my-bids__list">
        {/* Match windows first — urgent */}
        {matchWindows.map(player => {
          const offer = player.rfa_bids;
          if (!offer) return null;
          return (
            <div key={`match-${player.id}`} className="rfa-match-card">
              <div className="rfa-match-card__header">
                ⚠ Match Decision Required
              </div>
              <div className="rfa-match-card__player">{player.full_name}</div>
              <div className="rfa-match-card__offer">
                <strong>Offer to match:</strong><br />
                3yr / ${offer.y1_salary} · ${offer.y2_salary} · ${offer.y3_salary}<br />
                {offer.guaranteed_years} yrs gtd
                {offer.signing_bonus > 0 && ` + $${offer.signing_bonus} SB`}<br />
                <strong>Total guaranteed: ${offer.total_guaranteed}</strong>
              </div>
              <div className="rfa-match-card__actions">
                <button
                  className="rfa-match-card__match"
                  onClick={() => handleMatch(player.id, 'match')}
                >
                  MATCH
                </button>
                <button
                  className="rfa-match-card__decline"
                  onClick={() => handleMatch(player.id, 'decline')}
                >
                  DECLINE
                </button>
              </div>
            </div>
          );
        })}

        {/* My bids */}
        {myBids.length === 0 && matchWindows.length === 0 && (
          <div className="rfa-my-bids__empty">
            {isWaveOpen
              ? wave === 1
                ? 'Tag your RFAs using the RETAIN button'
                : 'Submit bids on players using the BID button'
              : 'Wave is not currently open'}
          </div>
        )}

        {myBids.map((bid, index) => {
          const player = bid.rfa_pool;
          return (
            <div key={bid.id} className="rfa-bid-card">
              <div className="rfa-bid-card__top">
                {/* Priority rank + reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    style={{
                      background: 'none', border: 'none', color: index === 0
                        ? 'var(--draft-border)' : 'var(--draft-text-muted)',
                      cursor: index === 0 ? 'default' : 'pointer',
                      fontSize: 10, padding: 0, lineHeight: 1,
                    }}
                  >▲</button>
                  <span className="rfa-bid-card__rank">#{index + 1}</span>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === myBids.length - 1}
                    style={{
                      background: 'none', border: 'none',
                      color: index === myBids.length - 1
                        ? 'var(--draft-border)' : 'var(--draft-text-muted)',
                      cursor: index === myBids.length - 1 ? 'default' : 'pointer',
                      fontSize: 10, padding: 0, lineHeight: 1,
                    }}
                  >▼</button>
                </div>

                <div className="rfa-bid-card__player">
                  <span className="rfa-bid-card__name">
                    {player?.full_name || 'Unknown Player'}
                  </span>
                  <span className="rfa-bid-card__meta">
                    {player?.position} · R{player?.draft_round} RFA
                    {bid.is_incumbent && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, background: 'var(--draft-amber)',
                        color: '#000', padding: '1px 5px', borderRadius: 3, fontWeight: 800,
                      }}>
                        INCUMBENT
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Contract details */}
              <div className="rfa-bid-card__contract">
                3yr / <span>${bid.y1_salary}</span> · <span>${bid.y2_salary}</span> · <span>${bid.y3_salary}</span>
                <br />
                {bid.guaranteed_years} yrs gtd
                {bid.signing_bonus > 0 && ` + $${bid.signing_bonus} SB`}
                <br />
                Total gtd: <span>${bid.total_guaranteed}</span>
              </div>

              {/* Toggles */}
              <div className="rfa-bid-card__toggles">
                <label className="rfa-bid-card__toggle">
                  <input
                    type="checkbox"
                    checked={bid.withdraw_if_higher_wins}
                    readOnly
                  />
                  Withdraw if higher priority wins
                </label>
                <label className="rfa-bid-card__toggle">
                  <input
                    type="checkbox"
                    checked={bid.conditional_on_cap}
                    readOnly
                  />
                  Conditional on cap space
                </label>
              </div>

              {/* Actions */}
              {isWaveOpen && (
                <div className="rfa-bid-card__actions">
                  <button
                    className="rfa-bid-card__withdraw"
                    onClick={() => {
                      if (window.confirm('Withdraw this bid?')) {
                        onWithdraw(bid.id);
                      }
                    }}
                  >
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