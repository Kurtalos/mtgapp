import type { StoredRoom } from "@/lib/types";
import { cancelRoomClose, resetLifecycle, scheduleRoomClose } from "./lifecycle";

/**
 * In-process fan-out for live rooms.
 *
 * Every open phone holds one Server-Sent Events stream. When a room changes the
 * writer broadcasts the new document to everyone else watching it, and when a
 * stream opens or closes we push the new presence list. This lives in memory
 * because a room only matters while the table is playing — the durable copy is
 * on disk.
 *
 * Single-process by design. If you ever run two instances behind a load
 * balancer, this needs to become Redis pub/sub; the rest of the app does not.
 */

export interface Subscriber {
  id: string;
  playerId: string;
  name: string;
  send: (event: string, data: unknown) => void;
}

const rooms = new Map<string, Map<string, Subscriber>>();

export function subscribe(code: string, subscriber: Subscriber): () => void {
  // A phone that is reconnecting (refresh, screen unlock, flaky signal) must not
  // lose the table to the cleanup below.
  cancelRoomClose(code);

  const existing = rooms.get(code) ?? new Map<string, Subscriber>();
  existing.set(subscriber.id, subscriber);
  rooms.set(code, existing);
  broadcastPresence(code);

  return () => {
    const current = rooms.get(code);
    if (!current) return;
    current.delete(subscriber.id);
    if (current.size === 0) {
      rooms.delete(code);
      // Last phone gone. Give everyone a minute to come back before the room is
      // deleted; the reaper asks this map again when the timer fires, since a
      // reconnect can land at any moment.
      scheduleRoomClose(code, () => (rooms.get(code)?.size ?? 0) === 0);
    } else broadcastPresence(code);
  };
}

export function publish(code: string, room: StoredRoom) {
  const current = rooms.get(code);
  if (!current) return;
  for (const subscriber of current.values()) {
    subscriber.send("room", room);
  }
}

export function presenceFor(code: string) {
  const current = rooms.get(code);
  if (!current) return [];
  return Array.from(current.values()).map((subscriber) => ({
    playerId: subscriber.playerId,
    name: subscriber.name,
    onlineAt: Date.now(),
  }));
}

/**
 * Tell every phone watching a room that it has been closed, then forget them.
 *
 * The streams end up closed by the clients, but dropping the map entry here
 * means a subscriber that never reacts cannot keep the room "occupied" and stop
 * the empty-room cleanup from running.
 */
export function broadcastClosed(code: string) {
  const current = rooms.get(code);
  if (!current) return;
  for (const subscriber of current.values()) {
    subscriber.send("closed", { code });
  }
  rooms.delete(code);
  cancelRoomClose(code);
}

function broadcastPresence(code: string) {
  const current = rooms.get(code);
  if (!current) return;
  const presence = presenceFor(code);
  for (const subscriber of current.values()) {
    subscriber.send("presence", presence);
  }
}

/** Test seam. */
export function resetHub() {
  rooms.clear();
  resetLifecycle();
}
