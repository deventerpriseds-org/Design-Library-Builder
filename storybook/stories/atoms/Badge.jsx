import React from 'react';

const styles = `
.dlg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--dlg-radius-full);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}
.dlg-badge--success { background: var(--dlg-success-soft); color: var(--dlg-success); }
.dlg-badge--warning { background: var(--dlg-warning-soft); color: var(--dlg-warning); }
.dlg-badge--error   { background: var(--dlg-error-soft);   color: var(--dlg-error); }
.dlg-badge--info    { background: var(--dlg-info-soft);    color: var(--dlg-info); }
.dlg-badge--brand   { background: var(--dlg-brand-soft);   color: var(--dlg-brand); }
.dlg-badge--neutral { background: var(--dlg-border);       color: var(--dlg-text-2); }
.dlg-badge__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
`;

export function Badge({ variant = 'brand', dot = false, children = 'Badge' }) {
  return (
    <>
      <style>{styles}</style>
      <span className={`dlg-badge dlg-badge--${variant}`}>
        {dot && <span className="dlg-badge__dot" />}
        {children}
      </span>
    </>
  );
}
