import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { PlayerView } from "@gts/shared";
import { rankByScore } from "./scoreboard-helpers.ts";

/**
 * Live standings during a game: players ordered by score with their rank and
 * status (who is drawing, who has already guessed, the host, anyone offline).
 * Status is shown with an icon *and* a label so it never relies on colour.
 */
@customElement("gts-scoreboard")
export class GtsScoreboard extends LitElement {
  @property({ attribute: false }) accessor players: PlayerView[] = [];
  @property() accessor selfSessionId: string | null = null;

  render() {
    const ranked = rankByScore(this.players);
    return html`
      <section aria-label="Scoreboard">
        <h2>Scores</h2>
        <ol>
          ${ranked.map(p => html`
            <li class=${p.connected ? "" : "offline"} aria-current=${p.sessionId === this.selfSessionId ? "true" : "false"}>
              <span class="rank">${p.rank}</span>
              <span class="name">
                ${p.nickname}${p.sessionId === this.selfSessionId ? html`<span class="you"> (you)</span>` : null}
              </span>
              ${this.renderBadges(p)}
              <span class="score">${p.score}</span>
            </li>
          `)}
        </ol>
      </section>
    `;
  }

  private renderBadges(player: PlayerView) {
    return html`
      <span class="badges">
        ${player.isDrawer ? html`<span class="badge draw" title="Drawing">✏️<span class="sr"> drawing</span></span>` : null}
        ${player.hasGuessed && !player.isDrawer ? html`<span class="badge ok" title="Guessed">✓<span class="sr"> guessed</span></span>` : null}
        ${player.isHost ? html`<span class="badge" title="Host">★<span class="sr"> host</span></span>` : null}
        ${player.connected ? null : html`<span class="badge dim" title="Offline">⏻<span class="sr"> offline</span></span>`}
      </span>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      font: 15px/1.4 system-ui, sans-serif;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.6;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    li[aria-current="true"] {
      background: color-mix(in srgb, #6d28d9 22%, transparent);
    }
    li.offline {
      opacity: 0.5;
    }
    .rank {
      flex: 0 0 1.5em;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      opacity: 0.6;
      text-align: right;
    }
    .name {
      flex: 1;
      min-width: 0;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .you {
      font-weight: 400;
      opacity: 0.6;
    }
    .badges {
      display: inline-flex;
      gap: 4px;
      font-size: 13px;
    }
    .badge.ok {
      color: #16794c;
      font-weight: 700;
    }
    .score {
      flex: 0 0 auto;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-scoreboard": GtsScoreboard;
  }
}
