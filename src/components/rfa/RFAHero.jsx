import { useNavigate } from 'react-router-dom';

const WAVE_NAMES = {
  1: 'Wave 1 — Retention Tags',
  2: 'Wave 2 — Max Offers',
  3: 'Wave 3 — $3 Above R1 Min',
  4: 'Wave 4 — R1 Minimum',
  5: 'Wave 5 — R2 Minimum',
};

const WAVE_DESCRIPTIONS = {
  1: 'Tag your own RFAs to retain their rights',
  2: 'Offers must touch the max at some point',
  3: 'Y1 salary must exceed $16.33',
  4: 'Y1 salary must exceed $13.33',
  5: 'Y1 salary must exceed $8.00',
};

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getClockUrgency(seconds) {
  if (seconds === null) return '';
  if (seconds < 300) return 'urgent';
  if (seconds < 600) return 'warning';
  return '';
}

export default function RFAHero({
  rfaState, timeLeft, matchWindows, currentTeam,
  getTeamName, getTeamLogo, isCommissioner, onRefresh,
}) {
  const navigate = useNavigate();

  const wave = rfaState?.current_wave || 1;
  const status = rfaState?.status;
  const urgency = getClockUrgency(timeLeft);
  const hasMatchWindows = matchWindows?.length > 0;

  return (
    <div className="rfa-hero">
      {/* Left: Wave info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">RFA Draft — 2026</span>
        <span className="rfa-hero__wave-name">{WAVE_NAMES[wave]}</span>
        <span style={{ fontSize: '10px', color: 'var(--draft-text-muted)' }}>
          {WAVE_DESCRIPTIONS[wave]}
        </span>
      </div>

      {/* Center: Clock */}
      <div className="rfa-hero__center">
        <div className="rfa-hero__status">
          {status === 'pre_rfa' && 'WAVE NOT YET OPEN'}
          {status === 'wave_open' && 'WAVE OPEN — ACCEPTING BIDS'}
          {status === 'completed' && 'RFA PERIOD COMPLETE'}
        </div>
        <div className={`rfa-hero__clock ${urgency}`}>
          {status === 'wave_open' ? formatTime(timeLeft) : '--:--:--'}
        </div>
        <div className="rfa-hero__clock-label">TIME REMAINING IN WAVE</div>
      </div>

      {/* Right: Actions */}
      <div className="rfa-hero__actions">
        {hasMatchWindows && (
          <div className="rfa-hero__match-alert">
            ⚠ {matchWindows.length} MATCH DECISION{matchWindows.length > 1 ? 'S' : ''} PENDING
          </div>
        )}
        <button
          className="rfa-hero__trade-btn"
          onClick={() => navigate('/trade-machine')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          TRADE MACHINE
          <span className="rfa-hero__trade-badge">SOON</span>
        </button>
      </div>
    </div>
  );
}