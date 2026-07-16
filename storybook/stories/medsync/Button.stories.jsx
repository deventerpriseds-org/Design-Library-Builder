import React from 'react'

export default {
  title: 'MedSync/Atoms/Button',
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
  args: { label: 'Button', disabled: false },
}

export const Primary = {
  args: { ...Default.args, label: 'Primary' },
}

export const Secondary = {
  args: { ...Default.args, label: 'Secondary' },
}

export const Ghost = {
  args: { ...Default.args, label: 'Ghost' },
}

export const Destructive = {
  args: { ...Default.args, label: 'Destructive' },
}

export const Link = {
  args: { ...Default.args, label: 'Link' },
}
