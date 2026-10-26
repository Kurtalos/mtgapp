import type {
  GameMode,
  LogEntry,
  PlayerState,
  RoleId,
  RoomState,
} from "@/lib/types";
import { MODE_META } from "@/lib/types";
import { roleSetFor } from "@/lib/data/roles";
import { PLANAR_CARDS } from "@/lib/data/planechase";
import { createRng, randomSeed, rollPlanarFace, shuffle, uid } from "./random";
import {
  ARCHENEMY_LIFE,
  KING_LIFE,
  USURPED_KING_LIFE,
  computeOutcome,
  lethalReason,
  playerName,
} from "./rules";

const MAX_LOG = 80;

export type RoomAction =
  | { type: "join"; playerId: string; name: string }
  | { type: "leave"; playerId: string }
  | { type: "rename"; playerId: string; name: string }
  | { type: "setMode"; mode: GameMode }
  | { type: "setStartingLife"; life: number }
  | { type: "kick"; byId: string; playerId: string }
  | { type: "start"; byId: string; schemeNames?: string[]; seed?: number }
  | { type: "reset"; byId: string; seed?: number }
  | { type: "adjustLife"; playerId: string; delta: number; byPlayerId?: string }
  | { type: "setLife"; playerId: string; value: number }
  | { type: "adjustCommanderDamage"; sourceId: string; targetId: string; delta: number }
  | { type: "adjustPoison"; playerId: string; delta: number }
  | {
      type: "adjustCounter";
      playerId: string;
      counter: "energy" | "experience" | "commanderTax";
      delta: number;
    }
  | { type: "eliminate"; playerId: string }
  | { type: "revive"; playerId: string }
  // Planechase
  | { type: "rollPlanarDie"; playerId: string; seed?: number }
  | { type: "ackChaos"; playerId: string }
  | { type: "planeswalk"; playerId: string; seed?: number }
  | { type: "setPlane"; playerId: string; planeId: string }
  | { type: "resetPlanarDeck"; seed?: number }
  | { type: "newturn" }
  // Archenemy
  | { type: "setArchenemy"; playerId: string; archenemyId: string }
  | { type: "revealScheme"; playerId: string }
  | { type: "resolveScheme"; playerId: string; name: string }
  | { type: "setSchemeDeck"; playerId: string; names: string[]; seed?: number }
  // Kingdoms
  | { type: "dealRoles"; byId: string; seed?: number }
  | { type: "revealRole"; playerId: string }
  | { type: "claimRole"; playerId: string; role: RoleId | null };

export function blankPlayer(id: string, name: string, seat: number, life: number): PlayerState {
  return {
    id,
    name,
    seat,
    life,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderTax: 0,
    commanderDamage: {},
    eliminated: false,
  };
}

/** Base life for an ordinary player in the given mode. */
export function baseLifeFor(mode: GameMode, startingLife: number): number {
  if (mode === "archenemy") return 20;
  return startingLife;
}

export function planardDeck(seed: number): string[] {
  const rng = createRng(seed);
  const planes = PLANAR_CARDS.filter((c) => c.type === "Plane");
  const phenomena = PLANAR_CARDS.filter((c) => c.type === "Phenomenon");
  // Real planar decks are mostly planes with a handful of phenomena mixed in.
  return shuffle([...planes, ...phenomena], rng).map((c) => c.id);
}

function log(
  state: RoomState,
  kind: LogEntry["kind"],
  text: string,
  actorId: string | null = null,
): RoomState {
  const entry: LogEntry = { id: uid("log"), at: Date.now(), actorId, text, kind };
  return { ...state, log: [entry, ...state.log].slice(0, MAX_LOG) };
}

function withPlayer(
  state: RoomState,
  playerId: string,
  patch: (p: PlayerState) => PlayerState,
): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? patch(p) : p)),
  };
}

/**
 * Marks anyone at a lethal state as eliminated and records why. Returns the
 * state plus the list of players who died in this pass so the caller can log
 * once and handle mode-specific consequences.
 */
