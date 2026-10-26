import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { RoomState } from "@/lib/types";
import { applyAction } from "@/lib/room/reducer";
import { createRoomState } from "@/lib/room/setup";

/**
 * A minimal browser shim so the local transport can be exercised in Node.
 * This is the same code path two phones use against Supabase, minus the HTTP.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

type TransportModule = typeof import("@/lib/transport/local");

let LocalTransport: TransportModule["LocalTransport"];

before(async () => {
  const storage = new MemoryStorage();
  const listeners = new Set<(event: StorageEvent) => void>();
  const channels = new Map<string, Set<{ onmessage: ((event: MessageEvent) => void) | null }>>();

  const windowShim = {
    localStorage: storage,
    addEventListener(type: string, handler: (event: StorageEvent) => void) {
      if (type === "storage") listeners.add(handler);
    },
    removeEventListener(type: string, handler: (event: StorageEvent) => void) {
      if (type === "storage") listeners.delete(handler);
    },
  };

  class BroadcastChannelShim {
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(private name: string) {
      const set = channels.get(name) ?? new Set();
      set.add(this);
      channels.set(name, set);
    }
    postMessage(data: unknown) {
      for (const peer of channels.get(this.name) ?? []) {
        if (peer === this) continue;
        peer.onmessage?.({ data } as MessageEvent);
      }
    }
    close() {
      channels.get(this.name)?.delete(this);
    }
  }

  const windowWithChannels = { ...windowShim, BroadcastChannel: BroadcastChannelShim };
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = windowWithChannels;
  g.localStorage = storage;
  g.BroadcastChannel = BroadcastChannelShim;
  g.queueMicrotask = queueMicrotask;

  ({ LocalTransport } = await import("@/lib/transport/local"));
});

function freshState(code: string, hostId = "p_host"): RoomState {
  return createRoomState({
    code,
    hostId,
    hostName: "Host",
    mode: "commander",
  });
}

describe("local transport", () => {
  it("creates a room at version 1 and loads it back", async () => {
    const transport = new LocalTransport();
    const state = freshState("AAAAA");
    const created = await transport.create("AAAAA", state);
    assert.equal(created.ok, true);
    assert.ok(created.ok && created.room.version === 1);

    const loaded = await transport.load("AAAAA");
    assert.equal(loaded?.state.code, "AAAAA");
    assert.equal(loaded?.version, 1);
  });

  it("refuses to create a duplicate room code", async () => {
    const transport = new LocalTransport();
    await transport.create("BBBBB", freshState("BBBBB"));
    const second = await transport.create("BBBBB", freshState("BBBBB", "p_other"));
    assert.equal(second.ok, false);
    assert.equal(second.room?.state.hostId, "p_host");
  });

  it("returns the current state when a write loses the version race", async () => {
    const transport = new LocalTransport();
    await transport.create("CCCCC", freshState("CCCCC"));

    // Two clients both start from version 1.
    const first = await transport.save(
      "CCCCC",
      { ...freshState("CCCCC"), startingLife: 30 },
      1,
    );
    assert.equal(first.ok, true);
    assert.ok(first.ok && first.room.version === 2);

    const stale = await transport.save(
      "CCCCC",
      { ...freshState("CCCCC"), startingLife: 60 },
      1,
    );
    assert.equal(stale.ok, false);
    assert.equal(stale.room?.version, 2);
    // The loser gets the winner's state back, not its own.
    assert.equal(stale.room?.state.startingLife, 30);
  });

  it("re-applies a lost action on top of the winning state", async () => {
    const transport = new LocalTransport();
    await transport.create("DDDDD", freshState("DDDDD"));
    let room = (await transport.load("DDDDD"))!;
    // Life changes only apply once the table is in play.
    room = {
      ...room,
      state: applyAction(room.state, {
        type: "start",
        byId: room.state.hostId,
        seed: 1,
      }),
    };
    await transport.save("DDDDD", room.state, room.version);
    room = (await transport.load("DDDDD"))!;

    const me = room.state.players[0].id;
    const action = { type: "adjustLife", playerId: me, delta: -7 } as const;

    // Client A wins the race.
    const mine = applyAction(room.state, action);
    const a = await transport.save("DDDDD", mine, room.version);
    assert.equal(a.ok, true);

    // Client B was working from the old version; adopt and replay.
    room = (await transport.load("DDDDD"))!;
    const theirs = applyAction(room.state, action);
    assert.equal(room.state.players[0].life, 33);
    const b = await transport.save("DDDDD", theirs, room.version);
    assert.equal(b.ok, true);
    assert.equal(b.ok && b.room.state.players[0].life, 26);
  });

  it("notifies a second tab when the room changes", async () => {
    const transport = new LocalTransport();
    await transport.create("EEEEE", freshState("EEEEE"));

    const seen: number[] = [];
    const stop = transport.subscribe("EEEEE", (room) => seen.push(room.version));

    const base = (await transport.load("EEEEE"))!;
    await transport.save("EEEEE", base.state, base.version);

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(seen, [2]);
    stop();
  });
});
