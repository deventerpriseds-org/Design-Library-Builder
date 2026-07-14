import { Button } from './Button';

export default {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
};

export const Primary = { args: { variant: 'primary', children: 'Save to Figma' } };
export const Secondary = { args: { variant: 'secondary', children: 'Cancel' } };
export const Ghost = { args: { variant: 'ghost', children: 'View Details' } };
export const Danger = { args: { variant: 'danger', children: 'Delete Component' } };
export const Small = { args: { variant: 'primary', size: 'sm', children: 'Extract' } };
export const Large = { args: { variant: 'primary', size: 'lg', children: 'Generate Library' } };
export const Disabled = { args: { variant: 'primary', disabled: true, children: 'Processing…' } };
