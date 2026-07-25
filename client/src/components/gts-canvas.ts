import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ServerMessage, Stroke } from "@gts/shared";
import type { GameClient } from "../net/ws-client.ts";
import type { GameState } from "../state/store.ts";
import {
  BRUSH_COLORS,
  BRUSH_SIZES,
  DEFAULT_COLOR,
  DEFAULT_SIZE,
  REFERENCE_WIDTH,
  canDraw,
  drawerNickname,
  isLocalDrawer,
  normalizePoint,
  roundKey,
  type Point,
} from "./canvas-helpers.ts";

/**
 * The shared drawing surface. The drawer paints with the pointer and each
 * completed line is sent as one `draw` message (one gesture = one `Stroke`, so
 * undo removes a whole line — matching the server, which pops the last stroke).
 * Everyone else watches: `drawBroadcast`/`clearCanvas` are streamed straight
 * from the socket (they bypass the state store) and replayed onto the canvas.
 *
 * Points are stored normalised (0..1); the canvas denormalises on render and
 * accounts for `devicePixelRatio`, so the picture is identical at any size.
 */
@customElement("gts-canvas")
export class GtsCanvas extends LitElement {
  @property({ attribute: false }) accessor state!: GameState;
  @property({ attribute: false }) accessor client!: GameClient;

  @state() accessor color = DEFAULT_COLOR;
  @state() accessor size = DEFAULT_SIZE;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private observer: ResizeObserver | null = null;
  private unsubscribe: (() => void) | null = null;
  private frame: number | null = null;

  /** Committed strokes (from this drawer's own lines and from broadcasts). */
  private strokes: Stroke[] = [];
  /** The line currently under the pointer, not yet committed/sent. */
  private current: Stroke | null = null;
  private lastRoundKey: number | null = null;
  private cssW = 0;
  private cssH = 0;

