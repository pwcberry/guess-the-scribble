import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import type { GameState } from "@gts/client/src/state/store.ts";
import { players, turnView, gameState } from "./data/harness.ts";
import "@gts/client/src/components/gts-chat.ts";

const meta: Meta = {
  component: "gts-chat",
  title: "Chat and Guessing Panel",
  render: args => html`<gts-chat .state=${args}></gts-chat>`,
  argTypes: {
    connection: {
      control: "select",
      options: ["idle", "connecting", "connected", "disconnected"]
    },
    sessionId: {
      control: "select",
      options: players.map(p => p.sessionId),
    }
  }
}

export default meta;

type Story = StoryObj<GameState>;

export const ChatWindowForDrawer: Story = {
  args: gameState("idle", "player-17", turnView("player-17", 4, "drawing")),
};

export const ChatWindowForGuessers: Story = {
  args: gameState("idle", "player-18", turnView("player-17", 4, "drawing")),
};
