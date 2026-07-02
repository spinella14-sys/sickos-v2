import { useNavigate } from 'react-router-dom';

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getClockUrgency(seconds) {
  if (seconds === null) return '';
  if (seconds < 3600) return 'urgent';
  if (seconds < 7200) return 'warning';
  return '';
}

export default function DraftHero({ currentPick, timeLeft, isMyPick, draftState, getTeamName, getTeamLogo }) {
  const navigate = useNavigate();

  if (!currentPick || !draftState) {
    return (
      <div className="draft-hero draft-hero--pre">
        <div className="draft-hero__status">
          {draftState?.status === 'pre_draft' ? 'Draft has not started yet' : 'Draft complete'}
        </div>
      </div>
    );
  }

  const urgency = getClockUrgency(timeLeft);
  const teamName = getTeamName(currentPick.current_team);
  const teamLogo = getTeamLogo(currentPick.current_team);

  return (
    <div className={`draft-hero ${isMyPick ? 'draft-hero--your-pick' : ''}`}>
      <div className="draft-hero__team">
        <div className="draft-hero__team-logo">
          <img
            src={teamLogo}
            alt={teamName}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
        <div className="draft-hero__team-info">
          <span className="draft-hero__team-name">{teamName}</span>
          {isMyPick && <span className="draft-hero__your-pick-badge">YOUR PICK</span>}
        </div>
      </div>

      <div className="draft-hero__center">
        <div className="draft-hero__pick-label">
          ROUND {currentPick.round} · PICK {currentPick.pick_in_round}
          <span className="draft-hero__overall"> (#{currentPick.overall_pick} overall)</span>
        </div>
        <div className={`draft-hero__clock ${urgency}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="draft-hero__clock-label">TIME REMAINING</div>
      </div>

      <div className="draft-hero__actions">
        <button
          className="draft-hero__trade-btn"
          onClick={() => navigate('/trade-machine')}
          title="Trade Machine (coming soon)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
          <span className="draft-hero__trade-badge">SOON</span>
        </button>
      </div>
    </div>
  );
}