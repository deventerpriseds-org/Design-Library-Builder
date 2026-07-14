import { Badge } from './Badge';

export default {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['brand', 'success', 'warning', 'error', 'info', 'neutral'],
    },
    dot: { control: 'boolean' },
    children: { control: 'text' },
  },
};

export const Brand = { args: { variant: 'brand', children: 'Atom' } };
export const Success = { args: { variant: 'success', children: 'Synced' } };
export const Warning = { args: { variant: 'warning', children: 'Pending' } };
export const Error = { args: { variant: 'error', children: 'Failed' } };
export const Info = { args: { variant: 'info', children: 'Molecule' } };
export const Neutral = { args: { variant: 'neutral', children: 'Draft' } };
export const WithDot = { args: { variant: 'success', dot: true, children: 'Live' } };
