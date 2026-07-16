import React from 'react'

export default {
  title: 'MedSync/Atoms/Checkbox',
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
  args: { label: 'Checkbox', disabled: false },
}

export const Unchecked = {
  args: { ...Default.args, label: 'Unchecked' },
}

export const Checked = {
  args: { ...Default.args, label: 'Checked' },
}

export const Indeterminate = {
  args: { ...Default.args, label: 'Indeterminate' },
}

export const Disabled = {
  args: { ...Default.args, label: 'Disabled' },
}
