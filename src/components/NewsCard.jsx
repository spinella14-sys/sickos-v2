// src/components/NewsCard.jsx
// Shared news popover — opens from the injury badge, the newspaper icon, or
// any "view news" trigger. Filters between Health/Injury and Transactions.

import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

const TYPE_LABEL = {
  injury_status_change: 'Injury Status',
  practice_report:      'Practice Report',
  late_scratch:         'Late Scratch',
  transaction_status:   'Roster Status',
  transaction_team:     'Team Move',
}

export default function NewsCard({ sleeperId, playerName, defaultTab = 'health', onClose }) {
  const [items, setItems]   = useState([])
  const [loading, setLoad]  = useState(true)
  const [tab, setTab]       = useState(defaultTab)

  useEffect(() => {
    setLoad(true)
    fetch(`${API_BASE}/news/player/${sleeperId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoad(false))
  }, [sleeperId])

  const filtered = items.filter(i => i.category === tab)

  return (
    <>
      <div className="nc-backdrop" onClick={onClose} />
      <div className="nc-card" onClick={e => e.stopPropagation()}>
        <div className="nc-header">
          <span className="nc-title">{playerName ? `${playerName} — News` : 'Player News'}</span>
          <button className="nc-close" onClick={onClose}>×</button>
        </div>

        <div className="nc-tabs">
          <button className={`nc-tab ${tab === 'health' ? 'nc-tab--active' : ''}`} onClick={() => setTab('health')}>
            Health / Injury
          </button>
          <button className={`nc-tab ${tab === 'transaction' ? 'nc-tab--active' : ''}`} onClick={() => setTab('transaction')}>
            Transactions
          </button>
        </div>

        <div className="nc-body">
          {loading && <div className="nc-loading">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="nc-empty">No {tab === 'health' ? 'health/injury' : 'transaction'} news recorded.</div>
          )}
          {!loading && filtered.map((item, i) => (
            <div key={i} className="nc-item">
              <div className="nc-item-top">
                <span className={`nc-type-tag ${item.type === 'late_scratch' ? 'nc-type-tag--urgent' : ''}`}>
                  {item.type === 'late_scratch' ? '⚠ LATE SCRATCH' : (TYPE_LABEL[item.type] || item.type)}
                </span>
                {item.is_new && <span className="nc-new-badge">NEW</span>}
              </div>
              <div className="nc-headline">{item.headline}</div>
              <div className="nc-time">{timeAgo(item.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
