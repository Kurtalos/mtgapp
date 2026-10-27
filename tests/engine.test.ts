import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAction, type RoomAction } from "@/lib/room/reducer";
import { createRoomState } from "@/lib/room/setup";
import { MODE_META, type GameMode, type RoomState } from "@/lib/types";
import { COMMANDER_DAMAGE_LETHAL, KING_LIFE } from "@/lib/room/rules";
import { createRng, rollPlanarFace, shuffle } from "@/lib/room/random";
import { roleSetFor } from "@/lib/data/roles";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLANAR_CARDS } from "@/lib/data/planechase";
import {
  ADVANCED_KINGDOM_CARDS,
  ADVANCED_SETUP_BY_SIZE,
  announceText,
  cardById,
  hasAnnounce,
} from "@/lib/data/advancedKingdoms";

const HOST = "p_host";

function room(mode: GameMode, names = ["Host", "B", "C", "D", "E"]): RoomState {
  let state = createRoomState({
    code: "TEST1",
    hostId: HOST,
    hostName: names[0],
    mode,
    // Most tests want a big table regardless of the format default. Nine
    // covers the Advanced Kingdoms printed maximum.
    maxPlayers: 9,
  });
  names.slice(1).forEach((name, i) => {
    state = applyAction(state, { type: "join", playerId: `p_${i + 1}`, name });
  });
  return state;
}

function act(state: RoomState, action: RoomAction): RoomState {
  return applyAction(state, action);
}

function started(mode: GameMode, names?: string[]): RoomState {
  return act(room(mode, names), {
    type: "start",
    byId: HOST,
    seed: 42,
    planes: PLANAR_CARDS,
  });
}

const ids = (state: RoomState) => state.players.map((p) => p.id);
const player = (state: RoomState, id: string) => state.players.find((p) => p.id === id)!;

describe("random", () => {
  it("shuffles deterministically for a given seed", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(7));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(7));
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("planar die is 3 blank, 1 chaos, 2 planeswalk in six", () => {
    const counts = { blank: 0, chaos: 0, planeswalk: 0 };
    for (let seed = 0; seed < 6000; seed++) {
      counts[rollPlanarFace(createRng(seed))] += 1;
    }
    // 6000 seeds / 6 faces → 3000 / 1000 / 2000, with generous tolerance.
    assert.ok(counts.blank > 2700 && counts.blank < 3300, `blank=${counts.blank}`);
    assert.ok(counts.chaos > 800 && counts.chaos < 1200, `chaos=${counts.chaos}`);
    assert.ok(counts.planeswalk > 1700 && counts.planeswalk < 2300, `planeswalk=${counts.planeswalk}`);
  });
});

describe("lobby", () => {
  it("adds players in seat order and ignores repeat joins", () => {
    const state = room("commander");
    assert.equal(state.players.length, 5);
    assert.deepEqual(state.players.map((p) => p.seat), [0, 1, 2, 3, 4]);
    const again = act(state, { type: "join", playerId: HOST, name: "Host" });
    assert.equal(again.players.length, 5);
  });

  it("switching format resets the starting life to that format's default", () => {
    let state = room("commander");
    state = act(state, { type: "setMode", mode: "archenemy" });
    assert.equal(state.startingLife, 20);
    state = act(state, { type: "setMode", mode: "kingdom" });
    assert.equal(state.startingLife, 40);
  });

  it("only the host can start and kick", () => {
    const state = room("commander");
    assert.equal(act(state, { type: "start", byId: "p_1" }).phase, "lobby");
    assert.equal(act(state, { type: "kick", byId: "p_1", playerId: "p_2" }).players.length, 5);
    assert.equal(
      act(state, { type: "kick", byId: HOST, playerId: "p_2" }).players.length,
      4,
    );
  });
});

describe("commander", () => {
  it("gives everyone 40 life and keeps the game in play", () => {
    const state = started("commander");
    assert.equal(state.phase, "playing");
    assert.deepEqual(state.players.map((p) => p.life), [40, 40, 40, 40, 40]);
    assert.equal(state.winners, null);
  });

  it("eliminates at zero life", () => {
    let state = started("commander");
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40, byPlayerId: HOST });
    assert.ok(player(state, "p_1").eliminated);
    assert.match(player(state, "p_1").deathReason ?? "", /life total reached 0/);
  });

  it("loses to 21 commander damage from a single commander", () => {
    let state = started("commander");
    for (let i = 0; i < COMMANDER_DAMAGE_LETHAL; i++) {
      state = act(state, {
        type: "adjustCommanderDamage",
        sourceId: HOST,
        targetId: "p_1",
        delta: 1,
      });
    }
    const victim = player(state, "p_1");
    assert.ok(victim.eliminated);
    assert.equal(victim.life, 40 - COMMANDER_DAMAGE_LETHAL);
    assert.match(victim.deathReason ?? "", /21 commander damage/);
  });

  it("does not eliminate when damage is spread across commanders", () => {
    let state = started("commander");
    for (let i = 0; i < 12; i++) {
      state = act(state, { type: "adjustCommanderDamage", sourceId: HOST, targetId: "p_1", delta: 1 });
      state = act(state, { type: "adjustCommanderDamage", sourceId: "p_2", targetId: "p_1", delta: 1 });
    }
    assert.equal(player(state, "p_1").eliminated, false);
    assert.equal(player(state, "p_1").commanderDamage[HOST], 12);
  });

  it("commander damage also drains life", () => {
    let state = started("commander");
    state = act(state, { type: "adjustCommanderDamage", sourceId: HOST, targetId: "p_1", delta: 5 });
    assert.equal(player(state, "p_1").life, 35);
    state = act(state, { type: "adjustCommanderDamage", sourceId: HOST, targetId: "p_1", delta: -5 });
    assert.equal(player(state, "p_1").life, 40);
    assert.equal(player(state, "p_1").commanderDamage[HOST], undefined);
  });

  it("loses at ten poison counters", () => {
    let state = started("commander");
    for (let i = 0; i < 10; i++) {
      state = act(state, { type: "adjustPoison", playerId: "p_2", delta: 1 });
    }
    assert.ok(player(state, "p_2").eliminated);
    assert.match(player(state, "p_2").deathReason ?? "", /poison/);
  });

  it("declares the last player standing the winner", () => {
    let state = started("commander", ["Host", "B"]);
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40, byPlayerId: HOST });
    assert.equal(state.phase, "finished");
    assert.deepEqual(state.winners, [HOST]);
  });

  it("lets the host revive a mis-tapped player", () => {
    let state = started("commander");
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40, byPlayerId: HOST });
    state = act(state, { type: "revive", playerId: "p_1" });
    assert.equal(player(state, "p_1").eliminated, false);
    assert.equal(player(state, "p_1").life, 40);
  });
});

