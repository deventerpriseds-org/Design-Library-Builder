import React, { useState, useEffect } from 'react'
import { useApp, go } from '../state.jsx'
import { listDesignSystems, saveDesignSystem } from '../api.js'

export function ComponentShowcase({ result }) {
  const primary = result?.meta?.primaryColor || '#1B4F5C'
  const secondary = result?.meta?.secondaryColor || primary
  const brandSoft = primary + '20'
  const fonts = [...new Set((result?.styles?.text || []).map((t) => t.fontFamily).filter(Boolean))]
  const bodyFont = fonts[0] || 'Inter, system-ui, sans-serif'
  const headFont = fonts[1] || fonts[0] || 'Inter, system-ui, sans-serif'
  const monoFont = result?.meta?.monoFontFamily || 'ui-monospace, SFMono-Regular, monospace'

  const textStyles = result?.styles?.text || []
  const colors = (() => {
    const out = []
    const prims = result?.variables?.collections?.Primitives
    if (Array.isArray(prims)) prims.filter((v) => v.type === 'color' || v.resolvedType === 'COLOR').slice(0, 16).forEach((v) => out.push({ name: v.name, value: v.value }))
    const styleColors = result?.styles?.color || []
    if (!out.length) styleColors.slice(0, 16).forEach((s) => out.push({ name: s.name, value: s.color || s.value }))
    return out
  })()
  const components = result?.components || []

  const S = {
    brand: primary,
    secondary,
    brandSoft,
    surface: '#fff',
    bg: result?.meta?.bgColor || '#F8F9FA',
    border: result?.meta?.borderColor || '#E2E8F0',
    text: result?.meta?.textColor || '#0F172A',
    text2: '#64748B',
    radius: result?.meta?.buttonRadius || 8,
    cardRadius: result?.meta?.cardRadius || 12,
    bodyFont,
    headFont,
    monoFont,
  }

  const [activeNav, setActiveNav] = useState('Home')
  const [activeSidebar, setActiveSidebar] = useState('Dashboard')
  const [activeTab, setActiveTab] = useState('Overview')
  const [accordionOpen, setAccordionOpen] = useState(0)

  return (
    <div style={{ fontFamily: S.bodyFont, color: S.text }}>

      {/* Typography */}
      <Section title="Typography">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {textStyles.slice(0, 8).map((ts, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div style={{ width: 100, fontSize: 11, color: S.text2, flexShrink: 0 }}>{ts.name}</div>
              <div style={{ fontFamily: ts.fontFamily || bodyFont, fontSize: Math.min(ts.fontSize || 14, 36), fontWeight: ts.fontWeight || 400, lineHeight: ts.lineHeight?.value || ts.lineHeight || 1.4 }}>
                {ts.name} — The quick brown fox
              </div>
            </div>
          ))}
          {!textStyles.length && (
            <>
              {[{l:'Display', s:36, w:700},{l:'Heading 1', s:28, w:700},{l:'Heading 2', s:22, w:600},{l:'Heading 3', s:18, w:600},{l:'Body', s:15, w:400},{l:'Body Small', s:13, w:400},{l:'Caption', s:12, w:400},{l:'Label', s:11, w:600}].map((t) => (
                <div key={t.l} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <div style={{ width: 100, fontSize: 11, color: S.text2, flexShrink: 0 }}>{t.l}</div>
                  <div style={{ fontFamily: t.l.includes('Display') || t.l.includes('Head') ? S.headFont : S.bodyFont, fontSize: t.s, fontWeight: t.w }}>The quick brown fox jumps over the lazy dog</div>
                </div>
              ))}
            </>
          )}
        </div>
      </Section>

      {/* Colors */}
      <Section title="Colors">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {colors.length ? colors.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: c.value, border: '1px solid rgba(0,0,0,0.08)' }} />
              <div style={{ fontSize: 10, color: S.text2, textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            </div>
          )) : (
            ['50','100','200','300','400','500','600','700','800','900'].map((shade) => (
              <div key={shade} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: S.brand, opacity: parseInt(shade) / 1000 + 0.05, border: '1px solid rgba(0,0,0,0.08)' }} />
                <div style={{ fontSize: 10, color: S.text2 }}>{shade}</div>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Btn bg={S.brand} color="#fff" radius={S.radius} label="Primary" />
          <Btn bg="transparent" color={S.brand} border={S.brand} radius={S.radius} label="Secondary" />
          <Btn bg="transparent" color={S.text2} border={S.border} radius={S.radius} label="Default" />
          <Btn bg="#DC2626" color="#fff" radius={S.radius} label="Destructive" />
          <Btn bg={S.brand} color="#fff" radius={S.radius} label="Disabled" disabled />
          <Btn bg={S.brandSoft} color={S.brand} radius={S.radius} label="Soft" />
          <Btn bg={S.secondary} color="#fff" radius={S.radius} label="Secondary Fill" />
        </div>
      </Section>

      {/* Badges & Pills */}
      <Section title="Badges & Pills">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {[
            { bg: S.brandSoft, color: S.brand, label: 'Brand' },
            { bg: '#DCFCE7', color: '#16A34A', label: 'Success' },
            { bg: '#FEF9C3', color: '#D97706', label: 'Warning' },
            { bg: '#FEE2E2', color: '#DC2626', label: 'Error' },
            { bg: '#DBEAFE', color: '#2563EB', label: 'Info' },
            { bg: '#F1F5F9', color: '#64748B', label: 'Neutral' },
          ].map((b) => (
            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 9999, background: b.bg, color: b.color, fontSize: 12, fontWeight: 500 }}>{b.label}</span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 9999, background: S.bg, color: S.text2, fontSize: 13, fontWeight: 500, border: `1px solid ${S.border}` }}>Pill</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 9999, background: S.brandSoft, color: S.brand, fontSize: 13, fontWeight: 500 }}>Active Pill</span>
        </div>
      </Section>

      {/* Banners */}
      <Section title="Banners / Alerts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { bg: '#DBEAFE', color: '#2563EB', icon: 'ℹ', msg: 'This is an informational banner message.' },
            { bg: '#DCFCE7', color: '#16A34A', icon: '✓', msg: 'Action completed successfully.' },
            { bg: '#FEF9C3', color: '#D97706', icon: '⚠', msg: 'Please review before continuing.' },
            { bg: '#FEE2E2', color: '#DC2626', icon: '✕', msg: 'Something went wrong. Please try again.' },
          ].map((b) => (
            <div key={b.icon} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: b.bg, color: b.color, fontSize: 14 }}>
              <span style={{ fontSize: 16 }}>{b.icon}</span> {b.msg}
            </div>
          ))}
        </div>
      </Section>

      {/* Form Inputs */}
      <Section title="Form Inputs">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <LabeledInput label="Default" value="Input value" radius={S.radius} border={S.border} brand={S.brand} text={S.text} text2={S.text2} />
          <LabeledInput label="Placeholder" placeholder="Placeholder text" radius={S.radius} border={S.border} brand={S.brand} text={S.text} text2={S.text2} />
          <LabeledInput label="Focused" value="Active state" focused radius={S.radius} border={S.border} brand={S.brand} text={S.text} text2={S.text2} />
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text2, marginBottom: 4 }}>Select</label>
            <select style={{ width: '100%', padding: '0 12px', height: 38, border: `1px solid ${S.border}`, borderRadius: S.radius, background: '#fff', fontSize: 14, color: S.text, fontFamily: S.bodyFont }}>
              <option>Option one</option>
              <option>Option two</option>
              <option>Option three</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text2, marginBottom: 8 }}>Checkbox &amp; Radio</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Checkbox A', 'Checkbox B'].map((l, i) => (
                <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${i === 0 ? S.brand : S.border}`, background: i === 0 ? S.brand : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i === 0 && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                  </div>
                  {l}
                </label>
              ))}
              {['Radio A', 'Radio B'].map((l, i) => (
                <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 9999, border: `2px solid ${i === 0 ? S.brand : S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i === 0 && <div style={{ width: 7, height: 7, borderRadius: 9999, background: S.brand }} />}
                  </div>
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text2, marginBottom: 4 }}>Textarea</label>
            <textarea readOnly value="Multi-line text input for longer content. Expands vertically." style={{ width: '100%', padding: '8px 12px', border: `1px solid ${S.border}`, borderRadius: S.radius, background: '#fff', fontSize: 14, color: S.text, fontFamily: S.bodyFont, resize: 'none', height: 76 }} />
          </div>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.cardRadius, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Basic Card</div>
            <div style={{ fontSize: 13, color: S.text2 }}>Card with subtle shadow and border.</div>
          </div>
          <div style={{ background: S.surface, border: `1px solid ${S.brand}`, borderRadius: S.cardRadius, padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: S.brand }}>Brand Card</div>
            <div style={{ fontSize: 13, color: S.text2 }}>Card with brand border accent.</div>
          </div>
          <div style={{ background: S.brand, borderRadius: S.cardRadius, padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: '#fff' }}>Filled Card</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Brand filled card variant.</div>
          </div>
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: S.cardRadius, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9999, background: S.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.brand, fontWeight: 700, fontSize: 14 }}>DS</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Media Card</div>
                <div style={{ fontSize: 12, color: S.text2 }}>User · just now</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: S.text2 }}>Card with avatar and metadata.</div>
          </div>
        </div>
      </Section>

      {/* Navigation Bar */}
      <Section title="Navigation Bar">
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 20px', height: 52, borderBottom: `1px solid ${S.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: S.brand, marginRight: 32, fontFamily: S.headFont }}>Brand</div>
            {['Home', 'Products', 'Pricing', 'About'].map((item) => (
              <button key={item} onClick={() => setActiveNav(item)}
                style={{ padding: '0 14px', height: 52, border: 'none', background: 'none', fontSize: 14, fontWeight: activeNav === item ? 600 : 400, color: activeNav === item ? S.brand : S.text2, borderBottom: activeNav === item ? `2px solid ${S.brand}` : '2px solid transparent', cursor: 'pointer', fontFamily: S.bodyFont }}>
                {item}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <Btn bg={S.brand} color="#fff" radius={S.radius} label="Sign in" />
          </div>
        </div>
      </Section>

      {/* Sidebar */}
      <Section title="Sidebar Navigation">
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden', maxWidth: 640 }}>
          <div style={{ width: 200, background: S.bg, borderRight: `1px solid ${S.border}`, padding: '16px 0' }}>
            {[
              { section: 'Main', items: ['Dashboard', 'Analytics', 'Reports'] },
              { section: 'Settings', items: ['Profile', 'Billing', 'Team'] },
            ].map((g) => (
              <div key={g.section} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: S.text2, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 16px', marginBottom: 4 }}>{g.section}</div>
                {g.items.map((item) => (
                  <button key={item} onClick={() => setActiveSidebar(item)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', background: activeSidebar === item ? S.brandSoft : 'none', color: activeSidebar === item ? S.brand : S.text, fontSize: 14, fontWeight: activeSidebar === item ? 600 : 400, cursor: 'pointer', fontFamily: S.bodyFont }}>
                    {item}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, fontFamily: S.headFont }}>{activeSidebar}</div>
            <div style={{ fontSize: 14, color: S.text2 }}>Content area for the {activeSidebar} section would render here.</div>
          </div>
        </div>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <div style={{ border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, background: S.bg }}>
            {['Overview', 'Details', 'Activity', 'Settings'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ padding: '10px 18px', border: 'none', background: 'none', fontSize: 14, fontWeight: activeTab === t ? 600 : 400, color: activeTab === t ? S.brand : S.text2, borderBottom: activeTab === t ? `2px solid ${S.brand}` : '2px solid transparent', cursor: 'pointer', fontFamily: S.bodyFont }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 14, color: S.text2 }}>Content for the <strong style={{ color: S.text }}>{activeTab}</strong> tab.</div>
          </div>
        </div>
      </Section>

      {/* Table */}
      <Section title="Table">
        <div style={{ border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                {['Name', 'Role', 'Status', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: S.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Alex Johnson', role: 'Designer', status: 'Active' },
                { name: 'Sam Rivera', role: 'Engineer', status: 'Active' },
                { name: 'Jordan Lee', role: 'Manager', status: 'Away' },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 1 ? S.bg : S.surface }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 16px', color: S.text2 }}>{row.role}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: row.status === 'Active' ? '#16A34A' : '#D97706' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 9999, background: row.status === 'Active' ? '#16A34A' : '#D97706', flexShrink: 0 }} />
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button style={{ fontSize: 12, color: S.brand, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Avatars */}
      <Section title="Avatars">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
          {[{ size: 28, label: 'XS' }, { size: 36, label: 'SM' }, { size: 44, label: 'MD' }, { size: 56, label: 'LG' }, { size: 72, label: 'XL' }].map(({ size, label }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: size, height: size, borderRadius: 9999, background: S.brandSoft, border: `2px solid ${S.brand}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.brand, fontWeight: 700, fontSize: size * 0.32 }}>DS</div>
                {size >= 44 && <div style={{ position: 'absolute', bottom: 1, right: 1, width: size * 0.22, height: size * 0.22, borderRadius: 9999, background: '#16A34A', border: '2px solid white' }} />}
              </div>
              <div style={{ fontSize: 11, color: S.text2 }}>{label}</div>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex' }}>
              {['#1B4F5C','#D97706','#2563EB','#16A34A'].map((bg, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 9999, background: bg, border: '2px solid white', marginLeft: i ? -10 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{String.fromCharCode(65 + i)}</div>
              ))}
              <div style={{ width: 36, height: 36, borderRadius: 9999, background: S.bg, border: `2px solid ${S.border}`, marginLeft: -10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: S.text2 }}>+8</div>
            </div>
            <div style={{ fontSize: 11, color: S.text2 }}>Group</div>
          </div>
        </div>
      </Section>

      {/* Progress & Spinner */}
      <Section title="Progress & Loaders">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[100, 72, 45, 20].map((pct) => (
            <div key={pct} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 8, background: S.border, borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16A34A' : S.brand, borderRadius: 9999, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: 13, color: S.text2, width: 36, textAlign: 'right' }}>{pct}%</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 4 }}>
            {[{ size: 20, bw: 2 }, { size: 32, bw: 3 }, { size: 44, bw: 4 }].map(({ size, bw }, i) => (
              <div key={i} className="dlg-spinner" style={{ width: size, height: size, borderWidth: bw }} />
            ))}
            <div style={{ display: 'flex', gap: 5 }}>
              {[0,1,2].map((i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: 9999, background: S.brand, opacity: 0.3 + i * 0.35 }} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Accordion */}
      <Section title="Accordion">
        <div style={{ border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden' }}>
          {[
            { title: 'What is a design system?', body: 'A design system is a collection of reusable components, guided by clear standards, that can be assembled to build any number of applications.' },
            { title: 'How are tokens organized?', body: 'Tokens are organized in three tiers: Primitives (raw values), Semantic (contextual aliases), and Component Tokens (per-component overrides).' },
            { title: 'Can I export to Figma?', body: 'Yes — click "Open in Figma" in the top bar to push the complete design system directly to a Figma file using the Figma MCP integration.' },
          ].map((item, i) => (
            <div key={i} style={{ borderBottom: i < 2 ? `1px solid ${S.border}` : 'none' }}>
              <button onClick={() => setAccordionOpen(accordionOpen === i ? -1 : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: S.text, cursor: 'pointer', textAlign: 'left', fontFamily: S.bodyFont }}>
                {item.title}
                <span style={{ color: S.brand, fontSize: 18, lineHeight: 1, transform: accordionOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
              </button>
              {accordionOpen === i && (
                <div style={{ padding: '0 18px 16px', fontSize: 14, color: S.text2, lineHeight: 1.6 }}>{item.body}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Modal Frame */}
      <Section title="Modal / Dialog">
        <div style={{ border: `1px solid ${S.border}`, borderRadius: S.cardRadius, overflow: 'hidden', background: 'rgba(0,0,0,0.04)', padding: 24 }}>
          <div style={{ background: S.surface, borderRadius: S.cardRadius, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', maxWidth: 420, margin: '0 auto', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: S.headFont }}>Confirm Action</div>
              <button style={{ background: 'none', border: 'none', fontSize: 18, color: S.text2, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 14, color: S.text2, lineHeight: 1.6 }}>
              This action cannot be undone. Are you sure you want to proceed?
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn bg="transparent" color={S.text2} border={S.border} radius={S.radius} label="Cancel" />
              <Btn bg={S.brand} color="#fff" radius={S.radius} label="Confirm" />
            </div>
          </div>
        </div>
      </Section>

      {/* Code Block */}
      <Section title="Code Block">
        <div style={{ background: '#0F172A', borderRadius: S.cardRadius, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {['#FF5F57','#FEBC2E','#28C840'].map((c) => <div key={c} style={{ width: 11, height: 11, borderRadius: 9999, background: c }} />)}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontFamily: monoFont }}>design-tokens.json</span>
          </div>
          <pre style={{ margin: 0, padding: '16px 20px', fontFamily: monoFont, fontSize: 13, lineHeight: 1.7, color: '#E2E8F0', overflowX: 'auto' }}>{`{
  "color": {
    "brand": { "value": "${primary}", "type": "color" },
    "surface": { "value": "#FFFFFF", "type": "color" },
    "text": { "value": "#0F172A", "type": "color" }
  },
  "spacing": {
    "4": { "value": "4px" },
    "8": { "value": "8px" },
    "16": { "value": "16px" }
  }
}`}</pre>
        </div>
      </Section>

      {/* Tooltip preview */}
      <Section title="Tooltip">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {['Top', 'Bottom', 'Left', 'Right'].map((pos) => (
            <div key={pos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button style={{ padding: '6px 14px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: S.radius, fontSize: 13, cursor: 'default', fontFamily: S.bodyFont }}>{pos}</button>
                <div style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', background: '#0F172A', color: '#fff', fontSize: 11, padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  Tooltip on {pos.toLowerCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Components extracted */}
      {components.length > 0 && (
        <Section title={`Components (${components.length} extracted)`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {components.map((c, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: S.brand }}>▦</span> {c.name}
                {c.variants?.length > 0 && <span style={{ fontSize: 11, color: S.text2 }}>×{c.variants.length}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dlg-text-2)' }}>{title}</div>
        <div style={{ flex: 1, height: 1, background: 'var(--dlg-border)' }} />
      </div>
      {children}
    </div>
  )
}

function Btn({ bg, color, border, radius, label, disabled }) {
  return (
    <button disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', padding: '0 16px', height: 38, borderRadius: radius, background: bg, color, border: border ? `1px solid ${border}` : '1px solid transparent', fontWeight: 500, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: 'inherit' }}>
      {label}
    </button>
  )
}

function LabeledInput({ label, value, placeholder, focused, radius, border, brand, text, text2 }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text2, marginBottom: 4 }}>{label}</label>
      <input readOnly value={value} placeholder={placeholder}
        style={{ width: '100%', padding: '0 12px', height: 38, border: focused ? `2px solid ${brand}` : `1px solid ${border}`, borderRadius: radius, background: '#fff', fontSize: 14, outline: 'none', color: text, boxSizing: 'border-box' }} />
    </div>
  )
}

export default function Showcase() {
  const { state, dispatch } = useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)

  useEffect(() => {
    if (state.user && !state.savedSystems.length) {
      setLoading(true)
      listDesignSystems().then((systems) => {
        dispatch({ type: 'SET_SAVED', systems })
        if (systems.length && !state.activeSystemId) dispatch({ type: 'SET_ACTIVE', id: systems[0].id })
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [state.user])

  const options = [
    ...(state.result ? [{ id: '__current', meta: { name: state.projectName || 'Current Session' }, ...state.result }] : []),
    ...state.savedSystems,
  ]

  const activeId = state.activeSystemId || (state.result ? '__current' : null)
  const activeSystem = options.find((s) => s.id === activeId) || options[0]

  async function handleSave() {
    if (!state.result || saving) return
    setSaving(true)
    try {
      const saved = await saveDesignSystem({ meta: { name: state.projectName, ...state.result.meta }, ...state.result })
      dispatch({ type: 'SET_SAVED', systems: [saved, ...state.savedSystems] })
      setSavedId(saved.id)
    } catch (e) { /* silently fail */ }
    setSaving(false)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="t-h3">Design System Showcase</div>
        <div style={{ flex: 1 }} />
        {loading && <div className="dlg-spinner" />}
        {options.length > 0 && (
          <select
            value={activeId || ''}
            onChange={(e) => dispatch({ type: 'SET_ACTIVE', id: e.target.value })}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)', color: 'var(--dlg-text)', fontSize: 14, cursor: 'pointer', minWidth: 180, fontFamily: 'inherit' }}>
            {options.map((s) => (
              <option key={s.id} value={s.id}>{s.meta?.name || s.projectName || s.id}</option>
            ))}
          </select>
        )}
        {state.result && !savedId && state.user && (
          <button className="dlg-btn" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
            {saving ? <><div className="dlg-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Saving…</> : '💾 Save'}
          </button>
        )}
        {savedId && <span className="dlg-badge dlg-badge-success">Saved ✓</span>}
        <button className="dlg-btn" onClick={() => go('/export')} title="Download tokens">
          ⬇ Download
        </button>
        {state.result && (
          <button className="dlg-btn dlg-btn-primary" onClick={() => go('/export?target=figma')} title="Push to Figma">
            ◆ Open in Figma
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--dlg-bg)' }}>
        {activeSystem ? (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeSystem.meta?.primaryColor && (
                <div style={{ width: 28, height: 28, borderRadius: 6, background: activeSystem.meta.primaryColor, flexShrink: 0, border: '2px solid rgba(0,0,0,0.1)' }} />
              )}
              <div>
                <div className="t-h2">{activeSystem.meta?.name || 'Untitled System'}</div>
                {activeSystem.meta?.extractedAt && (
                  <div className="t-xs" style={{ color: 'var(--dlg-text-3)' }}>
                    Generated {new Date(activeSystem.meta.extractedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            <ComponentShowcase result={activeSystem} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
            <div style={{ fontSize: 40 }}>▦</div>
            <div className="t-h2" style={{ color: 'var(--dlg-text-2)' }}>Nothing to preview yet</div>
            <p className="t-body" style={{ color: 'var(--dlg-text-3)', textAlign: 'center' }}>
              Extract a design system first, then come here to see all components live.
            </p>
            <button className="dlg-btn dlg-btn-primary" onClick={() => go('/upload')}>Start Extraction</button>
          </div>
        )}
      </div>
    </div>
  )
}
