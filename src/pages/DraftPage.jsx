import { TEAMS, LOGOS } from '../data/league'
import './SimplePages.css'

function TeamLogo({ abbrev, size = 22 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }} loading="lazy" />
}

export default function DraftPage() {
  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Draft Central</h1>
        <p className="sp-sub">Dynasty draft records · 2026 Draft coming July</p>
      </div>
      <div className="sp-content">
        <div className="draft-years">
          {[2026, 2025, 2024, 2023].map(y => (
            <button key={y} className={`draft-year-btn ${y === 2026 ? 'draft-year-btn--active' : ''}`}>{y}</button>
          ))}
        </div>
        <div className="draft-table">
          <div className="draft-row draft-row--header">
            <span>Pick</span><span>Team</span><span>Player</span><span>Position</span>
          </div>
          {TEAMS.map((t, i) => (
            <div key={t.abbrev} className="draft-row">
              <span className="draft-pick">1.{String(i+1).padStart(2,'0')}</span>
              <span className="draft-team"><TeamLogo abbrev={t.abbrev} size={22} />{t.name}</span>
              <span className="draft-player">—</span>
              <span className="draft-pos">—</span>
            </div>
          ))}
        </div>
        <div className="sp-note">2026 Draft board and historical picks will be built in the Draft Central update</div>
      </div>
    </div>
  )
}
