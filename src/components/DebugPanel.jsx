import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../state.jsx'

const LEVEL_COLOR = {
  info:    'var(--dlg-text-3)',
  success: '#22c55e',
  error:   '#ef4444',
  warn:    '#f59e0b',
  server:  '#60a5fa',
}

function fmt(ts) {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

export default function DebugPanel() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [state.debugLog, open])

  const count = state.debugLog.length
  const hasError = state.debugLog.some(e => e.level === 'error')

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      fontFamily: 'var(--t-mono, monospace)', fontSize: 11,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      pointerEvents: 'none',
    }}>
      {open && (
        <div style={{
          width: 420, maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto',
        }}>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 10, letterSpacing: '0.05em' }}>DEBUG LOG</span>
            <button onClick={() => dispatch({ type: 'CLEAR_DEBUG' })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 10, padding: 0 }}>clear</button>
          </div>
          <div ref={listRef} style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
            {count === 0 && (
              <div style={{ color: '#475569', padding: '8px 10px', fontSize: 10 }}>No events yet</div>
            )}
            {state.debugLog.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#475569', flexShrink: 0, userSelect: 'none' }}>{fmt(e.ts)}</span>
                <span style={{ color: LEVEL_COLOR[e.level] || LEVEL_COLOR.info, wordBreak: 'break-all', lineHeight: 1.5 }}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          pointerEvents: 'auto',
          background: hasError ? '#7f1d1d' : 'rgba(0,0,0,0.80)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${hasError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 6, color: hasError ? '#fca5a5' : '#94a3b8',
          padding: '4px 10px', cursor: 'pointer', fontSize: 10,
          fontFamily: 'var(--t-mono, monospace)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: hasError ? '#ef4444' : '#22c55e' }} />
        {open ? 'Hide' : 'Debug'} {count > 0 && `(${count})`}
      </button>
    </div>
  )
}
