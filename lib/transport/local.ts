import type { RoomState, StoredRoom } from "@/lib/types";
import type { PresencePlayer, RoomTransport, SaveResult } from "./types";

const KEY = (code: string) => `manatable:room:${code}`;

function read(code: string): StoredRoom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(code));
    return raw ? (JSON.parse(raw) as StoredRoom) : null;
  } catch {
    return null;
  }
}

function write(room: StoredRoom) {
  window.localStorage.setItem(KEY(room.code), JSON.stringify(room));
}

/**
 * Browser-only rooms.
 *
 * Every tab shares localStorage, and BroadcastChannel gives instant fan-out
 * between them, which means you can open two tabs and play against yourself —
 * genuinely handy for testing, and it keeps the app usable if you just want a
 * single tablet on the table with no backend at all.
 */
export class LocalTransport implements RoomTransport {
  kind = "local" as const;
  label = "Local (this browser only)";

  async load(code: string): Promise<StoredRoom | null> {
    return read(code);
  }

  async create(code: string, state: RoomState): Promise<SaveResult> {
    const existing = read(code);
    if (existing) return { ok: false, room: existing };
    const room: StoredRoom = {
      code,
      state,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    write(room);
    this.broadcast(room);
    return { ok: true, room };
  }

  async save(
    code: string,
    state: RoomState,
    expectedVersion: number,
  ): Promise<SaveResult> {
    const existing = read(code);
    if (!existing) return { ok: false, room: null };
    if (existing.version !== expectedVersion) {
      return { ok: false, room: existing };
    }
    const room: StoredRoom = {
      code,
      state,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    write(room);
    this.broadcast(room);
    return { ok: true, room };
  }

  subscribe(code: string, onChange: (room: StoredRoom) => void): () => void {
    if (typeof window === "undefined") return () => {};

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(`manatable:${code}`);
      channel.onmessage = (event) => {
        if (event.data?.type === "room" && event.data.room) {
          onChange(event.data.room as StoredRoom);
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY(code) || !event.newValue) return;
      try {
        onChange(JSON.parse(event.newValue) as StoredRoom);
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }

  watchPresence(
    code: string,
    me: PresencePlayer,
    onUpdate: (players: PresencePlayer[]) => void,
  ): () => void {
    if (typeof window === "undefined") return () => {};
    const self = { ...me, onlineAt: Date.now() };
    onUpdate([self]);
    return () => {};
  }

  describeError(): string | null {
    return null;
  }

  private broadcast(room: StoredRoom) {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(`manatable:${room.code}`);
    channel.postMessage({ type: "room", room });
    channel.close();
  }
}
