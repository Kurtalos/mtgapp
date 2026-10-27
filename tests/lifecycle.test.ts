import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, before, describe, it } from "node:test";
import {
  EMPTY_LOBBY_GRACE_MS,
  EMPTY_ROOM_GRACE_MS,
  cancelRoomClose,
  pendingRoomClose,
  resetLifecycle,
  scheduleRoomClose,
} from "@/lib/server/lifecycle";
import { resetHub, subscribe } from "@/lib/server/hub";
import { createRoom, readRoom } from "@/lib/server/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "manatable-lifecycle-"));
});

describe("closing rooms the whole table has left", () => {
  afterEach(() => {
    resetLifecycle();
    resetHub();
  });

  it("waits long enough to survive a pause in play", () => {
    // Four people put their phones down to argue about a rule. If the grace
    // period were short, the table would be gone when they picked them up.
    assert.ok(EMPTY_ROOM_GRACE_MS >= 10 * 60_000);
    assert.ok(EMPTY_LOBBY_GRACE_MS >= EMPTY_ROOM_GRACE_MS);
  });

  it("deletes the room once the grace period is up", async () => {
    await createRoom("ROOM1", { phase: "playing" });
    scheduleRoomClose("ROOM1", () => true, { playMs: 20 });

    assert.notEqual(await readRoom("ROOM1"), null, "still there during the grace period");
    await sleep(120);
    assert.equal(await readRoom("ROOM1"), null);
  });

  it("never touches a room nobody has joined", async () => {
    await createRoom("ROOM2", { phase: "lobby" });
    // The reaper is only ever armed by a disconnect, so a freshly minted code
    // that has never been opened keeps waiting for its players.
    assert.equal(pendingRoomClose("ROOM2"), false);
    await sleep(60);
    assert.notEqual(await readRoom("ROOM2"), null);
  });

  it("keeps the table when a phone reconnects during the grace period", async () => {
    await createRoom("ROOM3", { phase: "playing" });
    scheduleRoomClose("ROOM3", () => true, { playMs: 40 });

    await sleep(15);
    cancelRoomClose("ROOM3");
    await sleep(100);
    assert.notEqual(await readRoom("ROOM3"), null, "a refresh must not cost the game");
  });

  it("re-checks presence when the timer fires", async () => {
    await createRoom("ROOM4", { phase: "playing" });
    // The reconnect lands in the gap between the timer firing and the unlink.
    scheduleRoomClose("ROOM4", () => false, { playMs: 10 });

    await sleep(80);
    assert.notEqual(await readRoom("ROOM4"), null);
  });

  it("gives a lobby longer to assemble than a game in progress", async () => {
    await createRoom("ROOM5", { phase: "lobby" });
    scheduleRoomClose("ROOM5", () => true, { playMs: 10, lobbyMs: 200 });

    await sleep(70);
    assert.notEqual(await readRoom("ROOM5"), null, "players are still turning up");
    await sleep(220);
    assert.equal(await readRoom("ROOM5"), null);
  });

  it("is armed by the last subscriber leaving the hub", async () => {
    await createRoom("ROOM6", { phase: "playing" });

    const leaveA = subscribe("ROOM6", { id: "a", playerId: "p1", name: "A", send: () => {} });
    const leaveB = subscribe("ROOM6", { id: "b", playerId: "p2", name: "B", send: () => {} });

    leaveA();
    assert.equal(pendingRoomClose("ROOM6"), false, "one phone is still watching");

    leaveB();
    assert.equal(pendingRoomClose("ROOM6"), true);

    const back = subscribe("ROOM6", { id: "c", playerId: "p1", name: "A", send: () => {} });
    assert.equal(pendingRoomClose("ROOM6"), false, "the reconnect cancelled the close");

    back();
    assert.equal(pendingRoomClose("ROOM6"), true);
  });
});
