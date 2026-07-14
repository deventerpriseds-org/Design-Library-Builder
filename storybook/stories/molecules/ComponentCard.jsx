import React, { useState } from 'react';

const styles = `
.dlg-card {
  background: var(--dlg-surface);
  border: 1px solid var(--dlg-border);
  border-radius: var(--dlg-radius-lg);
  box-shadow: var(--dlg-shadow-sm);
  overflow: hidden;
  font-family: inherit;
  transition: box-shadow 0.15s;
}
.dlg-card:hover { box-shadow: var(--dlg-shadow-md); }
.dlg-card__preview {
  background: var(--dlg-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  border-bottom: 1px solid var(--dlg-border);
}
.dlg-card__body { padding: 14px 16px 16px; }
.dlg-card__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dlg-card__name { font-size: 14px; font-weight: 600; color: var(--dlg-text); }
.dlg-card__tier {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dlg-brand);
  background: var(--dlg-brand-soft);
  padding: 2px 7px;
  border-radius: var(--dlg-radius-full);
}
.dlg-card__desc { font-size: 12px; color: var(--dlg-text-2); margin: 6px 0 12px; line-height: 1.5; }
.dlg-card__variants { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; }
.dlg-card__pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--dlg-radius-full);
  border: 1px solid var(--dlg-border);
  cursor: pointer;
  background: var(--dlg-surface);
  color: var(--dlg-text-2);
  font-family: inherit;
  transition: border-color 0.12s, background 0.12s;
}
.dlg-card__pill--active {
  border-color: var(--dlg-brand);
  background: var(--dlg-brand-soft);
  color: var(--dlg-brand);
}
.dlg-card__status { display: flex; gap: 10px; align-items: center; }
.dlg-card__dot-row { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dlg-text-3); }
.dlg-card__dot {
  width: 7px; height: 7px; border-radius: 50%;
}
.dlg-card__dot--green  { background: var(--dlg-success); }
.dlg-card__dot--yellow { background: var(--dlg-warning); }
.dlg-card__dot--grey   { background: var(--dlg-text-3); }
`;

const PREVIEW_MAP = {
  Button: ({ variant }) => (
    <button style={{
      padding: '0 16px', height: '36px', borderRadius: '8px', border: 'none',
      background: variant === 'Secondary' ? '#fff' : 'var(--dlg-brand)',
      color: variant === 'Secondary' ? 'var(--dlg-text)' : '#fff',
      fontSize: '14px', fontWeight: 500, cursor: 'pointer',
      border: variant === 'Secondary' ? '1px solid var(--dlg-border)' : 'none',
    }}>
      {variant === 'Danger' ? 'Delete' : variant === 'Ghost' ? 'Learn more' : 'Save changes'}
    </button>
  ),
  Badge: ({ variant }) => (
    <span style={{
      padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      background: variant === 'Success' ? 'var(--dlg-success-soft)' : 'var(--dlg-brand-soft)',
      color: variant === 'Success' ? 'var(--dlg-success)' : 'var(--dlg-brand)',
    }}>{variant}</span>
  ),
  Input: () => (
    <input style={{
      height: '36px', padding: '0 12px', borderRadius: '8px',
      border: '1px solid var(--dlg-border)', background: 'var(--dlg-surface)',
      color: 'var(--dlg-text)', fontSize: '14px', width: '180px',
    }} placeholder="Component name…" readOnly />
  ),
};

export function ComponentCard({
  name = 'Button',
  tier = 'Atom',
  description = 'Core interactive element for user actions.',
  variants = ['Primary', 'Secondary', 'Ghost', 'Danger'],
  appStatus = 'synced',
  figmaStatus = 'synced',
  storiesStatus = 'pending',
}) {
  const [activeVariant, setActiveVariant] = useState(variants[0]);
  const Preview = PREVIEW_MAP[name] || (() => <span style={{ color: 'var(--dlg-text-3)', fontSize: 13 }}>{name}</span>);

  const dot = (status) => status === 'synced' ? 'green' : status === 'pending' ? 'yellow' : 'grey';

  return (
    <>
      <style>{styles}</style>
      <div className="dlg-card">
        <div className="dlg-card__preview">
          <Preview variant={activeVariant} />
        </div>
        <div className="dlg-card__body">
          <div className="dlg-card__row">
            <span className="dlg-card__name">{name}</span>
            <span className="dlg-card__tier">{tier}</span>
          </div>
          <p className="dlg-card__desc">{description}</p>
          <div className="dlg-card__variants">
            {variants.map(v => (
              <button
                key={v}
                className={`dlg-card__pill${v === activeVariant ? ' dlg-card__pill--active' : ''}`}
                onClick={() => setActiveVariant(v)}
              >{v}</button>
            ))}
          </div>
          <div className="dlg-card__status">
            <div className="dlg-card__dot-row"><span className={`dlg-card__dot dlg-card__dot--${dot(appStatus)}`} />App</div>
            <div className="dlg-card__dot-row"><span className={`dlg-card__dot dlg-card__dot--${dot(figmaStatus)}`} />Figma</div>
            <div className="dlg-card__dot-row"><span className={`dlg-card__dot dlg-card__dot--${dot(storiesStatus)}`} />Stories</div>
          </div>
        </div>
      </div>
    </>
  );
}
