// src/components/DefenseRankBadge.jsx
// Clickable opponent abbreviation. Click opens a popover showing how that
// defense performs against all 4 positions (using the league's own scoring).
// `rankings` is the full { QB:{TEAM:{rank,ppg,total_teams}}, RB:{...}, ... }
// object returned by GET /api/schedule/defense-rankings — fetch it once per
// page and pass it down, no extra network call needed per row.

import { useState } from 'react'
import { rankColor, rankSuffix } from '../utils/defenseRankUtils'

const POS_LIST = ['QB', 'RB', 'WR', 'TE']

export default function DefenseRankBadge({ opponent, isBye, rankings }) {
  const [open, setOpen] = useState(false)

  if (isBye) return <span className="drb-bye">BYE</span>
  if (!opponent) return <span className="drb-dash">—</span>

  return (
    <span className="drb-wrap">
      <button
        type="button"
        className="drb-trigger"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      >
        {opponent}
      </button>

      {open && (
        <>
          <div className="drb-backdrop" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="drb-popover" onClick={e => e.stopPropagation()}>
            <div className="drb-popover-hd">
              {opponent} vs Position
              <button className="drb-close" onClick={() => setOpen(false)}>×</button>
            </div>
            {POS_LIST.map(pos => {
              const r = rankings?.[pos]?.[opponent]
              const color = r ? rankColor(r.rank, r.total_teams) : 'var(--text-muted)'
              return (
                <div key={pos} className="drb-row">
                  <span className="drb-row-pos">{pos}</span>
                  <span className="drb-row-rank" style={{ color }}>
                    {r ? rankSuffix(r.rank) : '—'}
                  </span>
                  <span className="drb-row-ppg">
                    {r ? `${r.ppg} pts/g allowed` : 'No data'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </span>
  )
}

// Renders just the OPP RNK value for a single position — used as its own
// column next to the OPP badge above.
export function OppRankCell({ opponent, position, rankings }) {
  if (!opponent) return <span className="drb-dash">—</span>
  const r = rankings?.[position]?.[opponent]
  if (!r) return <span className="drb-dash">—</span>
  const color = rankColor(r.rank, r.total_teams)
  return <span style={{ color, fontWeight: 700 }}>{r.rank}</span>
}
