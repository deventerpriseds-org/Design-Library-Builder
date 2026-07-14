import { StatusBar } from './StatusBar';

export default {
  title: 'Molecules/StatusBar',
  component: StatusBar,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    appStatus: { control: 'select', options: ['synced', 'syncing', 'idle'] },
    figmaStatus: { control: 'select', options: ['synced', 'syncing', 'idle'] },
    storiesStatus: { control: 'select', options: ['synced', 'syncing', 'idle'] },
    totalComponents: { control: 'number' },
    syncedComponents: { control: 'number' },
  },
};

export const AllSynced = {
  args: { appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'synced', totalComponents: 24, syncedComponents: 24 },
};

export const StoriesSyncing = {
  args: { appStatus: 'synced', figmaStatus: 'synced', storiesStatus: 'syncing', totalComponents: 24, syncedComponents: 21 },
};

export const FigmaSyncing = {
  args: { appStatus: 'synced', figmaStatus: 'syncing', storiesStatus: 'idle', totalComponents: 24, syncedComponents: 18 },
};

export const Idle = {
  args: { appStatus: 'idle', figmaStatus: 'idle', storiesStatus: 'idle', totalComponents: 24, syncedComponents: 0 },
};
