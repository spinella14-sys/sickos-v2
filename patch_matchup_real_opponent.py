#!/usr/bin/env python3
"""
Patches src/pages/MatchupPage.jsx: replaces the generic "UPCOMING" label
with real opponent + kickoff time (e.g. "vs KC · Sun 1:00 PM"), using the
new game_date field now returned by /api/schedule/opponents. Follows the
exact same fetch pattern already used for projMap.

Run from the sickos-v2 directory:
    python3 patch_matchup_real_opponent.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/MatchupPage.jsx")

# ── 1. Add opponentMap state + fetch, mirroring the existing projMap effect ──
OLD_1 = """  // Fetch projections for this week (used when games haven't started)
  useEffect(() => {
    if (!matchup?.season || !matchup?.week) return
    fetch(`${API_BASE}/projections/${matchup.season}/${matchup.week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const map = {}
        ;(Array.isArray(data) ? data : []).forEach(p => { map[p.sleeper_id] = parseFloat(p.proj_pts || 0) })
        setProjMap(map)
      })
      .catch(() => {})
  }, [matchup?.season, matchup?.week])"""

NEW_1 = """  // Fetch projections for this week (used when games haven't started)
  useEffect(() => {
    if (!matchup?.season || !matchup?.week) return
    fetch(`${API_BASE}/projections/${matchup.season}/${matchup.week}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const map = {}
        ;(Array.isArray(data) ? data : []).forEach(p => { map[p.sleeper_id] = parseFloat(p.proj_pts || 0) })
        setProjMap(map)
      })
      .catch(() => {})
  }, [matchup?.season, matchup?.week])

  // Fetch real per-NFL-team opponent + kickoff time for this week, so
  // "UPCOMING" can show real matchup info instead of a generic label.
  useEffect(() => {
    if (!matchup?.season || !matchup?.week) return
    fetch(`${API_BASE}/schedule/opponents?season=${matchup.season}&week=${matchup.week}`)
      .then(r => r.ok ? r.json() : {})
      .then(data => setOpponentMap(data || {}))
      .catch(() => {})
  }, [matchup?.season, matchup?.week])"""

OLD_2 = """  const [projMap,  setProjMap]  = useState({})"""
NEW_2 = """  const [projMap,      setProjMap]      = useState({})
  const [opponentMap,  setOpponentMap]  = useState({})"""

# ── 2. Thread opponentMap through PlayerCell invocations ────────────────────
OLD_3 = """                  <PlayerCell player={home} side="home" projMap={projMap} isFinal={isFinal} />"""
NEW_3 = """                  <PlayerCell player={home} side="home" projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />"""

OLD_4 = """                  <PlayerCell player={away} side="away" projMap={projMap} isFinal={isFinal} />"""
NEW_4 = """                  <PlayerCell player={away} side="away" projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />"""

# ── 3. PlayerCell: accept opponentMap, look up this player's game info ──────
OLD_5 = """function PlayerCell({ player, side, projMap, isFinal }) {
  const isRight  = side === 'away'
  const projPts  = player ? (projMap[player.sleeper_id] ?? null) : null"""

NEW_5 = """function PlayerCell({ player, side, projMap, opponentMap, isFinal }) {
  const isRight  = side === 'away'
  const projPts  = player ? (projMap[player.sleeper_id] ?? null) : null
  const gameInfo = player ? (opponentMap[player.nfl_team] ?? null) : null"""

OLD_6 = """      <PlayerStatus player={player} projPts={projPts} isFinal={isFinal} />"""
NEW_6 = """      <PlayerStatus player={player} projPts={projPts} isFinal={isFinal} gameInfo={gameInfo} />"""

# ── 4. PlayerStatus: show real opponent + kickoff time instead of generic UPCOMING ──
OLD_7 = """  if (!hasStats && !isLocked) {
    if (projPts != null) {
      return <span className="mp-player-status mp-status-proj">PROJ {projPts.toFixed(1)}</span>
    }
    return <span className="mp-player-status mp-status-upcoming">UPCOMING</span>
  }
  return null
}"""

NEW_7 = """  if (!hasStats && !isLocked) {
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
}

function formatKickoff(gameDate) {
  if (!gameDate) return ''
  const d = new Date(gameDate)
  if (isNaN(d.getTime())) return ''
  const day  = d.toLocaleDateString('en-US', { weekday: 'short' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return ` · ${day} ${time}`
}"""


def apply(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"ERROR: Could not find block for step '{label}'. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Block for step '{label}' appears {count} times, expected 1. Aborting.")
        sys.exit(1)
    return text.replace(old, new, 1)


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    text = apply(text, OLD_2, NEW_2, "add opponentMap state")
    text = apply(text, OLD_1, NEW_1, "add opponentMap fetch effect")
    text = apply(text, OLD_3, NEW_3, "thread opponentMap to home PlayerCell")
    text = apply(text, OLD_4, NEW_4, "thread opponentMap to away PlayerCell")
    text = apply(text, OLD_5, NEW_5, "PlayerCell accepts opponentMap")
    text = apply(text, OLD_6, NEW_6, "pass gameInfo to PlayerStatus")
    text = apply(text, OLD_7, NEW_7, "PlayerStatus shows real opponent + kickoff")

    TARGET.write_text(text)
    print("✓ Patched src/pages/MatchupPage.jsx — shows real opponent + kickoff time instead of generic UPCOMING.")


if __name__ == "__main__":
    main()
