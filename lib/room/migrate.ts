import type { KingdomState, RoomState } from "@/lib/types";

/**
 * Bring a stored room up to the current shape.
 *
 * Rooms are plain JSON on disk, so a field added today simply is not there in a
 * table that was opened last week — and the interface would read `undefined`
 * where it expects a list or a map. Rooms are short-lived, but "short-lived"
 * still means a game in progress when a new version is deployed, and losing one
 * to a missing key is not a trade worth making.
 *
 * Only additive defaults live here. Nothing is ever rewritten or removed: a
 * room loaded and saved by the current version carries the new fields onward,
 * and a client running an older bundle that saves over it keeps them too,
 * because the reducer spreads the kingdom object rather than rebuilding it.
 */
export function normaliseRoomState(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const room = state as RoomState;
  if (!room.kingdom || typeof room.kingdom !== "object") return state;

  const kingdom = room.kingdom as Partial<KingdomState>;

  return {
    ...room,
    kingdom: {
      ...kingdom,
      // Defaults only where the stored room is missing the key entirely.
      revealed: kingdom.revealed ?? [],
      claims: kingdom.claims ?? {},
      roles: kingdom.roles ?? {},
      cards: kingdom.cards ?? {},
      classes: kingdom.classes ?? {},
      // The newest field: no room written before Advanced Kingdoms had its own
      // mode can possibly have it.
      announced: kingdom.announced ?? {},
    },
  };
}
