import type { RoomState, StoredRoom } from "@/lib/types";
import { getPlayerId, getSavedName } from "@/lib/identity";
import type { PresencePlayer, RoomTransport, SaveResult } from "./types";

interface Connection {
  source: EventSource;
  roomListeners: Set<(room: StoredRoom) => void>;
  closedListeners: Set<() => void>;
  presenceListeners: Set<(players: PresencePlayer[]) => void>;
  lastRoom: StoredRoom | null;
  lastPresence: PresencePlayer[] | null;
  refs: number;
}

/**
 * Talks to the backend bundled with this app (app/api/rt/**).
 *
 * Relative URLs only, so it needs no configuration and works behind whatever
 * reverse proxy you put in front of it. Override with NEXT_PUBLIC_REALTIME_URL
 * if the backend ever lives on its own host.
 *
 * One EventSource per room per tab, shared between the room feed and the
 * presence feed. Browsers cap concurrent connections per origin, so opening a
 * separate stream for each would waste half the budget.
 */
export class SelfHostedTransport implements RoomTransport {
  kind = "selfhosted" as const;
  label = "Self-hosted";
  private lastError: string | null = null;
  private connections = new Map<string, Connection>();

  private base(): string {
    const configured = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
    if (configured) return configured.replace(/\/$/, "");
    return "/api/rt";
  }

  describeError(): string | null {
    return this.lastError;
  }

  async load(code: string): Promise<StoredRoom | null> {
    try {
      const response = await fetch(`${this.base()}/rooms/${code}`, {
        cache: "no-store",
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        this.lastError = `Backend returned ${response.status}`;
        return null;
      }
      const payload = (await response.json()) as { room?: StoredRoom };
      return payload.room ?? null;
    } catch {
      this.lastError = "Could not reach the game server.";
      return null;
    }
  }

  async create(code: string, state: RoomState): Promise<SaveResult> {
    try {
      const response = await fetch(`${this.base()}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        room?: StoredRoom;
        error?: string;
      };

      if (response.status === 201 && payload.room) {
        return { ok: true, room: payload.room };
      }
      if (response.status === 409 && payload.room) {
        // Code collision — the caller retries with a different code.
        return { ok: false, room: payload.room };
      }
      this.lastError = payload.error ?? `Backend returned ${response.status}`;
      return { ok: false, room: null, error: this.lastError };
    } catch {
      this.lastError = "Could not reach the game server.";
      return { ok: false, room: null, error: this.lastError };
    }
  }

  async save(
    code: string,
    state: RoomState,
    expectedVersion: number,
  ): Promise<SaveResult> {
    try {
      const response = await fetch(`${this.base()}/rooms/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, expectedVersion }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        room?: StoredRoom;
        error?: string;
      };

      if (response.ok && payload.room) return { ok: true, room: payload.room };
      if (response.status === 409 && payload.room) {
        return { ok: false, room: payload.room };
      }
      if (response.status === 404) return { ok: false, room: null };

      this.lastError = payload.error ?? `Backend returned ${response.status}`;
      return { ok: false, room: null, error: this.lastError };
    } catch {
      this.lastError = "Could not reach the game server.";
      return { ok: false, room: null, error: this.lastError };
    }
  }

  subscribe(code: string, onChange: (room: StoredRoom) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const connection = this.ensureConnection(code);
    connection.roomListeners.add(onChange);
    connection.refs += 1;
    if (connection.lastRoom) onChange(connection.lastRoom);

    return () => this.release(code, "room", onChange);
  }

  /**
   * Fire when the server says this room was closed.
   *
   * The event arrives on the same stream the room updates use, so a phone that
   * is sitting on a dead table finds out immediately instead of showing a
   * frozen board until its next write.
   */
  onClosed(code: string, onClose: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const connection = this.ensureConnection(code);
    connection.closedListeners.add(onClose);
    connection.refs += 1;

    return () => {
      const current = this.connections.get(code);
      if (!current) return;
      current.closedListeners.delete(onClose);
      current.refs -= 1;
      if (
        current.refs <= 0 &&
        current.roomListeners.size === 0 &&
        current.presenceListeners.size === 0 &&
        current.closedListeners.size === 0
      ) {
        current.source.close();
        this.connections.delete(code);
      }
    };
  }

  watchPresence(
    code: string,
    me: PresencePlayer,
    onUpdate: (players: PresencePlayer[]) => void,
  ): () => void {
    if (typeof window === "undefined") return () => {};
    const connection = this.ensureConnection(code, me.name);
    connection.presenceListeners.add(onUpdate);
    connection.refs += 1;
    if (connection.lastPresence) onUpdate(connection.lastPresence);
    else onUpdate([]);

    return () => this.release(code, "presence", onUpdate);
  }

  // -------------------------------------------------------------------------

  private ensureConnection(code: string, nameHint?: string): Connection {
    const existing = this.connections.get(code);
    if (existing) return existing;

    const playerId = getPlayerId();
    const name = nameHint || getSavedName() || "Player";
    const url = `${this.base()}/rooms/${code}/events?playerId=${encodeURIComponent(
      playerId,
    )}&name=${encodeURIComponent(name)}`;

    const source = new EventSource(url);
    const connection: Connection = {
      source,
      roomListeners: new Set(),
      closedListeners: new Set(),
      presenceListeners: new Set(),
      lastRoom: null,
      lastPresence: null,
      refs: 0,
    };

    source.addEventListener("room", (event) => {
      try {
        const room = JSON.parse((event as MessageEvent).data) as StoredRoom;
        connection.lastRoom = room;
        for (const listener of connection.roomListeners) listener(room);
      } catch {
        /* ignore malformed frame */
      }
    });

    source.addEventListener("closed", () => {
      connection.lastRoom = null;
      for (const listener of connection.closedListeners) listener();
      // Nothing left to hear from this room.
      source.close();
      this.connections.delete(code);
    });

    source.addEventListener("presence", (event) => {
      try {
        const players = JSON.parse((event as MessageEvent).data) as PresencePlayer[];
        connection.lastPresence = players;
        for (const listener of connection.presenceListeners) listener(players);
      } catch {
        /* ignore malformed frame */
      }
    });

    // EventSource reconnects on its own; nothing sensible to do here.
    source.addEventListener("error", () => {});

    this.connections.set(code, connection);
    return connection;
  }

  private release(
    code: string,
    kind: "room" | "presence",
    listener: unknown,
  ) {
    const connection = this.connections.get(code);
    if (!connection) return;
    if (kind === "room") {
      connection.roomListeners.delete(listener as (room: StoredRoom) => void);
    } else {
      connection.presenceListeners.delete(
        listener as (players: PresencePlayer[]) => void,
      );
    }
    connection.refs -= 1;

    if (
      connection.refs <= 0 &&
      connection.roomListeners.size === 0 &&
      connection.presenceListeners.size === 0
    ) {
      connection.source.close();
      this.connections.delete(code);
    }
  }
}