describe("archenemy", () => {
  it("starts the archenemy on 40 and everyone else on 20", () => {
    const state = started("archenemy");
    assert.equal(state.archenemy.archenemyId, HOST);
    assert.equal(player(state, HOST).life, 40);
    assert.ok(state.players.slice(1).every((p) => p.life === 20));
  });

  it("the team wins when the archenemy dies", () => {
    let state = started("archenemy");
    state = act(state, { type: "adjustLife", playerId: HOST, delta: -40, byPlayerId: HOST });
    assert.equal(state.phase, "finished");
    assert.deepEqual(new Set(state.winners), new Set(ids(state).filter((id) => id !== HOST)));
  });

  it("the archenemy wins when the whole team is out", () => {
    let state = started("archenemy", ["Host", "B", "C"]);
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -20, byPlayerId: HOST });
    state = act(state, { type: "adjustLife", playerId: "p_2", delta: -20, byPlayerId: HOST });
    assert.equal(state.phase, "finished");
    assert.deepEqual(state.winners, [HOST]);
  });

  it("only the archenemy can set a scheme in motion", () => {
    let state = started("archenemy");
    const schemes = ["A", "B", "C"].map((name) => ({
      id: name.toLowerCase(),
      name,
      oracleText: "",
    }));
    state = act(state, {
      type: "setSchemeDeck",
      playerId: HOST,
      schemes,
      seed: 1,
    });
    assert.equal(act(state, { type: "revealScheme", playerId: "p_1" }).archenemy.active.length, 0);
    state = act(state, { type: "revealScheme", playerId: HOST });
    assert.equal(state.archenemy.active.length, 1);
    assert.equal(state.archenemy.deck.length, 2);
  });
});

describe("planechase", () => {
  it("starts with a plane face up and the rest in the deck", () => {
    const state = started("planechase");
    assert.ok(state.planechase.current);
    assert.equal(state.planechase.current?.type, "Plane");
    assert.ok(state.planechase.deck.length > 0);
    assert.equal(state.planechase.rollsThisTurn, 0);
  });

  it("counts rolls and resets them on a new turn", () => {
    let state = started("planechase");
    state = act(state, { type: "rollPlanarDie", playerId: HOST, seed: 3 });
    assert.equal(state.planechase.rollsThisTurn, 1);
    state = act(state, { type: "newturn" });
    assert.equal(state.planechase.rollsThisTurn, 0);
  });

  it("planeswalking changes the plane and moves the controller", () => {
    let state = started("planechase");
    const before = state.planechase.current?.id;
    state = act(state, { type: "planeswalk", playerId: "p_2", seed: 9 });
    assert.notEqual(state.planechase.current?.id, before);
    assert.equal(state.planechase.controllerId, "p_2");
  });

  it("is deterministic for the same seed", () => {
    const a = started("planechase");
    const b = started("planechase");
    const rollA = act(a, { type: "rollPlanarDie", playerId: HOST, seed: 123 });
    const rollB = act(b, { type: "rollPlanarDie", playerId: HOST, seed: 123 });
    assert.deepEqual(rollA.planechase.current, rollB.planechase.current);
    assert.equal(rollA.log[0].text, rollB.log[0].text);
  });

  it("can set a specific plane by hand", () => {
    let state = started("planechase");
    const agyrem = PLANAR_CARDS.find((card) => card.id === "agyrem")!;
    state = act(state, { type: "setPlane", playerId: HOST, plane: agyrem });
    assert.equal(state.planechase.current?.id, "agyrem");
  });
});

