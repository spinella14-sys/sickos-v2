#!/usr/bin/env python3
"""
Patches src/pages/FABidPage.jsx: fetches league season_mode on load and shows
a locked banner (disabling the form) whenever it's not 'regular_season'.
The real enforcement is server-side (routes/bids.js) -- this is UX only, so
managers see why they can't bid instead of hitting a raw 403.

Run from the sickos-v2 directory:
    python3 patch_fabid_season_lock.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/FABidPage.jsx")

# 1) Add state + fetch effect, right after the API_BASE constant
OLD_ANCHOR_1 = "const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'"
NEW_ANCHOR_1 = OLD_ANCHOR_1 + """

function useSeasonMode() {
  const [mode, setMode] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/system/season-mode`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMode(d?.season_mode || null))
      .catch(() => setMode(null))
  }, [])
  return mode
}"""

# 2) Call the hook inside the component
OLD_ANCHOR_2 = """export default function FABidPage() {
  const [searchParams] = useSearchParams()"""
NEW_ANCHOR_2 = """export default function FABidPage() {
  const seasonMode = useSeasonMode()
  const [searchParams] = useSearchParams()"""

# 3) Insert the banner right after the header block, before the rest of the form
OLD_ANCHOR_3 = """        {team && (
          <div className="fab-team-badge">
            <span className="fab-team-abbrev">{team}</span>
            <span className="fab-manager-name">{managerName}</span>
          </div>
        )}
      </div>
"""
NEW_ANCHOR_3 = """        {team && (
          <div className="fab-team-badge">
            <span className="fab-team-abbrev">{team}</span>
            <span className="fab-manager-name">{managerName}</span>
          </div>
        )}
      </div>

      {seasonMode && seasonMode !== 'regular_season' && (
        <div style={{
          margin: '0 0 20px', padding: '12px 16px',
          border: '1px solid var(--red)', borderRadius: 6,
          background: 'rgba(217,79,79,0.08)', color: 'var(--red)',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        }}>
          Free agent bidding is closed for the offseason. It opens automatically once the RFA, Rookie, and UFA drafts have all completed.
        </div>
      )}
"""

# 4) Disable the submit button during offseason too
OLD_ANCHOR_4 = "disabled={submitting || !preId || !salary || errors.length > 0}"
NEW_ANCHOR_4 = "disabled={submitting || !preId || !salary || errors.length > 0 || (seasonMode && seasonMode !== 'regular_season')}"


def apply(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"ERROR: Could not find anchor for step '{label}'. No changes made to this point.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Anchor for step '{label}' appears {count} times, expected 1. Aborting.")
        sys.exit(1)
    return text.replace(old, new, 1)


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    text = apply(text, OLD_ANCHOR_1, NEW_ANCHOR_1, "add useSeasonMode hook")
    text = apply(text, OLD_ANCHOR_2, NEW_ANCHOR_2, "call hook in component")
    text = apply(text, OLD_ANCHOR_3, NEW_ANCHOR_3, "insert banner")
    text = apply(text, OLD_ANCHOR_4, NEW_ANCHOR_4, "disable submit button")

    TARGET.write_text(text)
    print("✓ Patched src/pages/FABidPage.jsx — shows lock banner and disables form outside regular_season mode.")


if __name__ == "__main__":
    main()
