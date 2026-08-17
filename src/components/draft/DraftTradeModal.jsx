import { useState } from 'react'
import TradeMachinePage from '../../pages/TradeMachinePage'
import PendingTradesWidget from '../PendingTradesWidget'
import './DraftTradeModal.css'

// Shared embedded trade tool for all three draft screens (UFA, RFA,
// Rookie) -- opens as an overlay instead of navigating away from the
// live draft, so a manager never loses their place in an active wave/pick.
// PendingTradesWidget takes no props -- it reads the logged-in manager's
// own team via useAuth() internally.
export default function DraftTradeModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('propose') // 'propose' | 'pending'

  if (!isOpen) return null

  return (
    <div className="dtm-overlay" onClick={onClose}>
      <div className="dtm-panel" onClick={e => e.stopPropagation()}>
        <div className="dtm-header">
          <div className="dtm-tabs">
            <button
              className={`dtm-tab ${tab === 'propose' ? 'dtm-tab--active' : ''}`}
              onClick={() => setTab('propose')}
            >
              Propose Trade
            </button>
            <button
              className={`dtm-tab ${tab === 'pending' ? 'dtm-tab--active' : ''}`}
              onClick={() => setTab('pending')}
            >
              Pending Trades
            </button>
          </div>
          <button className="dtm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="dtm-body">
          {tab === 'propose' && <TradeMachinePage />}
          {tab === 'pending' && (
            <div className="dtm-pending-wrap">
              <PendingTradesWidget />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
