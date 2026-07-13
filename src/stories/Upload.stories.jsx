import React from 'react'
import Upload from '../screens/Upload.jsx'
import { AppProvider } from '../state.jsx'

export default {
  title: 'Screens/Upload',
  component: Upload,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ minHeight: '100vh', background: 'var(--dlg-surface, #f8f9fa)', fontFamily: 'Inter, sans-serif' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Upload screen — entry point for creating a new design library. Accepts screenshots, URLs, and a text description.',
      },
    },
  },
}

export const Default = {
  name: 'Empty state',
}

export const Mobile = {
  name: 'Mobile viewport',
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}

export const Tablet = {
  name: 'Tablet viewport',
  parameters: {
    viewport: { defaultViewport: 'tablet' },
  },
}
