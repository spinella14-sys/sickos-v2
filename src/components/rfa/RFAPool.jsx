import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import RFABidForm from './RFABidForm';
import RFATradeBlockTab from './RFATradeBlockTab';
import RFACapOverviewTab from './RFACapOverviewTab';
import RFAResultsTab from './RFAResultsTab';
import RFADraftChat from './RFADraftChat';

// Stat columns swap based on the position filter -- QB's passing-heavy
// line and RB/WR/TE's rushing/receiving line don't share column meaning,
// so ALL shows just Fantasy Pts rather than trying to mix them in one
// table (confirmed with Adam rather than guessing at a compromise).
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

// 2025 actuals use `games`; 2026 projections use Sleeper's own `gp` field.
// Not the same kind of number under the hood (real box scores vs a
// projection engine's estimate) but each is the correct divisor for its
// own view -- expected, not a bug.
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

export default function RFAPool({
  pool, wave, isWaveOpen, isPreRfa, currentTeam,
  statsView, setStatsView, trendWindow, setTrendWindow,
  myBids, myTeamData, selectedPlayer, setSelectedPlayer,
  getTeamName, getTeamLogo, onBidSubmit,
}) {
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'tradeblock' | 'cap'
  const [perGameMode, setPerGameMode] = useState('total'); // 'total' | 'per_game'
  const [sortKey, setSortKey] = useState('adp_dynasty_2qb');
  const [sortDir, setSortDir] = useState('asc'); // ADP ascending default -- "who should I actually be targeting"

  const totalQBCount = (myTeamData?.roster || []).filter(c => {
    const slot = c.roster_slots?.[0]?.slot_type;
    return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
  }).length;
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;

  const filtered = pool.filter(p => {
    // Wave 1 is retention-only (player already on your roster) -- QB limit
    // never applies there. Wave 2+ is a genuine new acquisition.
    if (wave > 1 && qbLimitReached && p.position === 'QB') return false;
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q);
    }
    return true;
  });

  const activeStatColumns = STAT_COLUMNS[posFilter] || STAT_COLUMNS.ALL;

  function getSortValue(p, key) {
    if (key === 'adp_dynasty_2qb') return p.adp_dynasty_2qb ?? Infinity; // nulls sort last ascending
    if (key === 'owned_pct') return p.owned_pct ?? -Infinity;
    if (key === 'bye_week') return p.bye_week ?? Infinity;
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
      // Lower-is-better columns default ascending; everything else (stats,
      // ownership) defaults descending, since higher is what you're
      // typically hunting for there.
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

  if (isPreRfa && wave === 1 && pool.length === 0) {
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

  // Grid columns: fixed leading/trailing columns, plus however many stat
  // columns the current position filter calls for -- built once here so
  // the header row and every player row stay pixel-aligned.
  const gridTemplateColumns = [
    '40px',   // RD
    '1fr',    // Player
    '50px',   // Pos
    '50px',   // Bye
    '60px',   // ADP
    '110px',  // % Owned
    ...activeStatColumns.map(() => '75px'),
    '100px',  // Incumbent
    '60px',   // Bids
    '100px',  // Status
    '90px',   // Action
  ].join(' ');

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

        {/* Tab bar -- Board is the only tab built out; Trade Block/Cap
            Overview are placeholders for a later phase. */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 16px 0' }}>
          {[
            { key: 'board', label: 'Board' },
            { key: 'tradeblock', label: 'Trade Block' },
            { key: 'cap', label: 'Cap Overview' },
            { key: 'results', label: 'Results' },
            { key: 'chat', label: 'Chat' },
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
          <div
            className="rfa-pool__filters"
            style={{ flexWrap: 'wrap', rowGap: 8 }}
          >
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

            {/* 2025 Stats / 2026 Projections toggle -- 2026 is the default */}
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

            {/* Total / Per Game toggle */}
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

            {/* Ownership trend window */}
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

      {activeTab === 'tradeblock' && <RFATradeBlockTab />}
      {activeTab === 'cap' && <RFACapOverviewTab myTeam={currentTeam} />}
      {activeTab === 'results' && <RFAResultsTab getTeamName={getTeamName} getTeamLogo={getTeamLogo} />}
      {activeTab === 'chat' && <RFADraftChat draftType="rfa" season={2026} currentTeam={currentTeam} getTeamName={getTeamName} getTeamLogo={getTeamLogo} />}

      {activeTab === 'board' && (
        <>
          {wave > 1 && qbLimitReached && (
            <div style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
              borderBottom: '1px solid var(--draft-border)',
            }}>
              ⚠ QBs are hidden from this pool -- your roster is already at the 2-QB active limit.
            </div>
          )}

          <div className="rfa-pool__col-headers" style={{ gridTemplateColumns }}>
            <span>RD</span>
            <span>PLAYER</span>
            <span>POS</span>
            <SortHeader colKey="bye_week" label="BYE" />
            <SortHeader colKey="adp_dynasty_2qb" label="ADP" />
            <SortHeader colKey="owned_pct" label="% OWNED" />
            {activeStatColumns.map(col => (
              <SortHeader key={col.key} colKey={col.sortKey || col.key} label={col.label} />
            ))}
            <span>INCUMBENT</span>
            <span>BIDS</span>
            <span>STATUS</span>
            <span />
          </div>

          <div className="rfa-pool__list">
            {sorted.length === 0 && (
              <div className="rfa-pool__empty">
                <div className="rfa-pool__empty-title">No Players Found</div>
              </div>
            )}

            {sorted.map(player => {
              const isMyPlayer = player.incumbent_team === currentTeam;
              const isSigned = player.status === 'signed';
              const matchOpen = player.match_window_open;
              const actionLabel = getActionLabel(player);
              const canAct = canBidOnPlayer(player) && !isSigned;
              const games = getGamesPlayed(player.stats, statsView);
              const perGame = perGameMode === 'per_game';

              return (
                <div
                  key={player.id}
                  className={`rfa-player-row
                    ${isMyPlayer ? 'rfa-player-row--my-player' : ''}
                    ${matchOpen && isMyPlayer ? 'rfa-player-row--match-open' : ''}
                    ${isSigned ? 'rfa-player-row--signed' : ''}
                  `}
                  style={{ gridTemplateColumns }}
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
                      <Link to={`/player/${player.sleeper_id}`} className="rfa-player-row__name">{player.full_name}</Link>
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
        </>
      )}

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
