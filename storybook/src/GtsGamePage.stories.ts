import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "./GtsGamePage.ts";

const meta: Meta = {
  component: "gts-game-page",
  title: "GTS Game Page",
  render: args => html`<gts-game-page .data=${args}></gts-game-page>`,
};

export default meta;

type Story = StoryObj;
export const Simple: Story = {

};
