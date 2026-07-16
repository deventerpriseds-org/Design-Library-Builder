import React from 'react'

export default {
  title: 'MedSync/Atoms/Avatar',
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
  args: { label: 'Avatar', disabled: false },
}

export const Image = {
  args: { ...Default.args, label: 'Image' },
}

export const Initials = {
  args: { ...Default.args, label: 'Initials' },
}

export const Icon = {
  args: { ...Default.args, label: 'Icon' },
}

export const Placeholder = {
  args: { ...Default.args, label: 'Placeholder' },
}
