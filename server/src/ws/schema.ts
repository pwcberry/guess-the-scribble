import type { ClientMessage } from "@gts/shared";
import { z } from "zod";

// Bounds to keep a single frame cheap to handle and hard to abuse.
const MAX_POINTS = 5_000;
const MAX_NICKNAME = 40;
const MAX_GUESS = 200;
const MAX_WORD = 60;

const strokeSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number()])).max(MAX_POINTS),
  color: z.string().max(32),
  width: z.number(),
});

/**
 * Runtime validation for every inbound client message — the trust boundary. The
 * shape mirrors `ClientMessage` in @gts/shared (the frozen wire protocol); if one
 * changes, the other must too.
 */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    roomCode: z.string().min(1).max(16),
    nickname: z.string().min(1).max(MAX_NICKNAME),
    sessionId: z.string().max(64).optional(),
  }),
  z.object({ type: z.literal("startGame") }),
  z.object({ type: z.literal("chooseWord"), word: z.string().min(1).max(MAX_WORD) }),
  z.object({ type: z.literal("draw"), stroke: strokeSchema }),
  z.object({ type: z.literal("clearCanvas") }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("guess"), text: z.string().min(1).max(MAX_GUESS) }),
  z.object({ type: z.literal("leave") }),
]);

/** Parse + validate a raw frame; returns null for malformed or invalid input. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  }
  catch {
    return null;
  }
  const result = clientMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}
