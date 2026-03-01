import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { createArcPlayerStore } from '../app/store';
import { createDefaultArcHandlers } from '../mocks/msw/defaultHandlers';
import { ArcPlayerWindow } from './ArcPlayerWindow';

function StoreDecorator(Story: React.ComponentType) {
  const store = createArcPlayerStore();
  return (
    <Provider store={store}>
      <Story />
    </Provider>
  );
}

const meta = {
  title: 'Apps/ArcAgiPlayer/ArcPlayerWindow',
  component: ArcPlayerWindow,
  decorators: [StoreDecorator],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ArcPlayerWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    msw: { handlers: createDefaultArcHandlers() },
  },
};

export const WithSpecificGame: Story = {
  args: { initialGameId: 'vc33-9851e02b' },
  parameters: {
    msw: { handlers: createDefaultArcHandlers() },
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: createDefaultArcHandlers(undefined, { delayMs: 60000 }) },
  },
};

export const LargeGrid: Story = {
  parameters: {
    msw: { handlers: createDefaultArcHandlers({ gridSize: 30 }) },
  },
};
