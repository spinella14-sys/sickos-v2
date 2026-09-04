import { useState, useMemo } from 'react';
import UFABidForm from './UFABidForm';
import PlayerLink from '../PlayerCard/PlayerLink';
import RFATradeBlockTab from '../rfa/RFATradeBlockTab';
import RFACapOverviewTab from '../rfa/RFACapOverviewTab';
import UFAResultsTab from './UFAResultsTab';

import { TIER_SHORT as TIER_NAMES } from '../../constants/ufaTiers';
const POS_BG    = { QB:'rgba(231,76,60,0.2)',  RB:'rgba(39,174,96,0.2)',  WR:'rgba(52,152,219,0.2)',  TE:'rgba(155,89,182,0.2)'  };
const POS_COLOR = { QB:'#E74C3C',              RB:'#27AE60',              WR:'#3498DB',              TE:'#9B59B6'               };

// Ported from RFAPool.jsx -- see that file for fuller design rationale.
// Duplicated here rather than extracted to a shared utils file, a
// deliberate speed tradeoff for tonight's UFA port -- flagged as tech
// debt worth consolidating once Rookie is also done.
const STAT_COLUMNS = {
  ALL: [{ key: 'fantasy_pts', label: 'PTS' }],
  QB: [
    { key: 'pass_cmp_att', sortKey: 'pass_cmp', label: 'CMP/ATT' },
    { key: 'pass_yd', label: 'PASS YD' },
    { key: 'pass_td', label: 'PASS TD' },
    { key: 'pass_int', label: 'INT' },
    { key: 'rush_yd', label: 'RUSH YD' },
    { key: 'rush_td', label: 'RUSH TD' },
  ],
  RB: [
    { key: 'rush_att', label: 'ATT' },
    { key: 'rush_yd', label: 'RUSH YD' },
    { key: 'rush_td', label: 'RUSH TD' },
    { key: 'rec', label: 'REC' },
    { key: 'targets', label: 'TAR' }, // 2025 view only -- Sleeper's 2026 projections have no targets field
    { key: 'rec_yd', label: 'REC YD' },
    { key: 'rec_td', label: 'REC TD' },
  ],
};
STAT_COLUMNS.WR = STAT_COLUMNS.RB;
STAT_COLUMNS.TE = STAT_COLUMNS.RB;

function getGamesPlayed(stats, view) {
  if (!stats) return 0;
  return (view === '2025' ? stats.games : stats.gp) || 0;
}

function fmtStat(raw, { perGame, games, decimals = 0 }) {
  if (raw == null) return '—';
  if (perGame) {
    const val = games > 0 ? raw / games : 0;
    return val.toFixed(1);
  }
  return Number(raw).toFixed(decimals);
}

function trendArrow(trend) {
  if (trend == null) return null;
  if (trend > 0) return <span style={{ color: 'var(--draft-green)' }}>▲{trend.toFixed(1)}</span>;
  if (trend < 0) return <span style={{ color: 'var(--draft-red)' }}>▼{Math.abs(trend).toFixed(1)}</span>;
  return <span style={{ color: 'var(--draft-text-muted)' }}>—</span>;
}