function settle(state: RoomState): { state: RoomState; deaths: string[] } {
  const deaths: string[] = [];
  const players = state.players.map((p) => {
    if (p.eliminated) return p;
    const reason = lethalReason(p, state);
    if (!reason) return p;
    deaths.push(p.id);
    return { ...p, eliminated: true, deathReason: reason };
  });

  let next: RoomState = { ...state, players };
  for (const id of deaths) {
    const player = players.find((p) => p.id === id)!;
    const reason = lethalReason(player, state) ?? "lethal state";
    next = log(next, "system", `${player.name} is out — ${reason}.`, null);
  }

  const winners = computeOutcome(next);
  if (winners) {
    next = { ...next, winners, phase: "finished" };
  }
  return { state: next, deaths };
}

/**
 * Kingdoms: if the King has just been killed by the Usurper's own hand, the
 * two swap places instead of the game ending.
 */
function maybeUsurp(state: RoomState, kingId: string, byId?: string): RoomState {
  if (state.mode !== "kingdom" || !byId || byId === kingId) return state;
  if (state.kingdom.roles[byId] !== "usurper") return state;
  const king = state.players.find((p) => p.id === kingId);
  if (!king || king.eliminated) return state;
  if (lethalReason(king, state) === null) return state;

  const players = state.players.map((p) => {
    if (p.id === kingId) {
      return {
        ...p,
        life: USURPED_KING_LIFE,
        poison: 0,
        commanderDamage: {},
        eliminated: false,
      };
    }
    if (p.id === byId) {
      return { ...p, life: KING_LIFE, role: "king" as RoleId };
    }
    return p;
  });
  const roles = { ...state.kingdom.roles, [kingId]: "usurper" as RoleId, [byId]: "king" as RoleId };
  let next: RoomState = {
    ...state,
    players,
    kingdom: {
      ...state.kingdom,
      roles,
      revealed: Array.from(new Set([...state.kingdom.revealed, byId, kingId])),
    },
  };
  next = log(
    next,
    "system",
    `⚡ ${playerName(next, byId)} usurps the throne! They become King at ${KING_LIFE} life; ${playerName(
      next,
      kingId,
    )} survives as the Usurper at ${USURPED_KING_LIFE} life.`,
  );
  return next;
}

function dealRoles(state: RoomState, seed: number): RoomState {
  const rng = createRng(seed);
  const seats = state.players.map((p) => p.id);
  const roles = shuffle(roleSetFor(seats.length), rng);
  const assigned: Record<string, RoleId> = {};
  seats.forEach((id, i) => {
    assigned[id] = roles[i] ?? "assassin";
  });
  const kingId = seats.find((id) => assigned[id] === "king") ?? null;

  let next: RoomState = {
    ...state,
    kingdom: {
      dealt: true,
      roles: assigned,
      revealed: kingId ? [kingId] : [],
      claims: {},
    },
    players: state.players.map((p) => ({
      ...p,
      role: assigned[p.id],
      life: assigned[p.id] === "king" ? KING_LIFE : state.startingLife,
    })),
  };
  next = log(next, "system", `Roles dealt. ${playerName(next, kingId)} is the King.`);
  return next;
}

function beginGame(state: RoomState, action: { seed?: number; schemeNames?: string[] }): RoomState {
  const seed = action.seed ?? randomSeed();
  let next: RoomState = { ...state, phase: "playing", winners: null };

  if (next.mode === "kingdom") {
    next = dealRoles(next, seed);
  }

  if (next.mode === "archenemy") {
    const archId = next.archenemy.archenemyId ?? next.hostId;
    next = {
      ...next,
      archenemy: { ...next.archenemy, archenemyId: archId },
      players: next.players.map((p) => ({
        ...p,
        life: p.id === archId ? ARCHENEMY_LIFE : 20,
      })),
    };
    if (action.schemeNames && action.schemeNames.length) {
      next = {
        ...next,
        archenemy: {
          ...next.archenemy,
          deck: shuffle(action.schemeNames, createRng(seed)),
        },
      };
    }
    next = log(next, "system", `${playerName(next, archId)} is the Archenemy.`);
  }

  if (next.mode === "planechase") {
    const deck = planardDeck(seed);
    const firstPlaneIndex = deck.findIndex(
      (id) => PLANAR_CARDS.find((c) => c.id === id)?.type === "Plane",
    );
    const currentIndex = firstPlaneIndex === -1 ? 0 : firstPlaneIndex;
    next = {
      ...next,
      planechase: {
        deck: deck.filter((_, i) => i !== currentIndex),
        current: deck[currentIndex] ?? null,
        bottom: [],
        controllerId: next.players[0]?.id ?? null,
        chaosPending: false,
        rollsThisTurn: 0,
      },
    };
    next = log(
      next,
      "mode",
      `Planeswalking begins on ${PLANAR_CARDS.find((c) => c.id === next.planechase.current)?.name ?? "an unknown plane"}.`,
    );
  }

  next = log(next, "system", `Game on — ${MODE_META[next.mode].name}.`);
  return next;
}

