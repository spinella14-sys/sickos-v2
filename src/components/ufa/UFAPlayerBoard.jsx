import { useState, useMemo } from 'react';
import UFABidForm from './UFABidForm';
import PlayerLink from '../PlayerCard/PlayerLink';

const TIER_NAMES = { 1: 'Tier 1 — $18+', 2: 'Tier 2 — $9.60+', 3: 'Tier 3 — Open' };
const POS_BG    = { QB:'rgba(231,76,60,0.2)',  RB:'rgba(39,174,96,0.2)',  WR:'rgba(52,152,219,0.2)',  TE:'rgba(155,89,182,0.2)'  };
const POS_COLOR = { QB:'#E74C3C',              RB:'#27AE60',              WR:'#3498DB',              TE:'#9B59B6'               };

export default function UFAPlayerBoard({
  players, wave, tier, isWaveOpen, isPreUFA,
  currentTeam, myBids, myCapData, selectedPlayer,
  setSelectedPlayer, onBidSubmit, bidsRemaining,
}) {
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortKey,   setSortKey]   = useState('full_name');

  const filtered = useMemo(() => {
    let list = [...players];
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.nfl_team || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => String(a[sortKey] || '').toLowerCase().localeCompare(String(b[sortKey] || '').toLowerCase()));
    return list;
  }, [players, posFilter, search, sortKey]);

  const hasBidOnPlayer = (sleeperId) =>
    myBids.some(b => b.ufa_pool?.sleeper_id === sleeperId || b.player_sleeper_id === sleeperId);
  const canBid = isWaveOpen && bidsRemaining > 0;

  if (isPreUFA) return (
    <main className="rfa-pool">
      <div className="rfa-pool__header">
        <div className="rfa-pool__title-row">
          <span className="rfa-pool__title">UFA Free Agent Pool</span>
          <span className="rfa-pool__wave-badge">Wave {wave}</span>
        </div>
      </div>
      <div className="rfa-pool__empty">
        <div className="rfa-pool__empty-title">Wave Not Yet Open</div>
        <p>The commissioner will open Wave {wave} shortly.</p>
      </div>
    </main>
  );

  const GRID = '40px 1fr 64px 80px 80px 80px';

  return (
    <main className="rfa-pool">
      <div className="rfa-pool__header">
        <div className="rfa-pool__title-row">
          <span className="rfa-pool__title">
            Free Agents
            <span style={{ color: 'var(--draft-amber)', marginLeft: 8 }}>{filtered.length} available</span>
          </span>
          <span className="rfa-pool__wave-badge">{TIER_NAMES[tier]} · Wave {wave}</span>
        </div>
        <div className="rfa-pool__filters">
          <div style={{ display: 'flex', gap: 4 }}>
            {['ALL','QB','RB','WR','TE'].map(pos => (
              <button key={pos}
                className={`pos-tab ${posFilter === pos ? 'pos-tab--active' : ''}`}
                onClick={() => setPosFilter(pos)}>{pos}</button>
            ))}
          </div>
          <div className="rfa-pool__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search players..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="player-board__sort-select" value={sortKey}
            onChange={e => setSortKey(e.target.value)}>
            <option value="full_name">Name</option>
            <option value="position">Position</option>
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: GRID,
        padding: '7px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--draft-text-muted)', textTransform: 'uppercase',
        borderBottom: '1px solid var(--draft-border)', background: 'var(--draft-surface)', flexShrink: 0,
      }}>
        <span /><span>PLAYER</span><span>POS</span><span>NFL TEAM</span><span>STATUS</span><span>ACTION</span>
      </div>

      <div className="rfa-pool__list">
        {filtered.length === 0 && (
          <div className="rfa-pool__empty"><div className="rfa-pool__empty-title">No players found</div></div>
        )}
        {filtered.map(player => {
          const hasBid = hasBidOnPlayer(player.sleeper_id);
          return (
            <div key={player.sleeper_id} style={{
              display: 'grid', gridTemplateColumns: GRID,
              alignItems: 'center', padding: '10px 16px',
              borderBottom: '1px solid var(--draft-border)',
              background: hasBid ? 'rgba(245,166,35,0.04)' : 'transparent',
              borderLeft: hasBid ? '3px solid var(--draft-amber)' : '3px solid transparent',
              transition: 'background 0.1s',
            }}>
              {/* Headshot */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--draft-surface-2)', border: '1px solid var(--draft-border)', flexShrink: 0 }}>
                <img src={`https://sleepercdn.com/content/nfl/players/thumb/${player.sleeper_id}.jpg`}
                  alt={player.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>

              {/* Name — PlayerLink opens player card */}
              <div>
                <PlayerLink
                  playerId={player.sleeper_id}
                  style={{ fontSize: 14, fontWeight: 700, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                >
                  {player.full_name}
                </PlayerLink>
                {player.age && <div style={{ fontSize: 10, color: 'var(--draft-text-muted)' }}>{player.age}y</div>}
              </div>

              {/* Position */}
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800,
                padding: '2px 7px', borderRadius: 4,
                background: POS_BG[player.position], color: POS_COLOR[player.position] }}>
                {player.position}
              </span>

              {/* NFL Team */}
              <span style={{ fontSize: 12, color: 'var(--draft-text-muted)' }}>{player.nfl_team || '—'}</span>

              {/* Bid status */}
              <span style={{ fontSize: 12, color: 'var(--draft-text-muted)' }}>
                {hasBid
                  ? <span style={{ color: 'var(--draft-amber)', fontWeight: 700 }}>✓ BID</span>
                  : '—'}
              </span>

              {/* Action */}
              <div>
                {isWaveOpen && (
                  <button
                    onClick={() => setSelectedPlayer(player)}
                    disabled={!canBid && !hasBid}
                    style={{
                      background: hasBid ? 'none' : canBid ? '#3498DB' : 'none',
                      color: hasBid ? 'var(--draft-amber)' : canBid ? '#fff' : 'var(--draft-text-muted)',
                      border: hasBid ? '1px solid var(--draft-amber)' : canBid ? 'none' : '1px solid var(--draft-border)',
                      fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, fontWeight: 800,
                      padding: '5px 10px', borderRadius: 4,
                      cursor: canBid || hasBid ? 'pointer' : 'not-allowed', letterSpacing: '0.06em',
                    }}
                  >
                    {hasBid ? 'EDIT' : canBid ? 'BID' : 'NO BIDS LEFT'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlayer && (
        <UFABidForm
          player={selectedPlayer}
          wave={wave}
          tier={tier}
          currentTeam={currentTeam}
          myCapData={myCapData}
          myBids={myBids}
          onSubmit={onBidSubmit}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </main>
  );
}