describe("kingdoms", () => {
  it("deals exactly one King and gives them 50 life", () => {
    const state = started("kingdom");
    const roles = Object.values(state.kingdom.roles);
    assert.equal(roles.filter((r) => r === "king").length, 1);
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    assert.equal(player(state, kingId).life, KING_LIFE);
    assert.deepEqual(state.kingdom.revealed, [kingId]);
  });

  it("uses the standard role composition by table size", () => {
    assert.deepEqual(roleSetFor(5).sort(), ["assassin", "bandit", "bandit", "king", "knight"].sort());
    assert.deepEqual(
      roleSetFor(6).sort(),
      ["assassin", "bandit", "bandit", "king", "knight", "usurper"].sort(),
    );
    assert.equal(roleSetFor(7).filter((r) => r === "assassin").length, 2);
  });

  it("bandits win the moment the King falls while one is alive", () => {
    let state = started("kingdom");
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    state = act(state, { type: "adjustLife", playerId: kingId, delta: -KING_LIFE, byPlayerId: HOST });
    assert.equal(state.phase, "finished");
    const winners = state.winners ?? [];
    assert.ok(winners.length > 0);
    for (const id of winners) assert.equal(state.kingdom.roles[id], "bandit");
  });

  it("king and knight win when only they remain", () => {
    let state = started("kingdom");
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    const knightId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "knight",
    )!;
    for (const id of ids(state)) {
      if (id === kingId || id === knightId) continue;
      state = act(state, { type: "eliminate", playerId: id });
    }
    assert.equal(state.phase, "finished");
    assert.deepEqual(new Set(state.winners), new Set([kingId, knightId]));
  });

  it("lets a Usurper take the throne instead of the King dying", () => {
    // Six players guarantees a Usurper is dealt. This works because any player
    // may reduce another player's life — the Usurper can swing at the King's
    // tile and be credited for the kill.
    let state = started("kingdom", ["Host", "B", "C", "D", "E", "F"]);
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    const usurperId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "usurper",
    )!;

    state = act(state, {
      type: "adjustLife",
      playerId: kingId,
      delta: -KING_LIFE,
      byPlayerId: usurperId,
    });

    assert.equal(state.kingdom.roles[usurperId], "king");
    assert.equal(state.kingdom.roles[kingId], "usurper");
    assert.equal(player(state, usurperId).life, KING_LIFE);
    assert.equal(player(state, kingId).life, 5);
    assert.equal(player(state, kingId).eliminated, false);
    assert.notEqual(state.phase, "finished");
  });

  it("does not swap the throne when the King dies to anyone else", () => {
    let state = started("kingdom", ["Host", "B", "C", "D", "E", "F"]);
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    const otherId = ids(state).find(
      (id) => id !== kingId && state.kingdom.roles[id] !== "usurper",
    )!;

    state = act(state, {
      type: "adjustLife",
      playerId: kingId,
      delta: -KING_LIFE,
      byPlayerId: otherId,
    });

    assert.equal(state.kingdom.roles[kingId], "king");
    assert.notEqual(state.kingdom.roles[otherId], "king");
  });

  it("does not usurp when the King dies to someone else", () => {
    let state = started("kingdom", ["Host", "B", "C", "D", "E", "F"]);
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    state = act(state, {
      type: "adjustLife",
      playerId: kingId,
      delta: -KING_LIFE,
      byPlayerId: ids(state).find(
        (id) => id !== kingId && state.kingdom.roles[id] !== "usurper",
      ),
    });
    assert.equal(state.phase, "finished");
    assert.equal(state.kingdom.roles[kingId], "king");
  });
});

describe("purity", () => {
  it("never mutates the state it is given", () => {
    const state = started("commander");
    const snapshot = JSON.parse(JSON.stringify(state));
    act(state, { type: "adjustLife", playerId: HOST, delta: -5, byPlayerId: HOST });
    act(state, { type: "adjustCommanderDamage", sourceId: HOST, targetId: "p_1", delta: 3 });
    assert.deepEqual(state, snapshot);
  });

  it("keeps the log bounded", () => {
    let state = started("commander");
    for (let i = 0; i < 300; i++) {
      state = act(state, { type: "adjustLife", playerId: HOST, delta: 1, byPlayerId: HOST });
    }
    assert.ok(state.log.length <= 80);
  });
});

describe("seats and spectators", () => {
  it("refuses a seat once the player limit is reached", () => {
    const state = createRoomState({
      code: "FULL1",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      maxPlayers: 2,
    });
    const withTwo = act(state, { type: "join", playerId: "p_1", name: "Second" });
    assert.equal(withTwo.players.length, 2);

    const withThree = act(withTwo, { type: "join", playerId: "p_2", name: "Third" });
    assert.equal(withThree.players.length, 2, "third player must not get a seat");
  });

  it("lets extra people watch without joining the game", () => {
    const state = createRoomState({
      code: "WATCH",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      maxPlayers: 2,
    });
    const seated = act(state, { type: "spectate", spectatorId: "s_1", name: "Couch" });
    assert.equal(seated.spectators.length, 1);
    assert.equal(seated.players.length, 1);
    // Spectators never reach the win conditions.
    assert.equal(seated.phase, "lobby");
    assert.equal(seated.winners, null);
  });

  it("moves someone from watching to a seat when they join", () => {
    let state = createRoomState({
      code: "SWAP1",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      maxPlayers: 4,
    });
    state = act(state, { type: "spectate", spectatorId: "p_1", name: "Late" });
    assert.equal(state.spectators.length, 1);

    state = act(state, { type: "join", playerId: "p_1", name: "Late" });
    assert.equal(state.players.length, 2);
    assert.equal(state.spectators.length, 0);
  });

  it("drops a spectator cleanly when they leave", () => {
    let state = room("commander");
    state = act(state, { type: "spectate", spectatorId: "s_9", name: "Watcher" });
    assert.equal(state.spectators.length, 1);
    state = act(state, { type: "leave", playerId: "s_9" });
    assert.equal(state.spectators.length, 0);
    // Leaving as a spectator must not remove a player.
    assert.equal(state.players.length, 5);
  });

  it("only the host can change the player limit, and never below the seated count", () => {
    const state = room("commander");
    assert.equal(
      act(state, { type: "setMaxPlayers", byId: "p_1", max: 2 }).maxPlayers,
      8,
    );

    const shrunk = act(state, { type: "setMaxPlayers", byId: HOST, max: 2 });
    assert.equal(shrunk.maxPlayers, 5, "cannot shrink below seated players");

    const grown = act(state, { type: "setMaxPlayers", byId: HOST, max: 8 });
    assert.equal(grown.maxPlayers, 8);

    const overMax = act(state, { type: "setMaxPlayers", byId: HOST, max: 99 });
    assert.equal(overMax.maxPlayers, 8, "clamped to the format maximum");
  });

  it("resets the seat cap and life total when the format changes", () => {
    let state = room("commander");
    state = act(state, { type: "setMaxPlayers", byId: HOST, max: 8 });
    state = act(state, { type: "setStartingLife", life: 60 });
    state = act(state, { type: "setMode", mode: "kingdom" });
    assert.equal(state.maxPlayers, 6);
    assert.equal(state.startingLife, 40);
  });

  it("honours a custom starting life total", () => {
    const state = createRoomState({
      code: "LIFE1",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      startingLife: 25,
    });
    assert.equal(state.startingLife, 25);
    assert.equal(state.players[0].life, 25);

    const clamped = createRoomState({
      code: "LIFE2",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      startingLife: -5,
    });
    assert.equal(clamped.startingLife, 1);
  });

  it("still applies commander damage rules with a nonstandard life total", () => {
    let state = createRoomState({
      code: "LIFE3",
      hostId: HOST,
      hostName: "Host",
      mode: "commander",
      startingLife: 25,
      maxPlayers: 4,
    });
    state = act(state, { type: "join", playerId: "p_1", name: "B" });
    state = act(state, { type: "start", byId: HOST, seed: 3 });
    for (let i = 0; i < 21; i++) {
      state = act(state, {
        type: "adjustCommanderDamage",
        sourceId: HOST,
        targetId: "p_1",
        delta: 1,
      });
    }
    assert.ok(player(state, "p_1").eliminated);
  });
});

