import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("gts-game-page")
export class GtsGamePage extends LitElement {
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
    "gts-game-page": GtsGamePage;
  }
}
