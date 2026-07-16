import React from 'react'

export default {
  title: 'MedSync/Molecules/Card',
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
  args: { label: 'Card', disabled: false },
}

export const Basic = {
  args: { ...Default.args, label: 'Basic' },
}

export const Elevated = {
  args: { ...Default.args, label: 'Elevated' },
}

export const Outlined = {
  args: { ...Default.args, label: 'Outlined' },
}

export const Interactive = {
  args: { ...Default.args, label: 'Interactive' },
}
