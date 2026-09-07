import type { Meta, StoryObj } from "@storybook/web-components-vite";
import type { GameMessage, Score } from "@gts/client/src/protocol.ts";

export interface GamePageState {
  scores: Score[];
  messages: GameMessage[];
  currentRound: number;
  totalRounds: number;
}

const meta: Meta = {
  component: "gts-game-page",
  title: "GTS Game Page",
};

export default meta;

type Story = StoryObj<GamePageState>;
export const Simple: Story = {
  args: {
    scores: [],
    messages: [],
    currentRound: 1,
    totalRounds: 3,
  },
};
