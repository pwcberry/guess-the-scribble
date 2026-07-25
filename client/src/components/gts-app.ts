import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { GameStore, type GameState } from "../state/store.ts";
import { parseRoomCode } from "./lobby-helpers.ts";
import "./gts-join.ts";
import "./gts-lobby.ts";
import "./gts-canvas.ts";
import type { JoinRequest } from "./gts-join.ts";

/**
 * Root component and screen router. Owns the single `GameStore`, re-rendering on
 * every state change, and picks the screen from the room status: join → lobby →
 * game → end. Translates child events (`gts-join`, `gts-start-game`) into client
 * calls, and keeps the URL's `?room=` code in sync so the lobby link is shareable.
 */
@customElement("gts-app")
export class GtsApp extends LitElement {
  private readonly store = new GameStore();
  private unsubscribe: (() => void) | null = null;

  @state() accessor gameState: GameState = this.store.getState();
  @state() accessor urlRoomCode: string | null = parseRoomCode(location.search);

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.store.subscribe((state) => {
      this.gameState = state;
      this._syncUrl(state);
    });
    this.addEventListener("gts-join", this._onJoin as EventListener);
    this.addEventListener("gts-start-game", this._onStartGame);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.removeEventListener("gts-join", this._onJoin as EventListener);
    this.removeEventListener("gts-start-game", this._onStartGame);
  }

  private readonly _onJoin = (event: CustomEvent<JoinRequest>) => {
    this.store.client.joinRoom(event.detail);
  };

  private readonly _onStartGame = () => {
    this.store.client.startGame();
  };

  /** Reflect the joined room into the URL so the link can be shared/reloaded. */
  private _syncUrl(state: GameState) {
    const code = state.room?.code;
    if (code && parseRoomCode(location.search) !== code) {
      const url = `${location.pathname}?room=${encodeURIComponent(code)}`;
      history.replaceState(null, "", url);
      this.urlRoomCode = code;
    }
  }

  render() {
    return html`
      ${this._renderBanner()}
      <main>${this._renderScreen()}</main>
    `;
  }

  private _renderBanner() {
    const { connection } = this.gameState;
    if (connection === "reconnecting") {
      return html`<div class="banner" role="status">Reconnecting…</div>`;
    }
    return null;
  }

  private _renderScreen() {
    const state = this.gameState;
    const room = state.room;

    if (room) {
      switch (room.status) {
        case "lobby":
          return html`<gts-lobby .state=${state}></gts-lobby>`;
        case "playing":
          return html`
            <gts-canvas .state=${state} .client=${this.store.client}></gts-canvas>
            <p class="note">Chat and the round HUD arrive in tasks 2d–2e.</p>
          `;
        case "ended":
          return this._renderEnded();
      }
    }

    if ((state.connection === "connecting" || state.connection === "reconnecting") && !state.error) {
      return this._placeholder("Connecting…", "Joining the room.");
    }

    return html`
      <gts-join
        .roomCode=${this.urlRoomCode}
        .errorMessage=${state.error?.message ?? null}
      ></gts-join>
    `;
  }

  private _renderEnded() {
    const scores = this.gameState.finalScores ?? [];
    return html`
      <section class="ended">
        <h1>Game over</h1>
        <ol>
          ${scores.map(s => html`<li><span>${s.nickname}</span><span>${s.score}</span></li>`)}
        </ol>
        <p class="note">Full end-of-game screen lands in task 2e.</p>
      </section>
    `;
  }

  private _placeholder(title: string, note: string) {
    return html`
      <section class="placeholder">
        <h1>${title}</h1>
        <p>${note}</p>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    .banner {
      padding: 8px 16px;
      text-align: center;
      background: #f59e0b;
      color: #1a1300;
      font: 600 14px/1.4 system-ui, sans-serif;
    }
    main {
      padding: 24px 16px;
    }
    .placeholder,
    .ended {
      max-width: 420px;
      margin: 0 auto;
      text-align: center;
      font: 16px/1.5 system-ui, sans-serif;
    }
    .ended ol {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ended li {
      display: flex;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .note {
      opacity: 0.6;
      font-size: 14px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-app": GtsApp;
  }
}
