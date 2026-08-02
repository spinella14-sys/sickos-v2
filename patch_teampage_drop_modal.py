#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx:
  1. Adds dropTarget state.
  2. Adds a new DropConfirmModal component -- fetches real dead-cap preview
     for all 3 release methods, lets the manager pick one, confirms, then
     calls POST /contracts/:id/self-release. team_abbrev sent is `abbrev`
     (the team page being viewed), which is correct whether an admin or
     the team's own manager clicks Drop -- canEdit already gates visibility.
  3. Renders the modal near the end of the page.

Run from the sickos-v2 directory:
    python3 patch_teampage_drop_modal.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

OLD_STATE = """  const [sbBalance,       setSbBalance]       = useState(null)

  const canEdit   = isAdmin || manager?.team_abbrev === abbrev?.toUpperCase()"""

NEW_STATE = """  const [sbBalance,       setSbBalance]       = useState(null)
  const [dropTarget,      setDropTarget]      = useState(null)  // contract pending drop confirmation

  const canEdit   = isAdmin || manager?.team_abbrev === abbrev?.toUpperCase()"""

OLD_COMPONENT_ANCHOR = """export default function TeamPage() {"""

NEW_COMPONENT_ANCHOR = """function DropConfirmModal({ contract, teamAbbrev, onClose, onDropped }) {
  const [preview, setPreview] = useState(null)
  const [method,  setMethod]  = useState('straight')
  const [loading, setLoading] = useState(true)
  const [dropping, setDropping] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/contracts/${contract.id}/release-preview`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setPreview(d.preview); setLoading(false) })
      .catch(() => { setErr('Could not load dead cap preview'); setLoading(false) })
  }, [contract.id])

  const totalDeadCap = (methodEntries) => (methodEntries || []).reduce((s, e) => s + e.amount, 0)

  const confirmDrop = () => {
    setDropping(true)
    fetch(`${API_BASE}/contracts/${contract.id}/self-release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_method: method, team_abbrev: teamAbbrev }),
    })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(() => { onDropped?.(); onClose(); })
      .catch(e => { setErr(e.error || 'Failed to drop player'); setDropping(false) })
  }

  const p = contract.players || {}

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#14171c', borderRadius:12, padding:24, maxWidth:440, width:'92%', border:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>Drop {p.full_name}?</div>
        <div style={{ fontSize:13, color:'#8B929E', marginBottom:16 }}>
          This removes {p.full_name} from your roster and makes them a free agent. This cannot be undone.
        </div>

        {loading && <div style={{ fontSize:13, color:'#8B929E' }}>Loading dead cap impact…</div>}
        {err && <div style={{ fontSize:13, color:'var(--red, #d94f4f)', marginBottom:12 }}>{err}</div>}

        {preview && (
          <div style={{ marginBottom:16 }}>
            {['straight','frontload','stretch'].map(m => (
              <label key={m} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 12px', marginBottom:6, borderRadius:8, cursor:'pointer',
                background: method === m ? 'rgba(240,180,41,0.12)' : 'rgba(255,255,255,0.04)',
                border: method === m ? '1px solid var(--draft-amber, #f0b429)' : '1px solid transparent',
              }}>
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="radio" name="release_method" checked={method === m} onChange={() => setMethod(m)}/>
                  <span style={{ textTransform:'capitalize', fontSize:13 }}>{m}</span>
                </span>
                <span style={{ fontSize:13, fontWeight:700 }}>
                  ${totalDeadCap(preview[m]).toFixed(2)} dead cap
                </span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} disabled={dropping} style={{
            flex:1, padding:'10px 0', borderRadius:8, border:'1px solid rgba(255,255,255,0.2)',
            background:'transparent', color:'#8B929E', cursor:'pointer',
          }}>
            Cancel
          </button>
          <button onClick={confirmDrop} disabled={loading || dropping} style={{
            flex:1, padding:'10px 0', borderRadius:8, border:'none',
            background:'var(--red, #d94f4f)', color:'#fff', fontWeight:700, cursor:'pointer',
          }}>
            {dropping ? 'Dropping…' : 'Confirm Drop'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TeamPage() {"""


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
    text = apply(text, OLD_STATE, NEW_STATE, "add dropTarget state")
    text = apply(text, OLD_COMPONENT_ANCHOR, NEW_COMPONENT_ANCHOR, "add DropConfirmModal component")

    TARGET.write_text(text)
    print("✓ Patched src/pages/TeamPage.jsx — added DropConfirmModal component + dropTarget state.")
    print("NOTE: still need to render <DropConfirmModal> in the JSX return -- see follow-up patch.")


if __name__ == "__main__":
    main()
