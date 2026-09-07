import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("simple-greeting")
export class SimpleGreeting extends LitElement {
  static styles = css`p {
    color: rebeccapurple
  }`;

  @property({ attribute: false }) accessor name = "somebody";

  render() {
    return html`<p>Hello, ${this.name}!</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "simple-greeting": SimpleGreeting;
  }
}
