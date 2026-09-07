import { LitElement, html } from "lit-element";
import { customElement, property } from "lit/decorators.js";
import type { GamePageState } from "./GtsGamePage.stories.ts";

@customElement("gts-game-page")
export class GtsGamePage extends LitElement {
  @property() accessor data!: GamePageState;

  render() {
    return html`
      <div>
        <h1>Drawing Experience</h1>
        <p>This is where the drawing page content will go.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-game-screen": GtsGamePage;
  }
}
