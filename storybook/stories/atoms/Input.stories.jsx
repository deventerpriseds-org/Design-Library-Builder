import { Input } from './Input';

export default {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};

export const Default = { args: { label: 'Component name', placeholder: 'e.g. PrimaryButton' } };
export const WithHint = { args: { label: 'Figma file key', placeholder: 'Paste key…', hint: 'Found in the Figma file URL' } };
export const WithError = { args: { label: 'Token prefix', placeholder: 'dlg-', error: 'Prefix must not contain spaces' } };
export const Disabled = { args: { label: 'API endpoint', placeholder: 'https://…', disabled: true } };
export const NoLabel = { args: { label: '', placeholder: 'Search components…' } };
