import React, { useState } from 'react'
import { useApp, go } from '../state.jsx'
import { pushToFigma } from '../api.js'
import { ComponentShowcase } from './Showcase.jsx'

const CATEGORIES = [
  { key: 'file', label: 'Figma File' },
  { key: 'variables', label: 'Variable Collections' },
  { key: 'text-styles', label: 'Text Styles' },
  { key: 'effect-styles', label: 'Effect Styles' },
  { key: 'components', label: 'Components' },
]

function SyncToggle({ on, onChange, label, description }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
      <span
        role="switch"
        aria-checked={on}
        onClick={onChange}
        style={{
          position: 'relative', width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: on ? 'var(--dlg-brand)' : 'var(--dlg-border)',
          transition: 'background 0.2s', cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: on ? 'translateX(16px)' : 'none', transition: 'transform 0.2s',
        }} />
      </span>
      <span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--dlg-text)', display: 'block' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--dlg-text-3)' }}>{description}</span>
      </span>
    </label>
  )
}

function StatusIcon({ status }) {
  if (status === 'ok') return <span style={{ color: '#16A34A', fontSize: 18 }}>✓</span>
  if (status === 'partial') return <span style={{ color: '#D97706', fontSize: 18 }}>⚠</span>
  if (status === 'error') return <span style={{ color: '#DC2626', fontSize: 18 }}>✕</span>
  return <span style={{ color: 'var(--dlg-text-3)', fontSize: 16 }}>○</span>
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export default function FigmaPush() {
  const { state, dispatch } = useApp()
  const [figmaToken, setFigmaToken] = useState(state.figmaToken || '')
  const [figmaFileUrl, setFigmaFileUrl] = useState('')
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [syncStorybook, setSyncStorybook] = useState(true)
  const [syncSupernova, setSyncSupernova] = useState(true)
  const result = state.figmaPushResult

  if (!state.result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 32 }}>
        <div className="t-h2">No design system loaded</div>
        <p className="t-body" style={{ color: 'var(--dlg-text-2)' }}>Go through Upload → Extract first.</p>
        <button className="dlg-btn dlg-btn-primary" onClick={() => go('/upload')}>Start Over</button>
      </div>
    )
  }

  function parseFileId(url) {
    const m = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/)
    return m ? m[1] : url.trim() || null
  }

  async function handlePush() {
    if (pushing) return
    setPushing(true)
    setError('')
    if (figmaToken) dispatch({ type: 'SET_FIGMA_TOKEN', token: figmaToken })
    const figmaFileId = parseFileId(figmaFileUrl) || state.figmaFileId
    try {
      const res = await pushToFigma({ result: state.result, figmaFileId, figmaToken: figmaToken || state.figmaToken, syncStorybook, syncSupernova })
      dispatch({ type: 'SET_FIGMA_PUSH', result: res })
    } catch (e) {
      setError(e.message)
    }
    setPushing(false)
  }

  const checklist = result?.checklist || {}
  const allOk = Object.values(checklist).every(c => c.status === 'ok')
  const hasErrors = Object.values(checklist).some(c => c.status === 'error')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="t-h1" style={{ marginBottom: 2 }}>Push to Figma</h1>
            <p className="t-sm" style={{ color: 'var(--dlg-text-2)', margin: 0 }}>
              Push variables, styles, and component scaffolds to a Figma file via the REST API.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="dlg-btn" onClick={() => go('/review')}>← Back to Review</button>
            <button className="dlg-btn dlg-btn-primary" onClick={() => go('/showcase')}>Continue to Showcase →</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--dlg-bg)', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Config card */}
        <div className="dlg-card" style={{ padding: 20, maxWidth: 680 }}>
          <div className="t-h3" style={{ marginBottom: 16 }}>Figma Configuration</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dlg-text-2)', marginBottom: 4 }}>
                Personal Access Token <span style={{ fontWeight: 400, color: 'var(--dlg-text-3)' }}>(or configure FIGMA_ACCESS_TOKEN on server)</span>
              </label>
              <input
                type="password"
                value={figmaToken}
                onChange={e => setFigmaToken(e.target.value)}
                placeholder="figd_…"
                style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid var(--dlg-border)', borderRadius: 8, background: 'var(--dlg-bg)', color: 'var(--dlg-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dlg-text-2)', marginBottom: 4 }}>
                Target Figma File URL <span style={{ fontWeight: 400, color: 'var(--dlg-text-3)' }}>(leave blank to create new file)</span>
              </label>
              <input
                value={figmaFileUrl}
                onChange={e => setFigmaFileUrl(e.target.value)}
                placeholder="https://www.figma.com/design/… or file key"
                style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid var(--dlg-border)', borderRadius: 8, background: 'var(--dlg-bg)', color: 'var(--dlg-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            {error && <div style={{ fontSize: 13, color: '#DC2626', padding: '8px 12px', background: '#FEE2E2', borderRadius: 6 }}>{error}</div>}

            {/* Sync options */}
            <div style={{ borderTop: '1px solid var(--dlg-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dlg-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>After push</div>
              <SyncToggle
                on={syncStorybook}
                onChange={() => setSyncStorybook(v => !v)}
                label="Sync Storybook"
                description="Rebuild and deploy Storybook stories to Azure"
              />
              <SyncToggle
                on={syncSupernova}
                onChange={() => setSyncSupernova(v => !v)}
                label="Sync Supernova"
                description="Push stories and Figma tokens to Supernova design docs"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                className="dlg-btn dlg-btn-primary"
                onClick={handlePush}
                disabled={pushing}
                style={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
              >
                {pushing ? <><div className="dlg-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Pushing…</> : '◆ Push to Figma'}
              </button>
              {result?.pluginJson && (
                <button className="dlg-btn" onClick={() => downloadJson(result.pluginJson, 'figma-plugin.json')}>
                  ⬇ Plugin JSON
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Checklist */}
        {Object.keys(checklist).length > 0 && (
          <div className="dlg-card" style={{ padding: 20, maxWidth: 680 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="t-h3">Push Results</div>
              {allOk && <span className="dlg-badge dlg-badge-success">All systems go ✓</span>}
              {hasErrors && <span className="dlg-badge dlg-badge-error">Some errors — check below</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CATEGORIES.map(cat => {
                const info = checklist[cat.key]
                return (
                  <div key={cat.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--dlg-bg)', border: '1px solid var(--dlg-border)' }}>
                    <StatusIcon status={info?.status} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{cat.label}</div>
                      {info && <div style={{ fontSize: 13, color: 'var(--dlg-text-2)', marginTop: 2 }}>{info.message}</div>}
                      {!info && <div style={{ fontSize: 13, color: 'var(--dlg-text-3)', marginTop: 2 }}>Not pushed yet</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            {result?.fileId && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--dlg-text-2)' }}>
                Figma file ID: <span className="t-mono" style={{ color: 'var(--dlg-brand)' }}>{result.fileId}</span>
              </div>
            )}
          </div>
        )}

        {/* Visual preview toggle */}
        <div style={{ maxWidth: 680 }}>
          <button
            className="dlg-btn"
            onClick={() => setPreview(p => !p)}
            style={{ marginBottom: preview ? 16 : 0 }}
          >
            {preview ? '▲ Hide' : '▼ Show'} component preview
          </button>
          {preview && (
            <div className="dlg-card" style={{ padding: 20 }}>
              <div className="t-h3" style={{ marginBottom: 16 }}>Visual Verification — Component Preview</div>
              <ComponentShowcase result={state.result} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
