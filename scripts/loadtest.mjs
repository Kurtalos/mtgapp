#!/usr/bin/env node
/**
 * Load test for the bundled backend.
 *
 * Opens one live connection per player across several simultaneous games, then
 * fires life changes the way a table full of people would, and reports server
 * memory, CPU and write latency.
 *
 *   node scripts/loadtest.mjs --url http://localhost:3000 --rooms 4 --players 8
 *
 * Run it against your VPS before deciding you need a bigger box.
 */

import http from "node:http";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) {
    args[key] = next;
    i += 1;
  } else {
    args[key] = "true";
  }
}

const BASE = (args.url ?? "http://localhost:3000").replace(/\/$/, "");
const ROOMS = Number(args.rooms ?? 4);
const PLAYERS = Number(args.players ?? 8);
const DURATION = Number(args.duration ?? 20); // seconds of active play
const THINK_MS = Number(args.think ?? 400); // pause between taps per player
const PID = args.pid ? Number(args.pid) : null; // server process to sample

const codeFor = (i) =>
  `LT${String(i).padStart(2, "0")}${randomBytes(1).toString("hex").toUpperCase().slice(0, 1)}`;

function makeRoomState(code, playerCount) {
  const now = Date.now();
  const players = Array.from({ length: playerCount }, (_, seat) => ({
    id: `p_${seat}`,
    name: `Player ${seat + 1}`,
    seat,
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderTax: 0,
    commanderDamage: {},
    eliminated: false,
  }));
  return {
    code,
    mode: "commander",
    phase: "playing",
    startingLife: 40,
    hostId: "p_0",
    players,
    maxPlayers: 8,
    spectators: [],
    planechase: {
      deck: [],
      current: null,
      bottom: [],
      controllerId: "p_0",
      chaosPending: false,
      rollsThisTurn: 0,
    },
    archenemy: { archenemyId: null, deck: [], active: [], lastRevealed: null, resolved: [] },
    kingdom: { dealt: false, roles: {}, revealed: [], claims: {} },
    log: [],
    lastRoll: null,
    winners: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function api(path, init) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, body };
}