describe("dice, coins and manual overrides", () => {
  it("gives the same die result for the same seed", () => {
    const state = started("commander");
    const a = act(state, { type: "rollDie", playerId: HOST, sides: 20, seed: 5 });
    const b = act(state, { type: "rollDie", playerId: HOST, sides: 20, seed: 5 });
    assert.equal(a.lastRoll?.value, b.lastRoll?.value);
    assert.equal(a.lastRoll?.label, "d20");
  });

  it("keeps every die roll inside its range", () => {
    let state = started("commander");
    for (let seed = 0; seed < 500; seed++) {
      state = act(state, { type: "rollDie", playerId: HOST, sides: 6, seed });
      const value = Number(state.lastRoll?.value);
      assert.ok(value >= 1 && value <= 6, `d6 rolled ${value}`);
    }
  });

  it("accepts a manually entered die result and marks it", () => {
    const state = started("commander");
    const rolled = act(state, {
      type: "rollDie",
      playerId: HOST,
      sides: 20,
      value: 17,
    });
    assert.equal(rolled.lastRoll?.value, "17");
    assert.equal(rolled.lastRoll?.manual, true);
    assert.match(rolled.log[0].text, /sets a d20: 17/);
  });

  it("clamps a manual result into the die's range", () => {
    const state = started("commander");
    const rolled = act(state, {
      type: "rollDie",
      playerId: HOST,
      sides: 6,
      value: 99,
    });
    assert.equal(rolled.lastRoll?.value, "6");
  });

  it("shares a coin flip with the whole table", () => {
    const state = started("commander");
    const flipped = act(state, { type: "flipCoin", playerId: HOST, value: "tails" });
    assert.equal(flipped.lastRoll?.value, "Tails");
    assert.equal(flipped.lastRoll?.kind, "coin");
    assert.match(flipped.log[0].text, /calls the coin/);
  });

  it("lets the planar die be set by hand", () => {
    const state = started("planechase");
    const manual = act(state, {
      type: "rollPlanarDie",
      playerId: HOST,
      face: "chaos",
    });
    assert.equal(manual.lastRoll?.value, "Chaos");
    assert.equal(manual.lastRoll?.manual, true);
    assert.equal(manual.planechase.chaosPending, true);
    // A manual result still counts as one of the turn's rolls.
    assert.equal(manual.planechase.rollsThisTurn, 1);
  });

  it("planeswalks when the planar die is set to planeswalk by hand", () => {
    const state = started("planechase");
    const before = state.planechase.current?.id;
    const manual = act(state, {
      type: "rollPlanarDie",
      playerId: HOST,
      face: "planeswalk",
      seed: 11,
    });
    assert.notEqual(manual.planechase.current?.id, before);
    assert.equal(manual.lastRoll?.value, "Planeswalk");
  });

  it("clears the shared roll on reset", () => {
    let state = started("commander");
    state = act(state, { type: "rollDie", playerId: HOST, sides: 20 });
    assert.ok(state.lastRoll);
    state = act(state, { type: "reset", byId: HOST });
    assert.equal(state.lastRoll, null);
  });
});

