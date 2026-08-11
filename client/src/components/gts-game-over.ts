import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Score } from "@gts/shared";
import { rankByScore } from "./scoreboard-helpers.ts";
import { elementStyles } from "./element-styles.ts";

/**
 * End-of-game screen: final standings with the winner called out, and a way to
 * start over. "Play again" dispatches `gts-new-game` for the app shell (there is
 * no in-protocol restart — it returns the player to a fresh join).
 */
@customElement("gts-game-over")
export class GtsGameOver extends LitElement {
  @property({ attribute: false }) accessor scores: Score[] = [];
  @property() accessor selfSessionId: string | null = null;

  render() {
    const ranked = rankByScore(this.scores);
    const winner = ranked[0] ?? null;

    return html`
      <section aria-label="Final results">
        <p class="eyebrow">Game over</p>
        ${winner
          ? html`<h1><span class="crown" aria-hidden="true">🏆</span> ${winner.nickname} wins</h1>`
          : html`<h1>No results</h1>`}

        <ol>
          ${ranked.map(s => html`
            <li aria-current=${s.sessionId === this.selfSessionId ? "true" : "false"}>
              <span class="rank">${s.rank}</span>
              <span class="name">
                ${s.nickname}${s.sessionId === this.selfSessionId ? html`<span class="you"> (you)</span>` : null}
              </span>
              <span class="score">${s.score}</span>
            </li>
          `)}
        </ol>

        <button type="button" @click=${this.playAgain}>Play again</button>
      </section>
    `;
  }

  private playAgain() {
    this.dispatchEvent(new CustomEvent("gts-new-game", { bubbles: true, composed: true }));
  }

  static styles = [elementStyles, css`
    :host {
      display: block;
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }
    .eyebrow {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.6;
    }
    h1 {
      margin: 0;
    }
    .crown {
      font-size: 24px;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    li[aria-current="true"] {
      background: color-mix(in srgb, var(--color-button-primary-background) 22%, transparent);
    }
    .rank {
      flex: 0 0 1.5em;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      opacity: 0.6;
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
    .score {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    button {
      align-self: center;
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-game-over": GtsGameOver;
  }
}
