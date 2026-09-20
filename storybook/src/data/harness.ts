import type { PlayerView, TurnPhase, TurnPublic } from "@gts/client/src/protocol.ts";
import type {ConnectionStatus} from "@gts/client/src/net/ws-client.ts";
import type { GameState } from "@gts/client/src/state/store.ts";

export const players: PlayerView[] = [
  {
    sessionId: "player-17",
    nickname: "Ali",
    score: 10,
    connected: true,
    isHost: true,
    isDrawer: true,
    hasGuessed: false,
  },
  {
    sessionId: "player-18",
    nickname: "Billie",
    score: 5,
    connected: true,
    isHost: false,
    isDrawer: false,
    hasGuessed: false,
  },
  {
    sessionId: "player-19",
    nickname: "Charlie",
    score: 3,
    connected: true,
    isHost: false,
    isDrawer: false,
    hasGuessed: false,
  },
];

export const turnView = (drawerSessionId: string, wordLength: number, phase: TurnPhase): TurnPublic => ({
  turnOrdinal: 1,
  roundOrdinal: 1,
  totalRounds: 3,
  drawerSessionId,
  drawerNickname: players.filter(p => p.sessionId === drawerSessionId)[0].nickname,
  wordPattern: Array.from("_".repeat(wordLength)).join(" "),
  wordLength,
  phase,
  endsAt: Date.now() + 20000, // 20 seconds from now
});

export const gameState = (connection: ConnectionStatus, sessionId: string | null, turn: TurnPublic): GameState => ({
  connection,
  sessionId,
  room: {
    code: "YELLOW",
    status: "playing",
    settings: {
      rounds: 1,
      drawTimeSec: 60,
      maxPlayers: 3,
    },
    turn,
    players,
  },
  wordChoices: [],
  myWord: "head",
  chat: [],
  lastTurn: null,
  finalScores: null,
  error: null,
  nextChatId: 1,
});
