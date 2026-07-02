import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

export default function TeamPanel({ viewingTeam, setViewingTeam, teams, currentTeam, getTeamName, getTeamLogo }) {
  const [teamData,       setTeamData]       = useState(null);
  const [draftedByTeam,  setDraftedByTeam]  = useState([]);

  useEffect(() => {
    if (!viewingTeam) return;

    fetch(`${API_BASE}/api/teams/${viewingTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTeamData(d); })
      .catch(() => {});

    fetch(`${API_BASE}/api/draft/picks`)
      .then(r => r.ok ? r.json() : [])
      .then(picks => {
        setDraftedByTeam(
          picks.filter(p => p.current_team === viewingTeam && p.status === 'completed')
        );
      })
      .catch(() => {});
  }, [viewingTeam]);

  // Upcoming picks this team still holds
  const upcomingPicks = (teamData && []) || [];

  const POS_ORDER = ['QB', 'RB', 'WR', 'TE'];
  const POS_MAX   = { QB: 3, RB: 5, WR: 5, TE: 3 };

  return (
    <aside className="team-panel">
      <div className="team-panel__selector">
        <select
          value={viewingTeam}
          onChange={e => setViewingTeam(e.target.value)}
          className="team-panel__select"
        >
          {teams.map(t => (
            <option key={t.abbrev} value={t.abbrev}>
              {t.name}{t.abbrev === currentTeam ? ' (You)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="team-panel__identity">
        <img
          src={getTeamLogo(viewingTeam)}
          alt={getTeamName(viewingTeam)}
          className="team-panel__logo"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="team-panel__name">{getTeamName(viewingTeam)}</div>
        {viewingTeam === currentTeam && (
          <span className="team-panel__your-team">YOUR TEAM</span>
        )}
      </div>

      {teamData && (
        <div className="team-panel__cap">
          <div className="team-panel__section-title">CAP SNAPSHOT</div>
          <div className="cap-row">
            <span>Cap Space</span>
            <span className="amber">${(teamData.cap_space ?? 0).toFixed(2)}</span>
          </div>
          <div className="cap-row">
            <span>Cap Used</span>
            <span>${(teamData.cap_used ?? 0).toFixed(2)}</span>
          </div>
          <div className="cap-row">
            <span>Hard Cap</span>
            <span>${(teamData.hard_cap ?? 138).toFixed(2)}</span>
          </div>
          <div className="cap-bar">
            <div
              className="cap-bar__fill"
              style={{
                width: `${Math.min(100, ((teamData.cap_used || 0) / (teamData.hard_cap || 138)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {teamData?.roster && (
        <div className="team-panel__roster-counts">
          <div className="team-panel__section-title">ROSTER SPOTS</div>
          {POS_ORDER.map(pos => {
            // FIX: players are nested under .players in the API response
            const count = teamData.roster.filter(p =>
              (p.players?.position || p.position) === pos
            ).length;
            const max = POS_MAX[pos] || 5;
            return (
              <div key={pos} className="roster-count-row">
                <span className={`pos-badge pos-badge--${pos}`}>{pos}</span>
                <div className="roster-count-bar">
                  {Array.from({ length: max }).map((_, i) => (
                    <div
                      key={i}
                      className={`roster-pip ${i < count ? 'roster-pip--filled' : ''}`}
                    />
                  ))}
                </div>
                <span className="roster-count-num">{count}</span>
              </div>
            );
          })}
          <div className="roster-count-row roster-count-total">
            <span>TOTAL</span>
            <span>{teamData.roster.length} / 17</span>
          </div>
        </div>
      )}

      {draftedByTeam.length > 0 && (
        <div className="team-panel__draft-picks">
          <div className="team-panel__section-title">PICKS MADE</div>
          {draftedByTeam.map(pick => (
            <div key={pick.overall_pick} className="draft-pick-row">
              <span className="draft-pick-row__slot">
                {pick.round}.{String(pick.pick_in_round).padStart(2, '0')}
              </span>
              <span className="draft-pick-row__player">{pick.player_name}</span>
              {pick.auto_picked && (
                <span className="draft-pick-row__auto">AUTO</span>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
