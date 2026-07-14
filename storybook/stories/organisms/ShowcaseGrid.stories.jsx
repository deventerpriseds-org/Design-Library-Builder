import { ShowcaseGrid } from './ShowcaseGrid';

export default {
  title: 'Organisms/ShowcaseGrid',
  component: ShowcaseGrid,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export const Default = { args: {} };

export const AllSynced = {
  args: {
    components: [
      { name: 'Button', tier: 'Atom', description: 'Core interactive element.', variants: ['Primary', 'Secondary'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
      { name: 'Badge', tier: 'Atom', description: 'Status label.', variants: ['Brand', 'Success'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
      { name: 'Input', tier: 'Atom', description: 'Text input field.', variants: ['Default', 'Error'], appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced' },
    ],
  },
};
