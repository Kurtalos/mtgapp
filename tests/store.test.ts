import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import { createRoom, pruneStaleRooms, readRoom, saveRoom } from "@/lib/server/store";

let dir: string;

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "manatable-store-"));
  process.env.DATA_DIR = dir;
});

describe("room store", () => {
  it("creates a room at version 1 and reads it back", async () => {
    const result = await createRoom("AAAAA", { life: 40 });
    assert.equal(result.ok, true);
    assert.equal(result.room.version, 1);

    const loaded = await readRoom("AAAAA");
    assert.deepEqual(loaded?.state, { life: 40 });
    assert.equal(loaded?.version, 1);
  });

  it("will not overwrite an existing room code", async () => {
    await createRoom("BBBBB", { host: "first" });
    const second = await createRoom("BBBBB", { host: "second" });
    assert.equal(second.ok, false);
    const loaded = await readRoom("BBBBB");
    assert.deepEqual(loaded?.state, { host: "first" });
  });

  it("increments the version on a compare-and-set write", async () => {
    await createRoom("CCCCC", { life: 40 });
    const first = await saveRoom("CCCCC", { life: 30 }, 1);
    assert.equal(first.ok, true);
    assert.equal(first.room?.version, 2);

    const second = await saveRoom("CCCCC", { life: 20 }, 2);
    assert.equal(second.ok, true);
    assert.equal(second.room?.version, 3);
  });

  it("rejects a stale write and returns the winner's state", async () => {
    await createRoom("DDDDD", { life: 40 });
    await saveRoom("DDDDD", { life: 30 }, 1);

    // A second phone still believes the room is at version 1.
    const stale = await saveRoom("DDDDD", { life: 60 }, 1);
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.reason, "conflict");
    assert.equal(stale.room?.version, 2);
    assert.deepEqual(stale.room?.state, { life: 30 });
  });

  it("reports a missing room rather than inventing one", async () => {
    const result = await saveRoom("ZZZZZ", { life: 1 }, 1);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing");
    assert.equal(result.room, null);
    assert.equal(await readRoom("ZZZZZ"), null);
  });

  it("serialises concurrent writes so only one lands", async () => {
    await createRoom("EEEEE", { hits: 0 });

    // Ten phones tapping at once, all starting from version 1.
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        saveRoom("EEEEE", { hits: i + 1 }, 1),
      ),
    );
    const winners = attempts.filter((result) => result.ok);
    assert.equal(winners.length, 1, "exactly one compare-and-set may win");

    const final = await readRoom("EEEEE");
    assert.equal(final?.version, 2);
  });

  it("prunes rooms that have been idle past the TTL", async () => {
    await createRoom("OLD01", { life: 40 });
    await createRoom("NEW01", { life: 40 });

    // Age the old room by rewriting its timestamp.
    const oldPath = path.join(dir, "OLD01.json");
    const record = JSON.parse(await fs.readFile(oldPath, "utf8"));
    record.updatedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    await fs.writeFile(oldPath, JSON.stringify(record));

    const removed = await pruneStaleRooms();
    assert.ok(removed >= 1);
    assert.equal(await readRoom("OLD01"), null);
    assert.notEqual(await readRoom("NEW01"), null);
  });

  it("refuses to escape the data directory via the room code", async () => {
    // The route layer validates this, but the store must not be the weak link.
    await createRoom("../../etc/passwd", { pwned: true });
    const files = await fs.readdir(dir);
    for (const file of files) {
      assert.ok(file.endsWith(".json"), `unexpected file ${file}`);
      assert.ok(!file.includes("/") && !file.includes(".."));
    }
  });
});

describe("content store", () => {
  it("saves and reads custom content", async () => {
    const { readContent, writeContent } = await import("@/lib/server/content-store");
    await writeContent({
      planes: [
        {
          id: "plane_custom",
          name: "Custom Plane",
          type: "Plane" as const,
          oracleText: "Do a thing.",
          chaosText: "Chaos: do another thing.",
          custom: true,
        },
      ],
      schemes: [],
      classes: [],
    });
    const loaded = await readContent();
    assert.equal(loaded.planes.length, 1);
    assert.equal(loaded.planes[0].name, "Custom Plane");
  });

  it("returns empty content rather than throwing when nothing is saved", async () => {
    process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "manatable-empty-"));
    const { readContent } = await import("@/lib/server/content-store");
    const loaded = await readContent();
    assert.deepEqual(loaded, { planes: [], schemes: [], classes: [] });
  });

  it("rejects malformed payloads", async () => {
    const { validateContent } = await import("@/lib/server/content-store");
    assert.equal(validateContent(null), null);
    assert.equal(validateContent({ planes: "nope" }), null);
    assert.equal(validateContent({ planes: [], schemes: [], classes: [] })?.planes.length, 0);
  });

  it("drops entries with an unknown role", async () => {
    const { validateContent } = await import("@/lib/server/content-store");
    const result = validateContent({
      planes: [],
      schemes: [],
      classes: [
        { id: "a", role: "knight", name: "White Knight", description: "" },
        { id: "b", role: "wizard", name: "Nope", description: "" },
      ],
    });
    assert.equal(result?.classes.length, 1);
    assert.equal(result?.classes[0].id, "a");
  });

  it("clamps absurd input instead of storing it", async () => {
    const { validateContent } = await import("@/lib/server/content-store");
    const result = validateContent({
      planes: [
        {
          id: "x".repeat(200),
          name: "N".repeat(500),
          type: "Plane",
          oracleText: "o".repeat(9000),
          chaosText: "",
        },
      ],
      schemes: [],
      classes: [],
    });
    const plane = result!.planes[0];
    assert.ok(plane.id.length <= 60);
    assert.ok(plane.name.length <= 120);
    assert.ok(plane.oracleText.length <= 2000);
  });
});
