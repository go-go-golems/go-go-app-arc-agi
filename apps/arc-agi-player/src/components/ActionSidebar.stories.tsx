import type { Meta, StoryObj } from '@storybook/react';
import { ActionSidebar } from './ActionSidebar';

const meta = {
  title: 'Apps/ArcAgiPlayer/ActionSidebar',
  component: ActionSidebar,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      <div data-widget="hypercard" style={{ height: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const AllActionsAvailable: Story = {
  args: {
    actionCount: 23,
    availableActions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
    levelsCompleted: 1,
    winLevels: [2],
    gameState: 'RUNNING',
    onAction: noop,
    onReset: noop,
    onUndo: noop,
  },
};

export const LimitedActions: Story = {
  args: {
    actionCount: 8,
    availableActions: ['ACTION1', 'ACTION3', 'ACTION6'],
    levelsCompleted: 0,
    winLevels: [2],
    gameState: 'RUNNING',
    onAction: noop,
    onReset: noop,
    onUndo: noop,
  },
};

export const HighScore: Story = {
  args: {
    actionCount: 45,
    availableActions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'],
    levelsCompleted: 4,
    winLevels: [5],
    gameState: 'RUNNING',
    onAction: noop,
    onReset: noop,
    onUndo: noop,
  },
};

export const GameWon: Story = {
  args: {
    actionCount: 30,
    availableActions: [],
    levelsCompleted: 2,
    winLevels: [2],
    gameState: 'WON',
    onAction: noop,
    onReset: noop,
  },
};

export const GameLost: Story = {
  args: {
    actionCount: 50,
    availableActions: [],
    levelsCompleted: 0,
    winLevels: [2],
    gameState: 'LOST',
    onAction: noop,
    onReset: noop,
  },
};

export const ZeroScore: Story = {
  args: {
    actionCount: 0,
    availableActions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
    levelsCompleted: 0,
    winLevels: [3],
    gameState: 'RUNNING',
    onAction: noop,
    onReset: noop,
  },
};
