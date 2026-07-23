import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GameState } from "../state/store.ts";
import { canStartGame, connectedCount, inviteLink, isHost, MIN_PLAYERS } from "./lobby-helpers.ts";

/**
 * Pre-game lobby. Shows the invite code and a copyable share link, the roster of
 * joined players, and the room settings. The host gets a Start button (enabled
 * once enough players are present); everyone else waits. Starting the game
 * dispatches `gts-start-game` for the app shell to send over the socket.
 */
@customElement("gts-lobby")
export class GtsLobby extends LitElement {
  @property({ attribute: false }) accessor state!: GameState;

  @state() accessor copied = false;

  render() {
    const room = this.state.room;
    if (!room) return null;

    const host = isHost(this.state);
    const canStart = canStartGame(this.state);
    const link = inviteLink(location.origin, room.code);

    return html`
      <section>
        <header>
          <h1>Lobby</h1>
          <div class="code" title="Room code">${room.code}</div>
        </header>

        <div class="invite">
          <input type="text" readonly .value=${link} @focus=${this._selectAll} />
          <button type="button" @click=${() => this._copy(link)}>
            ${this.copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <ul class="players">
          ${room.players.map(p => html`
            <li class=${p.connected ? "" : "offline"}>
              <span class="name">${p.nickname}</span>
              ${p.isHost ? html`<span class="badge">host</span>` : null}
              ${p.connected ? null : html`<span class="badge dim">offline</span>`}
            </li>
          `)}
        </ul>

        <dl class="settings">
          <div><dt>Rounds</dt><dd>${room.settings.rounds}</dd></div>
          <div><dt>Draw time</dt><dd>${room.settings.drawTimeSec}s</dd></div>
          <div><dt>Max players</dt><dd>${room.settings.maxPlayers}</dd></div>
        </dl>

        ${host
          ? html`
              <button type="button" class="start" ?disabled=${!canStart} @click=${this._start}>
                Start game
              </button>
              ${canStart
                ? null
                : html`<p class="hint">Need at least ${MIN_PLAYERS} players (${connectedCount(room.players)} here).</p>`}
            `
          : html`<p class="hint">Waiting for the host to start…</p>`}
      </section>
    `;
  }

  private _selectAll(event: Event) {
    (event.target as HTMLInputElement).select();
  }

  private async _copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 1500);
    }
    catch {
      // Clipboard unavailable (e.g. insecure context); the field is selectable.
    }
  }

  private _start() {
    this.dispatchEvent(new CustomEvent("gts-start-game", { bubbles: true, composed: true }));
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      padding: 24px;
      box-sizing: border-box;
      font: 16px/1.5 system-ui, sans-serif;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h1 {
      margin: 0;
      font-size: 28px;
    }
    .code {
      font: 700 22px/1 ui-monospace, monospace;
      letter-spacing: 2px;
      padding: 8px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .invite {
      display: flex;
      gap: 8px;
    }
    .invite input {
      flex: 1;
      min-width: 0;
      font: inherit;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 8px;
      background: transparent;
      color: inherit;
    }
    button {
      font: inherit;
      font-weight: 600;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      background: #6d28d9;
      color: #fff;
      cursor: pointer;
      white-space: nowrap;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .players {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .players li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .players li.offline {
      opacity: 0.5;
    }
    .name {
      font-weight: 600;
    }
    .badge {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 999px;
      background: #6d28d9;
      color: #fff;
    }
    .badge.dim {
      background: color-mix(in srgb, currentColor 30%, transparent);
    }
    .settings {
      display: flex;
      gap: 24px;
      margin: 0;
    }
    .settings dt {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .settings dd {
      margin: 0;
      font-weight: 600;
    }
    .start {
      align-self: stretch;
    }
    .hint {
      margin: 0;
      text-align: center;
      opacity: 0.7;
      font-size: 14px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-lobby": GtsLobby;
  }
}
