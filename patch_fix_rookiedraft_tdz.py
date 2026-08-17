#!/usr/bin/env python3
"""
Corrective patch -- fix RookieDraft.jsx TDZ crash
The myTeamData fetch effect was inserted too early (right after
autoPickRef/autoClockRef), referencing effectiveTeam before its actual
declaration ~150 lines later. This is a genuine JS temporal-dead-zone
error and was crashing the entire page. Moves the effect to immediately
after the real effectiveTeam declaration.

Run from ~/Downloads/sickos-v2
    python3 patch_fix_rookiedraft_tdz.py
"""
import sys
from pathlib import Path

ROOKIE_DRAFT = Path.cwd() / "src" / "pages" / "draft" / "RookieDraft.jsx"


def apply_or_die(text, old, new, label):
    count = text.count(old)
    if count != 1:
        print(f"FAILED -- [{label}], expected 1 match found {count}. Aborting, nothing written.")
        sys.exit(1)
    print(f"OK -- {label}")
    return text.replace(old, new, 1)


def main():
    text = ROOKIE_DRAFT.read_text(encoding="utf-8")

    # 1. Remove the misplaced effect from its current (too-early) location
    MISPLACED_OLD = """  const autoPickRef  = useRef(null)
  const autoClockRef = useRef(null)

  const [myTeamData, setMyTeamData] = useState(null)
  useEffect(() => {
    if (!effectiveTeam) return
    fetch(`${API}/teams/${effectiveTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMyTeamData)
      .catch(() => {})
  }, [effectiveTeam])"""
    MISPLACED_NEW = """  const autoPickRef  = useRef(null)
  const autoClockRef = useRef(null)

  const [myTeamData, setMyTeamData] = useState(null)"""
    text = apply_or_die(text, MISPLACED_OLD, MISPLACED_NEW, "remove misplaced effect, keep state declaration")

    # 2. Re-add the effect right after the real effectiveTeam declaration
    REAL_DECL_OLD = "  const effectiveTeam  = isCommissioner && actingAs ? actingAs : team"
    REAL_DECL_NEW = """  const effectiveTeam  = isCommissioner && actingAs ? actingAs : team

  useEffect(() => {
    if (!effectiveTeam) return
    fetch(`${API}/teams/${effectiveTeam}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMyTeamData)
      .catch(() => {})
  }, [effectiveTeam])"""
    text = apply_or_die(text, REAL_DECL_OLD, REAL_DECL_NEW, "add effect right after real declaration")

    ROOKIE_DRAFT.write_text(text, encoding="utf-8")
    print("\nFile written. Next: npm run build")


if __name__ == "__main__":
    main()