export function applyAction(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "join": {
      if (state.players.some((p) => p.id === action.playerId)) return state;
      if (state.phase !== "lobby") return state;
      const name = action.name.trim() || "Player";
      const seat = state.players.length;
      const life =
        state.mode === "kingdom"
          ? state.startingLife
          : baseLifeFor(state.mode, state.startingLife);
      const next = {
        ...state,
        players: [...state.players, blankPlayer(action.playerId, name, seat, life)],
      };
      return log(next, "system", `${name} joined the table.`);
    }

    case "leave": {
      if (state.players.length <= 1) return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      const remaining = state.players
        .filter((p) => p.id !== action.playerId)
        .map((p, i) => ({ ...p, seat: i }));
      const hostId =
        state.hostId === action.playerId ? remaining[0]?.id ?? state.hostId : state.hostId;
      const next: RoomState = {
        ...state,
        players: remaining,
        hostId,
        archenemy:
          state.archenemy.archenemyId === action.playerId
            ? { ...state.archenemy, archenemyId: remaining[0]?.id ?? null }
            : state.archenemy,
        planechase:
          state.planechase.controllerId === action.playerId
            ? { ...state.planechase, controllerId: remaining[0]?.id ?? null }
            : state.planechase,
      };
      return log(next, "system", `${player.name} left the table.`);
    }

    case "rename": {
      const name = action.name.trim().slice(0, 24);
      if (!name) return state;
      return withPlayer(state, action.playerId, (p) => ({ ...p, name }));
    }

    case "setMode": {
      if (state.phase !== "lobby") return state;
      return {
        ...state,
        mode: action.mode,
        startingLife: MODE_META[action.mode].defaultLife,
      };
    }

    case "setStartingLife": {
      if (state.phase !== "lobby") return state;
      const life = Math.max(1, Math.min(999, Math.round(action.life)));
      return { ...state, startingLife: life };
    }

    case "kick": {
      if (action.byId !== state.hostId) return state;
      if (action.playerId === state.hostId) return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      const remaining = state.players
        .filter((p) => p.id !== action.playerId)
        .map((p, i) => ({ ...p, seat: i }));
      return log({ ...state, players: remaining }, "system", `${player.name} was removed by the host.`);
    }

    case "start": {
      if (action.byId !== state.hostId) return state;
      if (state.players.length < 1) return state;
      return beginGame(state, action);
    }

    case "reset": {
      if (action.byId !== state.hostId) return state;
      const players = state.players.map((p, i) => ({
        ...blankPlayer(p.id, p.name, i, baseLifeFor(state.mode, state.startingLife)),
      }));
      const next: RoomState = {
        ...state,
        phase: "lobby",
        players,
        winners: null,
        log: [],
        kingdom: { dealt: false, roles: {}, revealed: [], claims: {} },
        archenemy: {
          archenemyId: state.archenemy.archenemyId,
          deck: [],
          active: [],
          lastRevealed: null,
          resolved: [],
        },
        planechase: {
          deck: [],
          current: null,
          bottom: [],
          controllerId: players[0]?.id ?? null,
          chaosPending: false,
          rollsThisTurn: 0,
        },
      };
      return log(next, "system", "Table reset. Everyone is back to full life.");
    }

    case "adjustLife": {
      if (state.phase === "lobby") return state;
      let next: RoomState = withPlayer(state, action.playerId, (p) => ({
        ...p,
        life: p.life + action.delta,
      }));
      const player = next.players.find((p) => p.id === action.playerId);
      if (player && action.delta !== 0) {
        next = log(
          next,
          "life",
          `${player.name} ${action.delta > 0 ? "gains" : "loses"} ${Math.abs(
            action.delta,
          )} life (${player.life}).`,
          action.byPlayerId ?? null,
        );
      }
      // Applied first: the Usurper only takes the throne once the King is
      // actually at a lethal state.
      next = maybeUsurp(next, action.playerId, action.byPlayerId);
      return settle(next).state;
    }

    case "setLife": {
      const value = Math.round(action.value);
      if (!Number.isFinite(value)) return state;
      const next = withPlayer(state, action.playerId, (p) => ({ ...p, life: value }));
      return settle(next).state;
    }

    case "adjustCommanderDamage": {
      if (state.phase === "lobby") return state;
      if (action.sourceId === action.targetId) return state;

      let next = withPlayer(state, action.targetId, (p) => {
        const current = p.commanderDamage[action.sourceId] ?? 0;
        const updated = Math.max(0, current + action.delta);
        const commanderDamage = { ...p.commanderDamage };
        if (updated === 0) delete commanderDamage[action.sourceId];
        else commanderDamage[action.sourceId] = updated;
        // Commander damage is also life loss.
        return { ...p, commanderDamage, life: p.life - action.delta };
      });

      if (action.delta !== 0) {
        next = log(
          next,
          "commander",
          `${playerName(next, action.sourceId)}'s commander ${
            action.delta > 0 ? "deals" : "heals"
          } ${Math.abs(action.delta)} to ${playerName(next, action.targetId)}.`,
          action.sourceId,
        );
      }
      next = maybeUsurp(next, action.targetId, action.sourceId);
      return settle(next).state;
    }

    case "adjustPoison": {
      const next = withPlayer(state, action.playerId, (p) => ({
        ...p,
        poison: Math.max(0, p.poison + action.delta),
      }));
      return settle(next).state;
    }

    case "adjustCounter": {
      return withPlayer(state, action.playerId, (p) => ({
        ...p,
        [action.counter]: Math.max(0, p[action.counter] + action.delta),
      }));
    }

    case "eliminate": {
      const next = withPlayer(state, action.playerId, (p) => ({
        ...p,
        eliminated: true,
      }));
      return settle(log(next, "system", `${playerName(next, action.playerId)} was eliminated.`)).state;
    }

    case "revive": {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      const restored = withPlayer(state, action.playerId, (p) => ({
        ...p,
        eliminated: false,
        life: state.mode === "archenemy" ? 20 : state.mode === "kingdom" && p.role === "king" ? KING_LIFE : state.startingLife,
        poison: 0,
        commanderDamage: {},
      }));
      const next: RoomState = { ...restored, winners: null, phase: "playing" };
      return log(next, "system", `${player.name} is back in the game.`);
    }

    // ---------------------------------------------------------------- Planechase
    case "rollPlanarDie": {
      const seed = action.seed ?? randomSeed();
      const face = rollPlanarFace(createRng(seed));
      const plane = PLANAR_CARDS.find((c) => c.id === state.planechase.current);
      let next: RoomState = {
        ...state,
        planechase: {
          ...state.planechase,
          rollsThisTurn: state.planechase.rollsThisTurn + 1,
          chaosPending: face === "chaos" ? true : state.planechase.chaosPending,
        },
      };
      const label =
        face === "blank" ? "Blank — nothing happens." : face === "chaos" ? "CHAOS!" : "PLANESWALK!";
      next = log(next, "roll", `${playerName(next, action.playerId)} rolls the planar die: ${label}`, action.playerId);

      if (face === "planeswalk") {
        next = planeswalkTo(next, action.playerId, seed + 1);
      } else if (face === "chaos" && plane) {
        next = log(next, "mode", `${plane.name}: whenever chaos ensues — ${plane.chaosText}`);
      }
      return next;
    }

    case "ackChaos": {
      return {
        ...state,
        planechase: { ...state.planechase, chaosPending: false },
      };
    }

    case "planeswalk": {
      return planeswalkTo(state, action.playerId, action.seed ?? randomSeed());
    }

    case "setPlane": {
      const card = PLANAR_CARDS.find((c) => c.id === action.planeId);
      if (!card) return state;
      const next: RoomState = {
        ...state,
        planechase: {
          ...state.planechase,
          current: card.id,
          chaosPending: false,
        },
      };
      return log(next, "mode", `The plane is now ${card.name}.`, action.playerId);
    }

    case "resetPlanarDeck": {
      const seed = action.seed ?? randomSeed();
      const deck = planardDeck(seed);
      const current = deck.find((id) => PLANAR_CARDS.find((c) => c.id === id)?.type === "Plane") ?? deck[0];
      return log(
        {
          ...state,
          planechase: {
            ...state.planechase,
            deck: deck.filter((id) => id !== current),
            current,
            bottom: [],
            chaosPending: false,
          },
        },
        "mode",
        "Planar deck reshuffled.",
      );
    }

    case "newturn": {
      return {
        ...state,
        planechase: { ...state.planechase, rollsThisTurn: 0, chaosPending: false },
      };
    }

    // ---------------------------------------------------------------- Archenemy
    case "setArchenemy": {
      if (action.playerId !== state.hostId) return state;
      if (state.phase !== "lobby") return state;
      return {
        ...state,
        archenemy: { ...state.archenemy, archenemyId: action.archenemyId },
      };
    }

    case "setSchemeDeck": {
      const seed = action.seed ?? randomSeed();
      return {
        ...state,
        archenemy: {
          ...state.archenemy,
          deck: shuffle(action.names, createRng(seed)),
          lastRevealed: null,
        },
      };
    }

    case "revealScheme": {
      if (action.playerId !== state.archenemy.archenemyId) return state;
      const [top, ...rest] = state.archenemy.deck;
      if (!top) return state;
      const next: RoomState = {
        ...state,
        archenemy: {
          ...state.archenemy,
          deck: rest,
          active: [...state.archenemy.active, top],
          lastRevealed: top,
        },
      };
      return log(next, "mode", `Scheme set in motion: ${top}.`, action.playerId);
    }

    case "resolveScheme": {
      const next: RoomState = {
        ...state,
        archenemy: {
          ...state.archenemy,
          active: state.archenemy.active.filter((n) => n !== action.name),
          resolved: [...state.archenemy.resolved, action.name],
          lastRevealed:
            state.archenemy.lastRevealed === action.name ? null : state.archenemy.lastRevealed,
        },
      };
      return log(next, "mode", `${action.name} is done.`, action.playerId);
    }

    // ---------------------------------------------------------------- Kingdoms
    case "dealRoles": {
      if (action.byId !== state.hostId) return state;
      return dealRoles(state, action.seed ?? randomSeed());
    }

    case "revealRole": {
      const revealed = Array.from(new Set([...state.kingdom.revealed, action.playerId]));
      return {
        ...state,
        kingdom: { ...state.kingdom, revealed },
      };
    }

    case "claimRole": {
      const claims = { ...state.kingdom.claims };
      if (action.role) claims[action.playerId] = action.role;
      else delete claims[action.playerId];
      return { ...state, kingdom: { ...state.kingdom, claims } };
    }

    default:
      return state;
  }
}

