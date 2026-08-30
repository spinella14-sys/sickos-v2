import { useState, useEffect, useRef } from 'react';

export default function RFAMyBids({
  myBids, matchWindows, wave, isWaveOpen,
  currentTeam, getTeamName, getTeamLogo, myTeamData,
  onRerank, onWithdraw, onMatch,
}) {
  // RFA runs exactly 5 waves: Wave 1 is tenders (standing offers on your
  // own players, never compete via priority_rank), Waves 2-5 are real
  // challenge bids. All five always show as sections, even with nothing
  // in them yet, so a manager can see the full shape of the draft and
  // know where to look/act.
  const ALL_WAVES = [1, 2, 3, 4, 5];

  const tenders = myBids.filter(b => b.is_incumbent);
  const challenges = myBids.filter(b => !b.is_incumbent);
  const challengesByWave = {};
  [2, 3, 4, 5].forEach(w => {
    challengesByWave[w] = challenges
      .filter(b => b.wave === w)
      .sort((a, b) => (a.priority_rank ?? Infinity) - (b.priority_rank ?? Infinity));
  });

  // Which wave sections are expanded -- current wave starts open, others
  // start collapsed. Initialized for all 5 waves up front since they're
  // always shown now, regardless of whether bids exist yet.
  const [expandedWaves, setExpandedWaves] = useState(() => {
    const init = {};
    ALL_WAVES.forEach(w => { init[w] = w === wave; });
    return init;
  });
  // If the current wave prop changes after mount (e.g. a new wave opens
  // while the sidebar is already mounted), make sure that new current
  // wave defaults to expanded too, without disturbing anything the
  // manager has already manually toggled.
  const lastAutoExpandedWaveRef = useRef(wave);
  useEffect(() => {
    if (wave !== lastAutoExpandedWaveRef.current) {
      setExpandedWaves(prev => ({ ...prev, [wave]: true }));
      lastAutoExpandedWaveRef.current = wave;
    }
  }, [wave]);
  const toggleWave = (w) => setExpandedWaves(prev => ({ ...prev, [w]: !prev[w] }));

  const handleMoveUp = (waveBids, index) => {
    if (index === 0) return;
    const reordered = [...waveBids];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const rankings = reordered.map((b, i) => ({ bid_id: b.id, priority_rank: i + 1 }));
    onRerank(rankings);
  };

  const handleMoveDown = (waveBids, index) => {
    if (index === waveBids.length - 1) return;
    const reordered = [...waveBids];
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

  // Shared card renderer -- used for both tenders (no reorder/rank shown)
  // and challenge bids within a wave section (reorder scoped to that wave).
  function renderBidCard(bid, { index, waveBids } = {}) {
    const player = bid.rfa_pool;
    const showReorder = index != null && waveBids;
    // Withdraw only makes sense for a bid that's still actually competing
    // -- a resolved bid (signed/won/matched/lost/etc) is a done deal, not
    // something to withdraw.
    const canWithdraw = isWaveOpen && bid.status === 'active';
    return (
      <div key={bid.id} className="rfa-bid-card">
        <div className="rfa-bid-card__top">
          {showReorder ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => handleMoveUp(waveBids, index)}
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
                onClick={() => handleMoveDown(waveBids, index)}
                disabled={index === waveBids.length - 1}
                style={{
                  background: 'none', border: 'none',
                  color: index === waveBids.length - 1
                    ? 'var(--draft-border)' : 'var(--draft-text-muted)',
                  cursor: index === waveBids.length - 1 ? 'default' : 'pointer',
                  fontSize: 10, padding: 0, lineHeight: 1,
                }}
              >▼</button>
            </div>
          ) : player?.match_window_open ? (
            <span style={{
              fontSize: 9, fontWeight: 800, color: 'var(--draft-red, #e84545)',
              background: 'rgba(232,69,69,0.12)', padding: '2px 6px', borderRadius: 3,
              alignSelf: 'flex-start',
            }}>
              MATCH WINDOW
            </span>
          ) : (
            <span style={{
              fontSize: 9, fontWeight: 800, color: 'var(--draft-amber)',
              background: 'rgba(212,168,67,0.12)', padding: '2px 6px', borderRadius: 3,
              alignSelf: 'flex-start',
            }}>
              TENDER
            </span>
          )}

          <div className="rfa-bid-card__player">
            <span className="rfa-bid-card__name">
              {player?.full_name || 'Unknown Player'}
            </span>
            <span className="rfa-bid-card__meta">
              {player?.position} · R{player?.draft_round} RFA
            </span>
          </div>
        </div>

        <div className="rfa-bid-card__contract">
          3yr / <span>${bid.y1_salary}</span> · <span>${bid.y2_salary}</span> · <span>${bid.y3_salary}</span>
          <br />
          {bid.guaranteed_years} yrs gtd
          {bid.signing_bonus > 0 && ` + $${bid.signing_bonus} SB`}
          <br />
          Total gtd: <span>${bid.total_guaranteed}</span>
        </div>

        <div className="rfa-bid-card__toggles">
          <label className="rfa-bid-card__toggle">
            <input type="checkbox" checked={bid.conditional_on_cap} readOnly />
            Conditional on cap space
          </label>
        </div>

        {canWithdraw && (
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
  }

  const hasAnyBids = myBids.length > 0;

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
          const capShortfall = myTeamData ? +(offer.y1_salary - myTeamData.cap_space).toFixed(2) : null;
          const sbShortfall = myTeamData ? +(offer.signing_bonus - (myTeamData.sb_budget_remaining ?? 0)).toFixed(2) : null;
          const canAfford = capShortfall !== null && capShortfall <= 0 && sbShortfall <= 0;
          const deadlineWave = (player.match_window_wave || 0) + 1;
          const isLastChance = wave >= deadlineWave;
          return (
            <div key={`match-${player.id}`} className="rfa-match-card">
              <div className="rfa-match-card__header">
                ⚠ Match Decision Required
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, marginBottom: 6,
                color: isLastChance ? 'var(--draft-red)' : 'var(--draft-amber)',
              }}>
                {isLastChance
                  ? `⏰ LAST CHANCE — this locks in when Wave ${wave} closes`
                  : `You must act before Wave ${deadlineWave} closes, or this player goes to the challenger`}
              </div>
              <div className="rfa-match-card__player">{player.full_name}</div>
              <div className="rfa-match-card__offer">
                <strong>Offer to match:</strong><br />
                3yr / ${offer.y1_salary} · ${offer.y2_salary} · ${offer.y3_salary}<br />
                {offer.guaranteed_years} yrs gtd
                {offer.signing_bonus > 0 && ` + $${offer.signing_bonus} SB`}<br />
                <strong>Total guaranteed: ${offer.total_guaranteed}</strong>
              </div>
              {myTeamData && (
                <div style={{
                  fontSize: 11, marginTop: 6, padding: '6px 8px', borderRadius: 4,
                  background: canAfford ? 'rgba(90,200,120,0.1)' : 'rgba(232,69,69,0.1)',
                  color: canAfford ? 'var(--draft-green, #5ac878)' : 'var(--draft-red)',
                  fontWeight: 700,
                }}>
                  {canAfford
                    ? '✓ You can currently afford to match this offer'
                    : `Need ${capShortfall > 0 ? `$${capShortfall.toFixed(2)} more cap space` : ''}${capShortfall > 0 && sbShortfall > 0 ? ' and ' : ''}${sbShortfall > 0 ? `$${sbShortfall.toFixed(2)} more signing bonus budget` : ''} — updates automatically if you trade or release a player`}
                </div>
              )}
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

        {!hasAnyBids && matchWindows.length === 0 && (
          <div className="rfa-my-bids__empty">
            {isWaveOpen
              ? wave === 1
                ? 'Tag your RFAs using the RETAIN button'
                : 'Submit bids on players using the BID button'
              : 'Wave is not currently open'}
          </div>
        )}

        {/* One section per wave, 1 through 5, always shown -- plain "Wave N"
            labels only, no thematic subtitles (those don't apply to RFA). */}
        {ALL_WAVES.map(w => {
          const isTenderWave = w === 1;
          const waveBids = isTenderWave ? tenders : challengesByWave[w];
          const isOpen = !!expandedWaves[w];
          return (
            <div key={w} className="rfa-my-bids__wave-section">
              <button
                className="rfa-my-bids__wave-header"
                onClick={() => toggleWave(w)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ color: 'var(--draft-amber, #F5A623)', fontWeight: 700 }}>
                  {isOpen ? '▾' : '▸'} Wave {w}{w === wave ? ' (current)' : ''}
                </span>
                <span className="rfa-my-bids__wave-count" style={{ color: '#FFFFFF' }}>{waveBids.length}</span>
              </button>
              {isOpen && (
                <div className="rfa-my-bids__wave-body">
                  {waveBids.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#FFFFFF', padding: '6px 2px' }}>
                      Nothing here yet.
                    </div>
                  ) : isTenderWave ? (
                    waveBids.map(bid => renderBidCard(bid))
                  ) : (
                    waveBids.map((bid, index) => renderBidCard(bid, { index, waveBids }))
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
