import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TEAMS } from '../data/league'
import LOGOS from '../assets/logos/index.js'
import './InboxPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const POLL_MS = 15000  // 15-second poll for near-real-time feel

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeSince(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff/60)}m`
  if (diff < 86400)  return `${Math.floor(diff/3600)}h`
  if (diff < 604800) return `${Math.floor(diff/86400)}d`
  return new Date(dateStr).toLocaleDateString()
}

function teamName(abbrev) {
  if (!abbrev || abbrev === 'SYSTEM') return 'System'
  return TEAMS.find(t => t.abbrev === abbrev)?.name || abbrev
}

function teamLogo(abbrev) {
  return LOGOS[abbrev] || null
}

const AUTO_TYPES = new Set(['auto_transaction','auto_trade','auto_draft','auto_injury','announcement'])

const TYPE_COLORS = {
  auto_transaction: 'var(--orange)',
  auto_trade:       'var(--blue)',
  auto_draft:       'var(--green)',
  auto_injury:      'var(--red,#d94f4f)',
  announcement:     'var(--gold)',
  chat:             'var(--text-muted)',
}

// ─── Message bubble (for DM conversations) ───────────────────────────────────
function Bubble({ msg, myTeam }) {
  const isMe = msg.sender_team === myTeam
  const logo = teamLogo(msg.sender_team)
  return (
    <div className={`bubble-row ${isMe ? 'bubble-row--me' : 'bubble-row--them'}`}>
      {!isMe && (
        <div className="bubble-avatar">
          {logo
            ? <img src={logo} alt={msg.sender_team} className="bubble-logo"/>
            : <div className="bubble-logo bubble-logo--fallback">{msg.sender_team?.[0]}</div>}
        </div>
      )}
      <div className="bubble-content">
        {!isMe && <div className="bubble-sender">{teamName(msg.sender_team)}</div>}
        <div className={`bubble ${isMe ? 'bubble--me' : 'bubble--them'}`}>
          {msg.body}
        </div>
        <div className="bubble-time">{timeSince(msg.created_at)}</div>
      </div>
    </div>
  )
}

// ─── Channel message row (feed style, like Slack) ────────────────────────────
function FeedMessage({ msg }) {
  const isAuto = AUTO_TYPES.has(msg.message_type)
  const logo   = teamLogo(msg.sender_team)
  const color  = TYPE_COLORS[msg.message_type] || 'var(--text-muted)'

  return (
    <div className={`feed-msg ${isAuto ? 'feed-msg--auto' : ''}`}>
      <div className="feed-msg-avatar">
        {isAuto ? (
          <div className="feed-msg-system-icon" style={{background: color}}>⚡</div>
        ) : logo ? (
          <img src={logo} alt={msg.sender_team} className="feed-msg-logo"/>
        ) : (
          <div className="feed-msg-logo feed-msg-logo--fallback">{msg.sender_team?.[0]}</div>
        )}
      </div>
      <div className="feed-msg-body">
        <div className="feed-msg-header">
          <span className="feed-msg-sender" style={isAuto ? {color} : {}}>
            {isAuto ? msg.message_type.replace('auto_','').replace('_',' ').toUpperCase() : teamName(msg.sender_team)}
          </span>
          <span className="feed-msg-time">{timeSince(msg.created_at)}</span>
        </div>
        <div className="feed-msg-text" dangerouslySetInnerHTML={{
          __html: msg.body
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>')
        }}/>
      </div>
    </div>
  )
}

// ─── New conversation modal ───────────────────────────────────────────────────
function NewConversationModal({ myTeam, onClose, onCreated, isAdmin }) {
  const [selected, setSelected] = useState([])
  const [creating, setCreating] = useState(false)

  function toggle(abbrev) {
    setSelected(p => p.includes(abbrev) ? p.filter(t=>t!==abbrev) : [...p, abbrev])
  }

  async function create() {
    if (!selected.length) return
    setCreating(true)
    const r = await fetch(`${API}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-team-abbrev': myTeam },
      body: JSON.stringify({ participants: selected }),
    })
    const data = await r.json()
    setCreating(false)
    if (r.ok) onCreated(data.id)
  }

  const others = TEAMS.filter(t => t.abbrev !== myTeam)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Message</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">Select one or more teams to message. Selecting multiple creates a group chat.</p>
          <div className="modal-teams">
            {others.map(t => (
              <button key={t.abbrev}
                className={`modal-team-btn ${selected.includes(t.abbrev) ? 'modal-team-btn--active' : ''}`}
                onClick={() => toggle(t.abbrev)}>
                {LOGOS[t.abbrev] && <img src={LOGOS[t.abbrev]} alt={t.abbrev} className="modal-team-logo"/>}
                <span>{t.name}</span>
                <span className="modal-team-abbrev">{t.abbrev}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-confirm" onClick={create} disabled={!selected.length || creating}>
            {creating ? 'Opening…' : selected.length > 1 ? `Start Group Chat (${selected.length + 1})` : 'Open Chat'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main InboxPage ───────────────────────────────────────────────────────────
export default function InboxPage() {
  const { manager, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const myTeam = manager?.team_abbrev

  // Active view: { type: 'channel'|'conversation', id: slug|uuid }
  const [active,       setActive]       = useState({ type: 'channel', id: 'general' })
  const [channels,     setChannels]     = useState([])
  const [conversations,setConversations]= useState([])
  const [messages,     setMessages]     = useState([])
  const [msgLoading,   setMsgLoading]   = useState(false)
  const [input,        setInput]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [showNewDM,    setShowNewDM]    = useState(false)
  const messagesEndRef = useRef(null)
  const pollRef        = useRef(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-team-abbrev': myTeam || '',
    ...(isAdmin ? { 'x-admin-password': 'Sickos26-Vault!Q7' } : {}),
  }), [myTeam, isAdmin])

  // ── Mark all old-system messages as read on mount ────────────────────────
  // The old messages table has trade notifications etc. that aren't shown
  // in the new inbox UI. Mark them all read on arrival so the count clears.
  useEffect(() => {
    if (!myTeam) return
    fetch(`${API}/messages?folder=inbox`, {
      headers: { 'x-team-abbrev': myTeam }
    })
      .then(r => r.ok ? r.json() : [])
      .then(msgs => {
        const unread = (msgs || []).filter(m => !m.is_read)
        unread.forEach(m => {
          fetch(`${API}/messages/${m.id}/read`, {
            method: 'PATCH',
            headers: { 'x-team-abbrev': myTeam },
          }).catch(() => {})
        })
      })
      .catch(() => {})
  }, [myTeam])

  // ── Load sidebar data ──────────────────────────────────────────────────────
  const loadSidebar = useCallback(async () => {
    if (!myTeam) return
    const [chRes, convRes] = await Promise.all([
      fetch(`${API}/channels`, { headers: headers() }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/conversations`, { headers: headers() }).then(r => r.ok ? r.json() : []),
    ])
    setChannels(Array.isArray(chRes) ? chRes : [])
    setConversations(Array.isArray(convRes) ? convRes : [])
  }, [myTeam, headers])

  // ── Load messages for active view ─────────────────────────────────────────
  const loadMessages = useCallback(async (scroll = false) => {
    if (!active) return
    setMsgLoading(true)
    const url = active.type === 'channel'
      ? `${API}/channels/${active.id}/messages`
      : `${API}/conversations/${active.id}/messages`
    const data = await fetch(url, { headers: headers() }).then(r => r.ok ? r.json() : [])
    setMessages(Array.isArray(data) ? data : [])
    setMsgLoading(false)
    if (scroll) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [active, headers])

  // ── Mark active view as read ───────────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!myTeam || !active) return
    const url = active.type === 'channel'
      ? `${API}/channels/${active.id}/read`
      : `${API}/conversations/${active.id}/read`
    await fetch(url, { method: 'POST', headers: headers() }).catch(() => {})
    loadSidebar()
  }, [active, myTeam, headers, loadSidebar])

  useEffect(() => { loadSidebar() }, [loadSidebar])

  useEffect(() => {
    loadMessages(true)
    markRead()
    // Set up polling
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      loadMessages(false)
      loadSidebar()
    }, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [active]) // eslint-disable-line

  // ── Handle ?compose=1 query param from dashboard ──────────────────────────
  useEffect(() => {
    if (params.get('compose') === '1') setShowNewDM(true)
  }, [params])

  // ── Send message ──────────────────────────────────────────────────────────
  async function send() {
    if (!input.trim() || sending) return
    setSending(true)
    const url = active.type === 'channel'
      ? `${API}/channels/${active.id}/messages`
      : `${API}/conversations/${active.id}/messages`
    await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body: input.trim() }),
    })
    setInput('')
    setSending(false)
    loadMessages(true)
    loadSidebar()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Compute total unread badge for nav ────────────────────────────────────
  const totalUnread = channels.reduce((s, c) => s + (c.unread || 0), 0)
    + conversations.reduce((s, c) => s + (c.unread || 0), 0)

  // ── Active view metadata ──────────────────────────────────────────────────
  const activeChannel = active.type === 'channel'
    ? channels.find(c => c.slug === active.id)
    : null
  const activeConv = active.type === 'conversation'
    ? conversations.find(c => c.id === active.id)
    : null

  const canPost = (() => {
    if (active.type === 'conversation') return true
    if (!activeChannel) return true
    if (activeChannel.is_readonly && !isAdmin) return false
    if (activeChannel.is_auto_only && !isAdmin) return false
    return true
  })()

  const isConversation = active.type === 'conversation'

  // Active conversation participant display
  const convParticipants = activeConv
    ? (activeConv.participants || []).filter(t => t !== myTeam)
    : []

  return (
    <div className="inbox-root">

      {/* ── Sidebar ── */}
      <div className="inbox-sidebar">
        <div className="inbox-sidebar-brand">
          <span className="inbox-sidebar-title">Messages</span>
          {totalUnread > 0 && <span className="inbox-total-unread">{totalUnread}</span>}
        </div>

        {/* Channels */}
        <div className="inbox-section-label">Channels</div>
        {channels.map(ch => (
          <button key={ch.slug}
            className={`inbox-item ${active.type === 'channel' && active.id === ch.slug ? 'inbox-item--active' : ''}`}
            onClick={() => setActive({ type: 'channel', id: ch.slug })}>
            <span className="inbox-item-name">{ch.name}</span>
            {ch.unread > 0 && <span className="inbox-unread-badge">{ch.unread}</span>}
          </button>
        ))}

        {/* Direct Messages */}
        <div className="inbox-section-label" style={{marginTop:16}}>
          Direct Messages
          <button className="inbox-new-dm-btn" onClick={() => setShowNewDM(true)} title="New message">+</button>
        </div>
        {conversations.length === 0 && (
          <div className="inbox-dm-empty">No conversations yet</div>
        )}
        {conversations.map(conv => {
          const others = (conv.participants || []).filter(t => t !== myTeam)
          const label = conv.title || others.join(', ')
          const preview = conv.last_message?.body?.slice(0, 40) || ''
          const isActive = active.type === 'conversation' && active.id === conv.id
          return (
            <button key={conv.id}
              className={`inbox-item inbox-item--dm ${isActive ? 'inbox-item--active' : ''}`}
              onClick={() => setActive({ type: 'conversation', id: conv.id })}>
              <div className="inbox-dm-avatars">
                {others.slice(0, 2).map(t => (
                  LOGOS[t]
                    ? <img key={t} src={LOGOS[t]} alt={t} className="inbox-dm-avatar"/>
                    : <div key={t} className="inbox-dm-avatar inbox-dm-avatar--fallback">{t[0]}</div>
                ))}
              </div>
              <div className="inbox-dm-info">
                <div className="inbox-item-name">{label}</div>
                {preview && <div className="inbox-dm-preview">{preview}</div>}
              </div>
              {conv.unread > 0 && <span className="inbox-unread-badge">{conv.unread}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Main feed ── */}
      <div className="inbox-main">

        {/* Header */}
        <div className="inbox-main-header">
          <div className="inbox-main-title">
            {isConversation
              ? convParticipants.map(t => (
                  LOGOS[t] && <img key={t} src={LOGOS[t]} alt={t} className="inbox-header-logo"/>
                ))
              : null}
            <span>
              {isConversation
                ? activeConv?.title || convParticipants.map(teamName).join(', ') || 'Conversation'
                : activeChannel?.name || active.id}
            </span>
          </div>
          {activeChannel?.description && (
            <div className="inbox-main-desc">{activeChannel.description}</div>
          )}
        </div>

        {/* Messages */}
        <div className="inbox-messages">
          {msgLoading && messages.length === 0 && (
            <div className="inbox-msg-loading">Loading…</div>
          )}
          {!msgLoading && messages.length === 0 && (
            <div className="inbox-msg-empty">
              {isConversation
                ? 'Start the conversation.'
                : `No messages in ${activeChannel?.name || active.id} yet.`}
            </div>
          )}
          {messages.map(msg => (
            isConversation
              ? <Bubble key={msg.id} msg={msg} myTeam={myTeam} />
              : <FeedMessage key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef}/>
        </div>

        {/* Composer */}
        {canPost ? (
          <div className="inbox-composer">
            <textarea
              className="inbox-composer-input"
              placeholder={
                isConversation
                  ? `Message ${convParticipants.map(teamName).join(', ')}…`
                  : `Message ${activeChannel?.name || '#' + active.id}…`
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
            />
            <button
              className="inbox-composer-send"
              onClick={send}
              disabled={!input.trim() || sending}>
              {sending ? '…' : '↑'}
            </button>
          </div>
        ) : (
          <div className="inbox-composer-readonly">
            {activeChannel?.is_readonly
              ? 'This channel is managed by the commissioner.'
              : 'This channel receives automated posts only.'}
          </div>
        )}
      </div>

      {/* New DM modal */}
      {showNewDM && (
        <NewConversationModal
          myTeam={myTeam}
          isAdmin={isAdmin}
          onClose={() => setShowNewDM(false)}
          onCreated={id => {
            setShowNewDM(false)
            loadSidebar()
            setActive({ type: 'conversation', id })
          }}
        />
      )}
    </div>
  )
}