export default function UFAPlayerBoard({
  players, wave, tier, isWaveOpen, isPreUFA,
  currentTeam, statsView, setStatsView, trendWindow, setTrendWindow,
  myBids, myCapData, selectedPlayer,
  setSelectedPlayer, onBidSubmit, bidsRemaining,
}) {
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'tradeblock' | 'cap' | 'results'
  const [perGameMode, setPerGameMode] = useState('total'); // 'total' | 'per_game'
  const [sortKey,   setSortKey]   = useState('adp_dynasty_2qb');
  const [sortDir,   setSortDir]   = useState('asc'); // ADP ascending default, matching RFA

  const totalQBCount = useMemo(() => {
    return (myCapData?.roster || []).filter(c => {
      const slot = c.roster_slots?.[0]?.slot_type;
      return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
    }).length;
  }, [myCapData]);
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;

  const activeStatColumns = STAT_COLUMNS[posFilter] || STAT_COLUMNS.ALL;

  const filtered = useMemo(() => {
    let list = [...players];
    if (qbLimitReached) list = list.filter(p => p.position !== 'QB');
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.nfl_team || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [players, posFilter, search, qbLimitReached]);

  function getSortValue(p, key) {
    if (key === 'adp_dynasty_2qb') return p.adp_dynasty_2qb ?? Infinity;
    if (key === 'owned_pct') return p.owned_pct ?? -Infinity;
    if (key === 'bye_week') return p.bye_week ?? Infinity;
    if (key === 'full_name') return (p.full_name || '').toLowerCase();
    if (key === 'position') return (p.position || '').toLowerCase();
    const raw = p.stats?.[key];
    if (raw == null) return -Infinity;
    if (perGameMode === 'per_game') {
      const games = getGamesPlayed(p.stats, statsView);
      return games > 0 ? raw / games : -Infinity;
    }
    return raw;
  }

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sortDir === 'asc' ? 1 : -1);
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, perGameMode, statsView]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'adp_dynasty_2qb' || key === 'bye_week' ? 'asc' : 'desc');
    }
  }

  function SortHeader({ colKey, label }) {
    const active = sortKey === colKey;
    return (
      <span
        onClick={() => handleSort(colKey)}
        style={{ cursor: 'pointer', color: active ? 'var(--draft-amber)' : undefined }}
      >
        {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </span>
    );
  }

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

  const GRID = [
    '40px',   // headshot
    '1fr',    // player
    '50px',   // pos
    '50px',   // bye
    '60px',   // adp
    '110px',  // % owned
    ...activeStatColumns.map(() => '75px'),
    '80px',   // nfl team
    '90px',   // status
    '110px',  // action
  ].join(' ');

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

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 16px 0' }}>
          {[
            { key: 'board', label: 'Board' },
            { key: 'tradeblock', label: 'Trade Block' },
            { key: 'cap', label: 'Cap Overview' },
            { key: 'results', label: 'Results' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`pos-tab ${activeTab === tab.key ? 'pos-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'board' && (
          <div className="rfa-pool__filters" style={{ flexWrap: 'wrap', rowGap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['ALL','QB','RB','WR','TE'].map(pos => (
                <button key={pos}
                  className={`pos-tab ${posFilter === pos ? 'pos-tab--active' : ''}`}
                  onClick={() => setPosFilter(pos)}>{pos}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {[{ key: '2026', label: '2026 Proj' }, { key: '2025', label: '2025 Stats' }].map(v => (
                <button
                  key={v.key}
                  className={`pos-tab ${statsView === v.key ? 'pos-tab--active' : ''}`}
                  onClick={() => setStatsView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {[{ key: 'total', label: 'Total' }, { key: 'per_game', label: 'Per Game' }].map(m => (
                <button
                  key={m.key}
                  className={`pos-tab ${perGameMode === m.key ? 'pos-tab--active' : ''}`}
                  onClick={() => setPerGameMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'last_week', label: 'Last Wk' },
                { key: '3week', label: '3-Wk' },
                { key: 'season', label: 'Season' },
              ].map(t => (
                <button
                  key={t.key}
                  className={`pos-tab ${trendWindow === t.key ? 'pos-tab--active' : ''}`}
                  onClick={() => setTrendWindow(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rfa-pool__search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" placeholder="Search players..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {activeTab === 'tradeblock' && <RFATradeBlockTab />}
      {activeTab === 'cap' && <RFACapOverviewTab myTeam={currentTeam} />}
      {activeTab === 'results' && <UFAResultsTab />}

      {activeTab === 'board' && (
        <>
          {qbLimitReached && (
            <div style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
              borderBottom: '1px solid var(--draft-border)',
            }}>
              ⚠ QBs are hidden from this pool -- your roster is already at the 2-QB active limit.
            </div>
          )}

          <div className="rfa-pool__col-headers" style={{ gridTemplateColumns: GRID }}>
            <span />
            <SortHeader colKey="full_name" label="PLAYER" />
            <SortHeader colKey="position" label="POS" />
            <SortHeader colKey="bye_week" label="BYE" />
            <SortHeader colKey="adp_dynasty_2qb" label="ADP" />
            <SortHeader colKey="owned_pct" label="% OWNED" />
            {activeStatColumns.map(col => (
              <SortHeader key={col.key} colKey={col.sortKey || col.key} label={col.label} />
            ))}
            <span>NFL TEAM</span>
            <span>STATUS</span>
            <span>ACTION</span>
          </div>

          <div className="rfa-pool__list">
            {sorted.length === 0 && (
              <div className="rfa-pool__empty"><div className="rfa-pool__empty-title">No players found</div></div>
            )}
            {sorted.map(player => {
              const hasBid = hasBidOnPlayer(player.sleeper_id);
              const games = getGamesPlayed(player.stats, statsView);
              const perGame = perGameMode === 'per_game';
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

                  {/* Bye week */}
                  <div>{player.bye_week ?? '—'}</div>

                  {/* ADP */}
                  <div>{player.adp_dynasty_2qb != null ? player.adp_dynasty_2qb.toFixed(1) : '—'}</div>

                  {/* % Owned + trend */}
                  <div>
                    {player.owned_pct != null ? `${player.owned_pct.toFixed(1)}%` : '—'}
                    {' '}
                    {trendArrow(player.owned_trend)}
                  </div>

                  {/* Swappable stat columns */}
                  {activeStatColumns.map(col => {
                    const stats = player.stats;
                    if (col.key === 'pass_cmp_att') {
                      const cmp = fmtStat(stats?.pass_cmp, { perGame, games });
                      const att = fmtStat(stats?.pass_att, { perGame, games });
                      return <div key={col.key}>{cmp}/{att}</div>;
                    }
                    const decimals = col.key === 'fantasy_pts' ? 1 : 0;
                    return (
                      <div key={col.key}>
                        {fmtStat(stats?.[col.key], { perGame, games, decimals })}
                      </div>
                    );
                  })}

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
        </>
      )}

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
