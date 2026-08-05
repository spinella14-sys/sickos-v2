#!/usr/bin/env python3
"""
Patch — Convert week-matchups strip into a real fixed sidebar + add records
1. Replaces the top-of-page strip with a proper right-edge fixed sidebar
   (toggle tab, slides in/out) — matches what was actually asked for.
2. Adds each team's W-L record (from /api/matchups/standings) next to
   their abbrev in the sidebar.

Run from ~/Downloads/sickos-v2
    python3 patch_sidebar_rebuild.py
"""
import sys
from pathlib import Path

MATCHUP_PAGE = Path.cwd() / "src" / "pages" / "MatchupPage.jsx"
MATCHUP_CSS  = Path.cwd() / "src" / "pages" / "MatchupPage.css"


def apply_patch(path, old, new, label):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        print("--- expected old_str ---")
        print(old)
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


# ═══════════════════════════════════════════════════════════════════════
# 1. Replace WeekMatchupsStrip entirely with WeekMatchupsSidebar
# ═══════════════════════════════════════════════════════════════════════
OLD_COMPONENT = """// Collapsible strip: every matchup for the week, real score + real PROJ,
// click any other matchup to jump to its box score.
function WeekMatchupsStrip({ season, week, currentMatchupId }) {
  const navigate = useNavigate()
  const [matchups, setMatchups] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!season || !week) return
    fetch(`${API_BASE}/matchups?season=${season}&week=${week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMatchups(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [season, week])

  if (!matchups.length) return null

  return (
    <div className="mp-week-strip">
      <button className="mp-week-strip-toggle" onClick={() => setOpen(o => !o)}>
        <span>Week {week} Matchups</span>
        <span className="mp-week-strip-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mp-week-strip-list">
          {matchups.map(m => {
            const isCurrent = m.id === currentMatchupId
            const statusLabel = m.status === 'final' ? 'FINAL' : m.status === 'in_progress' ? 'LIVE' : ''
            return (
              <div
                key={m.id}
                className={`mp-week-strip-item ${isCurrent ? 'mp-week-strip-item--current' : ''}`}
                onClick={() => !isCurrent && navigate(`/matchup/${m.id}`)}
              >
                <div className="mp-week-strip-team">
                  <img src={LOGOS[m.home_team]} alt="" className="mp-week-strip-logo" onError={e => e.target.style.opacity = 0} />
                  <span className="mp-week-strip-abbrev">{m.home_team}</span>
                  <span className="mp-week-strip-score">{(m.home_score || 0).toFixed(1)}</span>
                  <span className="mp-week-strip-proj">P {(m.home_proj || 0).toFixed(1)}</span>
                </div>
                <span className="mp-week-strip-status">{statusLabel}</span>
                <div className="mp-week-strip-team mp-week-strip-team--away">
                  <span className="mp-week-strip-proj">P {(m.away_proj || 0).toFixed(1)}</span>
                  <span className="mp-week-strip-score">{(m.away_score || 0).toFixed(1)}</span>
                  <span className="mp-week-strip-abbrev">{m.away_team}</span>
                  <img src={LOGOS[m.away_team]} alt="" className="mp-week-strip-logo" onError={e => e.target.style.opacity = 0} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}"""

NEW_COMPONENT = """// Fixed right-edge sidebar: every matchup for the week, real score + PROJ +
// team record, click any other matchup to jump to its box score.
function WeekMatchupsSidebar({ season, week, currentMatchupId }) {
  const navigate = useNavigate()
  const [matchups, setMatchups] = useState([])
  const [records, setRecords]   = useState({})
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!season || !week) return
    fetch(`${API_BASE}/matchups?season=${season}&week=${week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMatchups(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch(`${API_BASE}/matchups/standings?season=${season}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const map = {}
        ;(Array.isArray(data) ? data : []).forEach(t => { map[t.team] = t })
        setRecords(map)
      })
      .catch(() => {})
  }, [season, week])

  if (!matchups.length) return null

  const recordFor = (abbrev) => {
    const r = records[abbrev]
    return r ? `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}` : '0-0'
  }

  return (
    <>
      <button className={`mp-sidebar-tab ${open ? 'mp-sidebar-tab--open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="mp-sidebar-tab-label">Week {week}</span>
        <span className="mp-sidebar-tab-arrow">{open ? '›' : '‹'}</span>
      </button>
      <div className={`mp-sidebar ${open ? 'mp-sidebar--open' : ''}`}>
        <div className="mp-sidebar-header">Week {week} Matchups</div>
        <div className="mp-sidebar-list">
          {matchups.map(m => {
            const isCurrent = m.id === currentMatchupId
            const statusLabel = m.status === 'final' ? 'FINAL' : m.status === 'in_progress' ? 'LIVE' : ''
            return (
              <div
                key={m.id}
                className={`mp-sidebar-card ${isCurrent ? 'mp-sidebar-card--current' : ''}`}
                onClick={() => !isCurrent && navigate(`/matchup/${m.id}`)}
              >
                {statusLabel && <div className="mp-sidebar-card-status">{statusLabel}</div>}
                <div className="mp-sidebar-row">
                  <img src={LOGOS[m.home_team]} alt="" className="mp-sidebar-logo" onError={e => e.target.style.opacity = 0} />
                  <div className="mp-sidebar-team-info">
                    <span className="mp-sidebar-abbrev">{m.home_team}</span>
                    <span className="mp-sidebar-record">{recordFor(m.home_team)}</span>
                  </div>
                  <div className="mp-sidebar-nums">
                    <span className="mp-sidebar-score">{(m.home_score || 0).toFixed(1)}</span>
                    <span className="mp-sidebar-proj">PROJ {(m.home_proj || 0).toFixed(1)}</span>
                  </div>
                </div>
                <div className="mp-sidebar-row">
                  <img src={LOGOS[m.away_team]} alt="" className="mp-sidebar-logo" onError={e => e.target.style.opacity = 0} />
                  <div className="mp-sidebar-team-info">
                    <span className="mp-sidebar-abbrev">{m.away_team}</span>
                    <span className="mp-sidebar-record">{recordFor(m.away_team)}</span>
                  </div>
                  <div className="mp-sidebar-nums">
                    <span className="mp-sidebar-score">{(m.away_score || 0).toFixed(1)}</span>
                    <span className="mp-sidebar-proj">PROJ {(m.away_proj || 0).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}"""

