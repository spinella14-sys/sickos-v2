import { useState, useMemo } from 'react';
import PlayerLink from '../../components/PlayerCard/PlayerLink';
import RFATradeBlockTab from '../rfa/RFATradeBlockTab';
import RFACapOverviewTab from '../rfa/RFACapOverviewTab';
import RookieResultsTab from './RookieResultsTab';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

const SORT_OPTIONS = [
  { key: 'nfl_draft_pick', label: 'Big Board / NFL Draft' },
  { key: 'adp_dynasty_2qb', label: 'ADP' },
  { key: 'owned_pct',      label: '% Owned'              },
  { key: 'position',       label: 'Position'              },
  { key: 'full_name',      label: 'Name'                  },
];

// Ported from RFAPool.jsx/UFAPlayerBoard.jsx -- duplicated rather than
// extracted to a shared utils file, same speed tradeoff flagged for the
// UFA port. No 2025/2026 view distinction needed here at all -- rookies
// have only ever the one (2026 projections) view.
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
    { key: 'rec_yd', label: 'REC YD' },
    { key: 'rec_td', label: 'REC TD' },
  ],
};
STAT_COLUMNS.WR = STAT_COLUMNS.RB;
STAT_COLUMNS.TE = STAT_COLUMNS.RB;

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

export default function PlayerBoard({
  rookies,
  allPicks,
  currentPick,
  isMyPick,
  submitting,
  onPick,
  currentTeam,
  trendWindow, setTrendWindow,
  myTeamData = null,
}) {
  const [search,        setSearch]        = useState('');
  const [posFilter,     setPosFilter]     = useState('ALL');
  const [activeTab,     setActiveTab]     = useState('board'); // 'board' | 'tradeblock' | 'cap' | 'results'
  const [perGameMode,   setPerGameMode]   = useState('total'); // 'total' | 'per_game'
  const [sortKey,       setSortKey]       = useState('board_rank');
  const [sortAsc,       setSortAsc]       = useState(true); // My Draft Board rank ascending default

  // Clicking a header toggles direction if it's already the active sort,
  // otherwise switches to that column ascending.
  function handleHeaderSort(key) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  const totalQBCount = useMemo(() => {
    return (myTeamData?.roster || []).filter(c => {
      const slot = c.roster_slots?.[0]?.slot_type;
      return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
    }).length;
  }, [myTeamData]);
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;

  const activeStatColumns = STAT_COLUMNS[posFilter] || STAT_COLUMNS.ALL;

  const filtered = useMemo(() => {
    let list = [...rookies];
    if (qbLimitReached) list = list.filter(r => r.position !== 'QB');
    if (posFilter !== 'ALL') list = list.filter(r => r.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        (r.college || '').toLowerCase().includes(q) ||
        (r.nfl_team || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [rookies, posFilter, search, qbLimitReached]);

  function getSortValue(r, key) {
    if (key === 'board_rank') return r.board_rank ?? Infinity;
    if (key === 'adp_dynasty_2qb') return r.adp_dynasty_2qb ?? Infinity;
    if (key === 'owned_pct') return r.owned_pct ?? -Infinity;
    if (key === 'nfl_draft_pick') return r.nfl_draft_pick ?? Infinity;
    if (key === 'position' || key === 'full_name') return String(r[key] || '').toLowerCase();
    return r[key];
  }

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av === bv) return 0;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return (av < bv ? -1 : 1) * (sortAsc ? 1 : -1);
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortAsc]);

  const canPick  = isMyPick && currentPick?.status === 'on_clock' && !submitting;
  const draftOpen = currentPick?.status === 'on_clock';

  const GRID = [
    '80px',   // rank
    '1fr',    // player
    '60px',   // pos
    '50px',   // bye
    '60px',   // adp
    '110px',  // % owned
    ...activeStatColumns.map(() => '75px'),
    '80px',   // nfl team
    '100px',  // college
    '90px',   // action
  ].join(' ');

  return (
    <main className="player-board">
      <div className="player-board__header">
        <div className="player-board__count">
          SHOWING <span className="amber">{filtered.length}</span> OF{' '}
          <span className="amber">{rookies.length}</span> AVAILABLE PROSPECTS
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 0 0' }}>
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
          <div className="player-board__filters" style={{ flexWrap: 'wrap', rowGap: 8 }}>
            <div className="pos-tabs">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  className={`pos-tab ${posFilter === pos ? 'pos-tab--active' : ''}`}
                  onClick={() => setPosFilter(pos)}
                >
                  {pos}
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

            <div className="player-board__search">
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
            <select
              className="player-board__sort-select"
              value={sortKey}
              onChange={e => { setSortKey(e.target.value); setSortAsc(e.target.value === 'owned_pct' ? false : true); }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'tradeblock' && <RFATradeBlockTab />}
      {activeTab === 'cap' && <RFACapOverviewTab myTeam={currentTeam} />}
      {activeTab === 'results' && <RookieResultsTab />}

      {activeTab === 'board' && (
        <>
          {qbLimitReached && (
            <div style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
              borderBottom: '1px solid var(--draft-border)',
            }}>
              ⚠ QBs are hidden from this pool — your roster is already at the 2-active/1-PS QB limit.
            </div>
          )}

          <div className="player-board__col-headers" style={{ gridTemplateColumns: GRID }}>
            {[
              { key: 'board_rank', label: 'RANK' },
              { key: 'full_name', label: 'PLAYER' },
              { key: 'position', label: 'POS' },
            ].map(h => (
              <span
                key={h.key}
                onClick={() => handleHeaderSort(h.key)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {h.label}{sortKey === h.key ? (sortAsc ? ' \u25b2' : ' \u25bc') : ''}
              </span>
            ))}
            <span>BYE</span>
            <span
              onClick={() => handleHeaderSort('adp_dynasty_2qb')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              ADP{sortKey === 'adp_dynasty_2qb' ? (sortAsc ? ' \u25b2' : ' \u25bc') : ''}
            </span>
            <span
              onClick={() => handleHeaderSort('owned_pct')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              % OWNED{sortKey === 'owned_pct' ? (sortAsc ? ' \u25b2' : ' \u25bc') : ''}
            </span>
            {activeStatColumns.map(col => (
              <span key={col.key}>{col.label}</span>
            ))}
            <span>NFL TEAM</span>
            <span>COLLEGE</span>
            <span />
          </div>

          <div className="player-board__list">
            {sorted.length === 0 && (
              <div className="player-board__empty">No players match your filters</div>
            )}
            {sorted.map(rookie => {
              const isHovered = hoveredPlayer === rookie.sleeper_id;
              const games = rookie.stats?.gp || 0;
              const perGame = perGameMode === 'per_game';
              return (
                <div
                  key={rookie.sleeper_id}
                  className={`player-row ${isHovered ? 'player-row--hovered' : ''}`}
                  style={{ gridTemplateColumns: GRID }}
                  onMouseEnter={() => setHoveredPlayer(rookie.sleeper_id)}
                  onMouseLeave={() => setHoveredPlayer(null)}
                >
                  {/* My Draft Board rank, falling back to real NFL draft pick */}
                  <div className="player-row__rank">
                    {rookie.board_rank != null ? (
                      <span className="nfl-pick__num">#{rookie.board_rank}</span>
                    ) : rookie.nfl_draft_pick ? (
                      <span className="nfl-pick">
                        <span className="nfl-pick__round">R{rookie.nfl_draft_round}</span>
                        <span className="nfl-pick__num">#{rookie.nfl_draft_pick}</span>
                      </span>
                    ) : (
                      <span className="nfl-pick__udfa">UDFA</span>
                    )}
                  </div>

                  {/* Player identity — name is a clickable PlayerLink */}
                  <div className="player-row__identity">
                    <img
                      src={`https://sleepercdn.com/content/nfl/players/thumb/${rookie.sleeper_id}.jpg`}
                      alt={rookie.full_name}
                      className="player-row__headshot"
                      onError={e => { e.target.src = '/placeholder-player.png'; }}
                    />
                    <div className="player-row__info">
                      <PlayerLink
                        playerId={rookie.sleeper_id}
                        className="player-row__name"
                        style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                      >
                        {rookie.full_name}
                      </PlayerLink>
                      {rookie.age && <span className="player-row__meta">{rookie.age}y</span>}
                    </div>
                  </div>

                  {/* Position */}
                  <div className="player-row__pos">
                    <span className={`pos-badge pos-badge--${rookie.position}`}>{rookie.position}</span>
                  </div>

                  {/* Bye week */}
                  <div>{rookie.bye_week ?? '—'}</div>

                  {/* ADP */}
                  <div>{rookie.adp_dynasty_2qb != null ? rookie.adp_dynasty_2qb.toFixed(1) : '—'}</div>

                  {/* % Owned + trend */}
                  <div>
                    {rookie.owned_pct != null ? `${rookie.owned_pct.toFixed(1)}%` : '—'}
                    {' '}
                    {trendArrow(rookie.owned_trend)}
                  </div>

                  {/* Swappable stat columns */}
                  {activeStatColumns.map(col => {
                    const stats = rookie.stats;
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

                  {/* NFL team */}
                  <div className="player-row__nfl-team">
                    {rookie.nfl_team ? (
                      <img
                        src={`https://sleepercdn.com/images/team_logos/nfl/${rookie.nfl_team?.toLowerCase()}.jpg`}
                        alt={rookie.nfl_team}
                        className="nfl-team-logo"
                        onError={e => { e.target.replaceWith(Object.assign(document.createElement('span'), { textContent: rookie.nfl_team, style: 'font-size:11px;color:var(--draft-text-muted)' })); }}
                      />
                    ) : '—'}
                  </div>

                  {/* College */}
                  <div className="player-row__college">{rookie.college || '—'}</div>

                  {/* Draft action */}
                  <div className="player-row__action">
                    {canPick && (
                      <button
                        className="draft-btn"
                        onClick={() => onPick(rookie)}
                        disabled={submitting}
                      >
                        {submitting ? '...' : 'DRAFT'}
                      </button>
                    )}
                    {!canPick && draftOpen && (
                      <span className="draft-btn draft-btn--locked">
                        {currentPick?.current_team}'S PICK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}