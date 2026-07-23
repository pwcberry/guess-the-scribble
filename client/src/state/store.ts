import type {
  ChatKind,
  ErrorCode,
  PlayerView,
  RoomView,
  RoundResult,
  Score,
  ServerMessage,
} from "@gts/shared";
import { GameClient, type ConnectionStatus } from "../net/ws-client.ts";

/** A single line in the chat/guess log, with a stable id for list rendering. */
export interface ChatEntry {
  id: number;
  nickname: string;
  text: string;
  kind: ChatKind;
}

/** Outcome of the most recently finished round, for the reveal screen. */
export interface RoundOutcome {
  word: string;
  results: RoundResult[];
}

/** Everything the UI needs to render, derived from the server's messages. */
export interface GameState {
  connection: ConnectionStatus;
  sessionId: string | null;
  room: RoomView | null;
  /** Candidate words — only ever populated for the drawer. */
  wordChoices: string[];
  chat: ChatEntry[];
  lastRound: RoundOutcome | null;
  finalScores: Score[] | null;
  error: { code: ErrorCode; message: string } | null;
  /** Monotonic id source for chat entries; not for display. */
  nextChatId: number;
}

export const initialState: GameState = {
  connection: "idle",
  sessionId: null,
  room: null,
  wordChoices: [],
  chat: [],
  lastRound: null,
  finalScores: null,
  error: null,
  nextChatId: 1,
};

function mapPlayers(room: RoomView, fn: (player: PlayerView) => PlayerView): RoomView {
  return { ...room, players: room.players.map(fn) };
}

function appendChat(state: GameState, entry: Omit<ChatEntry, "id">): GameState {
  return {
    ...state,
    chat: [...state.chat, { ...entry, id: state.nextChatId }],
    nextChatId: state.nextChatId + 1,
  };
}

/**
 * Pure reducer: folds one server message into the client game state. Kept free
 * of side effects so it is trivially unit-testable; the store below wires it to
 * a live `GameClient`. Canvas stroke messages (`drawBroadcast`/`clearCanvas`)
 * are streamed straight to the canvas component and intentionally pass through
 * here untouched.
 */
export function reduce(state: GameState, message: ServerMessage): GameState {
  switch (message.type) {
    case "joined":
      return { ...state, sessionId: message.sessionId, room: message.room, error: null };

    case "roomState":
      return { ...state, room: message.room };

    case "playerJoined": {
      if (!state.room) return state;
      const others = state.room.players.filter(p => p.sessionId !== message.player.sessionId);
      return { ...state, room: { ...state.room, players: [...others, message.player] } };
    }

    case "playerLeft": {
      if (!state.room) return state;
      const players = state.room.players.filter(p => p.sessionId !== message.sessionId);
      return { ...state, room: { ...state.room, players } };
    }

    case "roundStart": {
      const room = state.room ? { ...state.room, status: "playing" as const, round: message.round } : state.room;
      return { ...state, room, wordChoices: [], lastRound: null };
    }

    case "wordChoices":
      return { ...state, wordChoices: message.words };

    case "chat":
      return appendChat(state, { nickname: message.nickname, text: message.text, kind: message.kind });

    case "correctGuess": {
      const withChat = appendChat(state, {
        nickname: message.nickname,
        text: "guessed the word!",
        kind: "correct",
      });
      if (!withChat.room) return withChat;
      const room = mapPlayers(withChat.room, p =>
        p.sessionId === message.sessionId ? { ...p, hasGuessed: true } : p);
      return { ...withChat, room };
    }

    case "roundEnd": {
      const scores = new Map(message.scores.map(s => [s.sessionId, s.score]));
      const room = state.room
        ? mapPlayers(state.room, p => ({ ...p, score: scores.get(p.sessionId) ?? p.score }))
        : state.room;
      const withChat = appendChat({ ...state, room }, {
        nickname: "",
        text: `The word was "${message.word}".`,
        kind: "system",
      });
      return { ...withChat, lastRound: { word: message.word, results: message.results } };
    }

    case "gameEnd": {
      const room = state.room ? { ...state.room, status: "ended" as const } : state.room;
      return { ...state, room, finalScores: message.scores };
    }

    case "error":
      return { ...state, error: { code: message.code, message: message.message } };

    default:
      return state;
  }
}

type Listener = (state: GameState) => void;

/**
 * Reactive game store. Subscribes to a `GameClient`, folds every server message
 * through `reduce`, tracks connection status, and notifies subscribers with the
 * new immutable state. UI components read `getState()` and re-render on change.
 */
export class GameStore {
  readonly client: GameClient;
  private state: GameState = initialState;
  private readonly listeners = new Set<Listener>();

  constructor(client: GameClient = new GameClient()) {
    this.client = client;
    client.onMessage(message => this.set(reduce(this.state, message)));
    client.onStatus(connection => this.set({ ...this.state, connection }));
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(next: GameState): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }
}