describe("kingdom role setup and classes", () => {
  const sixNames = ["Host", "B", "C", "D", "E", "F"];

  it("deals the composition the host configured", () => {
    let state = room("kingdom", sixNames);
    state = act(state, {
      type: "configureRoles",
      byId: HOST,
      setup: { king: 1, knight: 2, bandit: 2, assassin: 1, renegade: 0, usurper: 0 },
    });
    state = act(state, { type: "start", byId: HOST, seed: 7 });

    const roles = Object.values(state.kingdom.roles);
    assert.equal(roles.filter((r) => r === "king").length, 1);
    assert.equal(roles.filter((r) => r === "knight").length, 2);
    assert.equal(roles.filter((r) => r === "bandit").length, 2);
    assert.equal(roles.filter((r) => r === "assassin").length, 1);
    assert.equal(roles.filter((r) => r === "usurper").length, 0);
  });

  it("falls back to the standard set when the counts do not match the seats", () => {
    let state = room("kingdom", ["Host", "B", "C", "D", "E"]);
    state = act(state, {
      type: "configureRoles",
      byId: HOST,
      setup: { king: 1, knight: 1, bandit: 1, assassin: 1, renegade: 0, usurper: 0 },
    });
    state = act(state, { type: "start", byId: HOST, seed: 4 });
    // Five seats, four roles configured — deal the five-player default.
    assert.equal(Object.keys(state.kingdom.roles).length, 5);
    assert.equal(Object.values(state.kingdom.roles).filter((r) => r === "bandit").length, 2);
  });

  it("assigns a class that belongs to the player's role", () => {
    const classes = [
      { id: "k_white", role: "knight" as const, name: "White Knight", description: "" },
      { id: "k_black", role: "knight" as const, name: "Black Knight", description: "" },
      { id: "b_smuggler", role: "bandit" as const, name: "Smuggler", description: "" },
    ];
    let state = room("kingdom", sixNames);
    state = act(state, { type: "start", byId: HOST, seed: 21, classes });

    for (const [playerId, role] of Object.entries(state.kingdom.roles)) {
      const classId = state.kingdom.classes[playerId];
      if (!classId) continue;
      const matched = classes.find((entry) => entry.id === classId);
      assert.ok(matched, `${classId} should exist`);
      assert.equal(matched?.role, role, "a class must match its role");
    }
  });

  it("gives every knight in play a different class when there is a choice", () => {
    const classes = [
      { id: "k_white", role: "knight" as const, name: "White Knight", description: "" },
      { id: "k_black", role: "knight" as const, name: "Black Knight", description: "" },
    ];
    let state = room("kingdom", sixNames);
    state = act(state, {
      type: "configureRoles",
      byId: HOST,
      setup: { king: 1, knight: 4, bandit: 1, assassin: 0, renegade: 0, usurper: 0 },
    });
    state = act(state, { type: "start", byId: HOST, seed: 3, classes });

    const knightIds = Object.keys(state.kingdom.roles).filter(
      (id) => state.kingdom.roles[id] === "knight",
    );
    // Several knights can share a class; what matters is that each got one
    // drawn from the knight pool rather than a bandit's.
    for (const id of knightIds) {
      assert.ok(["k_white", "k_black"].includes(state.kingdom.classes[id]));
    }
  });

  it("only the host can change the role composition, and only in the lobby", () => {
    let state = room("kingdom", sixNames);
    // An untouched setup is all zeroes, which means "use the table default".
    const empty = () =>
      Object.values(state.kingdom.setup).every((count) => count === 0);
    act(state, {
      type: "configureRoles",
      byId: "p_1",
      setup: { king: 1, knight: 5, bandit: 0, assassin: 0, renegade: 0, usurper: 0 },
    });
    assert.ok(empty());

    state = act(state, { type: "start", byId: HOST, seed: 1 });
    act(state, {
      type: "configureRoles",
      byId: HOST,
      setup: { king: 1, knight: 5, bandit: 0, assassin: 0, renegade: 0, usurper: 0 },
    });
    assert.ok(empty());
  });
});

describe("role visibility", () => {
  it("starts with roles hidden from the whole table", () => {
    const state = started("kingdom");
    assert.equal(state.kingdom.revealAll, false);
    // Only the King is public.
    assert.equal(state.kingdom.revealed.length, 1);
  });

  it("lets the host reveal and re-hide every role", () => {
    let state = started("kingdom");
    state = act(state, { type: "revealAllRoles", byId: HOST, reveal: true });
    assert.equal(state.kingdom.revealAll, true);
    assert.match(state.log[0].text, /revealed every role/);

    state = act(state, { type: "revealAllRoles", byId: HOST, reveal: false });
    assert.equal(state.kingdom.revealAll, false);
  });

  it("ignores a reveal request from a non-host", () => {
    const state = started("kingdom");
    const attempted = act(state, {
      type: "revealAllRoles",
      byId: "p_1",
      reveal: true,
    });
    assert.equal(attempted.kingdom.revealAll, false);
  });

  it("hides roles again when the table is reset for a new game", () => {
    let state = started("kingdom");
    state = act(state, { type: "revealAllRoles", byId: HOST, reveal: true });
    state = act(state, { type: "reset", byId: HOST });
    assert.equal(state.kingdom.revealAll, false);
    assert.deepEqual(state.kingdom.roles, {});
  });

  it("keeps every role assigned once the game is over, for the reveal screen", () => {
    let state = started("kingdom");
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    state = act(state, { type: "adjustLife", playerId: kingId, delta: -KING_LIFE, byPlayerId: HOST });
    assert.equal(state.phase, "finished");
    // The roster needs all five roles, not just the winners.
    assert.equal(Object.keys(state.kingdom.roles).length, state.players.length);
  });
});

