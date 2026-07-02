import { useNavigate } from 'react-router-dom';

const TIER_NAMES = { 1: 'Tier 1 — Premium ($18+)', 2: 'Tier 2 — Mid-Range ($9.60+)', 3: 'Tier 3 — Open Market' };
const TIER_MINS  = { 1: '$18.00', 2: '$9.60', 3: '$2.40' };
const WAVE_IN_TIER = (wave) => ((wave - 1) % 3) + 1;
const TIER_FOR_WAVE = (wave) => wave <= 3 ? 1 : wave <= 6 ? 2 : 3;

function formatTime(s) {
  if (s === null || s === undefined) return '--:--:--';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function getUrgency(s) {
  if (!s && s !== 0) return '';
  if (s < 300) return 'urgent';
  if (s < 600) return 'warning';
  return '';
}

export default function UFAHero({ ufaState, timeLeft, currentTeam, bidsThisWave }) {
  const navigate = useNavigate();
  const wave   = ufaState?.current_wave || 1;
  const tier   = TIER_FOR_WAVE(wave);
  const status = ufaState?.status;
  const isOpen = status === 'wave_open';
  const urgency = getUrgency(timeLeft);

  return (
    <div className="rfa-hero">
      {/* Left: Wave + tier info */}
      <div className="rfa-hero__wave">
        <span className="rfa-hero__wave-label">UFA Draft — 2026 · Wave {wave} of 9</span>
        <span className="rfa-hero__wave-name">{TIER_NAMES[tier]}</span>
        <span style={{ fontSize: 10, color: 'var(--draft-text-muted)' }}>
          Wave {WAVE_IN_TIER(wave)} of 3 in this tier · Min offer: {TIER_MINS[tier]}
        </span>
      </div>

      {/* Center: Clock */}
      <div className="rfa-hero__center">
        <div className="rfa-hero__status">
          {status === 'pre_ufa'   && 'WAVE NOT YET OPEN'}
          {status === 'wave_open' && 'WAVE OPEN — SUBMIT BIDS'}
          {status === 'paused'    && 'WAVE PAUSED'}
          {status === 'completed' && 'UFA PERIOD COMPLETE'}
        </div>
        <div className={`rfa-hero__clock ${urgency}`}>
          {isOpen ? formatTime(timeLeft) : '--:--:--'}
        </div>
        <div className="rfa-hero__clock-label">TIME REMAINING IN WAVE</div>
      </div>

      {/* Right: Bids remaining + trade machine */}
      <div className="rfa-hero__actions">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--draft-surface-2)', border: '1px solid var(--draft-border)',
          borderRadius: 8, padding: '8px 16px', gap: 2,
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: Math.max(0, 3 - bidsThisWave) === 0 ? 'var(--draft-red)' : 'var(--draft-amber)' }}>
            {Math.max(0, 3 - bidsThisWave)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--draft-text-muted)', letterSpacing: '0.08em' }}>
            BIDS LEFT
          </span>
        </div>
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
