import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAction, type RoomAction } from "@/lib/room/reducer";
import { createRoomState } from "@/lib/room/setup";
import type { GameMode, RoomState } from "@/lib/types";
import { COMMANDER_DAMAGE_LETHAL, KING_LIFE, USURPED_KING_LIFE } from "@/lib/room/rules";
import { createRng, rollPlanarFace, shuffle } from "@/lib/room/random";
import { roleSetFor } from "@/lib/data/roles";

const HOST = "p_host";

function room(mode: GameMode, names = ["Host", "B", "C", "D", "E"]): RoomState {
  let state = createRoomState({
    code: "TEST1",
    hostId: HOST,
    hostName: names[0],
    mode,
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
  return act(room(mode, names), { type: "start", byId: HOST, seed: 42 });
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
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40 });
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
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40 });
    assert.equal(state.phase, "finished");
    assert.deepEqual(state.winners, [HOST]);
  });

  it("lets the host revive a mis-tapped player", () => {
    let state = started("commander");
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -40 });
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
    state = act(state, { type: "adjustLife", playerId: HOST, delta: -40 });
    assert.equal(state.phase, "finished");
    assert.deepEqual(new Set(state.winners), new Set(ids(state).filter((id) => id !== HOST)));
  });

  it("the archenemy wins when the whole team is out", () => {
    let state = started("archenemy", ["Host", "B", "C"]);
    state = act(state, { type: "adjustLife", playerId: "p_1", delta: -20 });
    state = act(state, { type: "adjustLife", playerId: "p_2", delta: -20 });
    assert.equal(state.phase, "finished");
    assert.deepEqual(state.winners, [HOST]);
  });

  it("only the archenemy can set a scheme in motion", () => {
    let state = started("archenemy");
    state = act(state, {
      type: "setSchemeDeck",
      playerId: HOST,
      names: ["A", "B", "C"],
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
    const before = state.planechase.current;
    state = act(state, { type: "planeswalk", playerId: "p_2", seed: 9 });
    assert.notEqual(state.planechase.current, before);
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
    state = act(state, { type: "setPlane", playerId: HOST, planeId: "agyrem" });
    assert.equal(state.planechase.current, "agyrem");
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
    state = act(state, { type: "adjustLife", playerId: kingId, delta: -KING_LIFE });
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
    // Six players guarantees a Usurper is dealt.
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
    assert.equal(player(state, kingId).life, USURPED_KING_LIFE);
    assert.equal(player(state, kingId).eliminated, false);
    assert.notEqual(state.phase, "finished");
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
    act(state, { type: "adjustLife", playerId: HOST, delta: -5 });
    act(state, { type: "adjustCommanderDamage", sourceId: HOST, targetId: "p_1", delta: 3 });
    assert.deepEqual(state, snapshot);
  });

  it("keeps the log bounded", () => {
    let state = started("commander");
    for (let i = 0; i < 300; i++) {
      state = act(state, { type: "adjustLife", playerId: HOST, delta: 1 });
    }
    assert.ok(state.log.length <= 80);
  });
});
