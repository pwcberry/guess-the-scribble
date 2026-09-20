import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ChatEntry, GameState } from "../state/store.ts";
import { chatInputState } from "./chat-helpers.ts";
import "./gts-chat.css";

/** Emitted when the player submits a guess (or, off-round, a chat line). */
export interface GuessRequest {
  text: string;
}

/**
 * Chat and guessing panel. Renders the running message log — guesses, correct
 * calls, private "you're close" nudges and system notices, each styled by kind —
 * and an input that dispatches `gts-guess` for the app shell to send. A single
 * `guess` message covers both guessing and chat; the server decides which based
 * on phase and role, and `chatInputState` mirrors when the input is usable.
 */
@customElement("gts-chat")
export class GtsChat extends LitElement {
  @property({ attribute: false }) accessor state!: GameState;

  @state() accessor draft = "";

  private log: HTMLElement | null = null;
  private lastCount = 0;

  // Renders into light DOM (not Shadow DOM) so its CSS lives in a plain,
  // BEM-scoped global stylesheet (gts-chat.css) instead of a shadow-adopted
  // `static styles` template — the only component in the repo that does this.
  protected createRenderRoot() {
    return this;
  }

  firstUpdated() {
    this.log = this.renderRoot.querySelector(".gts-chat__log");
  }

  protected updated() {
    const count = this.state.chat.length;
    if (count === this.lastCount || !this.log) {
      return;
    }
    // Follow new messages, but don't yank the reader down if they've scrolled
    // up to re-read history. Always jump to the latest on the first fill.
    const distanceFromBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight;
    const firstFill = this.lastCount === 0;
    this.lastCount = count;
    if (firstFill || distanceFromBottom < 40) {
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  render() {
    const input = chatInputState(this.state);
    return html`
      <section aria-label="Chat and guesses">
        <ol class="gts-chat__log" aria-roledescription="Chat messages" role="list" aria-live="polite" aria-relevant="additions">
          ${this.state.chat.length === 0
            ? html`
              <li class="gts-chat__message gts-chat__message--empty">No messages yet — guesses show up here.</li>`
            : this.state.chat.map(entry => this.renderEntry(entry))}
        </ol>
        ${input.enabled ? this.renderInput(input.placeholder) : this.renderNote(input.note)}
      </section>
    `;
  }

  private renderEntry(entry: ChatEntry) {
    switch (entry.kind) {
      case "correct":
        return html`<li class="gts-chat__message gts-chat__message--correct"><span class="gts-chat__author">${entry.nickname}</span> ${entry.text}</li>`;
      case "close":
        return html`<li class="gts-chat__message gts-chat__message--close">${entry.text}</li>`;
      case "system":
        return html`<li class="gts-chat__message gts-chat__message--system">${entry.text}</li>`;
      default:
        return html`<li class="gts-chat__message"><span class="gts-chat__author">${entry.nickname}</span> ${entry.text}</li>`;
    }
  }

  private renderInput(placeholder: string) {
    return html`
      <form class="gts-chat__form" @submit=${this.onSubmit}>
        <input
          class="gts-chat__input"
          type="text"
          maxlength="60"
          autocomplete="off"
          aria-label="Type a guess"
          .value=${this.draft}
          .placeholder=${placeholder}
          @input=${this.onInput}
        />
        <button class="primary" type="submit" ?disabled=${this.draft.trim() === ""}>Send</button>
      </form>
    `;
  }

  private renderNote(note: string | null) {
    if (!note) {
      return null;
    }
    return html`<p class="gts-chat__note" role="status">${note}</p>`;
  }

  private onInput(event: Event) {
    this.draft = (event.target as HTMLInputElement).value;
  }

  private onSubmit(event: Event) {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<GuessRequest>("gts-guess", {
        detail: { text },
        bubbles: true,
        composed: true,
      }),
    );
    this.draft = "";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-chat": GtsChat;
  }
}
