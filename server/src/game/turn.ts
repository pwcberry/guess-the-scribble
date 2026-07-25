import type { TurnPhase, Stroke } from "@gts/shared";

/**
 * Mutable state for one turn (one drawer). The word is the secret held only by
 * the server (and revealed to the drawer via their word choice). `guessed`
 * records, per guesser, how many milliseconds were left when they guessed — the
 * basis for time-decay scoring.
 */
export class Turn {
  readonly id: string;
  /** Global turn index (1-based). */
  readonly turnOrdinal: number;
  /** Round (full rotation) this turn belongs to (1-based). */
  readonly roundOrdinal: number;
  readonly drawerSessionId: string;
  choices: string[];

  word: string | null = null;
  phase: TurnPhase = "choosing";
  startedAt = 0;
  endsAt: number | null = null;

  readonly strokes: Stroke[] = [];
  /** guesser sessionId -> points earned this turn. */
  readonly guessed = new Map<string, number>();
  /** Points the drawer earned this turn (set at turn end). */
  drawerPoints = 0;

  constructor(params: {
    id: string;
    turnOrdinal: number;
    roundOrdinal: number;
    drawerSessionId: string;
    choices: string[];
  }) {
    this.id = params.id;
    this.turnOrdinal = params.turnOrdinal;
    this.roundOrdinal = params.roundOrdinal;
    this.drawerSessionId = params.drawerSessionId;
    this.choices = params.choices;
  }
}
