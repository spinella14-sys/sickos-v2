import { useState } from 'react';
import RFABidForm from './RFABidForm';

export default function RFAPool({
  pool, wave, isWaveOpen, isPreRfa, currentTeam,
  myBids, myTeamData, selectedPlayer, setSelectedPlayer,
  getTeamName, getTeamLogo, onBidSubmit,
}) {
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');

  const filtered = pool.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q);
    }
    return true;
  });

  const hasMyBidOnPlayer = (playerId) =>
    myBids.some(b => b.player_id === playerId);

  const canBidOnPlayer = (player) => {
    if (!isWaveOpen) return false;
    if (wave === 1) return player.incumbent_team === currentTeam;
    return true;
  };

  const getActionLabel = (player) => {
    if (player.status === 'signed') return 'SIGNED';
    if (player.match_window_open && player.incumbent_team === currentTeam) return 'DECIDE';
    if (hasMyBidOnPlayer(player.id)) return 'EDIT BID';
    if (wave === 1 && player.incumbent_team === currentTeam) return 'RETAIN';
    if (wave > 1 && player.incumbent_team !== currentTeam) return 'BID';
    return null;
  };

  const getActionClass = (player) => {
    if (player.status === 'signed') return 'rfa-action-btn rfa-action-btn--signed';
    if (wave === 1) return 'rfa-action-btn rfa-action-btn--retain';
    return 'rfa-action-btn rfa-action-btn--bid';
  };

  if (isPreRfa && wave === 1) {
    return (
      <main className="rfa-pool">
        <div className="rfa-pool__header">
          <div className="rfa-pool__title-row">
            <span className="rfa-pool__title">RFA Pool</span>
            <span className="rfa-pool__wave-badge">Wave {wave}</span>
          </div>
        </div>
        <div className="rfa-pool__empty">
          <div className="rfa-pool__empty-title">Wave 1 Not Yet Open</div>
          <p>The commissioner will open Wave 1 shortly.<br />
            You will be able to submit retention tags for your RFAs.</p>
        </div>
      </main>
    );
  }

  if (wave === 1 && isWaveOpen && pool.length === 0) {
    return (
      <main className="rfa-pool">
        <div className="rfa-pool__header">
          <div className="rfa-pool__title-row">
            <span className="rfa-pool__title">My RFAs</span>
            <span className="rfa-pool__wave-badge">Wave 1 — Retention</span>
          </div>
        </div>
        <div className="rfa-pool__empty">
          <div className="rfa-pool__empty-title">No RFAs This Year</div>
          <p>You have no restricted free agents to retain this offseason.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="rfa-pool">
      <div className="rfa-pool__header">
        <div className="rfa-pool__title-row">
          <span className="rfa-pool__title">
            {wave === 1 ? 'My Restricted Free Agents' : 'RFA Pool'}
            <span style={{ color: 'var(--draft-amber)', marginLeft: 8 }}>
              {filtered.length} players
            </span>
          </span>
          <span className="rfa-pool__wave-badge">Wave {wave}</span>
        </div>

        {wave > 1 && (
          <div className="rfa-pool__filters">
            <div style={{ display: 'flex', gap: 4 }}>
              {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
                <button
                  key={pos}
                  className={`pos-tab ${posFilter === pos ? 'pos-tab--active' : ''}`}
                  onClick={() => setPosFilter(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="rfa-pool__search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rfa-pool__col-headers">
        <span>RD</span>
        <span>PLAYER</span>
        <span>POS</span>
        <span>INCUMBENT</span>
        <span>BIDS</span>
        <span>STATUS</span>
        <span />
      </div>

      <div className="rfa-pool__list">
        {filtered.length === 0 && (
          <div className="rfa-pool__empty">
            <div className="rfa-pool__empty-title">No Players Found</div>
          </div>
        )}

        {filtered.map(player => {
          const isMyPlayer = player.incumbent_team === currentTeam;
          const isSigned = player.status === 'signed';
          const matchOpen = player.match_window_open;
          const actionLabel = getActionLabel(player);
          const canAct = canBidOnPlayer(player) && !isSigned;

          return (
            <div
              key={player.id}
              className={`rfa-player-row
                ${isMyPlayer ? 'rfa-player-row--my-player' : ''}
                ${matchOpen && isMyPlayer ? 'rfa-player-row--match-open' : ''}
                ${isSigned ? 'rfa-player-row--signed' : ''}
              `}
            >
              {/* Round badge */}
              <div>
                <span className={`rfa-round-badge rfa-round-badge--${player.draft_round}`}>
                  R{player.draft_round}
                </span>
              </div>

              {/* Player identity */}
              <div className="rfa-player-row__identity">
                <img
                  src={`https://sleepercdn.com/content/nfl/players/thumb/${player.sleeper_id}.jpg`}
                  alt={player.full_name}
                  className="rfa-player-row__headshot"
                  onError={e => { e.target.src = '/placeholder-player.png'; }}
                />
                <div>
                  <span className="rfa-player-row__name">{player.full_name}</span>
                  <span className="rfa-player-row__meta">
                    {player.nfl_team || '—'}
                    {isMyPlayer && (
                      <span className="rfa-my-player-badge" style={{ marginLeft: 6 }}>
                        YOUR PLAYER
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Position */}
              <div>
                <span className={`pos-badge pos-badge--${player.position}`}>
                  {player.position}
                </span>
              </div>

              {/* Incumbent team */}
              <div className="rfa-incumbent">
                <img
                  src={getTeamLogo(player.incumbent_team)}
                  alt={getTeamName(player.incumbent_team)}
                  className="rfa-incumbent__logo"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <span className="rfa-incumbent__name">
                  {getTeamName(player.incumbent_team)}
                </span>
              </div>

              {/* Bid count */}
              <div className="rfa-bid-count">
                <span className="rfa-bid-count__num">{player.bid_count}</span>
                <span>bid{player.bid_count !== 1 ? 's' : ''}</span>
              </div>

              {/* Status */}
              <div style={{ fontSize: 11, color: 'var(--draft-text-muted)' }}>
                {isSigned ? (
                  <span style={{ color: 'var(--draft-green)', fontWeight: 700 }}>
                    SIGNED
                  </span>
                ) : matchOpen && isMyPlayer ? (
                  <span style={{ color: 'var(--draft-red)', fontWeight: 700 }}>
                    MATCH PENDING
                  </span>
                ) : player.tagged ? (
                  <span style={{ color: 'var(--draft-amber)' }}>TAGGED</span>
                ) : (
                  <span>Available</span>
                )}
              </div>

              {/* Action button */}
              <div>
                {actionLabel && (
                  <button
                    className={getActionClass(player)}
                    disabled={!canAct}
                    onClick={() => canAct && setSelectedPlayer(player)}
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bid form modal */}
      {selectedPlayer && (
        <RFABidForm
          player={selectedPlayer}
          wave={wave}
          currentTeam={currentTeam}
          myTeamData={myTeamData}
          myBids={myBids}
          onSubmit={onBidSubmit}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
}