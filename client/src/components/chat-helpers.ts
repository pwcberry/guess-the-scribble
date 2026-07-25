import type { GameState } from "../state/store.ts";
import { isLocalDrawer } from "./canvas-helpers.ts";
import { selfPlayer } from "./lobby-helpers.ts";

/**
 * How the chat/guess input should behave for the local player right now. The
 * server routes a `guess` message as either a scored guess or ordinary chat
 * depending on phase and role, and silently drops messages from the drawer or a
 * player who has already guessed during the drawing phase. This mirrors those
 * rules on the client so the input reflects what will actually happen.
 */
export interface ChatInputState {
  enabled: boolean;
  placeholder: string;
  /** Shown in place of the input when disabled, explaining why. */
  note: string | null;
}

export function chatInputState(state: GameState): ChatInputState {
  const drawing = state.room?.turn?.phase === "drawing";

  if (drawing && isLocalDrawer(state)) {
    return {
      enabled: false,
      placeholder: "You're drawing",
      note: "You're the drawer — the guessers are typing.",
    };
  }

  if (drawing && (selfPlayer(state)?.hasGuessed ?? false)) {
    return {
      enabled: false,
      placeholder: "You guessed it!",
      note: "Nice — you guessed the word. Sit tight for the reveal.",
    };
  }

  if (drawing) {
    return { enabled: true, placeholder: "Type your guess…", note: null };
  }

  // Choosing / intermission / no active turn: messages are plain chat.
  return { enabled: true, placeholder: "Chat…", note: null };
}
