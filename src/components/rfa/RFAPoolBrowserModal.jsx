import { useState, useMemo } from 'react'

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE']

export default function RFAPoolBrowserModal({ players, onSelect, onClose }) {
  const [posFilter, setPosFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = players || []
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.full_name?.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => (a.adp_dynasty_2qb ?? 999) - (b.adp_dynasty_2qb ?? 999))
  }, [players, posFilter, search])

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: 'var(--draft-bg, #14171c)', borderRadius: 12, padding: 20,
        maxWidth: 480, width: '92%', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Select a Player</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--draft-text-muted, #8B949E)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              style={{
                background: posFilter === pos ? 'var(--draft-amber, #e8a933)' : 'var(--draft-surface, #1c1f26)',
                color: posFilter === pos ? '#000' : 'var(--draft-text, #e6edf3)',
                border: '1px solid var(--draft-border, #333)', borderRadius: 6,
                fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer',
              }}
            >{pos}</button>
          ))}
        </div>

        <input
          autoFocus
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--draft-surface-2, #232833)',
            border: '1px solid var(--draft-border, #333)', color: 'var(--draft-text, #e6edf3)',
            borderRadius: 6, padding: '8px 10px', fontSize: 14, marginBottom: 10, outline: 'none',
          }}
        />

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--draft-text-muted, #8B949E)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              No players found.
            </div>
          )}
          {filtered.map(p => (
            <div
              key={p.sleeper_id}
              onClick={() => onSelect(p)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 8px', borderRadius: 6, cursor: 'pointer',
                color: 'var(--draft-text, #e6edf3)', fontSize: 14,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,169,51,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600 }}>{p.full_name}</span>
              <span style={{ color: 'var(--draft-text-muted, #8B949E)', fontSize: 12 }}>
                {p.position} · {p.incumbent_team}{p.adp_dynasty_2qb != null ? ` · ADP ${p.adp_dynasty_2qb.toFixed(1)}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
