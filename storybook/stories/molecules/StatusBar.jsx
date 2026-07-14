import React from 'react';

const styles = `
.dlg-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--dlg-surface);
  border: 1px solid var(--dlg-border);
  border-radius: var(--dlg-radius-lg);
  font-family: inherit;
  flex-wrap: wrap;
}
.dlg-statusbar__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--dlg-text-2);
}
.dlg-statusbar__dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.dlg-statusbar__dot--green  { background: var(--dlg-success); }
.dlg-statusbar__dot--yellow { background: var(--dlg-warning); box-shadow: 0 0 0 2px var(--dlg-warning-soft); }
.dlg-statusbar__dot--grey   { background: var(--dlg-text-3); }
.dlg-statusbar__dot--pulse  { animation: dlg-pulse 1.4s ease-in-out infinite; }
@keyframes dlg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.dlg-statusbar__divider { width: 1px; height: 18px; background: var(--dlg-border); flex-shrink: 0; }
.dlg-statusbar__count { font-weight: 600; color: var(--dlg-text); }
`;

const DOT = {
  synced: 'green',
  syncing: 'yellow',
  idle: 'grey',
};

export function StatusBar({
  appStatus = 'synced',
  figmaStatus = 'synced',
  storiesStatus = 'syncing',
  totalComponents = 24,
  syncedComponents = 21,
}) {
  return (
    <>
      <style>{styles}</style>
      <div className="dlg-statusbar">
        <div className="dlg-statusbar__item">
          <span className={`dlg-statusbar__dot dlg-statusbar__dot--${DOT[appStatus]}${appStatus === 'syncing' ? ' dlg-statusbar__dot--pulse' : ''}`} />
          App {appStatus}
        </div>
        <div className="dlg-statusbar__divider" />
        <div className="dlg-statusbar__item">
          <span className={`dlg-statusbar__dot dlg-statusbar__dot--${DOT[figmaStatus]}${figmaStatus === 'syncing' ? ' dlg-statusbar__dot--pulse' : ''}`} />
          Figma {figmaStatus}
        </div>
        <div className="dlg-statusbar__divider" />
        <div className="dlg-statusbar__item">
          <span className={`dlg-statusbar__dot dlg-statusbar__dot--${DOT[storiesStatus]}${storiesStatus === 'syncing' ? ' dlg-statusbar__dot--pulse' : ''}`} />
          Stories {storiesStatus}
        </div>
        <div className="dlg-statusbar__divider" />
        <div className="dlg-statusbar__item">
          <span className="dlg-statusbar__count">{syncedComponents}</span>
          <span>/ {totalComponents} components synced</span>
        </div>
      </div>
    </>
  );
}
