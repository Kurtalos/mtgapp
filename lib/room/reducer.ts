import type {
  GameMode,
  KingdomVariant,
  LogEntry,
  PlanarFace,
  PlayerState,
  RoleClass,
  RoleId,
  RoomState,
} from "@/lib/types";
import { MODE_META, isKingdomMode, variantForMode } from "@/lib/types";
import { roleSetFor } from "@/lib/data/roles";
import {
  ADVANCED_KING_BONUS,
  advancedSetupFor,
  cardById,
  cardsForFamily,
} from "@/lib/data/advancedKingdoms";
import type { PlaneCard, SchemeCard } from "@/lib/content";
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
  | { type: "setMaxPlayers"; byId: string; max: number }
  | { type: "spectate"; spectatorId: string; name: string }
  | { type: "unspectate"; spectatorId: string }
  | { type: "kick"; byId: string; playerId: string }
  | {
      type: "start";
      byId: string;
      seed?: number;
      /** Content supplied by the client so the engine needs no catalog. */
      planes?: PlaneCard[];
      schemes?: SchemeCard[];
      classes?: RoleClass[];
    }
  | { type: "reset"; byId: string; seed?: number }
  | { type: "adjustLife"; playerId: string; delta: number; byPlayerId?: string }
  | { type: "setLife"; playerId: string; value: number; byPlayerId?: string }
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
  | { type: "rollPlanarDie"; playerId: string; seed?: number; face?: PlanarFace }
  | { type: "rollDie"; playerId: string; sides: number; seed?: number; value?: number }
  | {
      type: "flipCoin";
      playerId: string;
      seed?: number;
      value?: "heads" | "tails";
    }
  | { type: "clearRoll" }
  | { type: "ackChaos"; playerId: string }
  | { type: "planeswalk"; playerId: string; seed?: number }
  | { type: "setPlane"; playerId: string; plane: PlaneCard }
  | { type: "resetPlanarDeck"; seed?: number; planes?: PlaneCard[] }
  | { type: "newturn" }
  // Archenemy
  | { type: "setArchenemy"; playerId: string; archenemyId: string }
  | { type: "revealScheme"; playerId: string }
  | { type: "resolveScheme"; playerId: string; schemeId: string; name: string }
  | { type: "setSchemeDeck"; playerId: string; schemes: SchemeCard[]; seed?: number }
  // Kingdoms
  | {
      type: "dealRoles";
      byId: string;
      seed?: number;
      classes?: RoleClass[];
    }
  | {
      type: "configureRoles";
      byId: string;
      setup: Record<RoleId, number>;
    }
  | { type: "revealAllRoles"; byId: string; reveal: boolean }
  | { type: "setKingdomVariant"; byId: string; variant: KingdomVariant }
  /** Host adjudication, for cards whose result the app cannot compute. */
  | { type: "declareWinner"; byId: string; winnerIds: string[] }
  | { type: "revealRole"; playerId: string }
  | { type: "claimRole"; playerId: string; role: RoleId | null }
  /**
   * Advanced Kingdoms: turn your role card face up. `targetId` is only read by
   * cards whose Announce picks a player (The Priestess).
   */
  | {
      type: "announce";
      playerId: string;
      byId?: string;
      targetId?: string;
    };

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

/**
 * What the King starts on.
 *
 * Classic Kingdoms always put the throne on a flat 50. Advanced Kingdoms is
 * printed as "+10 life", so it rides on whatever the table set as its starting
 * total.
 */
export function kingLifeFor(state: RoomState): number {
  if (state.mode === "advanced") return state.startingLife + ADVANCED_KING_BONUS;
  return KING_LIFE;
}

/**
 * Builds a planar deck from whatever content the client handed us, so planes
 * added in the admin panel are dealt exactly like the bundled ones.
 */
