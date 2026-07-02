import { TRANSACTIONS, TEAMS, LOGOS } from '../data/league'
import './SimplePages.css'

function TeamLogo({ abbrev, size = 24 }) {
  const url = LOGOS[abbrev]
  if (!url) return <span className="sp-logo-ph" style={{ width: size, height: size }} />
  return <img src={url} alt={abbrev} style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }} loading="lazy" />
}

export function TransactionsPage() {
  const typeColor = { trade: 'var(--blue)', signing: 'var(--green)', release: 'var(--red)' }

  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Transaction Wire</h1>
        <p className="sp-sub">Full league activity log · 2025 Season</p>
      </div>
      <div className="sp-content">
        <div className="txn-full-list">
          {TRANSACTIONS.map(txn => (
            <div key={txn.id} className="txn-full-row">
              <div className="txn-full-date">{txn.date}</div>
              <span
                className="txn-full-type"
                style={{ borderColor: typeColor[txn.type], color: typeColor[txn.type] }}
              >
                {txn.type}
              </span>
              <div className="txn-full-body">
                <div className="txn-full-desc">{txn.desc}</div>
                <div className="txn-full-teams">
                  {txn.teams.map(a => {
                    const t = TEAMS.find(x => x.abbrev === a)
                    return (
                      <span key={a} className="txn-full-team">
                        <TeamLogo abbrev={a} size={18} />
                        {t?.name || a}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="sp-note">
          Full transaction history will be populated from Fantrax export in Drop 2
        </div>
      </div>
    </div>
  )
}

export function DraftPage() {
  const rounds = Array.from({ length: 16 }, (_, i) => ({
    pick: i + 1,
    round: 1,
    team: TEAMS[i],
    player: '—',
    pos: '—',
  }))

  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Draft History</h1>
        <p className="sp-sub">Dynasty draft records by year</p>
      </div>
      <div className="sp-content">
        <div className="draft-placeholder">
          <div className="draft-years">
            {[2025, 2024, 2023, 2022].map(y => (
              <button key={y} className={`draft-year-btn ${y === 2025 ? 'draft-year-btn--active' : ''}`}>{y}</button>
            ))}
          </div>
          <div className="draft-table">
            <div className="draft-row draft-row--header">
              <span>Pick</span><span>Team</span><span>Player</span><span>Position</span>
            </div>
            {rounds.map(r => (
              <div key={r.pick} className="draft-row">
                <span className="draft-pick">1.{String(r.pick).padStart(2,'0')}</span>
                <span className="draft-team">
                  <TeamLogo abbrev={r.team?.abbrev} size={22} />
                  {r.team?.name}
                </span>
                <span className="draft-player">{r.player}</span>
                <span className="draft-pos">{r.pos}</span>
              </div>
            ))}
          </div>
          <div className="sp-note">Draft history will be imported from Fantrax in Drop 2</div>
        </div>
      </div>
    </div>
  )
}

export function RulesPage() {
  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">League Rules</h1>
        <p className="sp-sub">Sickos Only Dynasty · Bylaws & Scoring</p>
      </div>
      <div className="sp-content">
        <div className="rules-grid">
          <div className="rules-card">
            <div className="rules-card-title">Roster & Lineup</div>
            <ul className="rules-list">
              <li>16 teams, dynasty format</li>
              <li>Lineup: 1 QB · 2 RB · 3 WR · 1 TE · 1 FLEX (RB/WR/TE)</li>
              <li>No bench limit (dynasty roster)</li>
            </ul>
          </div>
          <div className="rules-card">
            <div className="rules-card-title">Salary Cap</div>
            <ul className="rules-list">
              <li>Hard Cap: $126.5M</li>
              <li>Luxury Tax Line: $110M</li>
              <li>Minimum Salary: $2.2M</li>
              <li>QB Max: $24.44M</li>
              <li>Non-QB Max: $20M</li>
            </ul>
          </div>
          <div className="rules-card">
            <div className="rules-card-title">Passing Scoring</div>
            <ul className="rules-list">
              <li>Passing Yards: 0.06 / yd</li>
              <li>Completion: +1.0</li>
              <li>Passing TD: +10</li>
              <li>Interception: -5</li>
              <li>Sack: -1</li>
              <li>2-pt Conversion: +2</li>
            </ul>
          </div>
          <div className="rules-card">
            <div className="rules-card-title">Rushing Scoring</div>
            <ul className="rules-list">
              <li>Rushing Yards: 0.4 / yd</li>
              <li>Rushing TD: +10</li>
              <li>2-pt Conversion: +2</li>
              <li>Fumble Lost: -2</li>
            </ul>
          </div>
          <div className="rules-card">
            <div className="rules-card-title">Receiving Scoring</div>
            <ul className="rules-list">
              <li>Reception (all): +1.0</li>
              <li>QB/RB Rec Yards: 0.2 / yd</li>
              <li>WR/TE Rec Yards: 0.3 / yd</li>
              <li>Receiving TD: +10</li>
              <li>2-pt Conversion: +2</li>
            </ul>
          </div>
          <div className="rules-card">
            <div className="rules-card-title">Transactions</div>
            <ul className="rules-list">
              <li>FA bids submitted via TSF form</li>
              <li>Commissioner processes weekly</li>
              <li>Trades require both managers</li>
              <li>Trades close Week 14</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminPage() {
  return (
    <div className="sp-root">
      <div className="sp-header">
        <h1 className="sp-title">Admin Panel</h1>
        <p className="sp-sub">Commissioner tools · Password protected in Drop 2</p>
      </div>
      <div className="sp-content">
        <div className="admin-grid">
          {[
            { label: 'Process Transaction', desc: 'Add/drop/trade players, update cap', icon: '🔄' },
            { label: 'Update Scores',        desc: 'Sync weekly scoring from Sleeper',  icon: '📊' },
            { label: 'Manage Rosters',       desc: 'Edit roster slots and contracts',   icon: '📋' },
            { label: 'Season Settings',      desc: 'Advance week, manage playoffs',     icon: '⚙️' },
            { label: 'Import from Fantrax',  desc: 'Migrate historical data',           icon: '📥' },
            { label: 'Export Data',          desc: 'Download full league snapshot',     icon: '📤' },
          ].map(a => (
            <div key={a.label} className="admin-card">
              <span className="admin-icon">{a.icon}</span>
              <div className="admin-label">{a.label}</div>
              <div className="admin-desc">{a.desc}</div>
              <button className="admin-btn">Configure in Drop 2</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TransactionsPage
