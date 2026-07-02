// RFAMatchWindow.jsx
// Standalone match window component (used if we want a full-screen modal version)
// Currently match decisions are handled inline in RFAMyBids
// This component is reserved for a future full-screen match decision view

export default function RFAMatchWindow({ player, offer, onMatch, onDecline, onClose }) {
  if (!player || !offer) return null;

  return (
    <div className="rfa-bid-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rfa-bid-form" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="rfa-bid-form__header">
          <div>
            <div className="rfa-bid-form__title" style={{ color: 'var(--draft-red)' }}>
              ⚠ Match Decision
            </div>
            <div className="rfa-bid-form__player">{player.full_name}</div>
          </div>
          <button className="rfa-bid-form__close" onClick={onClose}>×</button>
        </div>

        {/* Explanation */}
        <div style={{
          background: 'rgba(232,69,69,0.08)',
          border: '1px solid var(--draft-red)',
          borderRadius: 6,
          padding: '12px',
          fontSize: 13,
          color: 'var(--draft-text-muted)',
          lineHeight: 1.6,
        }}>
          Another team has submitted a qualifying offer on <strong style={{ color: 'var(--draft-text)' }}>
            {player.full_name}
          </strong>. You have the right of first refusal — match the offer to retain your player,
          or decline and let them walk.
        </div>

        {/* Offer details */}
        <div className="rfa-bid-form__section">
          <label className="rfa-bid-form__label">Offer to Match</label>
          <div className="rfa-bid-form__contract-preview">
            <div className="rfa-bid-form__contract-row">
              <span>Year 1 (gtd)</span>
              <span>${offer.y1_salary}</span>
            </div>
            <div className="rfa-bid-form__contract-row">
              <span>Year 2 (gtd)</span>
              <span>${offer.y2_salary}</span>
            </div>
            <div className={`rfa-bid-form__contract-row ${offer.guaranteed_years < 3 ? 'non-gtd' : ''}`}>
              <span>Year 3 {offer.guaranteed_years < 3 ? '(non-gtd)' : '(gtd)'}</span>
              <span>${offer.y3_salary}</span>
            </div>
            {offer.signing_bonus > 0 && (
              <div className="rfa-bid-form__contract-row">
                <span>Signing Bonus</span>
                <span>${offer.signing_bonus}</span>
              </div>
            )}
            <div className="rfa-bid-form__contract-row" style={{
              borderTop: '1px solid var(--draft-border)',
              marginTop: 6,
              paddingTop: 6,
            }}>
              <span>Total Guaranteed</span>
              <span>${offer.total_guaranteed}</span>
            </div>
          </div>
        </div>

        {/* Cap note */}
        <div style={{
          background: 'rgba(245,166,35,0.08)',
          border: '1px solid var(--draft-amber)',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--draft-text-muted)',
          lineHeight: 1.5,
        }}>
          You may not currently have the cap space to match this offer. You can use the
          <strong style={{ color: 'var(--draft-amber)' }}> Trade Machine </strong>
          to create room before making your decision. The matching window will remain
          open until it expires.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="rfa-bid-form__submit"
            style={{ flex: 1 }}
            onClick={() => {
              if (window.confirm('Match this offer and retain the player?')) {
                onMatch();
              }
            }}
          >
            MATCH OFFER — RETAIN PLAYER
          </button>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Decline this offer? The player will sign with the other team.')) {
              onDecline();
            }
          }}
          style={{
            background: 'none',
            border: '1px solid var(--draft-red)',
            color: 'var(--draft-red)',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.08em',
            padding: 12,
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s',
            textTransform: 'uppercase',
          }}
        >
          DECLINE — LET PLAYER WALK
        </button>
      </div>
    </div>
  );
}