  connectedCallback() {
    super.connectedCallback();
    this.subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.observer?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  firstUpdated() {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (!changed.has("state")) return;
    const key = roundKey(this.state);
    if (key !== this.lastRoundKey) {
      this.lastRoundKey = key;
      this.reset();
    }
    // Lost drawing rights mid-line (phase ended); drop the in-progress stroke.
    if (this.current && !canDraw(this.state)) {
      this.current = null;
      this.requestRender();
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("client")) this.subscribe();
  }

  private subscribe() {
    if (this.unsubscribe || !this.client) return;
    this.unsubscribe = this.client.onMessage(message => this.onServerMessage(message));
  }

  private onServerMessage(message: ServerMessage) {
    if (message.type === "drawBroadcast") {
      this.strokes.push(message.stroke);
      this.requestRender();
    }
    else if (message.type === "clearCanvas") {
      this.reset();
    }
  }

  // --- pointer input (drawer only) ---------------------------------------

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!canDraw(this.state)) return;
    event.preventDefault();
    this.canvas?.setPointerCapture(event.pointerId);
    this.current = { points: [this.pointFrom(event)], color: this.color, width: this.size };
    this.requestRender();
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.current) return;
    const point = this.pointFrom(event);
    const last = this.current.points[this.current.points.length - 1];
    if (last[0] === point[0] && last[1] === point[1]) return;
    this.current.points.push(point);
    this.requestRender();
  };

  private readonly onPointerUp = () => {
    if (!this.current) return;
    const stroke = this.current;
    this.current = null;
    this.strokes.push(stroke);
    this.client.draw(stroke);
    this.requestRender();
  };

  private pointFrom(event: PointerEvent): Point {
    const rect = this.canvas!.getBoundingClientRect();
    return normalizePoint(event.clientX, event.clientY, rect);
  }

  private undo() {
    if (this.strokes.length === 0) return;
    this.strokes.pop();
    this.client.undo();
    this.requestRender();
  }

  private clear() {
    this.strokes = [];
    this.current = null;
    this.client.clearCanvas();
    this.requestRender();
  }

  // --- rendering ----------------------------------------------------------

  private reset() {
    this.strokes = [];
    this.current = null;
    this.requestRender();
  }

  private resize() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssW = rect.width;
    this.cssH = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.requestRender();
  }

  private requestRender() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.paint();
    });
  }

  private paint() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { cssW: w, cssH: h } = this;
    ctx.clearRect(0, 0, w, h);
    const scale = w / REFERENCE_WIDTH;
    for (const stroke of this.strokes) this.drawStroke(stroke, w, h, scale);
    if (this.current) this.drawStroke(this.current, w, h, scale);
  }

  private drawStroke(stroke: Stroke, w: number, h: number, scale: number) {
    const pts = stroke.points;
    if (pts.length === 0) return;
    const ctx = this.ctx!;
    const lineWidth = Math.max(0.5, stroke.width * scale);
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0] * w, pts[0][1] * h, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
    }
    ctx.stroke();
  }

  // --- template -----------------------------------------------------------

  render() {
    const drawer = isLocalDrawer(this.state);
    const drawing = canDraw(this.state);
    const round = this.state.room?.round ?? null;
    const choosing = drawer && round?.phase === "choosing";
    const choices = this.state.wordChoices;

    return html`
      <div class="stage">
        <canvas
          class=${drawing ? "live" : ""}
          role="img"
          aria-label=${drawer ? "Your drawing canvas" : `Drawing by ${drawerNickname(this.state) ?? "the drawer"}`}
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
        ></canvas>
        ${choosing && choices.length > 0 ? this.renderWordChoice(choices) : null}
      </div>
      ${drawer ? this.renderToolbar(drawing) : this.renderWatcher(round?.phase ?? null)}
    `;
  }

  private renderWatcher(phase: string | null) {
    const name = drawerNickname(this.state) ?? "The drawer";
    const what = phase === "choosing" ? "is choosing a word" : "is drawing";
    return html`<p class="caption" role="status">${name} ${what}…</p>`;
  }

  private renderWordChoice(words: string[]) {
    return html`
      <div class="overlay">
        <h2>Choose a word to draw</h2>
        <div class="choices">
          ${words.map(word => html`
            <button type="button" @click=${() => this.client.chooseWord(word)}>${word}</button>
          `)}
        </div>
      </div>
    `;
  }

  private renderToolbar(drawing: boolean) {
    return html`
      <div class="toolbar" role="toolbar" aria-label="Drawing tools" aria-disabled=${!drawing}>
        <div class="swatches" role="group" aria-label="Colour">
          ${BRUSH_COLORS.map(c => html`
            <button
              type="button"
              class="swatch"
              style="--swatch:${c.value}"
              title=${c.name}
              aria-label=${c.name}
              aria-pressed=${this.color === c.value}
              ?disabled=${!drawing}
              @click=${() => { this.color = c.value; }}
            ></button>
          `)}
        </div>
        <div class="sizes" role="group" aria-label="Brush size">
          ${BRUSH_SIZES.map(s => html`
            <button
              type="button"
              class="size"
              aria-label=${`Brush size ${s}`}
              aria-pressed=${this.size === s}
              ?disabled=${!drawing}
              @click=${() => { this.size = s; }}
            ><span class="dot" style="--d:${Math.min(24, s)}px"></span></button>
          `)}
        </div>
        <div class="actions">
          <button type="button" ?disabled=${!drawing} @click=${this.undo}>Undo</button>
          <button type="button" ?disabled=${!drawing} @click=${this.clear}>Clear</button>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      font: 16px/1.5 system-ui, sans-serif;
    }
    .stage {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: default;
      -webkit-user-select: none;
      user-select: none;
    }
    canvas.live {
      cursor: crosshair;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px;
      background: color-mix(in srgb, #16171d 55%, transparent);
      color: #fff;
      text-align: center;
    }
    .overlay h2 {
      margin: 0;
      font-size: 20px;
    }
    .choices {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
    .choices button {
      font: 600 18px/1 system-ui, sans-serif;
      padding: 14px 20px;
      border: none;
      border-radius: 10px;
      background: #6d28d9;
      color: #fff;
      cursor: pointer;
    }
    .choices button:hover {
      background: #7c3aed;
    }
    .caption {
      margin: 0;
      text-align: center;
      opacity: 0.7;
      font-size: 15px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .swatch {
      width: 26px;
      height: 26px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      background: var(--swatch);
      cursor: pointer;
    }
    .swatch[aria-pressed="true"] {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .sizes {
      display: flex;
      gap: 6px;
    }
    .size {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .size[aria-pressed="true"] {
      background: color-mix(in srgb, currentColor 14%, transparent);
      border-color: currentColor;
    }
    .dot {
      display: block;
      width: var(--d);
      height: var(--d);
      border-radius: 50%;
      background: currentColor;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    .actions button {
      font: 600 14px/1 system-ui, sans-serif;
      padding: 9px 14px;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .actions button:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "gts-canvas": GtsCanvas;
  }
}