describe("advanced kingdoms", () => {
  const nine = ["Host", "B", "C", "D", "E", "F", "G", "H", "I"];

  function advanced(names: string[]): RoomState {
    let state = room("kingdom", names);
    state = act(state, {
      type: "setKingdomVariant",
      byId: HOST,
      variant: "advanced",
    });
    return state;
  }

  it("switches rulesets, and only the host may do it", () => {
    const base = room("kingdom", ["Host", "B", "C", "D", "E"]);
    assert.equal(base.kingdom.variant, "classic");

    const attempted = act(base, {
      type: "setKingdomVariant",
      byId: "p_1",
      variant: "advanced",
    });
    assert.equal(attempted.kingdom.variant, "classic");

    const switched = act(base, {
      type: "setKingdomVariant",
      byId: HOST,
      variant: "advanced",
    });
    assert.equal(switched.kingdom.variant, "advanced");
  });

  it("deals the printed composition for five players", () => {
    let state = advanced(["Host", "B", "C", "D", "E"]);
    state = act(state, { type: "start", byId: HOST, seed: 5 });

    const roles = Object.values(state.kingdom.roles);
    assert.equal(roles.filter((r) => r === "king").length, 1);
    assert.equal(roles.filter((r) => r === "knight").length, 1);
    assert.equal(roles.filter((r) => r === "assassin").length, 2);
    assert.equal(roles.filter((r) => r === "renegade").length, 1);
    assert.equal(roles.filter((r) => r === "bandit").length, 0);
  });

  it("deals the printed composition for nine players", () => {
    let state = advanced(nine);
    state = act(state, { type: "start", byId: HOST, seed: 9 });

    const roles = Object.values(state.kingdom.roles);
    assert.equal(roles.filter((r) => r === "king").length, 1);
    assert.equal(roles.filter((r) => r === "knight").length, 2);
    assert.equal(roles.filter((r) => r === "bandit").length, 3);
    assert.equal(roles.filter((r) => r === "assassin").length, 3);
    assert.equal(roles.filter((r) => r === "renegade").length, 0);
  });

  it("gives every player a real card whose family matches their role", () => {
    let state = advanced(["Host", "B", "C", "D", "E", "F", "G"]);
    state = act(state, { type: "start", byId: HOST, seed: 77 });

    for (const [playerId, role] of Object.entries(state.kingdom.roles)) {
      const cardId = state.kingdom.cards[playerId];
      assert.ok(cardId, `${playerId} should hold a card`);
      const card = cardById(cardId);
      assert.ok(card, `${cardId} should exist`);
      assert.equal(card?.family, role, "the card must match the family dealt");
    }
  });

  it("starts the King ten life higher than the table", () => {
    let state = advanced(["Host", "B", "C", "D", "E"]);
    state = act(state, { type: "start", byId: HOST, seed: 3, classes: [] });

    const king = state.players.find((p) => state.kingdom.roles[p.id] === "king");
    const others = state.players.filter((p) => p.id !== king?.id);
    assert.equal(king?.life, state.startingLife + 10);
    for (const player of others) {
      assert.equal(player.life, state.startingLife);
    }
  });

  it("hands the win to the Assassins the moment the King falls", () => {
    let state = advanced(["Host", "B", "C", "D", "E"]);
    state = act(state, { type: "start", byId: HOST, seed: 12 });

    const king = state.players.find((p) => state.kingdom.roles[p.id] === "king")!;
    state = act(state, {
      type: "adjustLife",
      playerId: king.id,
      delta: -state.startingLife - 10,
      byPlayerId: HOST,
    });

    assert.equal(state.phase, "finished");
    const winners = state.winners ?? [];
    assert.ok(winners.length > 0);
    for (const id of winners) {
      assert.equal(state.kingdom.roles[id], "assassin");
    }
  });

  it("hands the win to the King when the opposition is gone", () => {
    let state = advanced(["Host", "B", "C", "D", "E"]);
    state = act(state, { type: "start", byId: HOST, seed: 12 });

    for (const player of [...state.players]) {
      const role = state.kingdom.roles[player.id];
      if (role === "king" || role === "knight") continue;
      state = act(state, { type: "eliminate", playerId: player.id });
      if (state.phase === "finished") break;
    }

    assert.equal(state.phase, "finished");
    const winners = state.winners ?? [];
    assert.ok(winners.some((id) => state.kingdom.roles[id] === "king"));
  });

  it("never guesses at a Renegade victory — the host calls it", () => {
    let state = advanced(["Host", "B", "C", "D", "E"]);
    state = act(state, { type: "start", byId: HOST, seed: 12 });
    const renegade = state.players.find(
      (p) => state.kingdom.roles[p.id] === "renegade",
    )!;

    state = act(state, {
      type: "declareWinner",
      byId: HOST,
      winnerIds: [renegade.id],
    });
    assert.equal(state.phase, "finished");
    assert.deepEqual(state.winners, [renegade.id]);
    // The reveal happens automatically so the table can see why.
    assert.equal(state.kingdom.revealAll, true);
  });

  it("falls back to the classic set below five players, where the printed table stops", () => {
    let state = advanced(["Host", "B", "C", "D"]);
    state = act(state, { type: "start", byId: HOST, seed: 4 });
    const roles = Object.values(state.kingdom.roles);
    assert.equal(roles.length, 4);
    assert.equal(roles.filter((r) => r === "king").length, 1);
  });
});

