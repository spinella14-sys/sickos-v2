#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx: the DropConfirmModal was only showing a
flat total dead cap figure per release method -- which is mathematically
identical across straight/frontload/stretch (same total guaranteed money,
just redistributed across a different number of years), making all three
options look the same and useless for actually deciding between them.
Fixes it to show the real year-by-year breakdown for each method, which is
what actually differentiates them (when the money hits, not how much).

Run from the sickos-v2 directory:
    python3 patch_drop_modal_year_breakdown.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

OLD_BLOCK = """        {preview && (
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
        )}"""

NEW_BLOCK = """        {preview && (
          <div style={{ marginBottom:16 }}>
            {['straight','frontload','stretch'].map(m => {
              const entries = preview[m] || []
              const total   = totalDeadCap(entries)
              return (
                <label key={m} style={{
                  display:'block', padding:'10px 12px', marginBottom:6, borderRadius:8, cursor:'pointer',
                  background: method === m ? 'rgba(240,180,41,0.12)' : 'rgba(255,255,255,0.04)',
                  border: method === m ? '1px solid var(--draft-amber, #f0b429)' : '1px solid transparent',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input type="radio" name="release_method" checked={method === m} onChange={() => setMethod(m)}/>
                      <span style={{ textTransform:'capitalize', fontSize:13, color:'#fff' }}>{m}</span>
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
                      ${total.toFixed(2)} total
                    </span>
                  </div>
                  {entries.length > 0 ? (
                    <div style={{
                      marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.08)',
                      display:'flex', flexWrap:'wrap', gap:'6px 14px',
                    }}>
                      {entries.map(e => (
                        <span key={e.season} style={{ fontSize:11, color:'#8B929E' }}>
                          {e.season}: <span style={{ color:'#fff', fontWeight:600 }}>${e.amount.toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop:6, fontSize:11, color:'#8B929E' }}>
                      No guaranteed money remaining — $0 dead cap
                    </div>
                  )}
                </label>
              )
            })}
          </div>
        )}"""


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()
    count = text.count(OLD_BLOCK)

    if count == 0:
        print("ERROR: Could not find the exact block to replace. No changes made.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: Found {count} matches, expected exactly 1. Aborting.")
        sys.exit(1)

    new_text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
    TARGET.write_text(new_text)
    print("✓ Patched src/pages/TeamPage.jsx — Drop modal now shows real year-by-year dead cap breakdown per method.")


if __name__ == "__main__":
    main()
