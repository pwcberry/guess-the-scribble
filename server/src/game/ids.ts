import { customAlphabet } from "nanoid";

// Invite codes are human-shareable, so use an unambiguous uppercase alphabet
// (no O/0, I/1) and a short length. Internal ids favour collision-resistance.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const inviteCode = customAlphabet(INVITE_ALPHABET, 6);
const id = customAlphabet(ID_ALPHABET, 16);

/** A 6-character shareable room code, e.g. "K7P2QX". */
export function makeInviteCode(): string {
  return inviteCode();
}

/** A 16-character opaque id for rooms, games, rounds. */
export function makeId(): string {
  return id();
}

/** A per-player session id. Stored client-side to enable reconnection. */
export function makeSessionId(): string {
  return id();
}
