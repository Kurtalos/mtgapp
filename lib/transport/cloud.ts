import type { RealtimeChannel } from "@supabase/supabase-js";
import { ROOMS_TABLE, getSupabase } from "@/lib/supabase";
import type { RoomState, StoredRoom } from "@/lib/types";
import type { PresencePlayer, RoomTransport, SaveResult } from "./types";

interface RoomRow {
  code: string;
  state: RoomState;
  version: number;
  updated_at: string;
}

function toStored(row: RoomRow): StoredRoom {
  return {
    code: row.code,
    state: row.state,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

/**
 * Cloud rooms backed by one row per room.
 *
 * The entire game is a single JSONB column, so a write is a compare-and-set on
 * the version number rather than a dozen row updates that could interleave.
 * If two phones tap at the same instant, exactly one write wins and the loser
 * reloads and replays — no torn state, no lost life totals.
 */
export class CloudTransport implements RoomTransport {
  kind = "cloud" as const;
  label = "Cloud (play from any device)";
  private lastError: string | null = null;

  describeError(): string | null {
    if (!this.lastError) return null;
    if (/does not exist|schema cache|42P01/i.test(this.lastError)) {
      return "The rooms table is missing. Run supabase/schema.sql in your Supabase SQL editor.";
    }
    if (/permission denied|row-level security/i.test(this.lastError)) {
      return "Supabase refused the write. Check the row level security policies in supabase/schema.sql.";
    }
    return this.lastError;
  }

  private note(error: { message?: string; code?: string } | null) {
    this.lastError = error?.message ?? error?.code ?? null;
  }

  async load(code: string): Promise<StoredRoom | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(ROOMS_TABLE)
      .select("code,state,version,updated_at")
      .eq("code", code)
      .maybeSingle();
    this.note(error);
    if (error || !data) return null;
    return toStored(data as RoomRow);
  }

  async create(code: string, state: RoomState): Promise<SaveResult> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, room: null };
    const { data, error } = await supabase
      .from(ROOMS_TABLE)
      .insert({ code, state, version: 1 })
      .select("code,state,version,updated_at")
      .maybeSingle();
    if (error || !data) {
      this.note(error);
      // A code collision is expected occasionally; anything else is a setup bug.
      const existing = error ? null : await this.load(code);
      return {
        ok: false,
        room: existing,
        error: error?.message,
      };
    }
    return { ok: true, room: toStored(data as RoomRow) };
  }

  async save(
    code: string,
    state: RoomState,
    expectedVersion: number,
  ): Promise<SaveResult> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, room: null };

    const { data, error } = await supabase
      .from(ROOMS_TABLE)
      .update({ state, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq("code", code)
      .eq("version", expectedVersion)
      .select("code,state,version,updated_at")
      .maybeSingle();

    if (error) {
      this.note(error);
      return { ok: false, room: await this.load(code), error: error.message };
    }
    if (!data) {
      // Someone else wrote first — return their state so the caller can retry.
      return { ok: false, room: await this.load(code) };
    }
    return { ok: true, room: toStored(data as RoomRow) };
  }

  subscribe(code: string, onChange: (room: StoredRoom) => void): () => void {
    const supabase = getSupabase();
    if (!supabase) return () => {};

    let applying = false;
    const channel = supabase
      .channel(`room-row:${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: ROOMS_TABLE,
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const row = payload.new as RoomRow;
          if (!row?.code || applying) return;
          applying = true;
          queueMicrotask(() => {
            applying = false;
          });
          onChange(toStored(row));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  watchPresence(
    code: string,
    me: PresencePlayer,
    onUpdate: (players: PresencePlayer[]) => void,
  ): () => void {
    const supabase = getSupabase();
    if (!supabase) return () => {};

    let channel: RealtimeChannel = supabase.channel(`presence:${code}`, {
      config: { presence: { key: me.playerId } },
    });

    const emit = () => {
      const raw = channel.presenceState() as Record<string, unknown[]>;
      const players: PresencePlayer[] = [];
      for (const [key, entries] of Object.entries(raw)) {
        const first = entries[0] as { name?: string; onlineAt?: number } | undefined;
        players.push({
          playerId: key,
          name: first?.name ?? "Player",
          onlineAt: first?.onlineAt ?? Date.now(),
        });
      }
      onUpdate(players);
    };

    channel = channel
      .on("presence", { event: "sync" }, emit)
      .on("presence", { event: "join" }, emit)
      .on("presence", { event: "leave" }, emit)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ name: me.name, onlineAt: Date.now() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }
}
