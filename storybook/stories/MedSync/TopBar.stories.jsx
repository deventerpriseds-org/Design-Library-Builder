import React from 'react'

export default {
  title: 'MedSync/Organisms/TopBar',
  tags: ['autodocs', 'medsync'],
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export const Default = {
  args: { label: 'TopBar', disabled: false },
  render: (args) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0 16px', height: 38, borderRadius: 6, background: '#2563EB', color: '#fff', fontWeight: 500, fontSize: 14, cursor: args.disabled ? 'not-allowed' : 'pointer', opacity: args.disabled ? 0.4 : 1 }}>
      {args.label}
    </div>
  ),
}

export const default = {
  args: { ...Default.args, label: 'default' },
}
