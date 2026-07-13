import React, { useEffect, useRef } from 'react'
import { useApp, go } from '../state.jsx'
import { extractDesign } from '../api.js'

const CATEGORIES = [
  'primitives', 'color-tokens', 'spacing-tokens', 'motion-tokens',
  'typography', 'text-styles', 'effect-styles', 'grid-styles',
  'components', 'patterns', 'finalizing',
]

const CAT_ICON = {
  'primitives': '◉',
  'color-tokens': '🎨',
  'spacing-tokens': '⇔',
  'motion-tokens': '◌',
  'typography': '✦',
  'text-styles': 'Aa',
  'effect-styles': '◈',
  'grid-styles': '⊞',
  'components': '▦',
  'patterns': '⊛',
  'finalizing': '⇓',
}

const CAT_LABEL = {
  'primitives': 'Primitives',
  'color-tokens': 'Color Tokens',
  'spacing-tokens': 'Spacing',
  'motion-tokens': 'Motion',
  'typography': 'Typography',
  'text-styles': 'Text Styles',
  'effect-styles': 'Effects',
  'grid-styles': 'Grids',
  'components': 'Components',
  'patterns': 'Patterns',
  'finalizing': 'Finalizing',
}

function buildManifest(result) {
  if (!result) return []
  const col = result?.variables?.collections || {}
  const inf = result?.meta?.inferenceMap || {}
  function status(key) {
    return inf[key] === 'found' ? 'found' : inf[key] === 'inferred' ? 'inferred' : null
  }
  return [
    {
      key: 'primitives', label: 'Color Primitives',
      count: (col.Primitives || []).length,
      status: status('primitives') || ((col.Primitives || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'color-tokens', label: 'Semantic Color Tokens',
      count: (col.Color || []).length, detail: 'light + dark',
      status: status('colorTokens') || ((col.Color || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'spacing-tokens', label: 'Spacing Scale',
      count: (col.Spacing || []).length,
      status: status('spacingTokens') || ((col.Spacing || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'motion-tokens', label: 'Motion Tokens',
      count: (col.Motion || []).length,
      status: status('motionTokens') || ((col.Motion || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'typography', label: 'Typography Variables',
      count: (col.Typography || []).length,
      status: status('typography') || ((col.Typography || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'text-styles', label: 'Text Styles',
      count: (result?.styles?.text || []).length,
      status: status('textStyles') || ((result?.styles?.text || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'effect-styles', label: 'Effects / Shadows',
      count: (result?.styles?.effects || []).length,
      status: status('effectStyles') || ((result?.styles?.effects || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'grid-styles', label: 'Grid Styles',
      count: (result?.styles?.grids || []).length,
      status: status('gridStyles') || ((result?.styles?.grids || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'components', label: 'Components',
      count: (result?.components || []).length,
      detail: (() => {
        const comps = result?.components || []
        return ['atom', 'molecule', 'organism', 'pattern']
          .map(t => ({ t, n: comps.filter(c => c.tier === t).length }))
          .filter(x => x.n > 0)
          .map(x => `${x.n} ${x.t}s`)
          .join(' · ')
      })(),
      status: status('components') || ((result?.components || []).length > 0 ? 'found' : 'inferred'),
    },
    {
      key: 'patterns', label: 'Page Patterns',
      count: (result?.patterns || []).length,
      status: status('patterns') || ((result?.patterns || []).length > 0 ? 'found' : 'inferred'),
    },
  ]
}

export default function Extract() {
  const { state, dispatch } = useApp()
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current || state.extracting || state.result) return
    if (!state.uploadedFiles.length && !state.inputUrls.length && !state.description) {
      go('/upload'); return
    }
    hasStarted.current = true
    runExtraction()
  }, [])

  async function runExtraction() {
    dispatch({ type: 'START_EXTRACT' })
    try {
      const images = state.uploadedFiles.map((f) => ({ name: f.name, dataUrl: f.dataUrl }))
      const result = await extractDesign(
        {
          name: state.projectName,
          primaryColor: state.primaryColorHint,
          images,
          urls: state.inputUrls,
          description: state.description,
        },
        (event) => dispatch({ type: 'LOG_CHUNK', event }),
      )
      dispatch({ type: 'SET_RESULT', result })
    } catch (e) {
      dispatch({ type: 'LOG_CHUNK', event: { type: 'progress', category: 'error', message: e.message, done: true } })
      dispatch({ type: 'EXTRACT_ERROR' })
    }
  }

  const log = state.extractionLog
  const doneSet = new Set(log.filter((e) => e.done).map((e) => e.category))
  const currentCat = log.length ? log[log.length - 1].category : null
  const progressPct = state.result ? 100 : Math.round((doneSet.size / CATEGORIES.length) * 100)
  const manifest = buildManifest(state.result)
  const hasError = log.some(e => e.category === 'error')

  if (!state.extracting && !state.result && !log.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div className="dlg-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <div className="t-body" style={{ color: 'var(--dlg-text-2)' }}>Preparing extraction…</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="t-h1" style={{ marginBottom: 6 }}>
          {state.result ? 'Extraction Complete ✓' : 'Extracting Design System'}
        </h1>
        <p className="t-body" style={{ color: 'var(--dlg-text-2)' }}>
          {state.result
            ? 'Claude built a complete design system from your inputs. Review the manifest, then iterate.'
            : 'Claude is analysing your inputs. Each section checks off as it completes.'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="dlg-progress-bar" style={{ marginBottom: 24 }}>
        <div className="dlg-progress-fill" style={{ width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Live checklist — each item ticks off the moment its done event arrives */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, marginBottom: 24 }}>
        {CATEGORIES.map((cat) => {
          const isDone = doneSet.has(cat)
          const isCurrent = !isDone && currentCat === cat
          return (
            <div key={cat} className="dlg-card" style={{
              padding: '10px 12px',
              borderColor: isDone ? 'var(--dlg-success)' : isCurrent ? 'var(--dlg-brand)' : 'var(--dlg-border)',
              background: isDone ? 'var(--dlg-success-soft)' : 'var(--dlg-surface)',
              transition: 'all 0.25s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{CAT_ICON[cat]}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, flex: 1,
                  color: isDone ? 'var(--dlg-success)' : isCurrent ? 'var(--dlg-brand)' : 'var(--dlg-text-3)',
                }}>
                  {CAT_LABEL[cat]}
                </span>
                {isDone
                  ? <span style={{ color: 'var(--dlg-success)', fontWeight: 700, fontSize: 13 }}>✓</span>
                  : isCurrent
                    ? <div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    : <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--dlg-border)', flexShrink: 0 }} />
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Live log — only while extracting */}
      {state.extracting && (
        <div className="dlg-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--dlg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="t-label" style={{ color: 'var(--dlg-text-2)' }}>Live Output</div>
            <div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          </div>
          <div style={{ maxHeight: 140, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {log.slice(-10).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--dlg-text-3)', flexShrink: 0 }}>{CAT_ICON[e.category] || '·'}</span>
                <span className="t-sm" style={{ color: e.category === 'error' ? 'var(--dlg-error)' : 'var(--dlg-text-2)' }}>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-extraction manifest */}
      {state.result && manifest.length > 0 && (
        <div className="dlg-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--dlg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="t-h3">What Claude built</div>
            <div style={{ flex: 1 }} />
            <span className="dlg-badge dlg-badge-success" style={{ fontSize: 11 }}>
              {manifest.filter(r => r.status === 'found').length} found
            </span>
            <span className="dlg-badge dlg-badge-warning" style={{ fontSize: 11 }}>
              {manifest.filter(r => r.status === 'inferred').length} inferred
            </span>
          </div>
          {manifest.map((row) => (
            <div key={row.key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px',
              borderBottom: '1px solid var(--dlg-border-soft)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: row.status === 'found' ? 'var(--dlg-success-soft)' : 'var(--dlg-warning-soft)',
                fontSize: 11, fontWeight: 700,
                color: row.status === 'found' ? 'var(--dlg-success)' : 'var(--dlg-warning)',
              }}>
                {row.status === 'found' ? '✓' : '~'}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{row.label}</span>
              {row.count > 0 && (
                <span style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>
                  {row.count}{row.detail ? ` (${row.detail})` : ''}
                </span>
              )}
              <span className={`dlg-badge ${row.status === 'found' ? 'dlg-badge-success' : 'dlg-badge-warning'}`} style={{ fontSize: 10, minWidth: 54, textAlign: 'center' }}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="dlg-banner dlg-banner-error" style={{ marginBottom: 20 }}>
          <span>✕</span>
          <div>
            <div className="t-sm" style={{ fontWeight: 600 }}>Extraction error</div>
            <div className="t-sm">{log.find(e => e.category === 'error')?.message}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="dlg-btn" onClick={() => go('/upload')}>← Back</button>
        {!state.result && !state.extracting && (
          <button className="dlg-btn dlg-btn-primary" onClick={() => { hasStarted.current = false; runExtraction() }}>
            Retry
          </button>
        )}
        {state.result && (
          <button className="dlg-btn dlg-btn-primary" onClick={() => go('/review')} style={{ height: 42, padding: '0 28px', fontSize: 15 }}>
            Review & Iterate →
          </button>
        )}
      </div>
    </div>
  )
}
