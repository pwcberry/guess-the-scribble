import type { Meta, StoryObj } from "@storybook/web-components-vite";
// import { action } from "storybook/actions";
import { expect, userEvent, within } from "storybook/test";
import { html } from "lit";
import type { ChatEntry, GameState } from "@gts/client/src/state/store.ts";
import { turnView, gameState } from "./data/harness.ts";
import "@gts/client/src/components/gts-chat.ts";

const meta: Meta = {
  component: "GtsChat",
  title: "Chat and Guessing Panel",
  render: (args) => {
    const state = {
      ...args.state,
      connection: args.connection,
    };
    return html`<gts-chat .state=${state}></gts-chat>`;
  },
  decorators: [(story, { args: { width } }) => {
    const storyWidth = `width-${width.replace("%", "")}`;
    return html`<div class="story-gts-chat ${storyWidth}">${story()}</div>`;
  }],
  args: {
    width: "100%",
    connection: "idle",
  },
  argTypes: {
    width: {
      control: "select",
      options: ["100%", "75%", "50%"],
    },
    connection: {
      control: "select",
      options: ["idle", "connecting", "connected", "disconnected"],
    },
    state: {
      control: "object",
    },
  },
};

export default meta;

type Story = StoryObj<{ state: GameState }>;

export const ChatWindowForDrawer: Story = {
  args: {
    state: gameState("idle", "player-17", turnView("player-17", 4, "drawing")),
  },
};

export const ChatWindowForGuessers: Story = {
  args: {
    state: gameState("idle", "player-18", turnView("player-17", 4, "drawing")),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Type a guess" });
    const submitted: string[] = [];
    canvasElement.addEventListener("gts-guess", (event) => {
      submitted.push((event as CustomEvent<{ text: string }>).detail.text);
    });

    await userEvent.type(input, "banana");
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));

    await expect(submitted).toEqual(["banana"]);
    await expect(input).toHaveValue("");
  },
};

const messagesChat: ChatEntry[] = [
  { id: 1, nickname: "Ali", text: "hi all", kind: "chat" },
  { id: 2, nickname: "Billie", text: "banana", kind: "correct" },
  { id: 3, nickname: "Charlie", text: "Charlie is close!", kind: "close" },
  { id: 4, nickname: "", text: "Charlie has joined", kind: "system" },
];

export const ChatWindowWithMessages: Story = {
  args: {
    state: {
      ...gameState("idle", "player-18", turnView("player-17", 4, "drawing")),
      chat: messagesChat,
      nextChatId: messagesChat.length + 1,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Renders in light DOM: assertions reach the message list directly on
    // canvasElement, with no shadowRoot to traverse.
    await expect(canvasElement.querySelector(".gts-chat__log")).not.toBeNull();
    await expect(canvasElement.querySelectorAll(".gts-chat__message")).toHaveLength(messagesChat.length);
    await expect(canvasElement.querySelector(".gts-chat__message--correct")).not.toBeNull();
    await expect(canvasElement.querySelector(".gts-chat__message--close")).not.toBeNull();
    await expect(canvasElement.querySelector(".gts-chat__message--system")).not.toBeNull();
    await expect(canvas.getByText(/banana/)).toBeInTheDocument();
  },
};
