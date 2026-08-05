#!/usr/bin/env python3
"""
Patch — Week matchups strip (Stage 3 finale)
Collapsible strip at the top of the box score showing every matchup that
week — team, real score, and real PROJ total (sourced from the newly
computed matchups.home_proj/away_proj). Click any other matchup to jump
to its box score.

Run from ~/Downloads/sickos-v2
    python3 patch_week_matchups_strip.py
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
# 1. New WeekMatchupsStrip component — insert after BenchPlayerRow
# ═══════════════════════════════════════════════════════════════════════
ANCHOR_OLD = """  return (
    <div className={`mp-bench-player ${isRight ? 'mp-bench-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{pts}{info}{headshot}</> : <>{headshot}{info}{pts}</>}
    </div>
  )
}"""
ANCHOR_NEW = """  return (
    <div className={`mp-bench-player ${isRight ? 'mp-bench-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{pts}{info}{headshot}</> : <>{headshot}{info}{pts}</>}
    </div>
  )
}

// Collapsible strip: every matchup for the week, real score + real PROJ,
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

# ═══════════════════════════════════════════════════════════════════════
# 2. Render it at the top of the page
# ═══════════════════════════════════════════════════════════════════════
ROOT_OLD = """  return (
    <div className="mp-root">

      {/* ── Scoreboard header ── */}"""
ROOT_NEW = """  return (
    <div className="mp-root">

      <WeekMatchupsStrip season={matchup.season} week={matchup.week} currentMatchupId={matchup.id} />

      {/* ── Scoreboard header ── */}"""


def main():
    apply_patch(MATCHUP_PAGE, ANCHOR_OLD, ANCHOR_NEW, "add WeekMatchupsStrip component")
    apply_patch(MATCHUP_PAGE, ROOT_OLD, ROOT_NEW, "render WeekMatchupsStrip at top of page")

    css_text = MATCHUP_CSS.read_text()
    new_css = """
/* Week matchups strip (collapsible) */
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
.mp-week-strip-status { font-family: var(--font-ui); font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: var(--orange); min-width: 34px; text-align: center; }
"""
    MATCHUP_CSS.write_text(css_text.rstrip() + "\n" + new_css)
    print("OK — appended week-strip CSS")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
