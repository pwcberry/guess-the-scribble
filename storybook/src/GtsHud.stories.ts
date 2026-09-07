import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import type { GameState } from "@gts/client/src/state/store.ts";
import "./GtsHud.ts";

const meta: Meta = {
  component: "gts-hud",
  title: "Heads-Up Display",
  render: args => html`<gts-hud .state=${args}></gts-hud>`,
};

export default meta;

type Story = StoryObj<GameState>;

export const Default: Story = {
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
      turn: {
        turnOrdinal: 1,
        roundOrdinal: 1,
        totalRounds: 3,
        drawerSessionId: "drawer-123",
        drawerNickname: "Alice",
        wordPattern: "_ _ _ _",
        wordLength: 4,
        phase: "drawing",
        endsAt: Date.now() + 30000, // 30 seconds from now
      },
      players: [
        {
          sessionId: "player-123",
          nickname: "Alice",
          score: 10,
          connected: true,
          isHost: true,
          isDrawer: true,
          hasGuessed: false,
        },
        {
          sessionId: "player-124",
          nickname: "Bob",
          score: 5,
          connected: true,
          isHost: false,
          isDrawer: false,
          hasGuessed: false,
        },
        {
          sessionId: "player-125",
          nickname: "Charlie",
          score: 3,
          connected: true,
          isHost: false,
          isDrawer: false,
          hasGuessed: false,
        },
      ],
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
