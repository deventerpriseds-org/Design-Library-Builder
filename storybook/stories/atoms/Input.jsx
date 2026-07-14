import React from 'react';

const styles = `
.dlg-field { display: flex; flex-direction: column; gap: 4px; }
.dlg-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dlg-text-2);
  font-family: inherit;
}
.dlg-input-wrap { position: relative; }
.dlg-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--dlg-radius-md);
  border: 1px solid var(--dlg-border);
  background: var(--dlg-surface);
  color: var(--dlg-text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}
.dlg-input:focus {
  border-color: var(--dlg-brand);
  box-shadow: 0 0 0 3px var(--dlg-brand-soft);
}
.dlg-input--error { border-color: var(--dlg-error); }
.dlg-input--error:focus { box-shadow: 0 0 0 3px var(--dlg-error-soft); }
.dlg-input:disabled { opacity: 0.5; cursor: not-allowed; background: var(--dlg-bg); }
.dlg-hint { font-size: 12px; color: var(--dlg-text-3); }
.dlg-hint--error { color: var(--dlg-error); }
`;

export function Input({
  label = 'Label',
  placeholder = 'Enter value…',
  hint = '',
  error = '',
  disabled = false,
  value,
  onChange,
}) {
  return (
    <>
      <style>{styles}</style>
      <div className="dlg-field">
        {label && <label className="dlg-label">{label}</label>}
        <div className="dlg-input-wrap">
          <input
            className={`dlg-input${error ? ' dlg-input--error' : ''}`}
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            onChange={onChange}
          />
        </div>
        {error ? (
          <span className="dlg-hint dlg-hint--error">{error}</span>
        ) : hint ? (
          <span className="dlg-hint">{hint}</span>
        ) : null}
      </div>
    </>
  );
}
