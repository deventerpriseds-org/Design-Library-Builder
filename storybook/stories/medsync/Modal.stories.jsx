import React from 'react'

export default {
  title: 'MedSync/Organisms/Modal',
  tags: ['autodocs', 'medsync'],
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  render: (args) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0 16px', height: 38, borderRadius: 6, background: '#2563EB', color: '#fff', fontWeight: 500, fontSize: 14, cursor: args.disabled ? 'not-allowed' : 'pointer', opacity: args.disabled ? 0.4 : 1 }}>
      {args.label}
    </div>
  ),
}

export const Default = {
  args: { label: 'Modal', disabled: false },
}

export const SM = {
  args: { ...Default.args, label: 'SM' },
}

export const MD = {
  args: { ...Default.args, label: 'MD' },
}

export const LG = {
  args: { ...Default.args, label: 'LG' },
}

export const Full = {
  args: { ...Default.args, label: 'Full' },
}
