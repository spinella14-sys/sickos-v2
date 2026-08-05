#!/usr/bin/env python3
"""
Patch — Bench redesign: full parity with starters
1. New BenchPlayerRow component reuses PlayerStatus (opponent + kickoff,
   BYE/FINAL/PLAYING labels) and the same locked-vs-live PROJ/TOT logic
   as PlayerCell, just in a more compact layout.
2. Fixes the same row-reverse-cancels-JSX-mirror bug in bench that we just
   fixed for starters — .mp-bench-player--right was cancelling out the
   away side's own element-order swap.

Run from ~/Downloads/sickos-v2
    python3 patch_bench_redesign.py
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
# 1. New BenchPlayerRow component — insert right after PlayerCell
# ═══════════════════════════════════════════════════════════════════════
ANCHOR_OLD = """  return (
    <div className={`mp-player ${isRight ? 'mp-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{ptsEl}{bio}{headshot}</> : <>{headshot}{bio}{ptsEl}</>}
    </div>
  )
}"""
ANCHOR_NEW = """  return (
    <div className={`mp-player ${isRight ? 'mp-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{ptsEl}{bio}{headshot}</> : <>{headshot}{bio}{ptsEl}</>}
    </div>
  )
}

// Bench player row — same PROJ/TOT + opponent-info treatment as starters,
// compact layout, mirrored home/away the same way (JSX order, no CSS reversal).
function BenchPlayerRow({ player, side, projMap, opponentMap, isFinal }) {
  const isRight   = side === 'away'
  const gameInfo  = opponentMap[player.nfl_team] ?? null
  const hasPlayed = player.week_pts !== null
  const projVal = player.is_locked ? player.locked_proj_pts : (projMap[player.sleeper_id] ?? null)
  const projDisplay = projVal != null ? projVal.toFixed(1) : '—'
  const totDisplay  = player.week_pts != null ? player.week_pts.toFixed(1) : '0.0'

  const headshot = (
    <img src={headshotUrl(player.sleeper_id)} alt="" className="mp-bench-headshot"
      onError={e => e.target.style.opacity = 0} />
  )
  const info = (
    <div className={`mp-bench-info ${isRight ? 'mp-bench-info--right' : ''}`}>
      <div className={`mp-bench-name-row ${isRight ? 'mp-bench-name-row--right' : ''}`}>
        <PlayerLink playerId={player.sleeper_id} className="mp-bench-name">{player.full_name}</PlayerLink>
        <InjBadge status={player.injury_status} />
      </div>
      <span className="mp-bench-meta" style={{ color: POS_COLOR[player.position] }}>{player.position}</span>
      <PlayerStatus player={player} isFinal={isFinal} gameInfo={gameInfo} />
    </div>
  )
  const pts = (
    <div className="mp-pts-block mp-pts-block--bench">
      <span className={`mp-pts-tot mp-pts-tot--bench ${!hasPlayed ? 'mp-pts-tot--zero' : ''}`}>{totDisplay}</span>
      <span className="mp-pts-proj mp-pts-proj--bench">PROJ {projDisplay}</span>
    </div>
  )

  return (
    <div className={`mp-bench-player ${isRight ? 'mp-bench-player--right' : ''} ${player.is_locked && !isFinal ? 'mp-player--live' : ''}`}>
      {isRight ? <>{pts}{info}{headshot}</> : <>{headshot}{info}{pts}</>}
    </div>
  )
}"""

# ═══════════════════════════════════════════════════════════════════════
# 2. Replace inline bench map blocks with BenchPlayerRow
# ═══════════════════════════════════════════════════════════════════════
BENCH_JSX_OLD = """                    {homeBench.map(p => (
                      <div key={p.sleeper_id} className="mp-bench-player">
                        <img src={headshotUrl(p.sleeper_id)} alt="" className="mp-bench-headshot"
                          onError={e => e.target.style.opacity = 0} />
                        <div className="mp-bench-info">
                          <PlayerLink playerId={p.sleeper_id} className="mp-bench-name">{p.full_name}</PlayerLink>
                          <span className="mp-bench-meta" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
                        </div>
                        <span className="mp-bench-pts">
                          {p.week_pts?.toFixed(1) ?? (projMap[p.sleeper_id] ? `(${projMap[p.sleeper_id].toFixed(1)})` : '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mp-bench-spacer" />
                  <div className="mp-bench-col mp-bench-col--right">
                    {awayBench.map(p => (
                      <div key={p.sleeper_id} className="mp-bench-player mp-bench-player--right">
                        <span className="mp-bench-pts">
                          {p.week_pts?.toFixed(1) ?? (projMap[p.sleeper_id] ? `(${projMap[p.sleeper_id].toFixed(1)})` : '—')}
                        </span>
                        <div className="mp-bench-info mp-bench-info--right">
                          <PlayerLink playerId={p.sleeper_id} className="mp-bench-name">{p.full_name}</PlayerLink>
                          <span className="mp-bench-meta" style={{ color: POS_COLOR[p.position] }}>{p.position}</span>
                        </div>
                        <img src={headshotUrl(p.sleeper_id)} alt="" className="mp-bench-headshot"
                          onError={e => e.target.style.opacity = 0} />
                      </div>
                    ))}"""
BENCH_JSX_NEW = """                    {homeBench.map(p => (
                      <BenchPlayerRow key={p.sleeper_id} player={p} side="home"
                        projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
                    ))}
                  </div>
                  <div className="mp-bench-spacer" />
                  <div className="mp-bench-col mp-bench-col--right">
                    {awayBench.map(p => (
                      <BenchPlayerRow key={p.sleeper_id} player={p} side="away"
                        projMap={projMap} opponentMap={opponentMap} isFinal={isFinal} />
                    ))}"""


def main():
    apply_patch(MATCHUP_PAGE, ANCHOR_OLD, ANCHOR_NEW, "add BenchPlayerRow component")
    apply_patch(MATCHUP_PAGE, BENCH_JSX_OLD, BENCH_JSX_NEW, "use BenchPlayerRow in render")

    # ═══════════════════════════════════════════════════════════════════
    # 3. CSS — fix mirror bug, add name-row + compact pts-block variants
    # ═══════════════════════════════════════════════════════════════════
    css = MATCHUP_CSS.read_text()

    ROWREVERSE_OLD = ".mp-bench-player--right { flex-direction: row-reverse; }"
    if ROWREVERSE_OLD not in css:
        print("FAILED — bench row-reverse rule not found")
        sys.exit(1)
    ROWREVERSE_NEW = ("/* .mp-bench-player--right intentionally does NOT reverse flex-direction —\n"
                       "   BenchPlayerRow's JSX already swaps element order to mirror home. */")
    css = css.replace(ROWREVERSE_OLD, ROWREVERSE_NEW, 1)

    NEW_CSS = """
/* Bench: name row (name + injury badge) + compact PROJ/TOT variant */
.mp-bench-name-row { display: flex; align-items: center; gap: 4px; }
.mp-bench-name-row--right { flex-direction: row-reverse; }
.mp-pts-block--bench { min-width: 40px; }
.mp-pts-tot--bench { font-size: 13px; }
.mp-pts-proj--bench { font-size: 8px; }
"""
    css = css.rstrip() + "\n" + NEW_CSS
    MATCHUP_CSS.write_text(css)
    print("OK — patched CSS (mirror fix + bench name-row + compact pts-block)")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
