import React from 'react';

const styles = `
.dlg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  border-radius: var(--dlg-radius-md);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.dlg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.dlg-btn--primary {
  background: var(--dlg-brand);
  color: var(--dlg-text-on-brand);
}
.dlg-btn--primary:hover:not(:disabled) { opacity: 0.88; }
.dlg-btn--secondary {
  background: var(--dlg-surface);
  color: var(--dlg-text);
  border-color: var(--dlg-border);
}
.dlg-btn--secondary:hover:not(:disabled) { background: var(--dlg-bg); }
.dlg-btn--ghost {
  background: transparent;
  color: var(--dlg-brand);
  border-color: transparent;
}
.dlg-btn--ghost:hover:not(:disabled) { background: var(--dlg-brand-soft); }
.dlg-btn--danger {
  background: var(--dlg-error);
  color: #fff;
}
.dlg-btn--danger:hover:not(:disabled) { opacity: 0.88; }
.dlg-btn--sm { height: 28px; padding: 0 10px; font-size: 12px; }
.dlg-btn--lg { height: 44px; padding: 0 22px; font-size: 15px; }
`;

export function Button({ variant = 'primary', size = 'md', disabled = false, children = 'Button', onClick }) {
  return (
    <>
      <style>{styles}</style>
      <button
        className={`dlg-btn dlg-btn--${variant} dlg-btn--${size}`}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </>
  );
}
