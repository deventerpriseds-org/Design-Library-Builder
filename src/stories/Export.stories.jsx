import React from 'react'
import Export from '../screens/Export.jsx'
import { WithState } from './storyHelpers.jsx'

const MOCK_RESULT = {
  meta: { name: 'Compass Design System', primaryColor: '#1B4F5C' },
  variables: {
    collections: {
      Primitives: [{ name: 'blue/500', resolvedType: 'COLOR', value: '#1B4F5C', scopes: ['FRAME_FILL'] }],
      Color: [{ name: 'color/brand/primary', resolvedType: 'COLOR', lightValue: '#1B4F5C', darkValue: '#4A8FA0', scopes: ['FRAME_FILL'] }],
      Spacing: [{ name: 'spacing/md', resolvedType: 'FLOAT', value: 16, scopes: ['GAP'] }],
      Motion: [{ name: 'motion/duration/normal', resolvedType: 'FLOAT', value: 200 }],
    },
  },
  styles: { text: [{ name: 'Body/Medium', fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 16, fontWeight: 400, lineHeight: { value: 24, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' } }] },
  components: [{ tier: 'molecule', name: 'Button', variants: ['Primary', 'Secondary'], states: ['Default', 'Disabled'] }],
  patterns: [{ name: 'Login / Auth', description: 'Full login screen.', components: ['Button', 'Text Input'] }],
}

export default {
  title: 'Screens/Export',
  component: Export,
  decorators: [
    (Story) => (
      <WithState initialState={{ result: MOCK_RESULT, projectName: 'Compass' }}>
        <div style={{ minHeight: '100vh', background: 'var(--dlg-surface, #f8f9fa)', fontFamily: 'Inter, sans-serif' }}>
          <Story />
        </div>
      </WithState>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Export screen — download design-system.json, CSS tokens, TypeScript constants, and Figma plugin bundle.',
      },
    },
  },
}

export const Default = { name: 'With result' }

export const Mobile = {
  name: 'Mobile viewport',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}
