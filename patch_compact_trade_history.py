#!/usr/bin/env python3
"""
Patch — Compact Trade History list
Each history card currently always shows a full multi-column asset
breakdown, making the list read as one giant fullscreen scroll. Since
clicking any card already opens TradeReviewModal with full details, the
list itself only needs a compact one-line summary. Also fixes an accidental
duplicate TradeReviewModal render (identical props, rendered twice).

Run from ~/Downloads/sickos-v2
    python3 patch_compact_trade_history.py
"""
import sys
from pathlib import Path

TM_PAGE = Path.cwd() / "src" / "pages" / "TradeMachinePage.jsx"

SUMMARY_OLD = "            const waitingOnTeams = trade.trade_teams?.filter(t => !t.has_accepted && t.team_abbrev !== myTeam).map(t=>t.team_abbrev) || []"
SUMMARY_NEW = """            const waitingOnTeams = trade.trade_teams?.filter(t => !t.has_accepted && t.team_abbrev !== myTeam).map(t=>t.team_abbrev) || []

            // Compact one-line summary of who sent what — full detail is one
            // click away via TradeReviewModal, so the list itself stays short.
            const assetsByTeam = {}
            ;(trade.trade_assets || []).forEach(a => {
              const label = a.asset_type === 'player' ? (a.player_name || a.sleeper_id)
                : a.asset_type === 'pick' ? (a.pick_label || 'Draft Pick')
                : a.asset_type === 'sb_budget' ? `$${parseFloat(a.sb_amount||0).toFixed(2)} SB`
                : 'Asset'
              if (!assetsByTeam[a.from_team]) assetsByTeam[a.from_team] = []
              assetsByTeam[a.from_team].push(label)
            })
            const assetSummary = Object.entries(assetsByTeam).map(([tAbbrev, names]) => {
              const shown = names.slice(0, 2).join(', ')
              const extra = names.length > 2 ? ` +${names.length - 2} more` : ''
              return `${tAbbrev} sends: ${shown}${extra}`
            }).join('   ·   ')"""

ASSETS_OLD = """                {/* Assets — one column per team */}
                <div className="tm-tc-assets">
                  {trade.trade_teams?.map(tt => {
                    const sending = trade.trade_assets?.filter(a => a.from_team === tt.team_abbrev)
                    if (!sending?.length) return null
                    const impact = capImpact[tt.team_abbrev] || 0
                    const sign   = impact >= 0 ? '+' : ''
                    const impColor = impact > 0 ? 'var(--red,#d94f4f)' : impact < 0 ? 'var(--green,#3dba6e)' : 'var(--text-muted)'
                    return (
                      <div key={tt.team_abbrev} className="tm-tc-side">
                        <div className="tm-tc-side-team">
                          {tt.team_abbrev} sends
                          {tt.has_accepted && <span className="tm-tc-accepted"> ✓</span>}
                          {impact !== 0 && (
                            <span style={{marginLeft:8,fontFamily:'var(--font-ui)',fontSize:10,fontWeight:700,color:impColor}}>
                              {sign}${Math.abs(impact).toFixed(2)} cap
                            </span>
                          )}
                        </div>
                        {sending.map((a, i) => (
                          <div key={i} className="tm-tc-asset">
                            {a.asset_type === 'player' && (
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}>
                                <div>
                                  <span style={{fontWeight:600}}>{a.player_name || a.sleeper_id}</span>
                                  {a.salary && (
                                    <span style={{marginLeft:8,fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>
                                      ${parseFloat(a.salary).toFixed(2)}{a.years ? ` · ${a.years}yr` : ''}
                                    </span>
                                  )}
                                </div>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                            {a.asset_type === 'pick' && (
                              <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                                <span>🏈 {a.pick_label || 'Draft Pick'}</span>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                            {a.asset_type === 'sb_budget' && (
                              <div style={{display:'flex',justifyContent:'space-between',width:'100%'}}>
                                <span>💰 ${parseFloat(a.sb_amount).toFixed(2)} SB budget</span>
                                <span style={{fontFamily:'var(--font-ui)',fontSize:11,color:'var(--text-muted)'}}>→ {a.to_team}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>"""
ASSETS_NEW = """                {/* Compact summary — click card for full detail */}
                <div className="tm-tc-summary">{assetSummary}</div>"""

DUP_OLD = """      {selectedTrade && (
        <TradeReviewModal
          trade={selectedTrade}
          myTeam={manager?.team_abbrev}
          isAdmin={isAdmin}
          onClose={() => setSelectedTrade(null)}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onAdminProcess={handleAdminProcess}
        />
      )}
      {selectedTrade && (
        <TradeReviewModal
          trade={selectedTrade}
          myTeam={manager?.team_abbrev}
          isAdmin={isAdmin}
          onClose={() => setSelectedTrade(null)}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onAdminProcess={handleAdminProcess}
        />
      )}"""
DUP_NEW = """      {selectedTrade && (
        <TradeReviewModal
          trade={selectedTrade}
          myTeam={manager?.team_abbrev}
          isAdmin={isAdmin}
          onClose={() => setSelectedTrade(null)}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onAdminProcess={handleAdminProcess}
        />
      )}"""


def apply_patch(old, new, label):
    text = TM_PAGE.read_text()
    count = text.count(old)
    if count != 1:
        print(f"FAILED — expected exactly 1 match for [{label}], found {count}.")
        sys.exit(1)
    TM_PAGE.write_text(text.replace(old, new, 1))
    print(f"OK — patched [{label}]")


def main():
    apply_patch(SUMMARY_OLD, SUMMARY_NEW, "compute compact asset summary")
    apply_patch(ASSETS_OLD, ASSETS_NEW, "replace bulky asset grid with compact summary")
    apply_patch(DUP_OLD, DUP_NEW, "fix duplicate TradeReviewModal render")

    css_path = Path.cwd() / "src" / "pages" / "TradeMachinePage.css"
    css = css_path.read_text()
    if ".tm-tc-summary" not in css:
        css = css.rstrip() + "\n\n.tm-tc-summary { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); padding: 6px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n"
        css_path.write_text(css)
        print("OK — added .tm-tc-summary CSS")
    else:
        print("SKIPPED — .tm-tc-summary CSS already present")

    print("\nAll patches applied. Next: npm run build")


if __name__ == "__main__":
    main()