RENDER_OLD = "      <WeekMatchupsStrip season={matchup.season} week={matchup.week} currentMatchupId={matchup.id} />"
RENDER_NEW = "      <WeekMatchupsSidebar season={matchup.season} week={matchup.week} currentMatchupId={matchup.id} />"

# ═══════════════════════════════════════════════════════════════════════
# 2. CSS — remove old strip CSS, add sidebar CSS
# ═══════════════════════════════════════════════════════════════════════
OLD_CSS = """/* Week matchups strip (collapsible) */
.mp-week-strip { margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg1); overflow: hidden; }
.mp-week-strip-toggle {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: none; border: none; cursor: pointer;
  font-family: var(--font-ui); font-size: 12px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-muted);
}
.mp-week-strip-arrow { font-size: 10px; }
.mp-week-strip-list { border-top: 1px solid var(--border); }
.mp-week-strip-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; gap: 10px; border-bottom: 1px solid var(--border); cursor: pointer;
  transition: background 0.12s;
}
.mp-week-strip-item:last-child { border-bottom: none; }
.mp-week-strip-item:hover { background: var(--bg2); }
.mp-week-strip-item--current { background: rgba(232,130,42,0.06); cursor: default; }
.mp-week-strip-team { display: flex; align-items: center; gap: 6px; flex: 1; }
.mp-week-strip-team--away { justify-content: flex-end; }
.mp-week-strip-logo { width: 20px; height: 20px; border-radius: 3px; object-fit: cover; }
.mp-week-strip-abbrev { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-primary); }
.mp-week-strip-score { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text-primary); min-width: 32px; text-align: center; }
.mp-week-strip-proj { font-family: var(--font-ui); font-size: 9px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.03em; }
.mp-week-strip-status { font-family: var(--font-ui); font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: var(--orange); min-width: 34px; text-align: center; }"""

NEW_CSS = """
/* Week matchups sidebar (fixed, slides in from the right) */
.mp-sidebar-tab {
  position: fixed; top: 50%; right: 0; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: var(--bg1); border: 1px solid var(--border); border-right: none;
  border-radius: 8px 0 0 8px; padding: 12px 6px; cursor: pointer; z-index: 40;
  transition: right 0.2s ease;
}
.mp-sidebar-tab--open { right: 280px; }
.mp-sidebar-tab-label {
  writing-mode: vertical-rl; font-family: var(--font-ui); font-size: 11px;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
}
.mp-sidebar-tab-arrow { font-size: 14px; color: var(--text-muted); }

.mp-sidebar {
  position: fixed; top: 0; right: -280px; width: 280px; height: 100vh;
  background: var(--bg1); border-left: 1px solid var(--border);
  overflow-y: auto; z-index: 39; transition: right 0.2s ease;
}
.mp-sidebar--open { right: 0; }
.mp-sidebar-header {
  padding: 16px 14px 10px; font-family: var(--font-ui); font-size: 12px;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.mp-sidebar-list { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.mp-sidebar-card {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
  cursor: pointer; transition: background 0.12s; position: relative;
}
.mp-sidebar-card:hover { background: var(--bg2); }
.mp-sidebar-card--current { background: rgba(232,130,42,0.06); cursor: default; border-color: var(--orange); }
.mp-sidebar-card-status {
  position: absolute; top: 6px; right: 8px; font-family: var(--font-ui); font-size: 8px;
  font-weight: 800; letter-spacing: 0.08em; color: var(--orange);
}
.mp-sidebar-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.mp-sidebar-logo { width: 22px; height: 22px; border-radius: 3px; object-fit: cover; flex-shrink: 0; }
.mp-sidebar-team-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.mp-sidebar-abbrev { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-primary); }
.mp-sidebar-record { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); }
.mp-sidebar-nums { display: flex; flex-direction: column; align-items: flex-end; }
.mp-sidebar-score { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text-primary); }
.mp-sidebar-proj { font-family: var(--font-ui); font-size: 8px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.03em; }
"""


def main():
    apply_patch(MATCHUP_PAGE, OLD_COMPONENT, NEW_COMPONENT, "replace strip component with sidebar")
    apply_patch(MATCHUP_PAGE, RENDER_OLD, RENDER_NEW, "render WeekMatchupsSidebar")

    css_text = MATCHUP_CSS.read_text()
    if OLD_CSS not in css_text:
        print("FAILED — old strip CSS not found, aborting to avoid a partial state")
        sys.exit(1)
    css_text = css_text.replace(OLD_CSS, "").rstrip()
    css_text = css_text + "\n" + NEW_CSS
    MATCHUP_CSS.write_text(css_text)
    print("OK — replaced strip CSS with sidebar CSS")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
