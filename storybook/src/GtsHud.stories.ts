import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import type { GameState } from "@gts/client/src/state/store.ts";
import { players, turnView } from "./data/harness.ts";
import "./GtsHud.ts";

const meta: Meta = {
  component: "gts-hud",
  title: "Heads-Up Display",
  render: args => html`<gts-hud .state=${args}></gts-hud>`,
};

export default meta;

type Story = StoryObj<GameState>;

export const Drawing: Story = {
  args: {
    connection: "idle",
    sessionId: "player-123",
    room: {
      code: "ABCDEF",
      status: "playing",
      settings: {
        rounds: 1,
        drawTimeSec: 60,
        maxPlayers: 3,
      },
      turn: turnView("player-123", 4, "drawing"),
      players,
    },
    wordChoices: [],
    myWord: "head",
    chat: [],
    lastTurn: null,
    finalScores: null,
    error: null,
    nextChatId: 1,
  },
};

export const Guessing: Story = {
  args: {
    connection: "idle",
    sessionId: null,
    room: {
      code: "ABCDEF",
      status: "playing",
      settings: {
        rounds: 1,
        drawTimeSec: 60,
        maxPlayers: 3,
      },
      turn: turnView("player-123", 4, "drawing"),
      players,
    },
    wordChoices: [],
    myWord: "head",
    chat: [],
    lastTurn: null,
    finalScores: null,
    error: null,
    nextChatId: 1,
  },
};
