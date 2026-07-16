import React from 'react'

export default {
  title: 'MedSync/Molecules/Alert',
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
  args: { label: 'Alert', disabled: false },
}

export const Info = {
  args: { ...Default.args, label: 'Info' },
}

export const Success = {
  args: { ...Default.args, label: 'Success' },
}

export const Warning = {
  args: { ...Default.args, label: 'Warning' },
}

export const Error = {
  args: { ...Default.args, label: 'Error' },
}
