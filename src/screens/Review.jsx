import React, { useState } from 'react'
import { useApp, go } from '../state.jsx'

const TABS = ['Colors', 'Typography', 'Tokens', 'Components', 'Effects', 'Grids']

const TIER_ORDER = ['atom', 'molecule', 'organism', 'pattern']
const TIER_LABELS = { atom: 'Atoms', molecule: 'Molecules', organism: 'Organisms', pattern: 'Patterns' }

function ColorGrid({ colors }) {
  if (!colors?.length) return <Empty label="No colors extracted" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
      {colors.map((c, i) => (
        <div key={i} className="dlg-card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="dlg-swatch" style={{ background: c.value || c.hex || c.color }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            <div className="t-mono" style={{ color: 'var(--dlg-text-2)', fontSize: 11 }}>{c.value || c.hex || c.color}</div>
            {c.usage && <div className="t-xs" style={{ color: 'var(--dlg-text-3)' }}>{c.usage}</div>}
          </div>
          {c.confidence && (
            <span className={`dlg-badge dlg-badge-${c.confidence === 'extracted' ? 'success' : 'warning'}`} style={{ fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
              {c.confidence}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function TypographyList({ styles }) {
  if (!styles?.length) return <Empty label="No text styles extracted" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {styles.map((s, i) => {
        const lh = s.lineHeight?.value ?? s.lineHeight
        const ls = s.letterSpacing?.value ?? s.letterSpacing
        const lhUnit = s.lineHeight?.unit === 'PIXELS' ? 'px' : s.lineHeight?.unit === 'PERCENT' ? '%' : ''
        const lsUnit = s.letterSpacing?.unit === 'PIXELS' ? 'px' : s.letterSpacing?.unit === 'PERCENT' ? '%' : ''
        return (
          <div key={i} className="dlg-card" style={{ padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 120, flex: '0 0 auto' }}>
              <div style={{ fontSize: 12, color: 'var(--dlg-text-3)', marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontFamily: s.fontFamily || 'inherit', fontSize: Math.min(s.fontSize || 16, 32), fontWeight: s.fontWeight || 400, lineHeight: lh ? `${lh}${lhUnit}` : 1.5 }}>
                {s.name}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {s.fontFamily && <Chip label="Font" value={s.fontFamily} />}
              {s.fontStyle && <Chip label="Style" value={s.fontStyle} />}
              {s.fontSize && <Chip label="Size" value={`${s.fontSize}px`} />}
              {s.fontWeight && <Chip label="Weight" value={String(s.fontWeight)} />}
              {lh != null && <Chip label="Line" value={`${lh}${lhUnit}`} />}
              {ls != null && <Chip label="Tracking" value={`${ls}${lsUnit}`} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TokensTab({ result }) {
  const collections = result?.variables?.collections || {}
  const colorTokens = collections['Color'] || collections['Tokens'] || []
  const spacingTokens = collections['Spacing'] || []
  const motionTokens = collections['Motion'] || []
  const componentTokens = collections['Component Tokens'] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {colorTokens.length > 0 && (
        <section>
          <div className="t-h3" style={{ marginBottom: 12 }}>Color Tokens</div>
          <TokenTable tokens={colorTokens} />
        </section>
      )}
      {spacingTokens.length > 0 && (
        <section>
          <div className="t-h3" style={{ marginBottom: 12 }}>Spacing & Radius</div>
          <TokenTable tokens={spacingTokens} showDark={false} />
        </section>
      )}
      {motionTokens.length > 0 && (
        <section>
          <div className="t-h3" style={{ marginBottom: 12 }}>Motion</div>
          <MotionTable tokens={motionTokens} />
        </section>
      )}
      {componentTokens.length > 0 && (
        <section>
          <div className="t-h3" style={{ marginBottom: 12 }}>Component Tokens</div>
          <TokenTable tokens={componentTokens} />
        </section>
      )}
      {colorTokens.length === 0 && spacingTokens.length === 0 && motionTokens.length === 0 && componentTokens.length === 0 && (
        <Empty label="No tokens extracted" />
      )}
    </div>
  )
}

function TokenTable({ tokens, showDark = true }) {
  if (!tokens?.length) return null
  const cols = showDark ? ['Name', 'Light', 'Dark', 'Type', 'Scope'] : ['Name', 'Value', 'Type', 'Scope']
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dlg-border)' }}>
            {cols.map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--dlg-text-2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--dlg-border-soft)' }}>
              <td style={{ padding: '8px 12px' }}>
                <span className="t-mono" style={{ color: 'var(--dlg-brand)', fontSize: 12 }}>{t.name}</span>
              </td>
              {showDark ? (
                <>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.lightValue && isColor(t.lightValue) && <div className="dlg-swatch" style={{ width: 20, height: 20, background: t.lightValue }} />}
                      <span className="t-mono" style={{ fontSize: 12 }}>{t.lightValue || t.value || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.darkValue && isColor(t.darkValue) && <div className="dlg-swatch" style={{ width: 20, height: 20, background: t.darkValue }} />}
                      <span className="t-mono" style={{ fontSize: 12 }}>{t.darkValue || '—'}</span>
                    </div>
                  </td>
                </>
              ) : (
                <td style={{ padding: '8px 12px' }}>
                  <span className="t-mono" style={{ fontSize: 12 }}>{t.value ?? t.lightValue ?? '—'}</span>
                </td>
              )}
              <td style={{ padding: '8px 12px' }}>
                <span className="dlg-badge dlg-badge-brand">{t.resolvedType || t.type || 'COLOR'}</span>
              </td>
              <td style={{ padding: '8px 12px' }}>
                <span className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-3)' }}>{Array.isArray(t.scopes) ? t.scopes.join(', ') : (t.scope || '—')}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MotionTable({ tokens }) {
  if (!tokens?.length) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dlg-border)' }}>
            {['Name', 'Value', 'Type', 'CSS Var'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--dlg-text-2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tokens.map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--dlg-border-soft)' }}>
              <td style={{ padding: '8px 12px' }}><span className="t-mono" style={{ color: 'var(--dlg-brand)', fontSize: 12 }}>{t.name}</span></td>
              <td style={{ padding: '8px 12px' }}><span className="t-mono" style={{ fontSize: 12 }}>{t.value != null ? String(t.value) : '—'}</span></td>
              <td style={{ padding: '8px 12px' }}><span className="dlg-badge dlg-badge-info">{t.resolvedType || t.type || 'FLOAT'}</span></td>
              <td style={{ padding: '8px 12px' }}><span className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-3)' }}>{t.cssVar || '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComponentGrid({ components }) {
  if (!components?.length) return <Empty label="No components extracted" />

  const byTier = {}
  components.forEach((c) => {
    const tier = (c.tier || 'atom').toLowerCase()
    if (!byTier[tier]) byTier[tier] = []
    byTier[tier].push(c)
  })

  const tiers = TIER_ORDER.filter((t) => byTier[t]?.length)
  if (!tiers.length) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {components.map((c, i) => <ComponentCard key={i} c={c} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {tiers.map((tier) => (
        <section key={tier}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="t-h3">{TIER_LABELS[tier] || tier}</div>
            <span className="dlg-badge dlg-badge-brand">{byTier[tier].length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {byTier[tier].map((c, i) => <ComponentCard key={i} c={c} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function ComponentCard({ c }) {
  return (
    <div className="dlg-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--dlg-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>▦</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
          <div style={{ fontSize: 11, color: 'var(--dlg-text-3)' }}>{c.category || c.tier || 'Component'}</div>
        </div>
      </div>
      {c.variants?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="t-xs" style={{ color: 'var(--dlg-text-3)', marginBottom: 4 }}>VARIANTS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {c.variants.map((v, j) => <span key={j} className="dlg-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{v}</span>)}
          </div>
        </div>
      )}
      {c.states?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="t-xs" style={{ color: 'var(--dlg-text-3)', marginBottom: 4 }}>STATES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {c.states.map((s, j) => <span key={j} className="dlg-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{s}</span>)}
          </div>
        </div>
      )}
      {(c.variableBindings || c.tokenBindings)?.length > 0 && (
        <div>
          <div className="t-xs" style={{ color: 'var(--dlg-text-3)', marginBottom: 4 }}>TOKEN BINDINGS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(c.variableBindings || c.tokenBindings).slice(0, 3).map((b, j) => (
              <div key={j} className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-2)' }}>{b}</div>
            ))}
            {(c.variableBindings || c.tokenBindings).length > 3 && (
              <div className="t-xs" style={{ color: 'var(--dlg-text-3)' }}>+{(c.variableBindings || c.tokenBindings).length - 3} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EffectList({ effects }) {
  if (!effects?.length) return <Empty label="No effects extracted" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
      {effects.map((e, i) => (
        <div key={i} className="dlg-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{e.name}</div>
          {e.effects?.length > 0 && e.effects.map((ef, j) => (
            <div key={j} className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-2)', marginBottom: 2 }}>
              {ef.type}{ef.radius != null ? ` r=${ef.radius}` : ''}{ef.spread != null ? ` s=${ef.spread}` : ''}
            </div>
          ))}
          {!e.effects?.length && <div className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-2)' }}>{e.value || e.css || 'see token'}</div>}
          {e.effectType && <span className="dlg-badge dlg-badge-info" style={{ marginTop: 8, fontSize: 10 }}>{e.effectType}</span>}
        </div>
      ))}
    </div>
  )
}

function GridList({ grids }) {
  if (!grids?.length) return <Empty label="No grid styles extracted" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grids.map((g, i) => (
        <div key={i} className="dlg-card" style={{ padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 140, flex: '0 0 auto' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
            <div style={{ fontSize: 11, color: 'var(--dlg-text-3)' }}>{g.breakpoint || ''}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {g.pattern && <Chip label="Pattern" value={g.pattern} />}
            {g.columns != null && <Chip label="Cols" value={String(g.columns)} />}
            {g.gutterSize != null && <Chip label="Gutter" value={`${g.gutterSize}px`} />}
            {g.offset != null && <Chip label="Margin" value={`${g.offset}px`} />}
            {g.count != null && <Chip label="Count" value={String(g.count)} />}
            {g.sectionSize != null && <Chip label="Section" value={`${g.sectionSize}px`} />}
          </div>
          {g.pattern && <span className="dlg-badge dlg-badge-info" style={{ fontSize: 10 }}>{g.pattern}</span>}
        </div>
      ))}
    </div>
  )
}

function PatternsGrid({ patterns }) {
  if (!patterns?.length) return <Empty label="No patterns extracted" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {patterns.map((p, i) => (
        <div key={i} className="dlg-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{p.name}</div>
          {p.description && <div className="t-sm" style={{ color: 'var(--dlg-text-2)', marginBottom: 8 }}>{p.description}</div>}
          {p.components?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {p.components.map((c, j) => <span key={j} className="dlg-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{c}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Chip({ label, value }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: 'var(--dlg-text-3)' }}>{label}: </span>
      <span className="t-mono">{value}</span>
    </div>
  )
}

function Empty({ label }) {
  return <div style={{ padding: 32, textAlign: 'center', color: 'var(--dlg-text-3)' }}>{label}</div>
}

function isColor(v) {
  return v && (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl'))
}

function flattenColors(result) {
  const out = []
  const cols = result?.variables?.collections || {}
  const prims = cols['Primitives'] || []
  if (Array.isArray(prims)) {
    prims.filter((v) => v.resolvedType === 'COLOR').forEach((v) => out.push({ name: v.name, value: v.value, confidence: 'extracted' }))
  }
  const colorCol = cols['Color'] || []
  if (Array.isArray(colorCol)) {
    colorCol.filter((v) => v.resolvedType === 'COLOR').forEach((v) => out.push({ name: v.name, value: v.lightValue || v.value, confidence: 'semantic' }))
  }
  const styles = result?.styles?.color
  if (Array.isArray(styles)) styles.forEach((s) => out.push({ name: s.name, value: s.color || s.value, usage: s.usage, confidence: 'style' }))
  return out
}

export default function Review() {
  const { state } = useApp()
  const [tab, setTab] = useState('Colors')

  if (!state.result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 32 }}>
        <div className="t-h2">No design system loaded</div>
        <p className="t-body" style={{ color: 'var(--dlg-text-2)' }}>Go through Upload → Extract first.</p>
        <button className="dlg-btn dlg-btn-primary" onClick={() => go('/upload')}>Start Over</button>
      </div>
    )
  }

  const r = state.result
  const colors = flattenColors(r)
  const textStyles = r?.styles?.text || []
  const components = r?.components || []
  const effectStyles = r?.styles?.effects || []
  const gridStyles = r?.styles?.grids || []
  const patterns = r?.patterns || []

  const allTokens = Object.values(r?.variables?.collections || {}).flat()
  const tokenCount = allTokens.length

  const counts = {
    Colors: colors.length,
    Typography: textStyles.length,
    Tokens: tokenCount,
    Components: components.length,
    Effects: effectStyles.length,
    Grids: gridStyles.length,
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ marginBottom: 4 }}>{r.meta?.name || state.projectName || 'Design System'}</h1>
          <p className="t-sm" style={{ color: 'var(--dlg-text-2)' }}>
            Review and edit the extracted design tokens, then export.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dlg-btn" onClick={() => go('/extract')}>← Re-extract</button>
          <button className="dlg-btn dlg-btn-primary" onClick={() => go('/export')}>Export →</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="dlg-badge dlg-badge-brand">{v} {k}</span>
        ))}
        {patterns.length > 0 && <span className="dlg-badge dlg-badge-info">{patterns.length} Patterns</span>}
        {r.meta?.primaryColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="dlg-badge dlg-badge-info">
            <div className="dlg-swatch" style={{ width: 14, height: 14, background: r.meta.primaryColor, border: 'none', borderRadius: 3 }} />
            {r.meta.primaryColor}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={`dlg-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t} {counts[t] > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>({counts[t]})</span>}
          </button>
        ))}
        {patterns.length > 0 && (
          <button className={`dlg-tab${tab === 'Patterns' ? ' active' : ''}`} onClick={() => setTab('Patterns')}>
            Patterns <span style={{ fontSize: 11, opacity: 0.7 }}>({patterns.length})</span>
          </button>
        )}
      </div>

      {tab === 'Colors' && <ColorGrid colors={colors} />}
      {tab === 'Typography' && <TypographyList styles={textStyles} />}
      {tab === 'Tokens' && <TokensTab result={r} />}
      {tab === 'Components' && <ComponentGrid components={components} />}
      {tab === 'Effects' && <EffectList effects={effectStyles} />}
      {tab === 'Grids' && <GridList grids={gridStyles} />}
      {tab === 'Patterns' && <PatternsGrid patterns={patterns} />}
    </div>
  )
}
