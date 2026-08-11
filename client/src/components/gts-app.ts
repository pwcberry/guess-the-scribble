import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { GameStore, type GameState } from "../state/store.ts";
import { parseRoomCode } from "./lobby-helpers.ts";
import { elementStyles } from "./element-styles.ts";
import "./gts-join.ts";
import "./gts-lobby.ts";
import "./gts-canvas.ts";
import "./gts-chat.ts";
import "./gts-hud.ts";
import "./gts-scoreboard.ts";
import "./gts-game-over.ts";
import type { ChooseWordRequest } from "./gts-canvas.ts";
import type { GuessRequest } from "./gts-chat.ts";
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
    this.addEventListener("gts-guess", this._onGuess as EventListener);
    this.addEventListener("gts-choose-word", this._onChooseWord as EventListener);
    this.addEventListener("gts-new-game", this._onNewGame);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.removeEventListener("gts-join", this._onJoin as EventListener);
    this.removeEventListener("gts-start-game", this._onStartGame);
    this.removeEventListener("gts-guess", this._onGuess as EventListener);
    this.removeEventListener("gts-choose-word", this._onChooseWord as EventListener);
    this.removeEventListener("gts-new-game", this._onNewGame);
  }

  private readonly _onJoin = (event: CustomEvent<JoinRequest>) => {
    this.store.client.joinRoom(event.detail);
  };

  private readonly _onStartGame = () => {
    this.store.client.startGame();
  };

  private readonly _onGuess = (event: CustomEvent<GuessRequest>) => {
    this.store.client.guess(event.detail.text);
  };

  private readonly _onChooseWord = (event: CustomEvent<ChooseWordRequest>) => {
    this.store.chooseWord(event.detail.word);
  };

  /** Return to a fresh join screen. There is no in-protocol game restart. */
  private readonly _onNewGame = () => {
    this.store.client.leave();
    location.assign(location.pathname);
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
            <div class="game">
              <div class="stage">
                <gts-hud .state=${state}></gts-hud>
                <gts-canvas .state=${state} .client=${this.store.client}></gts-canvas>
              </div>
              <div class="side">
                <gts-scoreboard
                  .players=${room.players}
                  .selfSessionId=${state.sessionId}
                ></gts-scoreboard>
                <gts-chat .state=${state}></gts-chat>
              </div>
            </div>
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
    return html`
      <gts-game-over
        .scores=${this.gameState.finalScores ?? []}
        .selfSessionId=${this.gameState.sessionId}
      ></gts-game-over>
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

  static styles = [elementStyles, css`
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
    .game {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .stage {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 0 0 auto;
    }
    @media (min-width: 860px) {
      .game {
        flex-direction: row;
        align-items: flex-start;
      }
      .side {
        flex: 0 0 320px;
      }
    }
    .placeholder {
      max-width: 420px;
      margin: 0 auto;
      text-align: center;
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-app": GtsApp;
  }
}
