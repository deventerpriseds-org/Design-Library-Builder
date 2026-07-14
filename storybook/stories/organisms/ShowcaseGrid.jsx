import React, { useState } from 'react';
import { ComponentCard } from '../molecules/ComponentCard';
import { StatusBar } from '../molecules/StatusBar';

const styles = `
.dlg-showcase { font-family: inherit; }
.dlg-showcase__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.dlg-showcase__filter {
  display: flex;
  gap: 4px;
}
.dlg-showcase__chip {
  padding: 4px 12px;
  border-radius: var(--dlg-radius-full);
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--dlg-border);
  background: var(--dlg-surface);
  color: var(--dlg-text-2);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.12s, background 0.12s, color 0.12s;
}
.dlg-showcase__chip--active {
  border-color: var(--dlg-brand);
  background: var(--dlg-brand-soft);
  color: var(--dlg-brand);
}
.dlg-showcase__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.dlg-showcase__status { margin-bottom: 16px; }
`;

const COMPONENTS = [
  { name: 'Button', tier: 'Atom', description: 'Core interactive element for user actions.', variants: ['Primary', 'Secondary', 'Ghost', 'Danger'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
  { name: 'Badge', tier: 'Atom', description: 'Status and category label.', variants: ['Brand', 'Success', 'Warning', 'Error'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'pending' },
  { name: 'Input', tier: 'Atom', description: 'Text field with validation states.', variants: ['Default', 'Error', 'Disabled'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
  { name: 'ComponentCard', tier: 'Molecule', description: 'Preview card for a single design component.', variants: ['Default', 'AllSynced'], appStatus: 'synced', figmaStatus: 'pending', storiesStatus: 'synced' },
  { name: 'StatusBar', tier: 'Molecule', description: 'Sync status across App, Figma, and Stories.', variants: ['Default', 'Syncing'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
];

const TIERS = ['All', 'Atom', 'Molecule', 'Organism'];

export function ShowcaseGrid({ components = COMPONENTS }) {
  const [tier, setTier] = useState('All');

  const filtered = tier === 'All' ? components : components.filter(c => c.tier === tier);
  const synced = components.filter(c => c.appStatus === 'synced' && c.figmaStatus === 'synced' && c.storiesStatus === 'synced').length;

  return (
    <>
      <style>{styles}</style>
      <div className="dlg-showcase">
        <div className="dlg-showcase__status">
          <StatusBar
            appStatus="synced"
            figmaStatus="synced"
            storiesStatus={synced === components.length ? 'synced' : 'syncing'}
            totalComponents={components.length}
            syncedComponents={synced}
          />
        </div>
        <div className="dlg-showcase__toolbar">
          <div className="dlg-showcase__filter">
            {TIERS.map(t => (
              <button
                key={t}
                className={`dlg-showcase__chip${tier === t ? ' dlg-showcase__chip--active' : ''}`}
                onClick={() => setTier(t)}
              >{t}</button>
            ))}
          </div>
        </div>
        <div className="dlg-showcase__grid">
          {filtered.map(c => <ComponentCard key={c.name} {...c} />)}
        </div>
      </div>
    </>
  );
}
