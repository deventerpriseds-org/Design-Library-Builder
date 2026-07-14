import React from 'react';

const styles = `
.dlg-toggle-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-family: inherit;
}
.dlg-toggle-wrap--disabled { opacity: 0.45; cursor: not-allowed; }
.dlg-toggle {
  position: relative;
  width: 36px; height: 20px;
  border-radius: 10px;
  background: var(--dlg-border);
  transition: background 0.2s;
  flex-shrink: 0;
}
.dlg-toggle--on { background: var(--dlg-brand); }
.dlg-toggle__thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
.dlg-toggle--on .dlg-toggle__thumb { transform: translateX(16px); }
.dlg-toggle-label { font-size: 14px; color: var(--dlg-text); }
`;

export function Toggle({ on = false, label = '', disabled = false, onChange }) {
  return (
    <>
      <style>{styles}</style>
      <label className={`dlg-toggle-wrap${disabled ? ' dlg-toggle-wrap--disabled' : ''}`}>
        <span
          className={`dlg-toggle${on ? ' dlg-toggle--on' : ''}`}
          role="switch"
          aria-checked={on}
          onClick={disabled ? undefined : onChange}
        >
          <span className="dlg-toggle__thumb" />
        </span>
        {label && <span className="dlg-toggle-label">{label}</span>}
      </label>
    </>
  );
}