describe("advanced kingdoms dealing", () => {
  it("never deals the same card to two players", () => {
    // The printed game hands out physical cards, so each is unique per table.
    for (const seed of [1, 2, 3, 17, 99, 404]) {
      let state = room("kingdom", [
        "Host", "B", "C", "D", "E", "F", "G", "H", "I",
      ]);
      state = act(state, {
        type: "setKingdomVariant",
        byId: HOST,
        variant: "advanced",
      });
      state = act(state, { type: "start", byId: HOST, seed });

      const dealt = Object.values(state.kingdom.cards);
      assert.equal(
        new Set(dealt).size,
        dealt.length,
        `seed ${seed} dealt a duplicate card`,
      );
    }
  });

  it("matches the printed table at every supported size", () => {
    for (const size of [5, 6, 7, 8, 9]) {
      const names = ["Host", "B", "C", "D", "E", "F", "G", "H", "I"].slice(0, size);
      let state = room("kingdom", names);
      state = act(state, {
        type: "setKingdomVariant",
        byId: HOST,
        variant: "advanced",
      });
      state = act(state, { type: "start", byId: HOST, seed: size });

      const expected = ADVANCED_SETUP_BY_SIZE[size];
      const counts: Record<string, number> = {};
      for (const role of Object.values(state.kingdom.roles)) {
        counts[role] = (counts[role] ?? 0) + 1;
      }
      assert.equal(counts.king ?? 0, expected.king, `${size}p king`);
      assert.equal(counts.knight ?? 0, expected.knight, `${size}p knight`);
      assert.equal(counts.bandit ?? 0, expected.bandit, `${size}p bandit`);
      assert.equal(counts.assassin ?? 0, expected.assassin, `${size}p assassin`);
      assert.equal(counts.renegade ?? 0, expected.renegade, `${size}p renegade`);
    }
  });

  it("has art on disk for every card it can deal", () => {
    for (const card of ADVANCED_KINGDOM_CARDS) {
      const file = join(process.cwd(), "public", card.image);
      assert.ok(existsSync(file), `missing art for ${card.name}: ${card.image}`);
    }
  });
});

describe("who may change a life total", () => {
  it("lets the host adjust anyone, in either direction", () => {
    const state = started("commander");
    const other = ids(state).find((id) => id !== HOST)!;
    const before = player(state, other).life;

    const down = act(state, {
      type: "adjustLife",
      playerId: other,
      delta: -3,
      byPlayerId: HOST,
    });
    assert.equal(player(down, other).life, before - 3);

    const up = act(state, {
      type: "adjustLife",
      playerId: other,
      delta: 7,
      byPlayerId: HOST,
    });
    assert.equal(player(up, other).life, before + 7);
  });

  it("lets a player adjust their own, in either direction", () => {
    const state = started("commander");
    const before = player(state, "p_1").life;

    const down = act(state, {
      type: "adjustLife",
      playerId: "p_1",
      delta: -1,
      byPlayerId: "p_1",
    });
    assert.equal(player(down, "p_1").life, before - 1);

    const up = act(state, {
      type: "adjustLife",
      playerId: "p_1",
      delta: 4,
      byPlayerId: "p_1",
    });
    assert.equal(player(up, "p_1").life, before + 4);
  });

  it("lets any player deal damage to another", () => {
    // Damage is aimed outward, and the table has to be able to credit the
    // player who actually swung.
    const state = started("commander");
    const before = player(state, "p_2").life;
    const after = act(state, {
      type: "adjustLife",
      playerId: "p_2",
      delta: -5,
      byPlayerId: "p_1",
    });
    assert.equal(player(after, "p_2").life, before - 5);
  });

  it("refuses to let a player heal another", () => {
    const state = started("commander");
    const before = player(state, "p_2").life;
    const after = act(state, {
      type: "adjustLife",
      playerId: "p_2",
      delta: 5,
      byPlayerId: "p_1",
    });
    assert.equal(player(after, "p_2").life, before);
    // A refused action is a true no-op, not a redraw.
    assert.equal(after, state);
  });

  it("refuses a spectator, who holds an id but no seat", () => {
    const state = started("commander");
    const before = player(state, HOST).life;
    const after = act(state, {
      type: "adjustLife",
      playerId: HOST,
      delta: -5,
      byPlayerId: "ghost",
    });
    assert.equal(player(after, HOST).life, before);
  });

  it("refuses an action with no actor recorded", () => {
    const state = started("commander");
    const before = player(state, "p_1").life;
    const after = act(state, {
      type: "adjustLife",
      playerId: "p_1",
      delta: -5,
    });
    assert.equal(player(after, "p_1").life, before);
  });

  it("judges a typed-in total by which way it moves", () => {
    const state = started("commander");

    // Lowering someone else's life is damage, so it is allowed.
    const damage = act(state, {
      type: "setLife",
      playerId: "p_2",
      value: 7,
      byPlayerId: "p_1",
    });
    assert.equal(player(damage, "p_2").life, 7);

    // Raising it is healing, which is the host's call.
    const heal = act(damage, {
      type: "setLife",
      playerId: "p_2",
      value: 40,
      byPlayerId: "p_1",
    });
    assert.equal(player(heal, "p_2").life, 7);

    const hostHeal = act(damage, {
      type: "setLife",
      playerId: "p_2",
      value: 40,
      byPlayerId: HOST,
    });
    assert.equal(player(hostHeal, "p_2").life, 40);
  });
});

describe("advanced kingdoms as its own mode", () => {
  it("is a separate format with its own player range", () => {
    const state = room("advanced");
    assert.equal(state.mode, "advanced");
    // The room build is forced to nine seats for the tests, but the format's
    // own default and limits are what the lobby uses.
    assert.equal(MODE_META.advanced.minPlayers, 5);
    assert.equal(MODE_META.advanced.maxPlayers, 9);
    assert.equal(state.kingdom.variant, "advanced");
  });

  it("keeps the ruleset and the mode pointing at the same thing", () => {
    let state = room("kingdom");
    assert.equal(state.kingdom.variant, "classic");

    state = act(state, { type: "setMode", mode: "advanced" });
    assert.equal(state.kingdom.variant, "advanced");
    assert.equal(state.mode, "advanced");

    state = act(state, { type: "setMode", mode: "kingdom" });
    assert.equal(state.kingdom.variant, "classic");

    // The old ruleset action still works, and moves the room with it, so a
    // table saved before this change loads into the right format.
    state = act(state, { type: "setKingdomVariant", byId: HOST, variant: "advanced" });
    assert.equal(state.mode, "advanced");
  });

  it("deals printed cards and starts the King ten life ahead", () => {
    let state = room("advanced");
    state = act(state, { type: "start", byId: HOST, seed: 11 });

    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    assert.equal(player(state, kingId).life, state.startingLife + 10);
    for (const id of ids(state)) {
      assert.ok(state.kingdom.cards[id], `${id} was dealt a card`);
    }
  });

  it("treats the King's elimination as the end of the game in both modes", () => {
    let state = room("advanced");
    state = act(state, { type: "start", byId: HOST, seed: 4 });
    const kingId = Object.keys(state.kingdom.roles).find(
      (id) => state.kingdom.roles[id] === "king",
    )!;
    state = act(state, {
      type: "adjustLife",
      playerId: kingId,
      delta: -200,
      byPlayerId: HOST,
    });
    assert.equal(state.phase, "finished");
  });
});

