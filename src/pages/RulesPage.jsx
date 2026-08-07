import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import './RulesPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Split raw markdown into blocks on ## or ### headings, preserving original
// index so a section can be edited and re-spliced back into the full doc
// even while a search filter is narrowing what's on screen.
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
  return blocks.map((b, idx) => ({
    idx,
    full: (b.heading ? b.heading + '\n' : '') + b.lines.join('\n'),
  }))
}

export default function RulesPage() {
  const { isAdmin } = useAuth()
  const [content,     setContent]     = useState('')
  const [loading,     setLoading]     = useState(true)
  const [query,       setQuery]       = useState('')
  const [editingIdx,  setEditingIdx]  = useState(null)
  const [sectionDraft,setSectionDraft]= useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)
  const [pwInput,     setPwInput]     = useState('')
  const [needsPw,     setNeedsPw]     = useState(!localStorage.getItem('adminPw'))

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

  function startEditingSection(block) {
    setEditingIdx(block.idx)
    setSectionDraft(block.full)
    setSaveMsg(null)
    setNeedsPw(!localStorage.getItem('adminPw'))
  }

  function cancelEditingSection() {
    setEditingIdx(null)
    setSaveMsg(null)
  }

  async function saveSection() {
    if (needsPw) {
      if (!pwInput.trim()) { setSaveMsg({ type: 'err', text: 'Enter the admin password to save.' }); return }
      localStorage.setItem('adminPw', pwInput.trim())
    }
    setSaving(true); setSaveMsg(null)

    const newBlocks = blocks.map(b => b.idx === editingIdx ? { ...b, full: sectionDraft } : b)
    const newContent = newBlocks.map(b => b.full).join('\n')

    const r = await fetch(`${API}/rules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': localStorage.getItem('adminPw') || '' },
      body: JSON.stringify({ content: newContent }),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      setContent(newContent)
      setEditingIdx(null)
      setSaveMsg({ type: 'ok', text: 'Section updated!' })
      setTimeout(() => setSaveMsg(null), 2500)
    } else {
      if (r.status === 401) { localStorage.removeItem('adminPw'); setNeedsPw(true) }
      setSaveMsg({ type: 'err', text: d.error || 'Failed to save — check the admin password' })
    }
  }

  return (
    <div className="rp-root">
      <div className="rp-header">
        <div>
          <h1 className="rp-title">League Rules</h1>
          <p className="rp-sub">Sickos Only Dynasty · Rulebook, Appendix &amp; FAQ</p>
        </div>
      </div>

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
          {filteredBlocks.map(b => (
            <div key={b.idx} className="rp-block">
              {isAdmin && editingIdx !== b.idx && (
                <button className="rp-block-edit-btn" onClick={() => startEditingSection(b)} title="Edit this section">
                  ✎ Edit
                </button>
              )}

              {editingIdx === b.idx ? (
                <div className="rp-section-editor">
                  <textarea
                    className="rp-section-textarea"
                    value={sectionDraft}
                    onChange={e => setSectionDraft(e.target.value)}
                    spellCheck={false}
                    autoFocus
                  />
                  {needsPw && (
                    <input
                      className="rp-pw-input"
                      type="password"
                      placeholder="Admin password"
                      value={pwInput}
                      onChange={e => setPwInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveSection()}
                    />
                  )}
                  <div className="rp-section-actions">
                    <button className="rp-save-btn" onClick={saveSection} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Section'}
                    </button>
                    <button className="rp-cancel-btn" onClick={cancelEditingSection} disabled={saving}>
                      Cancel
                    </button>
                    {saveMsg && <span className={`rp-save-msg rp-save-msg--${saveMsg.type}`}>{saveMsg.text}</span>}
                  </div>
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.full}</ReactMarkdown>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
