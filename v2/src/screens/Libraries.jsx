import React, { useState, useEffect } from 'react'
import { useApp, go } from '../state.jsx'
import { listDesignSystems } from '../api.js'

const STORYBOOK_BASE = 'https://lively-field-0cff9e30f.7.azurestaticapps.net'
const SUPERNOVA_BASE = 'https://app.supernova.io'

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function storybookUrl() {
  return STORYBOOK_BASE
}

function PlatformBadge({ href, label, color, icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: color + '18', color, border: `1px solid ${color}40`,
        textDecoration: 'none', transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = color + '30'}
      onMouseLeave={e => e.currentTarget.style.background = color + '18'}
    >
      {icon} {label}
    </a>
  )
}

function LibraryCard({ system, onSelect }) {
  const name = system.name || system.meta?.name || 'Untitled Library'
  const brand = system.primaryColor || system.meta?.primaryColor || '#6366f1'
  const figmaFileId = system.figmaFileId
  const figmaUrl = figmaFileId ? `https://www.figma.com/design/${figmaFileId}` : null
  const sbUrl = storybookUrl()
  const componentCount = system.components?.length || 0
  const tokenCount = Object.keys(system.colors || {}).length + Object.keys(system.typography || {}).length
  const isPublic = system.visibility === 'public'

  const savedAt = system.savedAt || system.createdAt
  const dateLabel = savedAt ? new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--dlg-surface)', border: '1px solid var(--dlg-border)',
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Color band */}
      <div style={{ height: 6, background: brand }} />

      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--dlg-text)' }}>{name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: isPublic ? '#6366f118' : 'var(--dlg-border)', color: isPublic ? 'var(--dlg-brand)' : 'var(--dlg-text-3)' }}>
                {isPublic ? 'Public' : 'Private'}
              </span>
            </div>
            {dateLabel && <div style={{ fontSize: 12, color: 'var(--dlg-text-3)' }}>{dateLabel}</div>}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: brand, flexShrink: 0 }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>
            <span style={{ fontWeight: 600, color: 'var(--dlg-text)' }}>{componentCount}</span> components
          </div>
          {tokenCount > 0 && (
            <div style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--dlg-text)' }}>{tokenCount}</span> tokens
            </div>
          )}
        </div>

        {/* Platform links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {figmaUrl && (
            <PlatformBadge href={figmaUrl} label="Figma" color="#f24e1e" icon="◆" />
          )}
          <PlatformBadge href={sbUrl} label="Storybook" color="#ff4785" icon="▦" />
          <PlatformBadge href={SUPERNOVA_BASE} label="Supernova" color="#6366f1" icon="✦" />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 48 }}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>▦</div>
      <div className="t-h2" style={{ color: 'var(--dlg-text-2)' }}>No libraries yet</div>
      <p className="t-body" style={{ color: 'var(--dlg-text-3)', textAlign: 'center', maxWidth: 320 }}>
        Upload screenshots or a Figma URL, extract your design system, then push to Figma, Storybook, and Supernova.
      </p>
      <button className="dlg-btn dlg-btn-primary" onClick={() => go('/upload')}>Build your first library</button>
    </div>
  )
}

export default function Libraries() {
  const { state, dispatch } = useApp()
  const [systems, setSystems] = useState(state.savedSystems || [])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    listDesignSystems()
      .then(data => {
        setSystems(data || [])
        if (data?.length) dispatch({ type: 'SET_SAVED', systems: data })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = systems.filter(s => {
    const name = (s.name || s.meta?.name || '').toLowerCase()
    return name.includes(search.toLowerCase())
  })

  function loadLibrary(system) {
    dispatch({ type: 'SET_RESULT', result: system })
    if (system.figmaFileId) dispatch({ type: 'SET_FIGMA_FILE', id: system.figmaFileId })
    go('/review')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="t-h1" style={{ marginBottom: 2 }}>My Libraries</h1>
            <p className="t-sm" style={{ color: 'var(--dlg-text-2)', margin: 0 }}>
              All design systems you've built — Figma, Storybook, and Supernova in one place.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {systems.length > 0 && (
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search libraries…"
                style={{ height: 34, padding: '0 12px', border: '1px solid var(--dlg-border)', borderRadius: 8, background: 'var(--dlg-bg)', color: 'var(--dlg-text)', fontSize: 13, width: 200 }}
              />
            )}
            <button className="dlg-btn dlg-btn-primary" onClick={() => go('/upload')}>+ New Library</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--dlg-bg)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--dlg-text-2)' }}>
            <div className="dlg-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            Loading libraries…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--dlg-text-3)' }}>
              {filtered.length} {filtered.length === 1 ? 'library' : 'libraries'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filtered.map((system, i) => (
                <LibraryCard key={system.id || i} system={system} onSelect={() => loadLibrary(system)} />
              ))}
            </div>

            {/* Platform overview */}
            <div style={{ marginTop: 40, padding: 24, background: 'var(--dlg-surface)', borderRadius: 12, border: '1px solid var(--dlg-border)' }}>
              <div className="t-h3" style={{ marginBottom: 16 }}>Platform Dashboards</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <a href="https://www.figma.com" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
                    background: 'var(--dlg-bg)', border: '1px solid var(--dlg-border)', textDecoration: 'none',
                    color: 'var(--dlg-text)', fontSize: 14, fontWeight: 500 }}>
                  <span style={{ fontSize: 20 }}>◆</span>
                  <div>
                    <div>Figma</div>
                    <div style={{ fontSize: 12, color: 'var(--dlg-text-3)' }}>Open workspace</div>
                  </div>
                </a>
                <a href={STORYBOOK_BASE} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
                    background: 'var(--dlg-bg)', border: '1px solid var(--dlg-border)', textDecoration: 'none',
                    color: 'var(--dlg-text)', fontSize: 14, fontWeight: 500 }}>
                  <span style={{ fontSize: 20 }}>▦</span>
                  <div>
                    <div>Storybook</div>
                    <div style={{ fontSize: 12, color: 'var(--dlg-text-3)' }}>All components</div>
                  </div>
                </a>
                <a href={SUPERNOVA_BASE} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
                    background: 'var(--dlg-bg)', border: '1px solid var(--dlg-border)', textDecoration: 'none',
                    color: 'var(--dlg-text)', fontSize: 14, fontWeight: 500 }}>
                  <span style={{ fontSize: 20 }}>✦</span>
                  <div>
                    <div>Supernova</div>
                    <div style={{ fontSize: 12, color: 'var(--dlg-text-3)' }}>Design docs</div>
                  </div>
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
