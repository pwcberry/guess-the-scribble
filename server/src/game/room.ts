import type {
  ClientMessage,
  ErrorCode,
  PlayerView,
  RoundPublic,
  RoundResult,
  RoomView,
  Score,
  ServerMessage,
  Stroke,
} from "@gts/shared";
import type { Connection } from "./connection.js";
import type { GameEvent, GameEventSink, PersistedResult } from "./events.js";
import { makeId, makeSessionId } from "./ids.js";
import { Player } from "./player.js";
import { Round } from "./round.js";
import { type Cancel, type Scheduler, systemScheduler } from "./scheduler.js";
import { drawerPoints, guesserPoints } from "./scoring.js";
import type { RoomSettings } from "./settings.js";
import type { WordPool } from "./words.js";
import { isCloseGuess, isCorrectGuess, letterCount, maskWord } from "./wordmask.js";

export type RoomStatus = "lobby" | "playing" | "ended";

const MAX_NICKNAME = 20;
/** Seconds the drawer has to choose a word before one is auto-picked. */
const CHOOSE_TIME_MS = 15_000;
/** Pause between the round reveal and the next round starting. */
const INTERMISSION_MS = 5_000;

export interface JoinRequest {
  nickname: string;
  conn: Connection;
  sessionId?: string;
}

export type JoinResult
  = | { ok: true; player: Player; reconnected: boolean }
    | { ok: false; code: ErrorCode; message: string };

export interface RoomDeps {
  id: string;
  inviteCode: string;
  settings: RoomSettings;
  words: WordPool;
  createdAt?: number;
  scheduler?: Scheduler;
  events?: GameEventSink;
}

/**
 * Authoritative in-memory state and behaviour for one room: players, the running
 * game, and the round state machine (choose -> draw -> reveal -> next). All
 * outbound messages flow through players' Connections; timers use the injected
 * scheduler; durable writes happen via emitted events. The engine itself never
 * touches the transport or the database.
 */
export class Room {
  readonly id: string;
  readonly inviteCode: string;
  readonly settings: RoomSettings;
  readonly createdAt: number;
  status: RoomStatus = "lobby";

  hostSessionId: string | null = null;
  gameId: string | null = null;
  round: Round | null = null;

  private readonly players = new Map<string, Player>();
  private readonly words: WordPool;
  private readonly scheduler: Scheduler;
  private readonly events?: GameEventSink;

  /** Global turn index (1-based) — one drawer's period; `RoundPublic.ordinal`. */
  private roundOrdinal = 0;
  /** Current rotation (1-based). A game runs `settings.rounds` rotations. */
  private rotationOrdinal = 0;
  /** SessionIds still to draw in the current rotation (one turn per present player). */
  private rotationQueue: string[] = [];
  private timerCancel: Cancel | null = null;

  constructor(deps: RoomDeps) {
    this.id = deps.id;
    this.inviteCode = deps.inviteCode;
    this.settings = deps.settings;
    this.createdAt = deps.createdAt ?? Date.now();
    this.words = deps.words;
    this.scheduler = deps.scheduler ?? systemScheduler;
    this.events = deps.events;
  }

  get playerList(): Player[] {
    return [...this.players.values()];
  }

  getPlayer(sessionId: string): Player | undefined {
    return this.players.get(sessionId);
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  // --- membership ---------------------------------------------------------

  join(req: JoinRequest): JoinResult {
    if (req.sessionId) {
      const existing = this.players.get(req.sessionId);
      if (existing) {
        existing.conn = req.conn;
        existing.connected = true;
        existing.send({ type: "joined", sessionId: existing.sessionId, room: this.view() });
        if (this.round) {
          this.sendRoundTo(existing);
        }
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

  markDisconnected(sessionId: string): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }
    player.connected = false;
    player.conn = null;
    this.broadcastState();
    this.handleDrawerAbsence(sessionId);
  }

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
    this.handleDrawerAbsence(sessionId);
  }

  // --- inbound messages ---------------------------------------------------

  handleMessage(sessionId: string, msg: ClientMessage): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }

