import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const POLL_INTERVAL_MS = 4000;

// A chatroom tethered specifically to being in the draft room -- separate
// from the regular inbox/messaging system entirely, per Adam's explicit
// design. Generic across draft types (draftType prop: 'rfa' | 'ufa' |
// 'rookie'), polling-based rather than websocket for simplicity.
export default function RFADraftChat({ draftType, season, currentTeam, getTeamName, getTeamLogo }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const res = await fetch(`${API}/draft-chat/messages?draft_type=${draftType}&season=${season}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data || []);
    } catch (e) {
      // Silent on poll failures -- don't spam the user with errors for a
      // background refresh; the next poll will just try again.
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftType, season]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API}/draft-chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_type: draftType, season, sender_team: currentTeam, body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to send');
        return;
      }
      setDraft('');
      await load();
    } catch (e) {
      setError('Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 480,
      border: '1px solid var(--draft-border, rgba(255,255,255,0.1))', borderRadius: 8,
      background: 'var(--draft-surface-2, #1a1e26)', margin: '12px 16px',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--draft-border, rgba(255,255,255,0.1))',
        fontSize: 13, fontWeight: 700, color: '#FFFFFF',
      }}>
        Draft Chat
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--draft-text-muted)', textAlign: 'center', marginTop: 20 }}>
            No messages yet — say hello.
          </div>
        )}
        {messages.map(m => {
          const isMe = m.sender_team === currentTeam;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: 10, color: 'var(--draft-text-muted)', marginBottom: 2 }}>
                {getTeamName ? getTeamName(m.sender_team) : m.sender_team}
              </div>
              <div style={{
                maxWidth: '75%', padding: '6px 10px', borderRadius: 10, fontSize: 13,
                color: '#FFFFFF',
                background: isMe ? 'var(--draft-amber, #F5A623)' : 'rgba(255,255,255,0.08)',
                ...(isMe ? { color: '#000000' } : {}),
                wordBreak: 'break-word',
              }}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: '4px 14px', fontSize: 11, color: 'var(--draft-red, #e84545)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--draft-border, rgba(255,255,255,0.1))' }}>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the league..."
          maxLength={1000}
          style={{
            flex: 1, background: 'var(--draft-surface, #14171c)', border: '1px solid var(--draft-border, rgba(255,255,255,0.1))',
            color: '#FFFFFF', borderRadius: 6, padding: '8px 10px', fontSize: 13,
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          style={{
            background: 'var(--draft-amber, #F5A623)', color: '#000', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: sending ? 'default' : 'pointer',
            opacity: sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
