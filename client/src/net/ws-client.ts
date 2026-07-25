import { WS_PATH, type ClientMessage, type ServerMessage, type Stroke } from "@gts/shared";

/** Lifecycle of the underlying socket, surfaced to the UI. */
export type ConnectionStatus
  = | "idle"
    | "connecting"
    | "open"
    | "reconnecting"
    | "closed";

/**
 * Minimal socket surface the client needs. The browser `WebSocket` satisfies
 * it; tests inject a fake so reconnection logic runs without a real network.
 */
export interface Socket {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

/** Where the reconnect `sessionId` is remembered across reloads. */
export interface SessionStorage {
  get(): string | null;
  set(sessionId: string): void;
}

export interface JoinParams {
  roomCode: string;
  nickname: string;
}

export interface GameClientOptions {
  /** Opens a socket to `url`; defaults to the browser `WebSocket`. */
  connect?: (url: string) => Socket;
  /** Persists the `sessionId`; defaults to `localStorage`. */
  storage?: SessionStorage;
  /** Overrides the derived same-origin `/ws` URL (tests). */
  url?: string;
  /** Reconnect backoff schedule in ms; the last value repeats. */
  backoffMs?: number[];
}

const SESSION_KEY = "gts:sessionId";
const DEFAULT_BACKOFF = [500, 1000, 2000, 5000];

/** Same-origin `ws(s)://…/ws` URL for the current page. */
function resolveUrl(): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}${WS_PATH}`;
}

function browserStorage(): SessionStorage {
  return {
    get: () => localStorage.getItem(SESSION_KEY),
    set: sessionId => localStorage.setItem(SESSION_KEY, sessionId),
  };
}

type MessageListener = (message: ServerMessage) => void;
type StatusListener = (status: ConnectionStatus) => void;

/**
 * Typed WebSocket client for the game protocol. Owns the connection lifecycle:
 * sends the initial `join`, re-joins with the stored `sessionId` after a drop,
 * and fans inbound `ServerMessage`s out to subscribers. The client is transport
 * for the protocol only — game state lives in the store (see state/store.ts).
 */
export class GameClient {
  private readonly connect: (url: string) => Socket;
  private readonly storage: SessionStorage;
  private readonly url: string;
  private readonly backoffMs: number[];

  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();

  private socket: Socket | null = null;
  private join: JoinParams | null = null;
  private status: ConnectionStatus = "idle";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  constructor(options: GameClientOptions = {}) {
    this.connect = options.connect ?? (url => new WebSocket(url) as Socket);
    this.storage = options.storage ?? browserStorage();
    this.url = options.url ?? resolveUrl();
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  /** Subscribe to inbound server messages. Returns an unsubscribe function. */
  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /** Subscribe to connection-status changes. Returns an unsubscribe function. */
  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Connect and join a room; reconnects automatically until `disconnect()`. If
   * the socket is already open (e.g. retrying after a rejected nickname), the
   * new `join` is sent over the existing connection instead of opening another.
   */
  joinRoom(params: JoinParams): void {
    this.join = params;
    this.closedByUser = false;
    if (this.status === "open") {
      this.sendJoin();
      return;
    }
    this.attempt = 0;
    this.open();
  }

  /** Close the connection intentionally; suppresses reconnection. */
  disconnect(): void {
    this.closedByUser = true;
    this.clearReconnect();
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  send(message: ClientMessage): void {
    if (this.status === "open" && this.socket) {
      this.socket.send(JSON.stringify(message));
    }
  }

  startGame(): void {
    this.send({ type: "startGame" });
  }

  chooseWord(word: string): void {
    this.send({ type: "chooseWord", word });
  }

  draw(stroke: Stroke): void {
    this.send({ type: "draw", stroke });
  }

  clearCanvas(): void {
    this.send({ type: "clearCanvas" });
  }

  undo(): void {
    this.send({ type: "undo" });
  }

  guess(text: string): void {
    this.send({ type: "guess", text });
  }

  leave(): void {
    this.send({ type: "leave" });
    this.disconnect();
  }

  private open(): void {
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const socket = this.connect(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempt = 0;
      this.setStatus("open");
      this.sendJoin();
    });
    socket.addEventListener("message", event => this.receive(event.data));
    socket.addEventListener("close", () => this.handleClose());
    socket.addEventListener("error", () => socket.close());
  }

  private sendJoin(): void {
    if (!this.join) {
      return;
    }
    const sessionId = this.storage.get() ?? undefined;
    this.send({
      type: "join",
      roomCode: this.join.roomCode,
      nickname: this.join.nickname,
      sessionId,
    });
  }

  private receive(data: unknown): void {
    if (typeof data !== "string") {
      return;
    }
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    }
    catch {
      return;
    }
    if (message.type === "joined") {
      this.storage.set(message.sessionId);
    }
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  private handleClose(): void {
    this.socket = null;
    if (this.closedByUser || !this.join) {
      this.setStatus("closed");
      return;
    }
    const delay = this.backoffMs[Math.min(this.attempt, this.backoffMs.length - 1)];
    this.attempt++;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
