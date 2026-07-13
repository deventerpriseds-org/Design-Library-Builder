import React, { useState, useEffect } from 'react'
import { useApp, go } from '../state.jsx'
import { ComponentShowcase } from './Showcase.jsx'
import { listPalettes, savePalette } from '../api.js'

const TABS = ['Preview', 'Colors', 'Typography', 'Tokens', 'Components', 'Effects', 'Grids']

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
      {styles.map((s, i) => (
        <div key={i} className="dlg-card" style={{ padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 120, flex: '0 0 auto' }}>
            <div style={{ fontSize: 12, color: 'var(--dlg-text-3)', marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontFamily: s.fontFamily || 'inherit', fontSize: Math.min(s.fontSize || 16, 32), fontWeight: s.fontWeight || 400, lineHeight: s.lineHeight?.value || s.lineHeight || 1.5 }}>
              {s.name}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {s.fontFamily && <Chip label="Font" value={s.fontFamily} />}
            {s.fontSize && <Chip label="Size" value={`${s.fontSize}px`} />}
            {s.fontWeight && <Chip label="Weight" value={String(s.fontWeight)} />}
            {s.lineHeight != null && <Chip label="Line" value={typeof s.lineHeight === 'object' ? `${s.lineHeight.value}${s.lineHeight.unit === 'PERCENT' ? '%' : 'px'}` : String(s.lineHeight)} />}
            {s.letterSpacing != null && <Chip label="Tracking" value={typeof s.letterSpacing === 'object' ? `${s.letterSpacing.value}${s.letterSpacing.unit === 'PERCENT' ? '%' : 'px'}` : `${s.letterSpacing}em`} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function TokenTable({ tokens }) {
  if (!tokens?.length) return <Empty label="No semantic tokens extracted" />
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dlg-border)' }}>
            {['Name', 'Light', 'Dark', 'Type'].map((h) => (
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
              <td style={{ padding: '8px 12px' }}>
                <span className="dlg-badge dlg-badge-brand">{t.type || 'color'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComponentGrid({ components }) {
  if (!components?.length) return <Empty label="No components extracted" />
  const tiers = ['atom', 'molecule', 'organism', 'pattern']
  return (
    <div>
      {tiers.map((tier) => {
        const items = components.filter((c) => c.tier === tier)
        if (!items.length) return null
        return (
          <div key={tier} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dlg-text-3)', marginBottom: 8 }}>{tier}s</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {items.map((c, i) => (
                <div key={i} className="dlg-card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: c.variants?.length ? 10 : 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--dlg-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>▦</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: 11, color: 'var(--dlg-text-3)' }}>{c.description}</div>}
                    </div>
                  </div>
                  {c.variants?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {c.variants.map((v, j) => <span key={j} className="dlg-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{v}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {!tiers.some((t) => components.some((c) => c.tier === t)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {components.map((c, i) => (
            <div key={i} className="dlg-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--dlg-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>▦</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
              </div>
            </div>
          ))}
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
          <div className="t-mono" style={{ fontSize: 11, color: 'var(--dlg-text-2)' }}>{e.value || e.css || 'see token'}</div>
          {e.type && <span className="dlg-badge dlg-badge-info" style={{ marginTop: 8, fontSize: 10 }}>{e.type}</span>}
        </div>
      ))}
    </div>
  )
}

function GridList({ grids }) {
  if (!grids?.length) return <Empty label="No grid styles extracted" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
      {grids.map((g, i) => (
        <div key={i} className="dlg-card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{g.name}</div>
          {g.pattern && <div style={{ fontSize: 12, color: 'var(--dlg-text-2)', marginBottom: 4 }}>Pattern: <span className="t-mono">{g.pattern}</span></div>}
          {g.columns != null && <div style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>Columns: {g.columns}</div>}
          {g.gutter != null && <div style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>Gutter: {g.gutter}px</div>}
          {g.margin != null && <div style={{ fontSize: 12, color: 'var(--dlg-text-2)' }}>Margin: {g.margin}px</div>}
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
  const prims = result?.variables?.collections?.Primitives
  if (Array.isArray(prims)) {
    prims.filter((v) => v.type === 'color' || v.resolvedType === 'COLOR').forEach((v) => out.push({ name: v.name, value: v.value, confidence: 'extracted' }))
  } else if (prims && typeof prims === 'object') {
    Object.entries(prims).forEach(([n, v]) => {
      if (typeof v === 'string' && (v.startsWith('#') || v.startsWith('rgb'))) out.push({ name: n, value: v, confidence: 'extracted' })
    })
  }
  const styles = result?.styles?.color
  if (Array.isArray(styles)) styles.forEach((s) => out.push({ name: s.name, value: s.color || s.value, usage: s.usage, confidence: 'style' }))
  return out
}

function flattenTokens(result) {
  const col = result?.variables?.collections?.Color
  if (Array.isArray(col)) return col.map((t) => ({ name: t.name, lightValue: t.lightValue || t.value, darkValue: t.darkValue, type: t.resolvedType || t.type || 'color' }))
  const tok = result?.variables?.collections?.Tokens
  if (Array.isArray(tok)) return tok.map((t) => ({ name: t.name, lightValue: t.lightValue || t.value, darkValue: t.darkValue, type: t.resolvedType || t.type || 'color' }))
  if (tok && typeof tok === 'object') {
    return Object.entries(tok).map(([n, v]) => ({ name: n, lightValue: typeof v === 'string' ? v : v?.light, darkValue: v?.dark, type: 'color' }))
  }
  return []
}

function parseTweak(text, result) {
  const patch = { meta: { ...result?.meta } }
  const t = text.toLowerCase()
  const hexMatch = text.match(/#[0-9a-fA-F]{3,6}/)
  const numMatch = text.match(/\b(\d+)(px)?\b/)
  const num = numMatch ? parseInt(numMatch[1]) : null

  if (hexMatch && (t.includes('primary') || t.includes('brand') || t.includes('color'))) {
    patch.meta.primaryColor = hexMatch[0]
  }
  if (hexMatch && (t.includes('secondary'))) {
    patch.meta.secondaryColor = hexMatch[0]
  }
  if (hexMatch && (t.includes('background') || t.includes('bg'))) {
    patch.meta.bgColor = hexMatch[0]
  }
  if (num != null && (t.includes('button radius') || t.includes('btn radius') || t.includes('button rounded') || t.includes('radius'))) {
    patch.meta.buttonRadius = num
    patch.meta.cardRadius = Math.max(num, Math.round(num * 1.5))
  }
  if (hexMatch && (t.includes('text') && !t.includes('button'))) {
    patch.meta.textColor = hexMatch[0]
  }
  if (hexMatch && t.includes('border')) {
    patch.meta.borderColor = hexMatch[0]
  }
  return patch
}

function applyPaletteToResult(result, palette) {
  if (!palette) return result
  const patch = {
    meta: {
      ...result.meta,
      ...(palette.primary_color && { primaryColor: palette.primary_color }),
      ...(palette.secondary_color && { secondaryColor: palette.secondary_color }),
      ...(palette.bg_color && { bgColor: palette.bg_color }),
      ...(palette.surface_color && { surfaceColor: palette.surface_color }),
      ...(palette.text_color && { textColor: palette.text_color }),
      ...(palette.border_color && { borderColor: palette.border_color }),
    },
  }
  if (palette.primitives) {
    patch.variables = {
      ...result.variables,
      collections: {
        ...result.variables?.collections,
        Primitives: palette.primitives,
      },
    }
  }
  if (palette.color_tokens) {
    patch.variables = {
      ...patch.variables,
      collections: {
        ...(patch.variables?.collections || result.variables?.collections),
        Color: palette.color_tokens,
      },
    }
  }
  if (palette.style_colors) {
    patch.styles = { ...result.styles, color: palette.style_colors }
  }
  return { ...result, ...patch }
}

function PalettePicker({ result, dispatch, savedPalettes }) {
  const [open, setOpen] = useState(false)
  const [customPrimary, setCustomPrimary] = useState(result?.meta?.primaryColor || '')
  const [customSecondary, setCustomSecondary] = useState(result?.meta?.secondaryColor || '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSavePalette() {
    if (!result?.meta?.primaryColor) return
    setSaving(true)
    try {
      const saved = await savePalette({
        orgId: 'default',
        name: `${result.meta.name || 'System'} — ${result.meta.primaryColor}`,
        primaryColor: result.meta.primaryColor,
        secondaryColor: result.meta.secondaryColor,
        bgColor: result.meta.bgColor,
        surfaceColor: result.meta.surfaceColor,
        textColor: result.meta.textColor,
        borderColor: result.meta.borderColor,
        primitives: result.variables?.collections?.Primitives?.filter(v => v.type === 'color' || v.resolvedType === 'COLOR'),
        colorTokens: result.variables?.collections?.Color,
        styleColors: result.styles?.color,
        extractedFromSystemId: result.meta?.extractedAt,
      })
      dispatch({ type: 'ADD_PALETTE', palette: saved })
      setSaveMsg('Palette saved ✓')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch {}
    setSaving(false)
  }

  function applyCustom() {
    if (!customPrimary) return
    const patch = { meta: { ...result.meta, primaryColor: customPrimary, secondaryColor: customSecondary || customPrimary } }
    dispatch({ type: 'PATCH_RESULT', patch })
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="dlg-btn"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 4, background: result?.meta?.primaryColor || '#888', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
        Color Palette ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: 'var(--dlg-surface)', border: '1px solid var(--dlg-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 300, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dlg-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Org Palettes</div>
          {savedPalettes.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--dlg-text-3)', marginBottom: 10 }}>No saved palettes yet. Save one after extraction.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {savedPalettes.map(p => (
              <button key={p.id} onClick={() => { dispatch({ type: 'PATCH_RESULT', patch: applyPaletteToResult(result, p) }); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--dlg-border)', background: 'var(--dlg-bg)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: p.primary_color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                {p.secondary_color && <div style={{ width: 12, height: 12, borderRadius: 3, background: p.secondary_color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dlg-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Custom Colors</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--dlg-text-2)', marginBottom: 3, display: 'block' }}>Primary</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={customPrimary || '#000000'} onChange={e => setCustomPrimary(e.target.value)} style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} />
                <input value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} placeholder="#hex" style={{ flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--dlg-border)', borderRadius: 5, fontSize: 12, fontFamily: 'monospace', minWidth: 0 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--dlg-text-2)', marginBottom: 3, display: 'block' }}>Secondary</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={customSecondary || customPrimary || '#000000'} onChange={e => setCustomSecondary(e.target.value)} style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} />
                <input value={customSecondary} onChange={e => setCustomSecondary(e.target.value)} placeholder="#hex" style={{ flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--dlg-border)', borderRadius: 5, fontSize: 12, fontFamily: 'monospace', minWidth: 0 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="dlg-btn dlg-btn-primary" onClick={applyCustom} style={{ flex: 1, height: 30, fontSize: 12 }}>Apply</button>
            <button className="dlg-btn" onClick={handleSavePalette} disabled={saving} style={{ flex: 1, height: 30, fontSize: 12 }}>
              {saving ? 'Saving…' : saveMsg || '💾 Save palette'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Review() {
  const { state, dispatch } = useApp()
  const [tab, setTab] = useState('Preview')
  const [tweak, setTweak] = useState('')
  const [tweakApplied, setTweakApplied] = useState(false)

  useEffect(() => {
    if (!state.savedPalettes.length) {
      listPalettes('default').then(palettes => dispatch({ type: 'SET_PALETTES', palettes })).catch(() => {})
    }
  }, [])

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
  const tokens = flattenTokens(r)
  const components = r?.components || []
  const effects = r?.styles?.effects || []
  const grids = r?.styles?.grids || []

  const counts = {
    Preview: null,
    Colors: colors.length,
    Typography: textStyles.length,
    Tokens: tokens.length,
    Components: components.length,
    Effects: effects.length,
    Grids: grids.length,
  }

  function applyTweak() {
    if (!tweak.trim()) return
    const patch = parseTweak(tweak, r)
    dispatch({ type: 'PATCH_RESULT', patch })
    setTweakApplied(true)
    setTweak('')
    setTab('Preview')
    setTimeout(() => setTweakApplied(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <h1 className="t-h1" style={{ marginBottom: 2 }}>{r.meta?.name || state.projectName || 'Design System'}</h1>
            <p className="t-sm" style={{ color: 'var(--dlg-text-2)', margin: 0 }}>
              Preview the assembled app, review each bin, and apply tweaks before pushing to Figma.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="dlg-btn" onClick={() => go('/extract')}>← Re-extract</button>
            <PalettePicker result={r} dispatch={dispatch} savedPalettes={state.savedPalettes} />
            <button className="dlg-btn dlg-btn-primary" onClick={() => go('/figma-push')} style={{ height: 38, padding: '0 20px' }}>
              Push to Figma →
            </button>
            <button className="dlg-btn" onClick={() => go('/showcase')} style={{ height: 38, padding: '0 16px' }}>
              Showcase →
            </button>
          </div>
        </div>

        {/* Tweak input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={tweak}
            onChange={(e) => setTweak(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyTweak()}
            placeholder='Describe a tweak, e.g. "make button radius 4px" or "primary color #3B82F6"'
            style={{ flex: 1, height: 36, padding: '0 12px', border: '1px solid var(--dlg-border)', borderRadius: 8, background: 'var(--dlg-bg)', color: 'var(--dlg-text)', fontSize: 13, fontFamily: 'inherit', minWidth: 0 }}
          />
          <button className="dlg-btn dlg-btn-primary" onClick={applyTweak} style={{ height: 36, padding: '0 16px', flexShrink: 0 }}>
            Apply
          </button>
          {tweakApplied && <span className="dlg-badge dlg-badge-success">Applied ✓</span>}
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        {Object.entries(counts).filter(([, v]) => v !== null && v > 0).map(([k, v]) => (
          <span key={k} className="dlg-badge dlg-badge-brand" style={{ cursor: 'pointer' }} onClick={() => setTab(k)}>{v} {k}</span>
        ))}
        {r.meta?.primaryColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="dlg-badge dlg-badge-info">
            <div className="dlg-swatch" style={{ width: 14, height: 14, background: r.meta.primaryColor, border: 'none', borderRadius: 3 }} />
            {r.meta.primaryColor}
          </div>
        )}
        {r.meta?.inferenceMap && Object.values(r.meta.inferenceMap).filter((v) => v === 'inferred').length > 0 && (
          <span className="dlg-badge dlg-badge-warning">
            {Object.values(r.meta.inferenceMap).filter((v) => v === 'inferred').length} inferred by Claude
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
        {TABS.map((t) => (
          <button key={t} className={`dlg-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}{counts[t] != null && counts[t] > 0 ? <span style={{ fontSize: 11, opacity: 0.7 }}> ({counts[t]})</span> : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: tab === 'Preview' ? 24 : '20px 24px', background: 'var(--dlg-bg)' }}>
        {tab === 'Preview' && (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <ComponentShowcase result={r} />
          </div>
        )}
        {tab === 'Colors' && <ColorGrid colors={colors} />}
        {tab === 'Typography' && <TypographyList styles={textStyles} />}
        {tab === 'Tokens' && <TokenTable tokens={tokens} />}
        {tab === 'Components' && <ComponentGrid components={components} />}
        {tab === 'Effects' && <EffectList effects={effects} />}
        {tab === 'Grids' && <GridList grids={grids} />}
      </div>
    </div>
  )
}
