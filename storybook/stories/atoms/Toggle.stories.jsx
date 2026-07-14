import { Toggle } from './Toggle';

export default {
  title: 'Atoms/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    on: { control: 'boolean' },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};

export const Off = { args: { on: false, label: 'Auto-sync to Figma' } };
export const On = { args: { on: true, label: 'Auto-sync to Figma' } };
export const NoLabel = { args: { on: true } };
export const Disabled = { args: { on: false, label: 'Preview mode', disabled: true } };