export function planardDeck(seed: number, cards: PlaneCard[]): PlaneCard[] {
  const rng = createRng(seed);
  const planes = cards.filter((c) => c.type === "Plane");
  const phenomena = cards.filter((c) => c.type === "Phenomenon");
  // Real planar decks are mostly planes with a handful of phenomena mixed in.
  return shuffle([...planes, ...phenomena], rng);
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
/**
 * The classic six-player Usurper's throne swap.
 *
 * Fires when the engine is told the Usurper dealt the lethal damage. That is
 * now expressible again: any player may reduce another player's life, so the
 * Usurper can swing at the King's tile and be credited for the kill.
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

/**
 * Assigns a role to every seat, then a random class inside that role.
 *
 * The composition comes from the host's setup window when they have used it,
 * otherwise from the standard table-size defaults. If the configured counts do
 * not match the number of seats we fall back to the defaults rather than
 * quietly dealing a lopsided game.
 */
function dealRoles(
  state: RoomState,
  seed: number,
  classes: RoleClass[] = [],
): RoomState {
  const rng = createRng(seed);
  const seats = state.players.map((p) => p.id);
  const advanced = state.kingdom.variant === "advanced";

  const configured = rolesFromSetup(state.kingdom.setup);
  const fallback = advanced
    ? advancedRolesFor(seats.length)
    : roleSetFor(seats.length);
  const bag = configured.length === seats.length ? configured : fallback;

  const roles = shuffle(bag, rng);
  const assigned: Record<string, RoleId> = {};
  const playerClasses: Record<string, string> = {};
  const playerCards: Record<string, string> = {};

  // Advanced Kingdoms deals physical cards: each family's pile is shuffled
  // once and handed out without replacement, exactly as the setup card says.
  // The printed set has five cards per family, and no table larger than nine
  // needs more than three of any one family, so the piles never run dry.
  const piles: Record<string, string[]> = {};
  if (advanced) {
    for (const family of ["king", "knight", "bandit", "assassin", "renegade"] as const) {
      piles[family] = shuffle(cardsForFamily(family), rng).map((card) => card.id);
    }
  }

  seats.forEach((id, i) => {
    const role = roles[i] ?? "assassin";
    assigned[id] = role;

    if (advanced) {
      const family = role === "usurper" ? "renegade" : role;
      const card = piles[family]?.shift();
      if (card) playerCards[id] = card;
      return;
    }

    // Classic: pick a class belonging to this role. No classes defined for it
    // means no class, and the UI simply shows the role.
    const pool = classes.filter((entry) => entry.role === role);
    if (pool.length > 0) {
      playerClasses[id] = pool[Math.floor(rng() * pool.length)].id;
    }
  });

  const kingId = seats.find((id) => assigned[id] === "king") ?? null;
  // Advanced Kingdoms starts the King at +10 life, not at a flat total.
  const kingLife = kingLifeFor(state);

  let next: RoomState = {
    ...state,
    kingdom: {
      ...state.kingdom,
      dealt: true,
      roles: assigned,
      cards: playerCards,
      classes: playerClasses,
      revealed: kingId ? [kingId] : [],
      claims: {},
    },
    players: state.players.map((p) => ({
      ...p,
      role: assigned[p.id],
      life: assigned[p.id] === "king" ? kingLife : state.startingLife,
    })),
  };

  const kingCard = kingId ? playerCards[kingId] : null;
  const kingName = kingCard ? cardById(kingCard)?.name : null;
  next = log(
    next,
    "system",
    kingName && advanced
      ? `Roles dealt. ${playerName(next, kingId)} is the King (${kingName}).`
      : `Roles dealt. ${playerName(next, kingId)} is the King.`,
  );
  return next;
}

/**
 * Advanced Kingdoms composition by table size, as a flat role bag. Falls back
 * to the classic set below five players, where the printed game does not run.
 */
function advancedRolesFor(playerCount: number): RoleId[] {
  const setup = advancedSetupFor(playerCount);
  if (!setup) return roleSetFor(Math.min(8, Math.max(2, playerCount)));
  const bag: RoleId[] = [];
  const push = (role: RoleId, count: number) => {
    for (let i = 0; i < count; i++) bag.push(role);
  };
  push("king", setup.king);
  push("knight", setup.knight);
  push("bandit", setup.bandit);
  push("assassin", setup.assassin);
  push("renegade", setup.renegade);
  return bag;
}

/**
 * Who is allowed to change a life total.
 *
 * Three rules, in order:
 *
 *   1. The host may correct anyone — that is what a host is for.
 *   2. A player may always change their own total.
 *   3. Any seated player may *reduce* another player's total, because damage is
 *      aimed outward and the table has to be able to point at the person who
 *      just got hit. Nobody but the host may *raise* someone else's life.
 *
 * Rule 3 exists so a lethal swing can be credited to the player who made it —
 * without it the Usurper's throne swap is unreachable, since only the King and
 * the host would ever be able to move the King's life total.
 *
 * This is a correctness guard, not a security boundary. The room document is
 * written by the clients themselves, so a determined player could PUT whatever
 * state they liked straight to the API. What this stops is the failure that
 * actually happens at a table: a mis-wired control, or a thumb on the wrong
 * tile. Real enforcement would mean moving the game server-side, which is a
 * much larger change than this rule is worth.
 */
export function canAdjustLife(
  state: RoomState,
  byId: string | undefined,
  targetId: string,
  delta: number,
): boolean {
  if (!byId) return false;
  if (byId === state.hostId) return true;

  // Spectators hold an id but no seat; they watch, they do not play.
  const seated = state.players.some((player) => player.id === byId);
  if (!seated) return false;

  if (byId === targetId) return true;

  // Damage only. Healing another player is the host's call.
  return delta < 0;
}

/** Expands {king: 1, bandit: 2, …} into the flat role bag to shuffle. */
export function rolesFromSetup(setup: Record<RoleId, number> | null): RoleId[] {
  if (!setup) return [];
  const bag: RoleId[] = [];
  for (const [role, count] of Object.entries(setup)) {
    for (let i = 0; i < Math.max(0, Math.round(count)); i++) {
      bag.push(role as RoleId);
    }
  }
  return bag;
}

function beginGame(
  state: RoomState,
  action: {
    seed?: number;
    planes?: PlaneCard[];
    schemes?: SchemeCard[];
    classes?: RoleClass[];
  },
): RoomState {
  const seed = action.seed ?? randomSeed();
  let next: RoomState = { ...state, phase: "playing", winners: null };

  if (isKingdomMode(next.mode)) {
    next = dealRoles(next, seed, action.classes ?? []);
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
    if (action.schemes && action.schemes.length) {
      next = {
        ...next,
        archenemy: {
          ...next.archenemy,
          deck: shuffle(action.schemes, createRng(seed)),
        },
      };
    }
    next = log(next, "system", `${playerName(next, archId)} is the Archenemy.`);
  }

  if (next.mode === "planechase") {
    const deck = planardDeck(seed, action.planes ?? []);
    const firstPlaneIndex = deck.findIndex((card) => card.type === "Plane");
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
      `Planeswalking begins on ${next.planechase.current?.name ?? "an unknown plane"}.`,
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
      if (state.players.length >= state.maxPlayers) return state;
      const name = action.name.trim() || "Player";
      const seat = state.players.length;
      const life = baseLifeFor(state.mode, state.startingLife);
      const next = {
        ...state,
        // Seating them means they are no longer watching.
        spectators: state.spectators.filter((sp) => sp.id !== action.playerId),
        players: [...state.players, blankPlayer(action.playerId, name, seat, life)],
      };
      return log(next, "system", `${name} sat down.`);
    }

    case "spectate": {
      const name = action.name.trim() || "Spectator";
      if (state.spectators.some((sp) => sp.id === action.spectatorId)) return state;
      if (state.players.some((p) => p.id === action.spectatorId)) return state;
      const next = {
        ...state,
        spectators: [
          ...state.spectators,
          { id: action.spectatorId, name, joinedAt: Date.now() },
        ],
      };
      return log(next, "system", `${name} is watching.`);
    }

    case "unspectate": {
      const spectator = state.spectators.find((sp) => sp.id === action.spectatorId);
      if (!spectator) return state;
      return {
        ...state,
        spectators: state.spectators.filter((sp) => sp.id !== action.spectatorId),
      };
    }

    case "leave": {
      if (state.spectators.some((sp) => sp.id === action.playerId)) {
        return {
          ...state,
          spectators: state.spectators.filter((sp) => sp.id !== action.playerId),
        };
      }
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
      if (state.spectators.some((sp) => sp.id === action.playerId)) {
        return {
          ...state,
          spectators: state.spectators.map((sp) =>
            sp.id === action.playerId ? { ...sp, name } : sp,
          ),
        };
      }
      return withPlayer(state, action.playerId, (p) => ({ ...p, name }));
    }

    case "setMode": {
      if (state.phase !== "lobby") return state;
      const meta = MODE_META[action.mode];
      const next: RoomState = {
        ...state,
        mode: action.mode,
        startingLife: meta.defaultLife,
        maxPlayers: Math.max(
          meta.minPlayers,
          Math.min(
            meta.maxPlayers,
            Math.max(state.players.length, meta.defaultMaxPlayers),
          ),
        ),
        // The room's ruleset follows its mode, so a table that switches from
        // Kingdoms to Advanced Kingdoms deals printed cards and vice versa.
        kingdom: { ...state.kingdom, variant: variantForMode(action.mode) },
      };
      return log(next, "system", `Format changed to ${meta.name}.`);
    }

    case "setMaxPlayers": {
      if (action.byId !== state.hostId) return state;
      if (state.phase !== "lobby") return state;
      const meta = MODE_META[state.mode];
      const max = Math.max(
        meta.minPlayers,
        Math.min(meta.maxPlayers, Math.round(action.max)),
      );
      // Never shrink the cap below the people already sitting down.
      return { ...state, maxPlayers: Math.max(max, state.players.length) };
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
        lastRoll: null,
        log: [],
        kingdom: {
          ...state.kingdom,
          dealt: false,
          roles: {},
          classes: {},
          revealed: [],
          announced: {},
          claims: {},
          revealAll: false,
        },
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
      if (!canAdjustLife(state, action.byPlayerId, action.playerId, action.delta))
        return state;
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
      const target = state.players.find((p) => p.id === action.playerId);
      if (!target) return state;
      // A "set to" is either damage or healing depending which way it goes.
      if (
        !canAdjustLife(
          state,
          action.byPlayerId,
          action.playerId,
          value - target.life,
        )
      ) {
        return state;
      }
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
        life:
          state.mode === "archenemy"
            ? 20
            : isKingdomMode(state.mode) && p.role === "king"
              ? kingLifeFor(state)
              : state.startingLife,
        poison: 0,
        commanderDamage: {},
      }));
      const next: RoomState = { ...restored, winners: null, phase: "playing" };
      return log(next, "system", `${player.name} is back in the game.`);
    }

    // ---------------------------------------------------------------- Planechase
    case "rollPlanarDie": {
      const seed = action.seed ?? randomSeed();
      const face = action.face ?? rollPlanarFace(createRng(seed));
      const manual = Boolean(action.face);
      const plane = state.planechase.current;
      let next: RoomState = {
        ...state,
        planechase: {
          ...state.planechase,
          rollsThisTurn: state.planechase.rollsThisTurn + 1,
          chaosPending: face === "chaos" ? true : state.planechase.chaosPending,
        },
        lastRoll: {
          kind: "planar",
          label: "Planar die",
          value:
            face === "chaos" ? "Chaos" : face === "planeswalk" ? "Planeswalk" : "Blank",
          sides: 6,
          byId: action.playerId,
          at: Date.now(),
          manual,
        },
      };
      const label =
        face === "blank" ? "Blank — nothing happens." : face === "chaos" ? "CHAOS!" : "PLANESWALK!";
      next = log(
        next,
        "roll",
        `${playerName(next, action.playerId)} ${manual ? "sets" : "rolls"} the planar die: ${label}`,
        action.playerId,
      );

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
      const card = action.plane as PlaneCard | undefined;
      if (!card) return state;
      const next: RoomState = {
        ...state,
        planechase: {
          ...state.planechase,
          current: card,
          chaosPending: false,
        },
      };
      return log(next, "mode", `The plane is now ${card.name}.`, action.playerId);
    }

    case "resetPlanarDeck": {
      const seed = action.seed ?? randomSeed();
      const deck = planardDeck(seed, action.planes ?? []);
      const current = deck.find((card) => card.type === "Plane") ?? deck[0];
      return log(
        {
          ...state,
          planechase: {
            ...state.planechase,
            deck: deck.filter((card) => card.id !== current?.id),
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

    case "rollDie": {
      const sides = Math.max(2, Math.min(100, Math.round(action.sides)));
      const seed = action.seed ?? randomSeed();
      const rolled = Math.floor(createRng(seed)() * sides) + 1;
      const value = action.value
        ? Math.max(1, Math.min(sides, Math.round(action.value)))
        : rolled;
      const manual = action.value !== undefined;
      let next: RoomState = {
        ...state,
        lastRoll: {
          kind: "die",
          label: `d${sides}`,
          value: String(value),
          sides,
          byId: action.playerId,
          at: Date.now(),
          manual,
        },
      };
      next = log(
        next,
        "roll",
        `${playerName(next, action.playerId)} ${manual ? "sets" : "rolls"} a d${sides}: ${value}.`,
        action.playerId,
      );
      return next;
    }

    case "flipCoin": {
      const seed = action.seed ?? randomSeed();
      const value: "heads" | "tails" =
        action.value ?? (createRng(seed)() > 0.5 ? "heads" : "tails");
      const manual = action.value !== undefined;
      let next: RoomState = {
        ...state,
        lastRoll: {
          kind: "coin",
          label: "Coin",
          value: value === "heads" ? "Heads" : "Tails",
          sides: 2,
          byId: action.playerId,
          at: Date.now(),
          manual,
        },
      };
      next = log(
        next,
        "roll",
        `${playerName(next, action.playerId)} ${manual ? "calls" : "flips"} the coin: ${value}.`,
        action.playerId,
      );
      return next;
    }

    case "clearRoll": {
      return { ...state, lastRoll: null };
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
          deck: shuffle(action.schemes, createRng(seed)),
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
      return log(
        next,
        "mode",
        `Scheme set in motion: ${top.name}.`,
        action.playerId,
      );
    }

    case "resolveScheme": {
      const next: RoomState = {
        ...state,
        archenemy: {
          ...state.archenemy,
          active: state.archenemy.active.filter((card) => card.id !== action.schemeId),
          resolved: [...state.archenemy.resolved, action.schemeId],
          lastRevealed:
            state.archenemy.lastRevealed?.id === action.schemeId
              ? null
              : state.archenemy.lastRevealed,
        },
      };
      return log(next, "mode", `${action.name} is done.`, action.playerId);
    }

    // ---------------------------------------------------------------- Kingdoms
    case "declareWinner": {
      if (action.byId !== state.hostId) return state;
      const winners = action.winnerIds.filter((id) =>
        state.players.some((p) => p.id === id),
      );
      if (winners.length === 0) return state;
      const names = winners
        .map((id) => playerName(state, id))
        .join(" and ");
      const next: RoomState = {
        ...state,
        phase: "finished",
        winners,
        // Show every card once the result is called.
        kingdom: { ...state.kingdom, revealAll: true },
      };
      return log(next, "system", `The host called the game for ${names}.`);
    }

    case "setKingdomVariant": {
      if (action.byId !== state.hostId) return state;
      if (state.phase !== "lobby") return state;
      // Kept for rooms saved before Advanced Kingdoms had its own mode. The
      // ruleset and the mode are two views of one choice, so move both.
      const next: RoomState = {
        ...state,
        // Switching rulesets never rewrites the table's starting life.
        mode: action.variant === "advanced" ? "advanced" : "kingdom",
        kingdom: { ...state.kingdom, variant: action.variant },
      };
      return log(
        next,
        "system",
        action.variant === "advanced"
          ? "Advanced Kingdoms selected — 5 to 9 players, dealt from the printed card set."
          : "Classic Kingdoms selected.",
      );
    }

    case "revealAllRoles": {
      if (action.byId !== state.hostId) return state;
      const next: RoomState = {
        ...state,
        kingdom: { ...state.kingdom, revealAll: action.reveal },
      };
      return log(
        next,
        "system",
        action.reveal
          ? "The host revealed every role at the table."
          : "The host hid the roles again.",
      );
    }

    case "configureRoles": {
      if (action.byId !== state.hostId) return state;
      if (state.phase !== "lobby") return state;
      return { ...state, kingdom: { ...state.kingdom, setup: action.setup } };
    }

    case "dealRoles": {
      if (action.byId !== state.hostId) return state;
      return dealRoles(state, action.seed ?? randomSeed(), action.classes ?? []);
    }

    case "revealRole": {
      const revealed = Array.from(new Set([...state.kingdom.revealed, action.playerId]));
      return {
        ...state,
        kingdom: { ...state.kingdom, revealed },
      };
    }

    case "announce": {
      return announce(state, action);
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

/**
 * Advanced Kingdoms: turn a role card face up.
 *
 * Announcing is the only way a card becomes public in the printed game, and it
 * is what several cards key off ("when a player announces…"). It is therefore
 * a real game action rather than a cosmetic reveal: it is one-way, everyone is
 * told, and a card whose ability the app can carry out carries it out.
 *
 * The app cannot see the battlefield, so it does not police *when* a card may
 * announce. The panel shows the printed condition and leaves the ruling to the
 * table — the same bargain the rest of the mode makes.
 */
function announce(
  state: RoomState,
  action: { playerId: string; byId?: string; targetId?: string },
): RoomState {
  if (!isKingdomMode(state.mode) || state.kingdom.variant !== "advanced") {
    return state;
  }
  if (state.phase !== "playing") return state;

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return state;

  // You announce your own card. The host may do it for someone who has walked
  // away from the table, which is the same override they have everywhere else.
  const byId = action.byId ?? action.playerId;
  if (byId !== action.playerId && byId !== state.hostId) return state;

  const cardId = state.kingdom.cards[action.playerId];
  const card = cardId ? cardById(cardId) : undefined;
  if (!card) return state;

  // Face up is face up: announcing twice is a no-op.
  if (state.kingdom.announced[action.playerId] !== undefined) return state;

  let next: RoomState = {
    ...state,
    kingdom: {
      ...state.kingdom,
      revealed: Array.from(new Set([...state.kingdom.revealed, action.playerId])),
      announced: { ...state.kingdom.announced, [action.playerId]: Date.now() },
    },
  };

  next = log(next, "mode", `${player.name} announces — ${card.name}.`, action.playerId);

  // The Priestess is the one Announce whose entire effect is on the numbers
  // this app already keeps, so it is resolved here rather than left to the
  // table. Without a target there is nothing to resolve; the log still shows
  // the announcement so the table can sort it out by hand.
  if (card.announceEffect?.kind === "exchangeWithTarget" && action.targetId) {
    const target = next.players.find((p) => p.id === action.targetId);
    if (target && target.id !== action.playerId) {
      const a = player;
      const b = target;
      next = {
        ...next,
        players: next.players.map((p) => {
          if (p.id === a.id) {
            return {
              ...p,
              life: b.life,
              poison: b.poison,
              commanderDamage: { ...b.commanderDamage },
            };
          }
          if (p.id === b.id) {
            return {
              ...p,
              life: a.life,
              poison: a.poison,
              commanderDamage: { ...a.commanderDamage },
            };
          }
          return p;
        }),
      };
      next = log(
        next,
        "life",
        `${card.name}: ${a.name} and ${b.name} exchange life totals, commander damage and poison.`,
        action.playerId,
      );
      next = settle(next).state;
    }
  }

  return next;
}

function planeswalkTo(
  state: RoomState,
  playerId: string,
  seed: number,
): RoomState {
  const rng = createRng(seed);
  let deck = state.planechase.deck.slice();
  let bottom = state.planechase.bottom.slice();
  let current: PlaneCard | null = null;
  const seen: PlaneCard[] = [];

  while (deck.length > 0) {
    const [next, ...rest] = deck;
    deck = rest;
    if (next.type === "Plane") {
      current = next;
      break;
    }
    seen.push(next);
  }

  // Phenomena that were passed over go to the bottom in a random order.
  bottom = [...bottom, ...shuffle(seen, rng)];

  if (!current) {
    // Deck is empty of planes — rebuild from every card we have seen.
    const rebuilt = planardDeck(seed + 7, [...deck, ...state.planechase.deck]);
    current = rebuilt.find((card) => card.type === "Plane") ?? null;
    deck = rebuilt.filter((card) => card.id !== current?.id);
    bottom = [];
  }

  const card = current;
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
