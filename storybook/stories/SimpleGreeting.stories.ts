import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

const meta: Meta = {
  component: "simple-greeting",
  title: "Sample/Greeting Component",
  render: args => html`<simple-greeting .name=${args.name}></simple-greeting>`,
};

export default meta;

type Story = StoryObj<{ name: string }>;

export const Humphrey: Story = {
  args: {
    name: "Humphrey",
  },
};

export const Olivia: Story = {
  args: {
    name: "Olivia",
  },
};
