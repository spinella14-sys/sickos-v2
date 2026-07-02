// src/components/NewsTickerWidget.jsx
// League-wide recent news ticker. Self-contained — drop this into any page
// (intended for the Dashboard once it's built). Fetches its own data.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import NewsCard from './NewsCard'
import './NewsCard.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

export default function NewsTickerWidget({ limit = 8 }) {
  const [items, setItems]   = useState([])
  const [loading, setLoad]  = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/news/recent?limit=${limit}`)
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoad(false))
  }, [limit])

  return (
    <div className="ntw-widget">
      <div className="ntw-header">
        <span className="ntw-title">League News</span>
      </div>
      <div className="ntw-list">
        {loading && <div className="ntw-loading">Loading…</div>}
        {!loading && items.length === 0 && <div className="ntw-empty">No recent news.</div>}
        {!loading && items.map((item, i) => (
          <div key={i} className="ntw-item" onClick={() => setOpenId(item.sleeper_id)}>
            {item.type === 'late_scratch' && <span className="ntw-urgent">⚠</span>}
            <span className="ntw-player">{item.players?.full_name || item.sleeper_id}</span>
            <span className="ntw-headline">{item.headline}</span>
            <span className="ntw-time">{timeAgo(item.created_at)}</span>
          </div>
        ))}
      </div>

      {openId && (
        <NewsCard sleeperId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
