import { ComponentCard } from './ComponentCard';

export default {
  title: 'Molecules/ComponentCard',
  component: ComponentCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    name: { control: 'select', options: ['Button', 'Badge', 'Input'] },
    tier: { control: 'select', options: ['Atom', 'Molecule', 'Organism'] },
    appStatus: { control: 'select', options: ['synced', 'pending', 'missing'] },
    figmaStatus: { control: 'select', options: ['synced', 'pending', 'missing'] },
    storiesStatus: { control: 'select', options: ['synced', 'pending', 'missing'] },
    description: { control: 'text' },
  },
};

export const ButtonCard = {
  args: {
    name: 'Button',
    tier: 'Atom',
    description: 'Core interactive element for triggering actions.',
    variants: ['Primary', 'Secondary', 'Ghost', 'Danger'],
    appStatus: 'synced',
    figmaStatus: 'synced',
    storiesStatus: 'pending',
  },
};

export const BadgeCard = {
  args: {
    name: 'Badge',
    tier: 'Atom',
    description: 'Inline label for status, tier, or category.',
    variants: ['Brand', 'Success', 'Warning', 'Error'],
    appStatus: 'synced',
    figmaStatus: 'pending',
    storiesStatus: 'missing',
  },
};

export const InputCard = {
  args: {
    name: 'Input',
    tier: 'Atom',
    description: 'Text field with label, hint, and error states.',
    variants: ['Default', 'Error', 'Disabled'],
    appStatus: 'synced',
    figmaStatus: 'synced',
    storiesStatus: 'synced',
  },
};

export const AllSynced = {
  args: {
    name: 'Button',
    tier: 'Atom',
    description: 'Fully synced across all three surfaces.',
    variants: ['Primary', 'Secondary'],
    appStatus: 'synced',
    figmaStatus: 'synced',
    storiesStatus: 'synced',
  },
};
