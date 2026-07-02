import { useState, useMemo } from 'react';
import PlayerLink from '../../components/PlayerCard/PlayerLink';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

const SORT_OPTIONS = [
  { key: 'nfl_draft_pick', label: 'Big Board / NFL Draft' },
  { key: 'percent_owned',  label: '% Owned'              },
  { key: 'position',       label: 'Position'              },
  { key: 'full_name',      label: 'Name'                  },
];

export default function PlayerBoard({
  rookies,
  allPicks,
  currentPick,
  isMyPick,
  submitting,
  onPick,
  currentTeam,
  ownership = {},   // { sleeper_id: pct_owned }
}) {
  const [search,        setSearch]        = useState('');
  const [posFilter,     setPosFilter]     = useState('ALL');
  const [sortKey,       setSortKey]       = useState('nfl_draft_pick');
  const [sortAsc,       setSortAsc]       = useState(true);
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  const filtered = useMemo(() => {
    let list = rookies.map(r => ({
      ...r,
      percent_owned: ownership[r.sleeper_id] ?? 0,
    }));

    if (posFilter !== 'ALL') {
      list = list.filter(r => r.position === posFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        (r.college || '').toLowerCase().includes(q) ||
        (r.nfl_team || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'nfl_draft_pick' || sortKey === 'percent_owned') {
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return sortAsc ? va - vb : vb - va;
      }
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return list;
  }, [rookies, posFilter, search, sortKey, sortAsc, ownership]);

  const canPick  = isMyPick && currentPick?.status === 'on_clock' && !submitting;
  const draftOpen = currentPick?.status === 'on_clock';

  return (
    <main className="player-board">
      <div className="player-board__header">
        <div className="player-board__count">
          SHOWING <span className="amber">{filtered.length}</span> OF{' '}
          <span className="amber">{rookies.length}</span> AVAILABLE PROSPECTS
        </div>
        <div className="player-board__filters">
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
            onChange={e => { setSortKey(e.target.value); setSortAsc(sortKey === 'percent_owned' ? false : true); }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Column headers — 7 cols: rank | player | pos | nfl team | college | % own | action */}
      <div className="player-board__col-headers" style={{
        gridTemplateColumns: '80px 1fr 60px 80px 100px 70px 90px'
      }}>
        <span>RANK</span>
        <span>PLAYER</span>
        <span>POS</span>
        <span>NFL TEAM</span>
        <span>COLLEGE</span>
        <span>% OWN</span>
        <span />
      </div>

      <div className="player-board__list">
        {filtered.length === 0 && (
          <div className="player-board__empty">No players match your filters</div>
        )}
        {filtered.map(rookie => {
          const isHovered = hoveredPlayer === rookie.sleeper_id;
          return (
            <div
              key={rookie.sleeper_id}
              className={`player-row ${isHovered ? 'player-row--hovered' : ''}`}
              style={{ gridTemplateColumns: '80px 1fr 60px 80px 100px 70px 90px' }}
              onMouseEnter={() => setHoveredPlayer(rookie.sleeper_id)}
              onMouseLeave={() => setHoveredPlayer(null)}
            >
              {/* NFL Draft rank */}
              <div className="player-row__rank">
                {rookie.nfl_draft_pick ? (
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

              {/* % Owned */}
              <div className="player-row__owned">
                {rookie.percent_owned > 0
                  ? <span style={{ color: rookie.percent_owned >= 50 ? 'var(--draft-amber)' : 'var(--draft-text-muted)', fontWeight: rookie.percent_owned >= 50 ? 700 : 400 }}>
                      {rookie.percent_owned.toFixed(0)}%
                    </span>
                  : <span style={{ color: 'var(--draft-text-muted)' }}>—</span>
                }
              </div>

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
    </main>
  );
}
