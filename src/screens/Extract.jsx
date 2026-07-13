import React, { useEffect, useRef, useState } from 'react'
import { useApp, go } from '../state.jsx'
import { extractDesign } from '../api.js'

const CATEGORIES = ['primitives', 'color-tokens', 'spacing-tokens', 'motion-tokens', 'typography', 'text-styles', 'effect-styles', 'grid-styles', 'components', 'patterns', 'finalizing']
const CAT_LABEL = {
  primitives: 'Primitives', 'color-tokens': 'Color Tokens', 'spacing-tokens': 'Spacing',
  'motion-tokens': 'Motion', typography: 'Typography', 'text-styles': 'Text Styles',
  'effect-styles': 'Effects', 'grid-styles': 'Grids', components: 'Components',
  patterns: 'Patterns', finalizing: 'Finalizing',
}
const CAT_ICON = {
  primitives: '🎨', 'color-tokens': '◉', 'spacing-tokens': '⇔', 'motion-tokens': '⏱',
  typography: '✦', 'text-styles': 'T', 'effect-styles': '✧', 'grid-styles': '⊞',
  components: '▦', patterns: '⊡', finalizing: '⇓',
}

// Elapsed time formatted as "0:42" or "1:05"
function useElapsed(running) {
  const [secs, setSecs] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (!running) { clearInterval(ref.current); return }
    setSecs(0)
    ref.current = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(ref.current)
  }, [running])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Extract() {
  const { state, dispatch } = useApp()
  const hasStarted = useRef(false)
  const lastHeartbeat = useRef(Date.now())
  const [stalled, setStalled] = useState(false)
  const elapsed = useElapsed(state.extracting)

  useEffect(() => {
    if (hasStarted.current || state.extracting || state.result) return
    if (!state.uploadedFiles.length && !state.inputUrls.length && !state.description) {
      go('/upload'); return
    }
    hasStarted.current = true
    runExtraction()
  }, [])

  // Stall detector: if no heartbeat for 20s while extracting, warn user
  useEffect(() => {
    if (!state.extracting) { setStalled(false); return }
    const id = setInterval(() => {
      if (Date.now() - lastHeartbeat.current > 20000) setStalled(true)
      else setStalled(false)
    }, 2000)
    return () => clearInterval(id)
  }, [state.extracting])

  async function runExtraction() {
    lastHeartbeat.current = Date.now()
    setStalled(false)
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
        (event) => {
          lastHeartbeat.current = Date.now()
          if (event.type === 'heartbeat') return  // just update the ref, don't log
          dispatch({ type: 'LOG_CHUNK', event })
        },
      )
      dispatch({ type: 'SET_RESULT', result })
      // Don't auto-redirect — let user see the summary and navigate themselves
    } catch (e) {
      dispatch({ type: 'LOG_CHUNK', event: { type: 'progress', category: 'error', message: e.message, done: true } })
      dispatch({ type: 'EXTRACT_ERROR' })
    }
  }

  const log = state.extractionLog
  const done = new Set(log.filter((e) => e.done && e.category !== 'error').map((e) => e.category))
  const activeEvents = log.filter((e) => !e.done)
  const activeCat = activeEvents.length ? activeEvents[activeEvents.length - 1].category : null
  const progressPct = state.result ? 100 : Math.round((done.size / CATEGORIES.length) * 100)
  const hasError = log.some((e) => e.category === 'error')

  // Phase label shown under the progress bar
  let phaseLabel = ''
  if (state.result) phaseLabel = 'Done'
  else if (hasError) phaseLabel = 'Failed'
  else if (stalled) phaseLabel = 'Waiting for server…'
  else if (activeCat) phaseLabel = CAT_LABEL[activeCat] || activeCat
  else if (state.extracting) phaseLabel = 'Starting up…'

  if (!state.extracting && !state.result && !log.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div className="dlg-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <div className="t-body" style={{ color: 'var(--dlg-text-2)' }}>Preparing extraction…</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ marginBottom: 6 }}>
          {state.result ? 'Extraction Complete ✓' : hasError ? 'Extraction Failed' : 'Extracting Design System'}
        </h1>
        <p className="t-body" style={{ color: 'var(--dlg-text-2)' }}>
          {state.result
            ? 'Claude analysed your inputs and generated a full design library.'
            : hasError
            ? 'Something went wrong. Check the log below, then retry.'
            : 'Claude is analysing your inputs and generating the full design library. This usually takes 30–90 seconds.'}
        </p>
      </div>

      {/* Progress bar + status row */}
      <div style={{ marginBottom: 24 }}>
        <div className="dlg-progress-bar" style={{ marginBottom: 8 }}>
          <div className="dlg-progress-fill" style={{ width: `${progressPct}%`, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="t-sm" style={{ color: stalled ? 'var(--dlg-warning, #f59e0b)' : 'var(--dlg-text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {state.extracting && !state.result && <div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
            {phaseLabel}
          </div>
          {state.extracting && !state.result && (
            <div className="t-sm" style={{ color: 'var(--dlg-text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {elapsed}
            </div>
          )}
          {progressPct > 0 && progressPct < 100 && (
            <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>{progressPct}%</div>
          )}
        </div>
      </div>

      {/* Stall warning */}
      {stalled && (
        <div className="dlg-banner" style={{ marginBottom: 16, borderColor: 'var(--dlg-warning, #f59e0b)', background: 'color-mix(in srgb, var(--dlg-warning, #f59e0b) 10%, transparent)' }}>
          <span>⏳</span>
          <div className="t-sm">No response for 20 seconds — the server may be waking from sleep. Hang tight or retry if it stays stuck.</div>
        </div>
      )}

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
        {CATEGORIES.map((cat) => {
          const isDone = done.has(cat)
          const isCurrent = !isDone && activeCat === cat
          return (
            <div key={cat} className="dlg-card" style={{
              padding: '10px 12px',
              borderColor: isDone ? 'var(--dlg-success)' : isCurrent ? 'var(--dlg-brand)' : 'var(--dlg-border)',
              opacity: isDone || isCurrent ? 1 : 0.6,
              transition: 'border-color 0.4s, opacity 0.4s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{CAT_ICON[cat]}</span>
                {isDone ? (
                  <span style={{ color: 'var(--dlg-success)', fontSize: 13, fontWeight: 700 }}>✓</span>
                ) : isCurrent ? (
                  <div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                ) : (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--dlg-border)' }} />
                )}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 500,
                color: isDone ? 'var(--dlg-success)' : isCurrent ? 'var(--dlg-brand)' : 'var(--dlg-text-3)',
              }}>
                {CAT_LABEL[cat]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Live log */}
      <LiveLog log={log} extracting={state.extracting} />

      {/* Result summary */}
      {state.result && (
        <ResultSummary result={state.result} projectName={state.projectName} />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="dlg-btn" onClick={() => go('/upload')}>← Back</button>
        {state.result && (
          <button className="dlg-btn dlg-btn-primary" onClick={() => go('/review')}>
            Review Results →
          </button>
        )}
        {!state.result && !state.extracting && (
          <button className="dlg-btn dlg-btn-primary" onClick={() => { hasStarted.current = false; runExtraction() }}>
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

function LiveLog({ log, extracting }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="dlg-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--dlg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="t-label" style={{ color: 'var(--dlg-text-2)', flex: 1 }}>Live Log</div>
        {extracting && <div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
        <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>{log.length} events</div>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {log.length === 0 && (
          <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>Waiting for response…</div>
        )}
        {log.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.7 }}>{CAT_ICON[e.category] || '·'}</span>
            <span className="t-sm" style={{ color: e.category === 'error' ? 'var(--dlg-error)' : e.done ? 'var(--dlg-success)' : 'var(--dlg-text-2)', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600, color: e.category === 'error' ? 'var(--dlg-error)' : 'var(--dlg-text)' }}>
                {CAT_LABEL[e.category] || e.category}:{' '}
              </span>
              {e.message}
              {e.done && e.category !== 'error' && ' ✓'}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function ResultSummary({ result, projectName }) {
  const collections = result?.variables?.collections || {}
  const totalVars = Object.values(collections).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
  const textStyles = result?.styles?.text?.length || 0
  const effectStyles = result?.styles?.effects?.length || 0
  const gridStyles = result?.styles?.grids?.length || 0
  const components = result?.components?.length || 0
  const patterns = result?.patterns?.length || 0
  const tokenMs = result?.meta?.tokenCount

  return (
    <div className="dlg-banner dlg-banner-success" style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>✦</span>
        <div className="t-sm" style={{ fontWeight: 600, fontSize: 15 }}>
          Design system generated for <strong>{result?.meta?.name || projectName || 'your app'}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {[
          ['Variables', totalVars],
          ['Text styles', textStyles],
          ['Effect styles', effectStyles],
          ['Grid styles', gridStyles],
          ['Components', components],
          ['Patterns', patterns],
        ].filter(([, n]) => n > 0).map(([label, n]) => (
          <div key={label} className="t-sm" style={{ color: 'var(--dlg-text-2)' }}>
            <strong style={{ color: 'var(--dlg-text)' }}>{n}</strong> {label}
          </div>
        ))}
        {tokenMs && (
          <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>{tokenMs} tokens</div>
        )}
      </div>
    </div>
  )
}
