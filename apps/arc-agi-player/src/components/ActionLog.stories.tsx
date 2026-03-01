import type { Meta, StoryObj } from '@storybook/react';
import { MOCK_ACTION_HISTORY, MOCK_LONG_ACTION_HISTORY } from '../mocks/fixtures/games';
import { ActionLog } from './ActionLog';

const meta = {
  title: 'Apps/ArcAgiPlayer/ActionLog',
  component: ActionLog,
  parameters: { layout: 'padded' },
  decorators: [
    (Story: React.ComponentType) => (
      <div data-widget="hypercard" style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionLog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { actions: [] },
};

export const FewActions: Story = {
  args: { actions: MOCK_ACTION_HISTORY.slice(0, 6) },
};

export const WithCoordinates: Story = {
  args: { actions: MOCK_ACTION_HISTORY },
};

export const ManyActions: Story = {
  args: { actions: MOCK_LONG_ACTION_HISTORY },
};