/** Keeps one SSE stream open and records delivery latency. */
function openStream(code, playerId, stats) {
  const url = new URL(`${BASE}/api/rt/rooms/${code}/events`);
  url.searchParams.set("playerId", playerId);
  url.searchParams.set("name", playerId);

  let buffer = "";
  let lastSeen = 0;
  const request = http.get(url, (response) => {
    stats.streamsOpened += 1;
    response.setEncoding("utf8");
    response.on("data", (chunk) => {
      buffer += chunk;
      let split;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        stats.eventsReceived += 1;
        if (frame.startsWith("event: room") && lastSeen > 0) {
          stats.deliveryLatencies.push(performance.now() - lastSeen);
        }
      }
    });
    response.on("end", () => {
      stats.streamsClosed += 1;
    });
  });

  request.on("error", () => {
    stats.errors += 1;
  });

  return {
    markWrite() {
      lastSeen = performance.now();
    },
    close() {
      request.destroy();
    },
  };
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function sampleProcess() {
  if (!PID) return null;
  try {
    const status = fs.readFileSync(`/proc/${PID}/status`, "utf8");
    const rss = /VmRSS:\s+(\d+) kB/.exec(status);
    return rss ? Math.round(Number(rss[1]) / 1024) : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\nCards with Kurt load test → ${BASE}`);
  console.log(`  ${ROOMS} simultaneous games × ${PLAYERS} players = ${ROOMS * PLAYERS} live connections`);
  console.log(`  ${DURATION}s of active play at ~${THINK_MS}ms between taps\n`);

  const stats = {
    streamsOpened: 0,
    streamsClosed: 0,
    eventsReceived: 0,
    errors: 0,
    writeLatencies: [],
    deliveryLatencies: [],
    writes: 0,
  };

  // ---------------------------------------------------------------- setup
  const rooms = [];
  for (let i = 0; i < ROOMS; i++) {
    const code = codeFor(i);
    const state = makeRoomState(code, PLAYERS);
    const created = await api("/api/rt/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    });
    if (created.status !== 201) {
      console.error(`Failed to create room ${code}: ${created.status}`, created.body);
      process.exit(1);
    }
    rooms.push({ code, version: 1, state });
  }
  console.log(`Created ${rooms.length} rooms.`);

  // One stream per player, mimicking every phone at every table.
  const streams = [];
  for (const room of rooms) {
    for (let p = 0; p < PLAYERS; p++) {
      streams.push(openStream(room.code, `p_${p}`, stats));
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`Open streams: ${stats.streamsOpened}\n`);

  const rssBefore = sampleProcess();

  // ----------------------------------------------------------------- play
  const startedAt = performance.now();
  const deadline = startedAt + DURATION * 1000;

  const workers = [];
  for (const room of rooms) {
    for (let p = 0; p < PLAYERS; p++) {
      workers.push(
        (async () => {
          let mine = room;
          while (performance.now() < deadline) {
            const delta = [-1, 1, -5, 5][Math.floor(Math.random() * 4)];
            mine.state.players[p].life += delta;
            mine.state.updatedAt = Date.now();

            const stream = streams[rooms.indexOf(room) * PLAYERS + p];
            stream.markWrite();
            const t0 = performance.now();
            const result = await api(`/api/rt/rooms/${mine.code}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                state: mine.state,
                expectedVersion: mine.version,
              }),
            });
            const elapsed = performance.now() - t0;
            stats.writes += 1;

            if (result.status === 200) {
              stats.writeLatencies.push(elapsed);
              mine.version += 1;
            } else if (result.status === 409 && result.body?.room) {
              // Lost the race — adopt and carry on, exactly like a real client.
              mine = { ...mine, version: result.body.room.version, state: result.body.room.state };
              stats.writeLatencies.push(elapsed);
            } else {
              stats.errors += 1;
            }
            await new Promise((resolve) => setTimeout(resolve, THINK_MS));
          }
        })(),
      );
    }
  }
  await Promise.all(workers);

  const rssAfter = sampleProcess();
  // Allow in-flight frames to land before counting.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const elapsedSec = (performance.now() - startedAt) / 1000;

  // ---------------------------------------------------------------- report
  console.log("─── Results ───────────────────────────────────────────");
  console.log(`Writes            ${stats.writes} (${(stats.writes / elapsedSec).toFixed(1)}/s)`);
  console.log(`Write latency     p50 ${percentile(stats.writeLatencies, 50).toFixed(1)}ms · p95 ${percentile(stats.writeLatencies, 95).toFixed(1)}ms · max ${Math.max(...stats.writeLatencies, 0).toFixed(1)}ms`);
  console.log(`Event delivery    p50 ${percentile(stats.deliveryLatencies, 50).toFixed(1)}ms · p95 ${percentile(stats.deliveryLatencies, 95).toFixed(1)}ms · max ${Math.max(...stats.deliveryLatencies, 0).toFixed(1)}ms`);
  console.log(`Events received   ${stats.eventsReceived}`);
  console.log(`Open streams      ${stats.streamsOpened} opened, ${stats.streamsClosed} closed`);
  console.log(`Errors            ${stats.errors}`);
  if (rssBefore !== null && rssAfter !== null) {
    console.log(`Server memory     ${rssBefore} MB → ${rssAfter} MB`);
  } else {
    console.log(`Server memory     (pass --pid <server pid> to sample)`);
  }
  console.log("───────────────────────────────────────────────────────");

  for (const stream of streams) stream.close();

  // Rooms are left behind on purpose so the cleanup path gets exercised.
  console.log(`\nLeft ${rooms.length} rooms in the store. Delete DATA_DIR/*.json to clean up.`);
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
