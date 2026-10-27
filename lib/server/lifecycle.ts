import { deleteRoom, readRoom } from "./store";

/**
 * Closes a table once everyone has left it.
 *
 * Presence lives in memory (see `hub.ts`), so the moment the last phone watching
 * a room disconnects we know the table is empty. Without this the room file
 * would simply sit on disk until the week-long TTL in `store.ts` expired, and a
 * playgroup that tries a new code every game ends up with a drawer full of dead
 * ones.
 *
 * The grace period is the important part. Phones drop their stream all the time
 * — a screen lock, a tunnel, a wifi handover, four people putting their phones
 * down to argue about a rule — and every one of those briefly looks identical to
 * "the last player left". Fifteen minutes in play (half an hour in the lobby) is
 * comfortably longer than any of that, and a re-subscribe cancels the timer, so
 * a pause or a refresh can never cost anyone their game.
 *
 * Timers are in-process, like the hub. After a restart the sweep in `store.ts`
 * is still the backstop, so nothing leaks forever.
 */

export const EMPTY_ROOM_GRACE_MS = 15 * 60_000;
/** Nobody has started playing yet, so give a fresh table longer to assemble. */
export const EMPTY_LOBBY_GRACE_MS = 30 * 60_000;

type Timer = ReturnType<typeof setTimeout>;

const timers = new Map<string, Timer>();
/** When each currently-empty room was first left alone. */
const emptySince = new Map<string, number>();

export interface CloseGrace {
  playMs?: number;
  lobbyMs?: number;
}

function schedule(fn: () => void, delay: number): Timer {
  const timer = setTimeout(fn, delay);
  // Never hold the process open just to delete a room.
  const ref = timer as unknown as { unref?: () => void };
  ref.unref?.();
  return timer;
}

/**
 * Delete `code` once it has been empty for the grace period.
 *
 * `nobodyReturned` is the caller's live view of presence: it is asked again when
 * the timer fires, because a phone can reconnect in the gap between the last
 * disconnect and the deletion.
 */
export function scheduleRoomClose(
  code: string,
  nobodyReturned: () => boolean,
  grace: CloseGrace = {},
): void {
  if (timers.has(code)) return;

  const playMs = grace.playMs ?? EMPTY_ROOM_GRACE_MS;
  const lobbyMs = grace.lobbyMs ?? EMPTY_LOBBY_GRACE_MS;
  emptySince.set(code, Date.now());

  const arm = (delay: number) => {
    timers.set(
      code,
      schedule(() => {
        void run();
      }, Math.max(0, delay)),
    );
  };

  const run = async () => {
    timers.delete(code);
    if (!nobodyReturned()) {
      emptySince.delete(code);
      return;
    }

    const record = await readRoom(code).catch(() => null);
    if (!record) {
      emptySince.delete(code);
      return;
    }

    // A lobby is still being assembled; a game in progress is over.
    const phase = (record.state as { phase?: string } | null)?.phase;
    const leftAt = emptySince.get(code) ?? Date.now();
    if (phase === "lobby" && Date.now() - leftAt < lobbyMs) {
      arm(lobbyMs - (Date.now() - leftAt));
      return;
    }

    emptySince.delete(code);
    await deleteRoom(code).catch(() => undefined);
  };

  arm(playMs);
}

/** Someone came back (or the room is gone): forget the pending close. */
export function cancelRoomClose(code: string): void {
  const timer = timers.get(code);
  if (timer) clearTimeout(timer);
  timers.delete(code);
  emptySince.delete(code);
}

/** Test seam. */
export function pendingRoomClose(code: string): boolean {
  return timers.has(code);
}

/** Test seam. */
export function resetLifecycle(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  emptySince.clear();
}
