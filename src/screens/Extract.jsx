import React, { useEffect, useRef, useState } from 'react'
import { useApp, go } from '../state.jsx'
import { extractDesign } from '../api.js'

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

function dbg(dispatch, level, msg) {
  dispatch({ type: 'DEBUG_LOG', level, msg })
}

export default function Extract() {
  const { state, dispatch } = useApp()
  const hasStarted = useRef(false)
  const elapsed = useElapsed(state.extracting)

  useEffect(() => {
    if (hasStarted.current || state.extracting || state.result) return
    if (!state.uploadedFiles.length && !state.inputUrls.length && !state.description) {
      dbg(dispatch, 'warn', 'No inputs found — redirecting to /upload')
      go('/upload'); return
    }
    hasStarted.current = true
    runExtraction()
  }, [])

  async function runExtraction() {
    dispatch({ type: 'START_EXTRACT' })
    dbg(dispatch, 'info', `Starting extraction — ${state.uploadedFiles.length} image(s), ${state.inputUrls.length} URL(s)`)

    const images = state.uploadedFiles.map((f) => ({ name: f.name, dataUrl: f.dataUrl }))
    dbg(dispatch, 'info', `Images prepared: ${images.map(i => i.name).join(', ') || 'none'}`)
    dbg(dispatch, 'info', `POST /design-library/extract → sending to API…`)

    const t0 = Date.now()
    try {
      const result = await extractDesign({
        name: state.projectName,
        primaryColor: state.primaryColorHint,
        images,
        urls: state.inputUrls,
        description: state.description,
      })
      const ms = Date.now() - t0
      dbg(dispatch, 'success', `API responded in ${ms}ms`)

      // surface server debug steps if present
      if (result._debug?.steps) {
        result._debug.steps.forEach(s => dbg(dispatch, 'server', `[server] ${s}`))
      }
      dbg(dispatch, 'server', `[server] tokens: ${result._debug?.tokenCount ?? result.meta?.tokenCount ?? '?'}, totalMs: ${result._debug?.totalMs ?? ms}`)

      const colls = result?.variables?.collections || {}
      const totalVars = Object.values(colls).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)
      dbg(dispatch, 'success', `Result: ${totalVars} variables, ${result?.styles?.text?.length ?? 0} text styles, ${result?.components?.length ?? 0} components`)

      dispatch({ type: 'SET_RESULT', result })
    } catch (e) {
      const ms = Date.now() - t0
      dbg(dispatch, 'error', `API error after ${ms}ms: ${e.message}`)
      dispatch({ type: 'SET_ERROR', message: e.message })
    }
  }

  const hasError = !!state.extractError

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <h1 className="t-h1" style={{ marginBottom: 12 }}>
        {state.result ? 'Extraction Complete ✓' : hasError ? 'Extraction Failed' : 'Extracting Design System'}
      </h1>
      <p className="t-body" style={{ color: 'var(--dlg-text-2)', marginBottom: 40 }}>
        {state.result
          ? 'Claude analysed your inputs and generated a full design library.'
          : hasError
          ? state.extractError
          : 'Claude is reading your inputs and building the design library. This usually takes 30–90 seconds — the page will update when it\'s ready.'}
      </p>

      {state.extracting && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div className="dlg-spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
          <div className="t-sm" style={{ color: 'var(--dlg-text-3)', fontVariantNumeric: 'tabular-nums', fontSize: 20 }}>
            {elapsed}
          </div>
          <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>
            Waiting for Claude… <span style={{ fontSize: 10, opacity: 0.6 }}>(open Debug panel ↘ for live trace)</span>
          </div>
        </div>
      )}

      {state.result && <ResultSummary result={state.result} projectName={state.projectName} />}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 40 }}>
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

function ResultSummary({ result, projectName }) {
  const collections = result?.variables?.collections || {}
  const totalVars = Object.values(collections).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
  const textStyles = result?.styles?.text?.length || 0
  const effectStyles = result?.styles?.effects?.length || 0
  const components = result?.components?.length || 0
  const patterns = result?.patterns?.length || 0
  const tokenMs = result?.meta?.tokenCount

  return (
    <div className="dlg-banner dlg-banner-success" style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 10, textAlign: 'left' }}>
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
          ['Components', components],
          ['Patterns', patterns],
        ].filter(([, n]) => n > 0).map(([label, n]) => (
          <div key={label} className="t-sm" style={{ color: 'var(--dlg-text-2)' }}>
            <strong style={{ color: 'var(--dlg-text)' }}>{n}</strong> {label}
          </div>
        ))}
        {tokenMs && <div className="t-sm" style={{ color: 'var(--dlg-text-3)' }}>{tokenMs} tokens</div>}
      </div>
    </div>
  )
}
