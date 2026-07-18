import type { ClientMessage, ErrorCode, PlayerView, RoomView, ServerMessage } from "@gts/shared";
import type { Connection } from "./connection.js";
import { makeSessionId } from "./ids.js";
import { Player } from "./player.js";
import type { RoomSettings } from "./settings.js";

export type RoomStatus = "lobby" | "playing" | "ended";

const MAX_NICKNAME = 20;

export interface JoinRequest {
  nickname: string;
  conn: Connection;
  sessionId?: string;
}

export type JoinResult
  = | { ok: true; player: Player; reconnected: boolean }
    | { ok: false; code: ErrorCode; message: string };

/**
 * Authoritative in-memory state and behaviour for one room. Owns its players and
 * (from Phase 1c) the running game/round. All outbound messages flow through the
 * players' Connections; the engine never touches the transport directly.
 */
export class Room {
  readonly id: string;
  readonly inviteCode: string;
  readonly settings: RoomSettings;
  readonly createdAt: number;
  status: RoomStatus = "lobby";

  hostSessionId: string | null = null;

  /** Insertion-ordered; iteration order defines drawer rotation. */
  protected readonly players = new Map<string, Player>();

  constructor(params: {
    id: string;
    inviteCode: string;
    settings: RoomSettings;
    createdAt?: number;
  }) {
    this.id = params.id;
    this.inviteCode = params.inviteCode;
    this.settings = params.settings;
    this.createdAt = params.createdAt ?? Date.now();
  }

  get playerList(): Player[] {
    return [...this.players.values()];
  }

  getPlayer(sessionId: string): Player | undefined {
    return this.players.get(sessionId);
  }

  /** True when no players remain at all (safe for the registry to drop). */
  isEmpty(): boolean {
    return this.players.size === 0;
  }

  // --- membership ---------------------------------------------------------

  join(req: JoinRequest): JoinResult {
    // Reconnection: a known sessionId reclaims its seat and score.
    if (req.sessionId) {
      const existing = this.players.get(req.sessionId);
      if (existing) {
        existing.conn = req.conn;
        existing.connected = true;
        existing.send({ type: "joined", sessionId: existing.sessionId, room: this.view() });
        this.broadcastState({ except: existing.sessionId });
        return { ok: true, player: existing, reconnected: true };
      }
    }

    const nickname = req.nickname.trim();
    if (nickname.length === 0 || nickname.length > MAX_NICKNAME) {
      return { ok: false, code: "bad_request", message: "Nickname must be 1-20 characters." };
    }
    if (this.players.size >= this.settings.maxPlayers) {
      return { ok: false, code: "room_full", message: "This room is full." };
    }
    if (this.nicknameTaken(nickname)) {
      return { ok: false, code: "nickname_taken", message: "That nickname is taken." };
    }

    const player = new Player(makeSessionId(), nickname, req.conn);
    if (this.players.size === 0) {
      this.hostSessionId = player.sessionId;
    }
    this.players.set(player.sessionId, player);

    player.send({ type: "joined", sessionId: player.sessionId, room: this.view() });
    this.broadcast({ type: "playerJoined", player: this.viewOf(player) }, { except: player.sessionId });
    return { ok: true, player, reconnected: false };
  }

  /** Connection dropped: keep the seat (for reconnection) but mark offline. */
  markDisconnected(sessionId: string): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }
    player.connected = false;
    player.conn = null;
    this.broadcastState();
  }

  /** Explicit leave: relinquish the seat entirely. */
  leave(sessionId: string): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }
    player.conn?.close();
    this.players.delete(sessionId);
    if (this.hostSessionId === sessionId) {
      this.hostSessionId = this.players.keys().next().value ?? null;
    }
    this.broadcast({ type: "playerLeft", sessionId });
    this.broadcastState();
  }

  // --- inbound messages ---------------------------------------------------

  handleMessage(sessionId: string, msg: ClientMessage): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }

    switch (msg.type) {
      case "draw":
        this.broadcast({ type: "drawBroadcast", stroke: msg.stroke }, { except: sessionId });
        break;
      case "clearCanvas":
        this.broadcast({ type: "clearCanvas" }, { except: sessionId });
        break;
      case "guess":
        // No active round yet (Phase 1c/1d add guess scoring); treat as chat.
        this.broadcast({ type: "chat", nickname: player.nickname, text: msg.text, kind: "chat" });
        break;
      case "leave":
        this.leave(sessionId);
        break;
      // startGame / chooseWord / undo are handled once rounds land (Phase 1c).
      default:
        break;
    }
  }

  // --- views & broadcasting ----------------------------------------------

  view(): RoomView {
    return {
      code: this.inviteCode,
      status: this.status,
      settings: this.settings,
      players: this.playerList.map(p => this.viewOf(p)),
      round: null,
    };
  }

  protected viewOf(player: Player): PlayerView {
    return player.view({
      isHost: player.sessionId === this.hostSessionId,
      isDrawer: false,
    });
  }

  broadcast(message: ServerMessage, opts: { except?: string } = {}): void {
    for (const player of this.players.values()) {
      if (player.connected && player.sessionId !== opts.except) {
        player.send(message);
      }
    }
  }

  protected broadcastState(opts: { except?: string } = {}): void {
    const view = this.view();
    for (const player of this.players.values()) {
      if (player.connected && player.sessionId !== opts.except) {
        player.send({ type: "roomState", room: view });
      }
    }
  }

  private nicknameTaken(nickname: string): boolean {
    const lower = nickname.toLowerCase();
    return this.playerList.some(p => p.nickname.toLowerCase() === lower);
  }
}
