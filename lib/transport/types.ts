import type { RoomState, StoredRoom } from "@/lib/types";

export type SaveResult =
  | { ok: true; room: StoredRoom }
  | { ok: false; room: StoredRoom | null; error?: string };

export interface PresencePlayer {
  playerId: string;
  name: string;
  onlineAt: number;
}

/**
 * Storage + fan-out for a room. Two implementations:
 *
 *  - supabase   — shared across devices, if you already have a project.
 *  - selfhosted — the small backend bundled with this app (the default).
 *  - local      — browser only, synced between tabs, so the app is never a
 *                 blank screen and a single tablet works with no server.
 *
 * Both speak the same optimistic-concurrency protocol, so no UI code needs to
 * know which one is underneath.
 */
export interface RoomTransport {
  kind: "cloud" | "local" | "selfhosted";
  label: string;
  load(code: string): Promise<StoredRoom | null>;
  create(code: string, state: RoomState): Promise<SaveResult>;
  save(
    code: string,
    state: RoomState,
    expectedVersion: number,
  ): Promise<SaveResult>;
  subscribe(code: string, onChange: (room: StoredRoom) => void): () => void;
  /**
   * Called when the backend says this room no longer exists — closed by an
   * admin, not merely unwritten. Optional: a backend that cannot tell us is
   * still correct, the client just finds out on its next read.
   */
  onClosed?(code: string, onClose: () => void): () => void;
  watchPresence(
    code: string,
    me: PresencePlayer,
    onUpdate: (players: PresencePlayer[]) => void,
  ): () => void;
  /**
   * The most recent backend complaint, if any. Used to tell the operator
   * "you still need to run the schema" instead of a generic failure.
   */
  describeError(): string | null;
}

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}
