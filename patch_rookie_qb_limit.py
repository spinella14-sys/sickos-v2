#!/usr/bin/env python3
"""
Patch -- QB limit filtering in Rookie Draft pool
Same rule as UFA/RFA: block at 3 total (active+PS combined), IR excluded.
Fetches team roster data via a new effect keyed on effectiveTeam, passes
it to PlayerBoard, which computes the filter and shows the same banner.

Run from ~/Downloads/sickos-v2
    python3 patch_rookie_qb_limit.py
"""
import sys
from pathlib import Path

ROOKIE_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RookieDraft.jsx"
PLAYER_BOARD = Path.cwd() / "src" / "components" / "draft" / "PlayerBoard.jsx"


def apply_or_die(text, old, new, label, path_name):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}] in {path_name}, expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def apply_or_die_local(text, old, new, label, path_name):
    return apply_or_die(text, old, new, label, path_name)


def main():
    # ---- RookieDraft.jsx: fetch team roster + pass to PlayerBoard ----
    rd_text = ROOKIE_DRAFT.read_text(encoding="utf-8")

    STATE_OLD = """  const autoPickRef  = useRef(null)
  const autoClockRef = useRef(null)"""
    STATE_NEW = """  const autoPickRef  = useRef(null)
  const autoClockRef = useRef(null)

  const [myTeamData, setMyTeamData] = useState(null)
  useEffect(() => {
    if (!effectiveTeam) return
    fetch(`${API}/teams/${effectiveTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMyTeamData)
      .catch(() => {})
  }, [effectiveTeam])"""
    rd_text = apply_or_die(rd_text, STATE_OLD, STATE_NEW, "add team roster fetch", "RookieDraft.jsx")

    BOARD_OLD = """        <PlayerBoard
          rookies={sortedRookies}
          allPicks={allPicks}
          currentPick={draftIsActive ? currentPick : null}
          isMyPick={isMyPick}
          submitting={submitting}
          onPick={handlePick}
          currentTeam={effectiveTeam}
          ownership={ownership}
        />"""
    BOARD_NEW = """        <PlayerBoard
          rookies={sortedRookies}
          allPicks={allPicks}
          currentPick={draftIsActive ? currentPick : null}
          isMyPick={isMyPick}
          submitting={submitting}
          onPick={handlePick}
          currentTeam={effectiveTeam}
          ownership={ownership}
          myTeamData={myTeamData}
        />"""
    rd_text = apply_or_die(rd_text, BOARD_OLD, BOARD_NEW, "pass myTeamData to PlayerBoard", "RookieDraft.jsx")

    ROOKIE_DRAFT.write_text(rd_text, encoding="utf-8")

    # ---- PlayerBoard.jsx: compute filter + banner ----
    pb_text = PLAYER_BOARD.read_text(encoding="utf-8")

    PROPS_OLD = """  currentTeam,
  ownership = {},   // { sleeper_id: pct_owned }
}) {"""
    PROPS_NEW = """  currentTeam,
  ownership = {},   // { sleeper_id: pct_owned }
  myTeamData = null,
}) {"""
    pb_text = apply_or_die(pb_text, PROPS_OLD, PROPS_NEW, "add myTeamData prop", "PlayerBoard.jsx")

    FILTER_OLD = """  const filtered = useMemo(() => {
    let list = rookies.map(r => ({
      ...r,
      percent_owned: ownership[r.sleeper_id] ?? 0,
    }));

    if (posFilter !== 'ALL') {
      list = list.filter(r => r.position === posFilter);
    }"""
    FILTER_NEW = """  const totalQBCount = useMemo(() => {
    return (myTeamData?.roster || []).filter(c => {
      const slot = c.roster_slots?.[0]?.slot_type;
      return (slot === 'active' || slot === 'ps') && c.players?.position === 'QB';
    }).length;
  }, [myTeamData]);
  // Real rule: max 2 active + max 1 PS (3 total, active+PS combined). IR is
  // unlimited and excluded from this count entirely.
  const qbLimitReached = totalQBCount >= 3;

  const filtered = useMemo(() => {
    let list = rookies.map(r => ({
      ...r,
      percent_owned: ownership[r.sleeper_id] ?? 0,
    }));

    if (qbLimitReached) {
      list = list.filter(r => r.position !== 'QB');
    }
    if (posFilter !== 'ALL') {
      list = list.filter(r => r.position === posFilter);
    }"""
    pb_text = apply_or_die(pb_text, FILTER_OLD, FILTER_NEW, "compute QB filter", "PlayerBoard.jsx")

    BANNER_OLD = """      </div>

      {/* Column headers -- 7 cols: rank | player | pos | nfl team | college | % own | action */}"""
    BANNER_NEW = """      </div>

      {qbLimitReached && (
        <div style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600,
          color: 'var(--draft-amber)', background: 'rgba(232,168,67,0.12)',
          borderBottom: '1px solid var(--draft-border)',
        }}>
          \u26a0 QBs are hidden from this pool -- your roster is already at the 2-active/1-PS QB limit.
        </div>
      )}

      {/* Column headers -- 7 cols: rank | player | pos | nfl team | college | % own | action */}"""
    pb_text = apply_or_die(pb_text, BANNER_OLD, BANNER_NEW, "add QB limit banner", "PlayerBoard.jsx")

    PLAYER_BOARD.write_text(pb_text, encoding="utf-8")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