    switch (msg.type) {
      case "startGame":
        this.startGame(sessionId);
        break;
      case "chooseWord":
        this.chooseWord(sessionId, msg.word);
        break;
      case "draw":
        this.handleDraw(sessionId, msg.stroke);
        break;
      case "clearCanvas":
        this.handleClear(sessionId);
        break;
      case "undo":
        this.handleUndo(sessionId);
        break;
      case "guess":
        this.handleGuess(player, msg.text);
        break;
      case "leave":
        this.leave(sessionId);
        break;
      default:
        break;
    }
  }

  // --- game lifecycle -----------------------------------------------------

  startGame(sessionId: string): void {
    const player = this.players.get(sessionId);
    if (!player) {
      return;
    }
    if (sessionId !== this.hostSessionId || this.status !== "lobby") {
      player.send({ type: "error", code: "not_allowed", message: "Only the host can start, once, from the lobby." });
      return;
    }
    if (this.connectedCount() < 2) {
      player.send({ type: "error", code: "bad_request", message: "Need at least 2 players to start." });
      return;
    }

    this.status = "playing";
    this.gameId = makeId();
    this.roundOrdinal = 0;
    this.rotationOrdinal = 0;
    this.rotationQueue = [];
    for (const p of this.players.values()) {
      p.score = 0;
    }
    this.emit({
      type: "gameStarted",
      gameId: this.gameId,
      roomId: this.id,
      startedAt: this.now(),
      roundCount: this.settings.rounds,
    });
    this.beginRound();
  }

  private beginRound(): void {
    // A game needs 2+ present players; a drop below that ends it early.
    if (this.connectedCount() < 2) {
      this.endGame();
      return;
    }
    const drawer = this.nextDrawer();
    if (!drawer) {
      this.endGame();
      return;
    }
    this.roundOrdinal += 1;

    for (const p of this.players.values()) {
      p.hasGuessed = false;
      p.guessedAt = null;
    }

    this.round = new Round({
      id: makeId(),
      ordinal: this.roundOrdinal,
      drawerSessionId: drawer.sessionId,
      choices: this.words.pickChoices(3),
    });

    this.broadcast({ type: "roundStart", round: this.publicRound()! });
    drawer.send({ type: "wordChoices", words: this.round.choices });
    this.setTimer(CHOOSE_TIME_MS, () => this.autoChoose());
  }

  chooseWord(sessionId: string, word: string): void {
    const round = this.round;
    if (!round || round.phase !== "choosing" || sessionId !== round.drawerSessionId) {
      return;
    }
    if (!round.choices.includes(word)) {
      return;
    }
    this.startDrawing(word);
  }

  private autoChoose(): void {
    const round = this.round;
    if (round && round.phase === "choosing" && round.choices.length > 0) {
      this.startDrawing(round.choices[0]!);
    }
  }

  private startDrawing(word: string): void {
    const round = this.round!;
    round.word = word;
    round.phase = "drawing";
    round.startedAt = this.now();
    round.endsAt = round.startedAt + this.settings.drawTimeSec * 1000;

    this.broadcast({ type: "roundStart", round: this.publicRound()! });
    this.setTimer(this.settings.drawTimeSec * 1000, () => this.endRound());
  }

  private endRound(): void {
    const round = this.round;
    if (!round) {
      return;
    }
    this.clearTimer();
    round.phase = "intermission";

    // Drawer earns in proportion to how many guessers got it.
    const totalGuessers = this.playerList.filter(p => p.sessionId !== round.drawerSessionId).length;
    round.drawerPoints = drawerPoints(round.guessed.size, totalGuessers);
    const drawer = this.players.get(round.drawerSessionId);
    if (drawer) {
      drawer.score += round.drawerPoints;
    }

    const word = round.word ?? round.choices[0] ?? "";
    const persisted = this.buildPersistedResults(round);
    const results: RoundResult[] = persisted.map(r => ({
      sessionId: r.sessionId,
      nickname: r.nickname,
      guessed: r.guessed,
      points: r.points,
    }));
    const scores = this.scoreboard();

    this.broadcast({ type: "roundEnd", word, results, scores });
    this.emit({
      type: "roundEnded",
      data: {
        gameId: this.gameId!,
        roundId: round.id,
        ordinal: round.ordinal,
        drawerNickname: this.nicknameOf(round.drawerSessionId),
        word,
        drawing: [...round.strokes],
        results: persisted,
      },
    });

    this.setTimer(INTERMISSION_MS, () => this.beginRound());
  }

  private endGame(): void {
    this.clearTimer();
    this.status = "ended";
    this.round = null;
    const scores = this.scoreboard();
    this.broadcast({ type: "gameEnd", scores });
    this.emit({
      type: "gameEnded",
      gameId: this.gameId!,
      endedAt: this.now(),
      scores,
      players: this.playerList.map(p => ({ sessionId: p.sessionId, nickname: p.nickname, score: p.score })),
    });
  }

  // --- drawing & guessing -------------------------------------------------

  private handleDraw(sessionId: string, stroke: Stroke): void {
    const round = this.round;
    if (!round || round.phase !== "drawing" || sessionId !== round.drawerSessionId) {
      return;
    }
    round.strokes.push(stroke);
    this.broadcast({ type: "drawBroadcast", stroke }, { except: sessionId });
  }

  private handleClear(sessionId: string): void {
    const round = this.round;
    if (!round || round.phase !== "drawing" || sessionId !== round.drawerSessionId) {
      return;
    }
    round.strokes.length = 0;
    this.broadcast({ type: "clearCanvas" }, { except: sessionId });
  }

  private handleUndo(sessionId: string): void {
    const round = this.round;
    if (!round || round.phase !== "drawing" || sessionId !== round.drawerSessionId) {
      return;
    }
    round.strokes.pop();
    // Replay the remaining strokes so all guessers stay in sync.
    this.broadcast({ type: "clearCanvas" }, { except: sessionId });
    for (const stroke of round.strokes) {
      this.broadcast({ type: "drawBroadcast", stroke }, { except: sessionId });
    }
  }

  private handleGuess(player: Player, text: string): void {
    const round = this.round;

    // Outside an active drawing phase, or from a player who already guessed:
    // treat as ordinary chat (drawer chat is suppressed to avoid leaks).
    if (!round || round.phase !== "drawing" || !round.word) {
      this.broadcast({ type: "chat", nickname: player.nickname, text, kind: "chat" });
      return;
    }
    if (player.sessionId === round.drawerSessionId || player.hasGuessed) {
      return;
    }

    if (isCorrectGuess(text, round.word)) {
      const remaining = Math.max(0, (round.endsAt ?? this.now()) - this.now());
      const points = guesserPoints(remaining, this.settings.drawTimeSec * 1000);
      player.hasGuessed = true;
      player.guessedAt = this.now();
      player.score += points;
      round.guessed.set(player.sessionId, points);

      player.send({ type: "guessResult", correct: true });
      this.broadcast({ type: "correctGuess", sessionId: player.sessionId, nickname: player.nickname });

      if (this.allGuessed(round)) {
        this.endRound();
      }
      return;
    }

    // Wrong guess: everyone sees it as chat; the guesser gets a private "close" nudge.
    this.broadcast({ type: "chat", nickname: player.nickname, text, kind: "chat" });
    if (isCloseGuess(text, round.word)) {
      player.send({ type: "chat", nickname: player.nickname, text: "You're close!", kind: "close" });
    }
  }

  private allGuessed(round: Round): boolean {
    const guessers = this.playerList.filter(
      p => p.connected && p.sessionId !== round.drawerSessionId,
    );
    return guessers.length > 0 && guessers.every(p => p.hasGuessed);
  }

  // --- views & broadcasting ----------------------------------------------

  view(): RoomView {
    return {
      code: this.inviteCode,
      status: this.status,
      settings: this.settings,
      players: this.playerList.map(p => this.viewOf(p)),
      round: this.publicRound(),
    };
  }

  publicRound(): RoundPublic | null {
    const round = this.round;
    if (!round) {
      return null;
    }
    return {
      ordinal: round.ordinal,
      rotationOrdinal: this.rotationOrdinal,
      totalRounds: this.settings.rounds,
      drawerSessionId: round.drawerSessionId,
      drawerNickname: this.nicknameOf(round.drawerSessionId),
      wordPattern: round.word ? maskWord(round.word) : "",
      wordLength: round.word ? letterCount(round.word) : 0,
      phase: round.phase,
      endsAt: round.endsAt,
    };
  }

  broadcast(message: ServerMessage, opts: { except?: string } = {}): void {
    for (const player of this.players.values()) {
      if (player.connected && player.sessionId !== opts.except) {
        player.send(message);
      }
    }
  }

  protected viewOf(player: Player): PlayerView {
    return player.view({
      isHost: player.sessionId === this.hostSessionId,
      isDrawer: this.round?.drawerSessionId === player.sessionId,
    });
  }

  private broadcastState(opts: { except?: string } = {}): void {
    const view = this.view();
    for (const player of this.players.values()) {
      if (player.connected && player.sessionId !== opts.except) {
        player.send({ type: "roomState", room: view });
      }
    }
  }

  /** Resend current round state to a (re)joining player; word choices if drawer. */
  private sendRoundTo(player: Player): void {
    const round = this.round;
    if (!round) {
      return;
    }
    player.send({ type: "roundStart", round: this.publicRound()! });
    if (player.sessionId === round.drawerSessionId && round.phase === "choosing") {
      player.send({ type: "wordChoices", words: round.choices });
    }
  }

  // --- helpers ------------------------------------------------------------

  private buildPersistedResults(round: Round): PersistedResult[] {
    return this.playerList.map(p => ({
      sessionId: p.sessionId,
      nickname: p.nickname,
      guessed: round.guessed.has(p.sessionId),
      guessedAt: p.guessedAt,
      points: p.sessionId === round.drawerSessionId
        ? round.drawerPoints
        : round.guessed.get(p.sessionId) ?? 0,
    }));
  }

  private scoreboard(): Score[] {
    return this.playerList
      .map(p => ({ sessionId: p.sessionId, nickname: p.nickname, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * The next drawer, or undefined when the game is over. A rotation is one turn
   * per present player; when the queue empties we start the next rotation
   * (re-snapshotting present players, so leavers are dropped and joiners picked
   * up) until `settings.rounds` rotations have been played.
   */
  private nextDrawer(): Player | undefined {
    for (;;) {
      while (this.rotationQueue.length > 0) {
        const player = this.players.get(this.rotationQueue.shift()!);
        if (player?.connected) {
          return player;
        }
      }
      if (this.rotationOrdinal >= this.settings.rounds) {
        return undefined;
      }
      this.rotationOrdinal += 1;
      this.rotationQueue = this.playerList.filter(p => p.connected).map(p => p.sessionId);
      if (this.rotationQueue.length === 0) {
        return undefined;
      }
    }
  }

  private handleDrawerAbsence(sessionId: string): void {
    if (this.status !== "playing" || !this.round) {
      return;
    }
    if (this.connectedCount() < 2) {
      this.endGame();
      return;
    }
    if (this.round.drawerSessionId === sessionId && this.round.phase !== "intermission") {
      this.endRound();
    }
  }

  private connectedCount(): number {
    return this.playerList.filter(p => p.connected).length;
  }

  private nicknameOf(sessionId: string): string {
    return this.players.get(sessionId)?.nickname ?? "?";
  }

  private nicknameTaken(nickname: string): boolean {
    const lower = nickname.toLowerCase();
    return this.playerList.some(p => p.nickname.toLowerCase() === lower);
  }

  private emit(event: GameEvent): void {
    this.events?.(event);
  }

  private setTimer(ms: number, cb: () => void): void {
    this.clearTimer();
    this.timerCancel = this.scheduler.schedule(ms, cb);
  }

  private clearTimer(): void {
    if (this.timerCancel) {
      this.timerCancel();
      this.timerCancel = null;
    }
  }

  private now(): number {
    return this.scheduler.now();
  }
}
