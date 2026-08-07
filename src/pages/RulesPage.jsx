import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import './RulesPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Split raw markdown into searchable blocks on ## or ### headings.
// Anything before the first heading is kept as a leading block with no heading.
function splitIntoBlocks(md) {
  const lines = (md || '').split('\n')
  const blocks = []
  let current = { heading: null, lines: [] }
  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line)) {
      if (current.heading !== null || current.lines.some(l => l.trim())) blocks.push(current)
      current = { heading: line, lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.heading !== null || current.lines.some(l => l.trim())) blocks.push(current)
  return blocks.map(b => ({
    heading: b.heading,
    text: b.lines.join('\n'),
    full: (b.heading ? b.heading + '\n' : '') + b.lines.join('\n'),
  }))
}

export default function RulesPage() {
  const { isAdmin } = useAuth()
  const [content,    setContent]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [query,      setQuery]      = useState('')
  const [editing,    setEditing]    = useState(false)
  const [draft,      setDraft]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)

  useEffect(() => {
    fetch(`${API}/rules`)
      .then(r => r.ok ? r.json() : { content: '' })
      .then(d => { setContent(d.content || ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const blocks = useMemo(() => splitIntoBlocks(content), [content])

  const filteredBlocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return blocks
    return blocks.filter(b => b.full.toLowerCase().includes(q))
  }, [blocks, query])

  function startEditing() {
    setDraft(content)
    setEditing(true)
    setSaveMsg(null)
  }

  async function saveRules() {
    setSaving(true); setSaveMsg(null)
    const r = await fetch(`${API}/rules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': localStorage.getItem('adminPw') || '' },
      body: JSON.stringify({ content: draft }),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      setContent(draft)
      setEditing(false)
      setSaveMsg({ type: 'ok', text: 'Rules updated!' })
    } else {
      setSaveMsg({ type: 'err', text: d.error || 'Failed to save' })
    }
  }

  return (
    <div className="rp-root">
      <div className="rp-header">
        <div>
          <h1 className="rp-title">League Rules</h1>
          <p className="rp-sub">Sickos Only Dynasty · Rulebook, Appendix &amp; FAQ</p>
        </div>
        {isAdmin && !editing && (
          <button className="rp-edit-btn" onClick={startEditing}>Edit Rules</button>
        )}
      </div>

      {editing ? (
        <div className="rp-editor">
          <textarea
            className="rp-editor-textarea"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck={false}
          />
          <div className="rp-editor-actions">
            <button className="rp-save-btn" onClick={saveRules} disabled={saving}>
              {saving ? 'Saving…' : 'Save Rules'}
            </button>
            <button className="rp-cancel-btn" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            {saveMsg && <span className={`rp-save-msg rp-save-msg--${saveMsg.type}`}>{saveMsg.text}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className="rp-search-bar">
            <input
              className="rp-search-input"
              placeholder='Search the rules… (e.g. "dead cap", "trade deadline", "QB limit")'
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <span className="rp-search-count">
                {filteredBlocks.length} result{filteredBlocks.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="rp-loading">Loading rules…</div>
          ) : !content ? (
            <div className="rp-empty">No rules content yet.</div>
          ) : !filteredBlocks.length ? (
            <div className="rp-empty">No matches for "{query}".</div>
          ) : (
            <div className="rp-content">
              {filteredBlocks.map((b, i) => (
                <div key={i} className="rp-block">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.full}</ReactMarkdown>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
