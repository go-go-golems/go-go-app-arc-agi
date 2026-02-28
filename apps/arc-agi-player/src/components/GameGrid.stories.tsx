import type { Meta, StoryObj } from '@storybook/react';
import { makeCheckerboardFrame, makeCrossFrame, makeGradientFrame, makeScatteredFrame } from '../mocks/fixtures/games';
import { GameGrid } from './GameGrid';

const meta = {
  title: 'Apps/ArcAgiPlayer/GameGrid',
  component: GameGrid,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      <div data-widget="hypercard" style={{ width: 500 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GameGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checkerboard: Story = {
  args: { frame: makeCheckerboardFrame(16, 16) },
};

export const Gradient: Story = {
  args: { frame: makeGradientFrame(16, 16) },
};

export const Scattered: Story = {
  args: { frame: makeScatteredFrame(16, 16) },
};

export const Cross: Story = {
  args: { frame: makeCrossFrame(20, 20) },
};

export const LargeGrid: Story = {
  args: { frame: makeScatteredFrame(30, 30) },
};

export const SmallGrid: Story = {
  args: { frame: makeCheckerboardFrame(5, 5) },
};

export const Empty: Story = {
  args: { frame: [] },
};

export const WithCellClick: Story = {
  args: {
    frame: makeCheckerboardFrame(10, 10),
    onCellClick: (row: number, col: number) => {
      console.log(`Cell clicked: row=${row}, col=${col}`);
    },
  },
};
