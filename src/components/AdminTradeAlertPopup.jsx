import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL;

// Global, unmissable popup for the admin whenever a trade reaches
// pending_admin (both sides have accepted, needs admin review before it can
// execute). Rendered once at the App root so it shows up regardless of what
// page the admin is currently on -- including mid-draft.
export default function AdminTradeAlertPopup() {
  const { isAdmin } = useAuth();
  const [pendingTrades, setPendingTrades] = useState([]);
  const [dismissed, setDismissed] = useState(() => new Set());
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) return;

    const check = () => {
      fetch(`${API_BASE}/trades?status=pending_admin`)
        .then(r => r.ok ? r.json() : [])
        .then(trades => setPendingTrades(Array.isArray(trades) ? trades : []))
        .catch(() => {});
    };

    check();
    pollRef.current = setInterval(check, 15000);
    return () => clearInterval(pollRef.current);
  }, [isAdmin]);

  if (!isAdmin) return null;

  const unseen = pendingTrades.filter(t => !dismissed.has(t.id));
  if (!unseen.length) return null;

  const trade = unseen[0];
  const teamNames = (trade.trade_teams || []).map(tt => tt.team_abbrev).join(' ↔ ');

  const dismiss = () => setDismissed(prev => new Set(prev).add(trade.id));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#14171c', borderRadius: 12, padding: 24,
        maxWidth: 440, width: '92%', border: '1px solid rgba(232,69,69,0.4)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: '#E84545' }}>
          🔔 Trade Needs Your Review
        </div>
        <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>
          Both teams have accepted — {teamNames} — this trade is now waiting on you.
        </div>
        {unseen.length > 1 && (
          <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 12 }}>
            +{unseen.length - 1} more also waiting on review
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin" style={{
            flex: 1, padding: '10px 0', borderRadius: 8, textAlign: 'center',
            background: 'var(--draft-amber, #f0b429)', color: '#000', fontWeight: 700,
            textDecoration: 'none',
          }}>
            Review Now
          </a>
          <button onClick={dismiss} style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#8B949E', cursor: 'pointer',
          }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
