#!/usr/bin/env python3
"""
Patch — Scoreboard Stage 2 (frontend half): PROJ + TOT always shown together
1. Each player row now shows a stacked TOT (live/final actual points) and
   PROJ (frozen once locked, live rolling estimate before that) instead of
   one number that silently means different things depending on game state.
2. projTotal() now correctly sources locked_proj_pts for locked players
   instead of always reading the live rolling projMap.
3. Bottom Totals row now shows real PROJ + TOT for both teams, always —
   covers Preview/During Play/Post Week with the same two numbers rather
   than one number wearing three different labels.
4. Removed the header's small "Proj:" badge — now redundant with the
   Totals row always showing both numbers.

Run from ~/Downloads/sickos-v2
    python3 patch_proj_tot_display.py
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
# 1. PlayerStatus — drop the PROJ branch (now lives in the pts block)
# ═══════════════════════════════════════════════════════════════════════
STATUS_OLD = """// Per-player game status indicator
function PlayerStatus({ player, projPts, isFinal, gameInfo }) {
  if (!player) return null

  const hasStats  = player.week_pts !== null
  const isLocked  = player.is_locked
  const onBye     = player.week_pts === null && !isLocked && player.bye_week != null

  if (onBye) {
    return <span className="mp-player-status mp-status-bye">BYE</span>
  }
  if (hasStats && isFinal) {
    return <span className="mp-player-status mp-status-final">FINAL</span>
  }
  if (hasStats && isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  if (!hasStats && isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  if (!hasStats && !isLocked) {
    const oppText = gameInfo?.opponent
      ? `${gameInfo.is_home ? 'vs' : '@'} ${gameInfo.opponent}${formatKickoff(gameInfo.game_date)}`
      : null
    if (projPts != null) {
      return (
        <span className="mp-player-status mp-status-proj">
          PROJ {projPts.toFixed(1)}{oppText ? ` · ${oppText}` : ''}
        </span>
      )
    }
    if (oppText) {
      return <span className="mp-player-status mp-status-upcoming">{oppText}</span>
    }
    return <span className="mp-player-status mp-status-upcoming">UPCOMING</span>
  }
  return null
}"""

STATUS_NEW = """// Per-player game status indicator — informational only; the PROJ/TOT
// numbers themselves live in the dedicated pts block next to each player.
function PlayerStatus({ player, isFinal, gameInfo }) {
  if (!player) return null

  const hasStats  = player.week_pts !== null
  const isLocked  = player.is_locked
  const onBye     = player.week_pts === null && !isLocked && player.bye_week != null

  if (onBye) {
    return <span className="mp-player-status mp-status-bye">BYE</span>
  }
  if (hasStats && isFinal) {
    return <span className="mp-player-status mp-status-final">FINAL</span>
  }
  if (isLocked) {
    return <span className="mp-player-status mp-status-playing">PLAYING</span>
  }
  const oppText = gameInfo?.opponent
    ? `${gameInfo.is_home ? 'vs' : '@'} ${gameInfo.opponent}${formatKickoff(gameInfo.game_date)}`
    : null
  return <span className="mp-player-status mp-status-upcoming">{oppText || 'UPCOMING'}</span>
}"""

# ═══════════════════════════════════════════════════════════════════════
# 2. PlayerCell — always show TOT + PROJ stacked, using locked value once
#    the player is locked, live rolling projMap value before that
# ═══════════════════════════════════════════════════════════════════════
CELL_OLD = """function PlayerCell({ player, side, projMap, opponentMap, isFinal }) {
  const isRight  = side === 'away'
  const projPts  = player ? (projMap[player.sleeper_id] ?? null) : null
  const gameInfo = player ? (opponentMap[player.nfl_team] ?? null) : null
  const pts      = player?.week_pts != null ? player.week_pts.toFixed(1) : null
  const hasPlayed = player?.week_pts !== null"""
CELL_NEW = """function PlayerCell({ player, side, projMap, opponentMap, isFinal }) {
  const isRight  = side === 'away'
  const gameInfo = player ? (opponentMap[player.nfl_team] ?? null) : null
  const hasPlayed = player?.week_pts !== null
  // PROJ: frozen at lock time (never changes again), live rolling estimate before that
  const projVal = player
    ? (player.is_locked ? player.locked_proj_pts : (projMap[player.sleeper_id] ?? null))
    : null
  const projDisplay = projVal != null ? projVal.toFixed(1) : '—'"""

PTSEL_OLD = """  // When no actual stats yet, show projection dimly in place of points
  const displayPts = pts !== null ? pts : (projPts != null ? projPts.toFixed(1) : '—')
  const ptsClass   = pts !== null
    ? `mp-pts ${!hasPlayed ? 'mp-pts--zero' : ''}`
    : 'mp-pts mp-pts--proj'

  const ptsEl = (
    <span className={ptsClass}>{displayPts}</span>
  )"""
PTSEL_NEW = """  const totDisplay = player?.week_pts != null ? player.week_pts.toFixed(1) : '0.0'

  const ptsEl = (
    <div className="mp-pts-block">
      <span className={`mp-pts-tot ${!hasPlayed ? 'mp-pts-tot--zero' : ''}`}>{totDisplay}</span>
      <span className="mp-pts-proj">PROJ {projDisplay}</span>
    </div>
  )"""

STATUS_CALL_OLD = '      <PlayerStatus player={player} projPts={projPts} isFinal={isFinal} gameInfo={gameInfo} />'
STATUS_CALL_NEW = '      <PlayerStatus player={player} isFinal={isFinal} gameInfo={gameInfo} />'

# ═══════════════════════════════════════════════════════════════════════
# 3. projTotal — use locked_proj_pts for locked players, not live projMap
# ═══════════════════════════════════════════════════════════════════════
PROJTOTAL_OLD = """  // Projected totals (for upcoming starters)
  const projTotal = (lineup) =>
    lineup
      .filter(p => STARTER_SLOTS.has(p.slot_type))
      .reduce((s, p) => s + (p.week_pts ?? projMap[p.sleeper_id] ?? 0), 0)
      .toFixed(2)"""
PROJTOTAL_NEW = """  // Projected totals: frozen locked_proj_pts once a player is locked
  // (never recalculated after), live rolling projMap estimate before that.
  const projTotal = (lineup) =>
    lineup
      .filter(p => STARTER_SLOTS.has(p.slot_type))
      .reduce((s, p) => {
        const proj = p.is_locked ? (p.locked_proj_pts ?? 0) : (projMap[p.sleeper_id] ?? 0)
        return s + proj
      }, 0)
      .toFixed(2)"""

# ═══════════════════════════════════════════════════════════════════════
# 4. Remove redundant header "Proj:" badges
# ═══════════════════════════════════════════════════════════════════════
HOME_BADGE_OLD = """              <span className="mp-team-abbrev">{matchup.home_team}</span>
              {(isLive || !isFinal) && (
                <span className="mp-proj-score">Proj: {projTotal(matchup.home_lineup || [])}</span>
              )}"""
HOME_BADGE_NEW = '              <span className="mp-team-abbrev">{matchup.home_team}</span>'

AWAY_BADGE_OLD = """              <span className="mp-team-abbrev">{matchup.away_team}</span>
              {(isLive || !isFinal) && (
                <span className="mp-proj-score">Proj: {projTotal(matchup.away_lineup || [])}</span>
              )}"""
AWAY_BADGE_NEW = '              <span className="mp-team-abbrev">{matchup.away_team}</span>'

# ═══════════════════════════════════════════════════════════════════════
# 5. Bottom Totals row — real PROJ + TOT for both teams, always
# ═══════════════════════════════════════════════════════════════════════
TOTALS_OLD = """            {/* Totals */}
            <div className="mp-totals-row">
              <div className={`mp-total-score ${homeWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                {homeScore.toFixed(2)}
              </div>
              <div className="mp-totals-label">{isFinal ? 'FINAL' : isLive ? 'LIVE' : 'PROJECTED'}</div>
              <div className={`mp-total-score mp-total-score--right ${awayWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                {awayScore.toFixed(2)}
              </div>
            </div>"""
TOTALS_NEW = """            {/* Totals — real PROJ + TOT always shown together */}
            <div className="mp-totals-row">
              <div className="mp-totals-side">
                <div className={`mp-total-score ${homeWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                  {homeScore.toFixed(2)}
                </div>
                <div className="mp-total-proj">PROJ {projTotal(matchup.home_lineup || [])}</div>
              </div>
              <div className="mp-totals-label">{isFinal ? 'FINAL' : isLive ? 'LIVE' : 'PREVIEW'}</div>
              <div className="mp-totals-side mp-totals-side--right">
                <div className={`mp-total-score mp-total-score--right ${awayWins ? 'mp-total--win' : 'mp-total--loss'}`}>
                  {awayScore.toFixed(2)}
                </div>
                <div className="mp-total-proj">PROJ {projTotal(matchup.away_lineup || [])}</div>
              </div>
            </div>"""


def main():
    apply_patch(MATCHUP_PAGE, STATUS_OLD, STATUS_NEW, "PlayerStatus: drop PROJ branch")
    apply_patch(MATCHUP_PAGE, CELL_OLD, CELL_NEW, "PlayerCell: compute projVal from locked/live source")
    apply_patch(MATCHUP_PAGE, PTSEL_OLD, PTSEL_NEW, "PlayerCell: stacked TOT + PROJ block")
    apply_patch(MATCHUP_PAGE, STATUS_CALL_OLD, STATUS_CALL_NEW, "PlayerStatus call: drop projPts prop")
    apply_patch(MATCHUP_PAGE, PROJTOTAL_OLD, PROJTOTAL_NEW, "projTotal: use locked_proj_pts when locked")
    apply_patch(MATCHUP_PAGE, HOME_BADGE_OLD, HOME_BADGE_NEW, "remove home header Proj badge")
    apply_patch(MATCHUP_PAGE, AWAY_BADGE_OLD, AWAY_BADGE_NEW, "remove away header Proj badge")
    apply_patch(MATCHUP_PAGE, TOTALS_OLD, TOTALS_NEW, "Totals row: real PROJ + TOT for both teams")

    if not MATCHUP_CSS.exists():
        MATCHUP_CSS.write_text("")
        print(f"NOTE — {MATCHUP_CSS.name} didn't exist, created it")
    css_text = MATCHUP_CSS.read_text()
    new_css = """
/* PROJ + TOT stacked per-player block (Scoreboard Stage 2) */
.mp-pts-block { display: flex; flex-direction: column; align-items: center; min-width: 48px; }
.mp-pts-tot { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text); }
.mp-pts-tot--zero { color: var(--text-muted); }
.mp-pts-proj { font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; margin-top: 2px; }

/* Totals row: PROJ + TOT stacked per side */
.mp-totals-side { display: flex; flex-direction: column; align-items: center; }
.mp-totals-side--right { align-items: center; }
.mp-total-proj { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; margin-top: 4px; }
"""
    if ".mp-pts-block" in css_text:
        print("SKIPPED — CSS already present in MatchupPage.css")
    else:
        MATCHUP_CSS.write_text(css_text.rstrip() + "\n" + new_css)
        print("OK — appended PROJ/TOT CSS to MatchupPage.css")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
