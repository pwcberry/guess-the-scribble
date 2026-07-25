import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { RoomSettings } from "@gts/shared";
import { createRoom } from "../net/api.ts";
import { DEFAULT_SETTINGS } from "./settings-presets.ts";

/** Emitted when the player commits to joining a room with a nickname. */
export interface JoinRequest {
  roomCode: string;
  nickname: string;
}

/**
 * Home screen. With an invite code in the URL the player just enters a nickname
 * and joins; without one they configure a new room, which is created over HTTP
 * before joining. Either path ends by dispatching a `gts-join` event that the
 * app shell turns into a WebSocket connection.
 */
@customElement("gts-join")
export class GtsJoin extends LitElement {
  /** Invite code from the URL, if the player followed a shared link. */
  @property() accessor roomCode: string | null = null;
  /** Server-reported error from a previous join attempt (e.g. nickname taken). */
  @property() accessor errorMessage: string | null = null;

  @state() accessor nickname = "";
  @state() accessor settings: RoomSettings = { ...DEFAULT_SETTINGS };
  @state() accessor busy = false;
  @state() accessor localError: string | null = null;

  render() {
    const joining = this.roomCode !== null;
    const error = this.localError ?? this.errorMessage;
    return html`
      <section>
        <h1>Guess the Scribble</h1>
        <p class="tagline">
          ${joining
            ? html`Joining room <strong>${this.roomCode}</strong>`
            : "Create a room and share the link with friends."}
        </p>

        <label>
          Nickname
          <input
            type="text"
            .value=${this.nickname}
            maxlength="20"
            placeholder="Your name"
            @input=${this._onNickname}
            @keydown=${this._onKeydown}
          />
        </label>

        ${joining ? null : this._renderSettings()}
        ${error ? html`<p class="error" role="alert">${error}</p>` : null}

        <button type="button" ?disabled=${this.busy} @click=${this._submit}>
          ${this.busy ? "Creating…" : joining ? "Join game" : "Create room"}
        </button>
      </section>
    `;
  }

  private _renderSettings() {
    return html`
      <fieldset>
        <legend>Room settings</legend>
        <label class="setting">
          Rounds
          <input type="number" min="1" max="10" .value=${String(this.settings.rounds)}
            @input=${(e: Event) => this._onSetting("rounds", e)} />
        </label>
        <label class="setting">
          Draw time (s)
          <input type="number" min="30" max="180" step="5" .value=${String(this.settings.drawTimeSec)}
            @input=${(e: Event) => this._onSetting("drawTimeSec", e)} />
        </label>
        <label class="setting">
          Max players
          <input type="number" min="2" max="12" .value=${String(this.settings.maxPlayers)}
            @input=${(e: Event) => this._onSetting("maxPlayers", e)} />
        </label>
      </fieldset>
    `;
  }

  private _onNickname(event: Event) {
    this.nickname = (event.target as HTMLInputElement).value;
    this.localError = null;
  }

  private _onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      this._submit();
    }
  }

  private _onSetting(key: keyof RoomSettings, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.settings = { ...this.settings, [key]: value };
  }

  private async _submit() {
    if (this.busy) {
      return;
    }
    const nickname = this.nickname.trim();
    if (!nickname) {
      this.localError = "Please enter a nickname.";
      return;
    }

    if (this.roomCode !== null) {
      this._emitJoin(this.roomCode, nickname);
      return;
    }

    this.busy = true;
    this.localError = null;
    try {
      const room = await createRoom(this.settings);
      this._emitJoin(room.inviteCode, nickname);
    }
    catch {
      this.localError = "Could not create the room. Try again.";
    }
    finally {
      this.busy = false;
    }
  }

  private _emitJoin(roomCode: string, nickname: string) {
    this.dispatchEvent(
      new CustomEvent<JoinRequest>("gts-join", {
        detail: { roomCode, nickname },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      padding: 24px;
      box-sizing: border-box;
      font: 16px/1.5 system-ui, sans-serif;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: 32px;
      text-align: center;
    }
    .tagline {
      margin: 0;
      text-align: center;
      opacity: 0.75;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-weight: 600;
    }
    input {
      font: inherit;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 8px;
      background: transparent;
      color: inherit;
    }
    fieldset {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 8px;
      margin: 0;
    }
    legend {
      padding: 0 6px;
      font-weight: 600;
    }
    .setting {
      font-size: 13px;
      font-weight: 500;
    }
    button {
      font: inherit;
      font-weight: 600;
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      background: #6d28d9;
      color: #fff;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .error {
      margin: 0;
      color: #dc2626;
      font-size: 14px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-join": GtsJoin;
  }
}
