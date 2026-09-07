import type { PlayerView, TurnPhase, TurnPublic } from "@gts/client/src/protocol.ts";

export const players: PlayerView[] = [
  {
    sessionId: "player-123",
    nickname: "Ali",
    score: 10,
    connected: true,
    isHost: true,
    isDrawer: true,
    hasGuessed: false,
  },
  {
    sessionId: "player-124",
    nickname: "Billie",
    score: 5,
    connected: true,
    isHost: false,
    isDrawer: false,
    hasGuessed: false,
  },
  {
    sessionId: "player-125",
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