describe("announcing a role card", () => {
  /** A started Advanced Kingdoms room where a chosen player holds The Priestess. */
  function withPriestess(): { state: RoomState; holder: string } {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      let state = room("advanced");
      state = act(state, { type: "start", byId: HOST, seed });
      const holder = Object.keys(state.kingdom.cards).find(
        (id) => state.kingdom.cards[id] === "ak_the_priestess",
      );
      if (holder) return { state, holder };
    }
    throw new Error("The Priestess was never dealt");
  }

  it("turns the card face up for the whole table", () => {
    const { state, holder } = withPriestess();
    assert.ok(!state.kingdom.revealed.includes(holder));

    const after = act(state, { type: "announce", playerId: holder, byId: holder });
    assert.ok(after.kingdom.revealed.includes(holder));
    assert.ok(after.kingdom.announced[holder] > 0);
    assert.match(after.log[0].text, /announces — The Priestess/);
  });

  it("cannot be undone or repeated", () => {
    const { state, holder } = withPriestess();
    const once = act(state, { type: "announce", playerId: holder, byId: holder });
    const twice = act(once, {
      type: "announce",
      playerId: holder,
      byId: holder,
      targetId: "p_1" === holder ? "p_2" : "p_1",
    });
    assert.deepEqual(twice.kingdom.announced, once.kingdom.announced);
    assert.equal(twice.log.length, once.log.length);
  });

  it("only the owner may announce, unless the host does it for them", () => {
    const { state, holder } = withPriestess();
    const other = ids(state).find((id) => id !== holder)!;

    const byOther = act(state, {
      type: "announce",
      playerId: holder,
      byId: other,
    });
    assert.equal(byOther, state);

    const byHost = act(state, { type: "announce", playerId: holder, byId: HOST });
    assert.ok(byHost.kingdom.announced[holder]);
  });

  it("does nothing in classic Kingdoms or before the game starts", () => {
    const { state, holder } = withPriestess();

    // A room cannot change format mid-game, so build the classic shape by hand:
    // the same dealt cards, but the classic ruleset, where announcing is not a
    // thing.
    const classic: RoomState = {
      ...state,
      mode: "kingdom",
      kingdom: { ...state.kingdom, variant: "classic" },
    };
    assert.equal(
      act(classic, { type: "announce", playerId: holder, byId: holder }),
      classic,
    );

    const lobby = room("advanced");
    const holderInLobby = ids(lobby)[0];
    assert.equal(
      act(lobby, { type: "announce", playerId: holderInLobby, byId: holderInLobby }),
      lobby,
    );
  });

  it("The Priestess exchanges life, commander damage and poison", () => {
    const { state, holder } = withPriestess();
    const target = ids(state).find((id) => id !== holder)!;

    // Give the two of them clearly different numbers. Commander damage is
    // applied first because it is also life loss — it would move the totals
    // this test is checking.
    let prepared = act(state, {
      type: "adjustCommanderDamage",
      sourceId: target,
      targetId: holder,
      delta: 6,
    });
    prepared = act(prepared, {
      type: "setLife",
      playerId: holder,
      value: 31,
      byPlayerId: HOST,
    });
    prepared = act(prepared, {
      type: "setLife",
      playerId: target,
      value: 8,
      byPlayerId: HOST,
    });
    prepared = act(prepared, {
      type: "adjustPoison",
      playerId: target,
      delta: 3,
    });

    const after = act(prepared, {
      type: "announce",
      playerId: holder,
      byId: holder,
      targetId: target,
    });

    // Everything the two of them had accumulated changes hands.
    assert.equal(player(after, holder).life, 8);
    assert.equal(player(after, target).life, 31);
    assert.equal(player(after, holder).poison, 3);
    assert.equal(player(after, target).poison, 0);
    assert.equal(player(after, holder).commanderDamage[target] ?? 0, 0);
    assert.equal(player(after, target).commanderDamage[target], 6);
  });

  it("logs the announcement without a target, and resolves nothing", () => {
    const { state, holder } = withPriestess();
    const before = state.players.map((p) => p.life);
    const after = act(state, { type: "announce", playerId: holder, byId: holder });
    assert.deepEqual(
      after.players.map((p) => p.life),
      before,
    );
    assert.ok(after.kingdom.announced[holder]);
  });

  it("every printed card except the King can announce", () => {
    for (const card of ADVANCED_KINGDOM_CARDS) {
      assert.equal(
        hasAnnounce(card),
        card.id !== "ak_the_king",
        `${card.name} announce detection`,
      );
    }
  });

  it("strips the reminder text from the ability it shows the table", () => {
    const priestess = cardById("ak_the_priestess")!;
    const text = announceText(priestess);
    assert.ok(!text.includes("turn this card face up"));
    assert.match(text, /Exchange life totals/);
  });
});
