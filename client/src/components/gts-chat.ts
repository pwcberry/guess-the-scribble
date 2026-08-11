import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ChatEntry, GameState } from "../state/store.ts";
import { chatInputState } from "./chat-helpers.ts";
import { elementStyles } from "./element-styles.ts";

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

  firstUpdated() {
    this.log = this.renderRoot.querySelector(".log");
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
        <ol class="log" role="log" aria-live="polite" aria-relevant="additions">
          ${this.state.chat.length === 0
            ? html`<li class="empty">No messages yet — guesses show up here.</li>`
            : this.state.chat.map(entry => this.renderEntry(entry))}
        </ol>
        ${input.enabled ? this.renderInput(input.placeholder) : this.renderNote(input.note)}
      </section>
    `;
  }

  private renderEntry(entry: ChatEntry) {
    switch (entry.kind) {
      case "correct":
        return html`<li class="correct"><span class="who">${entry.nickname}</span> ${entry.text}</li>`;
      case "close":
        return html`<li class="close">${entry.text}</li>`;
      case "system":
        return html`<li class="system">${entry.text}</li>`;
      default:
        return html`<li class="chat"><span class="who">${entry.nickname}</span> ${entry.text}</li>`;
    }
  }

  private renderInput(placeholder: string) {
    return html`
      <form class="entry" @submit=${this.onSubmit}>
        <input
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
    return html`<p class="note" role="status">${note}</p>`;
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

  static styles = [elementStyles, css`
    :host {
      display: block;
      width: 100%;
      font: 15px/1.5 system-ui, sans-serif;
    }
    section {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      gap: 10px;
    }
    .log {
      list-style: none;
      margin: 0;
      padding: 12px;
      flex: 1;
      min-height: 160px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-radius: 10px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .log li {
      padding: 3px 4px;
      overflow-wrap: anywhere;
    }
    .empty {
      margin: auto;
      text-align: center;
      opacity: 0.55;
      font-size: 14px;
    }
    .who {
      font-weight: 700;
    }
    .who::after {
      content: ":";
      font-weight: 400;
      opacity: 0.6;
    }
    .correct {
      color: #16794c;
      font-weight: 600;
    }
    .correct .who::after {
      content: "";
    }
    @media (prefers-color-scheme: dark) {
      .correct {
        color: #4cc38a;
      }
    }
    .correct::before {
      content: "✓ ";
    }
    .close {
      color: #9a6700;
      font-style: italic;
    }
    @media (prefers-color-scheme: dark) {
      .close {
        color: #f5c451;
      }
    }
    .system {
      text-align: center;
      opacity: 0.6;
      font-size: 14px;
    }
    .entry {
      display: flex;
      gap: 8px;
    }
    .entry input {
      flex: 1;
      min-width: 0;
    }
    .note {
      margin: 0;
      padding: 10px 12px;
      text-align: center;
      opacity: 0.7;
      font-size: 14px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-chat": GtsChat;
  }
}
