#!/usr/bin/env python3
"""
Patches src/pages/TeamPage.jsx: updates the Transactions tab to consume the
new /api/transactions response shape (assets[] instead of player_details[],
no more t.description — built client-side from asset data instead).

Run from the sickos-v2 (frontend) directory:
    python3 patch_teampage_transactions.py
"""
import sys
from pathlib import Path

TARGET = Path("src/pages/TeamPage.jsx")

OLD_BLOCK = """                {transactions.map((t,i) => (
                  <div key={t.id||i} style={{
                    padding:'10px 14px', borderBottom:'1px solid var(--border)',
                    fontFamily:'var(--font-ui)',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom: t.player_details?.length ? 6 : 0}}>
                      <span style={{
                        fontSize:9, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
                        padding:'2px 7px', border:'1px solid var(--border-bright)', color:'var(--text-muted)',
                        whiteSpace:'nowrap', flexShrink:0,
                      }}>{(t.type||'').replace(/_/g,' ')}</span>
                      <span style={{flex:1,fontSize:13,color:'var(--text-primary)'}}>{t.description}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {/* Player cards for anyone mentioned in this transaction */}
                    {t.player_details?.length > 0 && (
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',paddingLeft:4}}>
                        {t.player_details.map(p => (
                          <div key={p.sleeper_id} style={{display:'flex',alignItems:'center',gap:6}}>
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${p.sleeper_id}.jpg`}
                              alt=""
                              style={{width:24,height:24,objectFit:'cover',objectPosition:'top',borderRadius:3,background:'var(--bg3)'}}
                              onError={e=>e.target.style.opacity=0}
                            />
                            <PlayerLink playerId={p.sleeper_id} style={{fontSize:12,fontWeight:600}}>
                              {p.full_name || p.sleeper_id}
                            </PlayerLink>
                            {p.position && (
                              <span style={{fontSize:10,fontWeight:700,color:POS_COLOR[p.position]||'var(--text-muted)'}}>
                                {p.position}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}"""

NEW_BLOCK = """                {transactions.map((t,i) => {
                  const players = (t.assets||[]).filter(a => a.player)
                  const desc = describeTeamPageTx(t)
                  return (
                  <div key={t.id||i} style={{
                    padding:'10px 14px', borderBottom:'1px solid var(--border)',
                    fontFamily:'var(--font-ui)',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom: players.length ? 6 : 0}}>
                      <span style={{
                        fontSize:9, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
                        padding:'2px 7px', border:'1px solid var(--border-bright)', color:'var(--text-muted)',
                        whiteSpace:'nowrap', flexShrink:0,
                      }}>{(t.type||'').replace(/_/g,' ')}</span>
                      <span style={{flex:1,fontSize:13,color:'var(--text-primary)'}}>{desc}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                        {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {/* Player cards for anyone mentioned in this transaction */}
                    {players.length > 0 && (
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',paddingLeft:4}}>
                        {players.map(a => (
                          <div key={a.player.sleeper_id} style={{display:'flex',alignItems:'center',gap:6}}>
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${a.player.sleeper_id}.jpg`}
                              alt=""
                              style={{width:24,height:24,objectFit:'cover',objectPosition:'top',borderRadius:3,background:'var(--bg3)'}}
                              onError={e=>e.target.style.opacity=0}
                            />
                            <PlayerLink playerId={a.player.sleeper_id} style={{fontSize:12,fontWeight:600}}>
                              {a.player.full_name || a.player.sleeper_id}
                            </PlayerLink>
                            {a.player.position && (
                              <span style={{fontSize:10,fontWeight:700,color:POS_COLOR[a.player.position]||'var(--text-muted)'}}>
                                {a.player.position}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )})}"""

# Small helper function inserted once, right after the POS_COLOR constant.
HELPER_ANCHOR = "const POS_COLOR = { QB:'#e8822a', RB:'#3dba6e', WR:'#3a9fd4', TE:'#d4a843', K:'#8a9bb0' }"
HELPER_CODE = HELPER_ANCHOR + """

// ── Transactions tab description builder (new schema has no flat description) ──
function describeTeamPageTx(t) {
  const assets = t.assets || []
  const first = assets[0]
  const name = first?.player?.full_name || first?.player_id || 'player'
  if (t.type === 'signing') {
    const years = first?.contract_years ? Object.keys(first.contract_years).length : null
    const total = first?.contract_years
      ? Object.values(first.contract_years).reduce((s,y)=>s+(parseFloat(y.salary)||0),0)
      : null
    return `Signed ${name}${years ? ` · ${years}yr / $${total.toFixed(2)}` : ''}`
  }
  if (t.type === 'release') return `Released ${name}`
  if (t.type === 'bid_lost') return `Lost bid on ${name}`
  if (t.type === 'trade') {
    const names = assets.filter(a=>a.player).map(a=>a.player?.full_name||a.player_id)
    return names.length ? `Trade: ${names.join(', ')}` : 'Trade'
  }
  if (t.type === 'draft_batch') return t.notes || 'Draft results'
  return (t.type||'').replace(/_/g,' ')
}"""


def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run this from the sickos-v2 directory.")
        sys.exit(1)

    text = TARGET.read_text()

    if OLD_BLOCK not in text:
        print("ERROR: Could not find the exact Transactions tab render block to replace.")
        print("The file may have changed since this patch was written. No changes made.")
        sys.exit(1)

    if text.count(OLD_BLOCK) > 1:
        print("ERROR: Found multiple matches, expected exactly 1. Aborting.")
        sys.exit(1)

    text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)

    if HELPER_ANCHOR not in text:
        print("ERROR: Could not find anchor point for helper function. No changes made.")
        sys.exit(1)
    if text.count(HELPER_ANCHOR) > 1:
        print("ERROR: Anchor point appears more than once, ambiguous. No changes made.")
        sys.exit(1)

    text = text.replace(HELPER_ANCHOR, HELPER_CODE, 1)

    TARGET.write_text(text)
    print("✓ Patched src/pages/TeamPage.jsx — Transactions tab now uses the new schema.")


if __name__ == "__main__":
    main()
