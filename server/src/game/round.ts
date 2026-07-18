import type { RoundPhase, Stroke } from "@gts/shared";

/**
 * Mutable state for one round (one drawer). The word is the secret held only by
 * the server (and revealed to the drawer via their word choice). `guessed`
 * records, per guesser, how many milliseconds were left when they guessed — the
 * basis for time-decay scoring.
 */
export class Round {
  readonly id: string;
  readonly ordinal: number;
  readonly drawerSessionId: string;
  choices: string[];

  word: string | null = null;
  phase: RoundPhase = "choosing";
  startedAt = 0;
  endsAt: number | null = null;

  readonly strokes: Stroke[] = [];
  /** guesser sessionId -> points earned this round. */
  readonly guessed = new Map<string, number>();
  /** Points the drawer earned this round (set at round end). */
  drawerPoints = 0;

  constructor(params: { id: string; ordinal: number; drawerSessionId: string; choices: string[] }) {
    this.id = params.id;
    this.ordinal = params.ordinal;
    this.drawerSessionId = params.drawerSessionId;
    this.choices = params.choices;
  }
}