function planeswalkTo(state: RoomState, playerId: string, seed: number): RoomState {
  const rng = createRng(seed);
  let deck = state.planechase.deck.slice();
  let bottom = state.planechase.bottom.slice();
  let current: string | null = null;
  const seen: string[] = [];

  while (deck.length > 0) {
    const [next, ...rest] = deck;
    deck = rest;
    const card = PLANAR_CARDS.find((c) => c.id === next);
    if (card?.type === "Plane") {
      current = card.id;
      break;
    }
    seen.push(next);
  }

  // Phenomena that were passed over go to the bottom in a random order.
  bottom = [...bottom, ...shuffle(seen, rng)];

  if (!current) {
    // Deck is empty of planes — reshuffle the discards back in.
    const rebuilt = planardDeck(seed + 7);
    const firstPlane = rebuilt.find(
      (id) => PLANAR_CARDS.find((c) => c.id === id)?.type === "Plane",
    );
    current = firstPlane ?? null;
    deck = rebuilt.filter((id) => id !== firstPlane);
    bottom = [];
  }

  const card = PLANAR_CARDS.find((c) => c.id === current);
  const next: RoomState = {
    ...state,
    planechase: {
      ...state.planechase,
      deck,
      bottom,
      current,
      controllerId: playerId,
      chaosPending: false,
    },
  };
  return log(
    next,
    "mode",
    `Planeswalk → ${card?.name ?? "unknown plane"}${seen.length ? ` (${seen.length} phenomenon skipped)` : ""}. Planar controller: ${playerName(next, playerId)}.`,
    playerId,
  );
}
