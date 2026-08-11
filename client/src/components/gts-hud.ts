import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TurnPublic } from "@gts/shared";
import type { GameState, TurnOutcome } from "../state/store.ts";
import { drawerNickname, isLocalDrawer } from "./canvas-helpers.ts";
import { remainingSeconds, timerFraction } from "./hud-helpers.ts";

/**
 * The turn heads-up display: which round it is, who's drawing, the word (shown
 * in full to the drawer, as blanks to everyone else), and a live countdown.
 * Between turns it becomes the reveal panel — the server only broadcasts
 * `turnEnd` (not a phase change), so the reveal is keyed off `lastTurn`, not
 * the turn phase, which still reads "drawing" on the client during intermission.
 */
@customElement("gts-hud")
export class GtsHud extends LitElement {
  @property({ attribute: false }) accessor state!: GameState;

  @state() accessor now = Date.now();
  private ticker: ReturnType<typeof setInterval> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.ticker = setInterval(() => {
      this.now = Date.now();
    }, 500);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  render() {
    const turn = this.state.room?.turn ?? null;
    if (this.state.lastTurn) {
      return this.renderReveal(this.state.lastTurn);
    }
    if (!turn) {
      return null;
    }
    return this.renderActive(turn);
  }

  private renderActive(turn: TurnPublic) {
    const drawing = turn.phase === "drawing";
    const totalMs = (this.state.room?.settings.drawTimeSec ?? 0) * 1000;
    const seconds = remainingSeconds(turn.endsAt, this.now);
    const fraction = timerFraction(turn.endsAt, this.now, totalMs);
    const urgency = fraction > 0.5 ? "calm" : fraction > 0.2 ? "warn" : "urgent";

    return html`
      <section aria-label="Round status">
        <div class="top">
          <span class="round">Round ${turn.roundOrdinal} of ${turn.totalRounds}</span>
          ${drawing
            ? html`<span class="clock ${urgency}" role="timer" aria-label=${`${seconds} seconds left`}>${seconds}s</span>`
            : null}
        </div>

        ${this.renderWord(turn, drawing)}

        ${drawing
          ? html`<div class="bar" role="presentation"><span class="fill ${urgency}" style="width:${(fraction * 100).toFixed(1)}%"></span></div>`
          : null}
      </section>
    `;
  }

  private renderWord(turn: TurnPublic, drawing: boolean) {
    const drawer = isLocalDrawer(this.state);
    const name = drawerNickname(this.state) ?? "The drawer";

    if (!drawing) {
      // Choosing phase: the drawer picks in the canvas overlay; others wait.
      const label = drawer ? "Choose a word to draw" : `${name} is choosing a word`;
      return html`<p class="prompt">${label}</p>`;
    }

    if (drawer && this.state.myWord) {
      return html`
        <div class="word">
          <span class="label">You're drawing</span>
          <strong class="secret">${this.state.myWord}</strong>
        </div>
      `;
    }

    return html`
      <div class="word">
        <span class="label">${name} is drawing</span>
        <span class="pattern" aria-label=${`${turn.wordLength} letters`}>${turn.wordPattern}</span>
      </div>
    `;
  }

  private renderReveal(outcome: TurnOutcome) {
    const results = [...outcome.results].sort((a, b) => b.points - a.points);
    return html`
      <section class="reveal" role="status">
        <p class="revealed">The word was <strong>${outcome.word}</strong></p>
        <ul>
          ${results.map(r => html`
            <li>
              <span class="who">${r.nickname}</span>
              <span class="tag">${r.guessed ? "guessed" : "—"}</span>
              <span class="pts">${r.points > 0 ? `+${r.points}` : "0"}</span>
            </li>
          `)}
        </ul>
        <p class="next">Next turn starting…</p>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      font: 16px/1.4 system-ui, sans-serif;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 12px;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .round {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.65;
    }
    .clock {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      font-size: 20px;
    }
    .clock.warn {
      color: var(--color-warning);
    }
    .clock.urgent {
      color: var(--color-error);
    }
    .word {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-align: center;
    }
    .label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }
    .pattern,
    .secret {
      font: 700 26px/1.2 ui-monospace, monospace;
      letter-spacing: 0.18em;
    }
    .prompt {
      margin: 0;
      text-align: center;
      font-weight: 600;
    }
    .bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 14%, transparent);
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--color-success);
      transition: width 0.5s linear;
    }
    .fill.warn {
      background: var(--color-warning);
    }
    .fill.urgent {
      background: var(--color-error);
    }
    .reveal {
      align-items: stretch;
    }
    .revealed {
      margin: 0;
      text-align: center;
      font-size: 18px;
    }
    .revealed strong {
      font-weight: 800;
    }
    .reveal ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .reveal li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .who {
      flex: 1;
      min-width: 0;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tag {
      font-size: 13px;
      opacity: 0.6;
    }
    .pts {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .next {
      margin: 0;
      text-align: center;
      font-size: 13px;
      opacity: 0.6;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-hud": GtsHud;
  }
}
