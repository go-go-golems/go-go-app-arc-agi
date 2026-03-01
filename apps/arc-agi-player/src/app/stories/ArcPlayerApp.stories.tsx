import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { ActionLog } from '../../components/ActionLog';
import { ActionSidebar } from '../../components/ActionSidebar';
import { ArcPlayerWindow } from '../../components/ArcPlayerWindow';
import { GameGrid } from '../../components/GameGrid';
import {
  MOCK_ACTION_HISTORY,
  MOCK_INITIAL_FRAME,
  MOCK_MIDGAME_FRAME,
  MOCK_WON_FRAME,
} from '../../mocks/fixtures/games';
import { createDefaultArcHandlers } from '../../mocks/msw/defaultHandlers';
import { createArcPlayerStore } from '../store';

function StoreDecorator(Story: React.ComponentType) {
  const store = createArcPlayerStore();
  return (
    <Provider store={store}>
      <div data-widget="hypercard">
        <Story />
      </div>
    </Provider>
  );
}

const noop = () => {};

const meta = {
  title: 'Apps/ArcAgiPlayer/FullApp',
  decorators: [StoreDecorator],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPlayer: Story = {
  parameters: {
    msw: { handlers: createDefaultArcHandlers() },
  },
  render: () => <ArcPlayerWindow />,
};

export const InitialGrid: Story = {
  render: () => <GameGrid frame={MOCK_INITIAL_FRAME.frame} />,
};

export const MidGameGrid: Story = {
  render: () => <GameGrid frame={MOCK_MIDGAME_FRAME.frame} />,
};

export const WonGrid: Story = {
  render: () => <GameGrid frame={MOCK_WON_FRAME.frame} />,
};

export const SidebarPlaying: Story = {
  render: () => (
    <ActionSidebar
      actionCount={23}
      availableActions={['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']}
      levelsCompleted={1}
      winLevels={[2]}
      gameState="RUNNING"
      onAction={noop}
      onReset={noop}
      onUndo={noop}
    />
  ),
};

export const ActionHistory: Story = {
  render: () => <ActionLog actions={MOCK_ACTION_HISTORY} />,
};
