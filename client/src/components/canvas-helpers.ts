import type { GameState } from "../state/store.ts";

/** A canvas point, normalised to 0..1 on both axes (see `Stroke` in `@gts/shared`). */
export type Point = [number, number];

/** A named brush colour, so swatches can carry an accessible label. */
export interface BrushColor {
  name: string;
  value: string;
}

/**
 * Drawing palette. A broad, flat set of paint colours — not the app's purple
 * accent, which belongs to chrome, not the artwork. The canvas paints on white,
 * so white doubles as an eraser.
 */
export const BRUSH_COLORS: readonly BrushColor[] = [
  { name: "Black", value: "#1b1b1f" },
  { name: "Grey", value: "#8b8b93" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#e5484d" },
  { name: "Orange", value: "#f76b15" },
  { name: "Yellow", value: "#ffc53d" },
  { name: "Green", value: "#30a46c" },
  { name: "Teal", value: "#12a594" },
  { name: "Blue", value: "#0091ff" },
  { name: "Navy", value: "#3e63dd" },
  { name: "Purple", value: "#8e4ec6" },
  { name: "Pink", value: "#e93d82" },
  { name: "Brown", value: "#ad7f58" },
];

/** Selectable brush widths, in reference pixels (see `REFERENCE_WIDTH`). */
export const BRUSH_SIZES: readonly number[] = [3, 6, 12, 22];

export const DEFAULT_COLOR = BRUSH_COLORS[0].value;
export const DEFAULT_SIZE = BRUSH_SIZES[1];

/**
 * Canvas width, in CSS pixels, at which a `Stroke.width` is drawn 1:1. Rendering
 * scales line width by `actualWidth / REFERENCE_WIDTH` so a drawing keeps its
 * proportions on any canvas size — the same rationale as normalised points.
 */
export const REFERENCE_WIDTH = 800;

export function clamp01(n: number): number {
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}

/** The subset of `DOMRect` needed to map client coords into the canvas. */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Map a pointer's client coordinates to a normalised `[x, y]` in 0..1 relative
 * to `rect`, clamped to the canvas so strokes that stray outside stay in bounds.
 * A zero-sized rect (element not laid out yet) maps to the origin.
 */
export function normalizePoint(clientX: number, clientY: number, rect: RectLike): Point {
  const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return [clamp01(x), clamp01(y)];
}

/** Session id of the current turn's drawer, or null when no turn is active. */
export function currentDrawerId(state: GameState): string | null {
  return state.room?.turn?.drawerSessionId ?? null;
}

/** Whether this client is the drawer of the current turn. */
export function isLocalDrawer(state: GameState): boolean {
  const drawer = currentDrawerId(state);
  return drawer !== null && drawer === state.sessionId;
}

/** Whether the current turn is in its active drawing phase. */
export function isDrawingPhase(state: GameState): boolean {
  return state.room?.turn?.phase === "drawing";
}

/** Whether this client may draw right now (drawer, during the drawing phase). */
export function canDraw(state: GameState): boolean {
  return isLocalDrawer(state) && isDrawingPhase(state);
}

/** Nickname of the current drawer, for captions like "Ada is drawing". */
export function drawerNickname(state: GameState): string | null {
  return state.room?.turn?.drawerNickname ?? null;
}

/**
 * Identity of the current turn, used to reset the canvas when the turn
 * changes. Null when no turn is active. Turn ordinals are unique within a game.
 */
export function turnKey(state: GameState): number | null {
  return state.room?.turn?.turnOrdinal ?? null;
}
