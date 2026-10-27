import { promises as fs } from "node:fs";
import path from "node:path";
import { normaliseRoomState } from "@/lib/room/migrate";

/**
 * Durable storage for rooms.
 *
 * Deliberately boring: one JSON file per room on local disk, written with a
 * temp-file-and-rename so a crash mid-write cannot leave a half-written room.
 *
 * Why not a database? The entire dataset for a playgroup is a handful of
 * objects a few kilobytes each, and the app runs as a single Node process, so
 * an in-process lock plus an atomic rename gives us exactly the compare-and-set
 * semantics the client needs without a dependency, a daemon, or a native module
 * to compile on a $5 VPS.
 */

const ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 7; // a week of silence and it is gone

function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), ".data", "rooms");
}

function roomPath(code: string): string {
  // Room codes are A-Z0-9 only, but never trust that at the filesystem layer.
  const safe = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return path.join(dataDir(), `${safe}.json`);
}

export interface StoredRoomRecord {
  code: string;
  state: unknown;
  version: number;
  updatedAt: string;
}

/** Serialises read-modify-write per room within this process. */
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(code) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Keep the chain alive but never let a rejection poison the next caller.
  locks.set(
    code,
    next.catch(() => undefined),
  );
  return next;
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function readRoom(code: string): Promise<StoredRoomRecord | null> {
  try {
    const raw = await fs.readFile(roomPath(code), "utf8");
    const room = JSON.parse(raw) as StoredRoomRecord;
    // Old rooms are missing fields added since they were written; every reader
    // comes through here, so this is the one place to fix that.
    return { ...room, state: normaliseRoomState(room.state) };
  } catch (error) {
    const code_ = (error as NodeJS.ErrnoException).code;
    if (code_ === "ENOENT") return null;
    throw error;
  }
}

async function writeRoom(room: StoredRoomRecord): Promise<void> {
  await ensureDir();
  const target = roomPath(room.code);
  const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(temp, JSON.stringify(room), "utf8");
  // rename is atomic on the same filesystem: readers either see the old room
  // or the new one, never a partial write.
  await fs.rename(temp, target);
}

export async function createRoom(
  code: string,
  state: unknown,
): Promise<{ ok: true; room: StoredRoomRecord } | { ok: false; room: StoredRoomRecord }> {
  return withLock(code, async () => {
    const existing = await readRoom(code);
    if (existing) return { ok: false as const, room: existing };

    const room: StoredRoomRecord = {
      code,
      state,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    await writeRoom(room);
    return { ok: true as const, room };
  });
}

export async function saveRoom(
  code: string,
  state: unknown,
  expectedVersion: number,
): Promise<
  | { ok: true; room: StoredRoomRecord }
  | { ok: false; room: StoredRoomRecord | null; reason: "missing" | "conflict" }
> {
  return withLock(code, async () => {
    const existing = await readRoom(code);
    if (!existing) {
      return { ok: false as const, room: null, reason: "missing" as const };
    }
    if (existing.version !== expectedVersion) {
      return { ok: false as const, room: existing, reason: "conflict" as const };
    }

    const room: StoredRoomRecord = {
      code,
      state,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await writeRoom(room);
    return { ok: true as const, room };
  });
}

/**
 * Remove a room entirely.
 *
 * Used when a table has been empty long enough to be considered over. Returns
 * true when a file was actually removed, so callers can tell "closed" from
 * "already gone".
 */
export async function deleteRoom(code: string): Promise<boolean> {
  return withLock(code, async () => {
    try {
      await fs.unlink(roomPath(code));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  });
}

/** What the admin panel needs to know about a live room. */
export interface RoomSummary {
  code: string;
  mode: string;
  phase: string;
  players: number;
  maxPlayers: number;
  hostName: string;
  updatedAt: string;
  /** Size on disk, so an operator can see which room is the heavy one. */
  bytes: number;
}

/**
 * Every room currently on disk, newest first.
 *
 * Deliberately tolerant: a half-written or hand-edited file is skipped rather
 * than failing the whole listing, because this is the screen an operator opens
 * when something has already gone wrong.
 */
export async function listRooms(): Promise<RoomSummary[]> {
  await ensureDir();
  const dir = dataDir();
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const rooms: RoomSummary[] = [];

  for (const file of files) {
    if (!file.endsWith(".json") || file.endsWith(".tmp")) continue;
    const full = path.join(dir, file);
    try {
      const raw = await fs.readFile(full, "utf8");
      const record = JSON.parse(raw) as StoredRoomRecord;
      const state = record.state as {
        mode?: string;
        phase?: string;
        players?: unknown[];
        maxPlayers?: number;
        hostId?: string;
      } | null;
      const host = state?.players?.find(
        (p) => (p as { id?: string })?.id === state?.hostId,
      ) as { name?: string } | undefined;

      rooms.push({
        code: record.code ?? file.replace(/\.json$/, ""),
        mode: state?.mode ?? "unknown",
        phase: state?.phase ?? "unknown",
        players: state?.players?.length ?? 0,
        maxPlayers: state?.maxPlayers ?? 0,
        hostName: host?.name ?? "—",
        updatedAt: record.updatedAt ?? new Date(0).toISOString(),
        bytes: raw.length,
      });
    } catch {
      // Unreadable room: leave it for pruneStaleRooms, do not break the list.
    }
  }

  return rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Deletes rooms nobody has touched for a week. Returns how many went. */
export async function pruneStaleRooms(ttlMs = ROOM_TTL_MS): Promise<number> {
  await ensureDir();
  const dir = dataDir();
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const cutoff = Date.now() - ttlMs;
  let removed = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) {
      // Clean up any debris from a process that died mid-write.
      if (!file.endsWith(".json") && file.includes(".tmp")) {
        await fs.unlink(path.join(dir, file)).catch(() => undefined);
      }
      continue;
    }
    const full = path.join(dir, file);
    try {
      const raw = await fs.readFile(full, "utf8");
      const room = JSON.parse(raw) as StoredRoomRecord;
      const touched = new Date(room.updatedAt ?? 0).getTime();
      if (Number.isFinite(touched) && touched < cutoff) {
        await fs.unlink(full);
        removed += 1;
      }
    } catch {
      // A corrupt file is dead weight; drop it rather than serve it forever.
      await fs.unlink(full).catch(() => undefined);
    }
  }
  return removed;
}

export const ROOM_TTL = ROOM_TTL_MS;
