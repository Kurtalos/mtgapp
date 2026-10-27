/**
 * Core domain types.
 *
 * The whole room is one plain-JSON object so it can be persisted in a single
 * database row and pushed to every phone as-is. That keeps the UI trivially
 * simple: one state in, one state out.
 */

/** Classic five-role Kingdoms, or the Advanced Kingdoms card set. */
export type KingdomVariant = "classic" | "advanced";

export type GameMode =
  | "commander"
  | "planechase"
  | "archenemy"
  | "kingdom"
  | "advanced";

export const GAME_MODES: GameMode[] = [
  "commander",
  "planechase",
  "archenemy",
  "kingdom",
  "advanced",
];

/**
 * Both Kingdoms rulesets share one engine: same roles, same win conditions,
 * same throne. They are separate rooms because the *card* layer differs —
 * Advanced Kingdoms deals printed cards with Announce abilities, and those
 * abilities change what a reveal means. Anything that only cares about "is
 * there a King at this table" should ask this rather than compare modes.
 */
export function isKingdomMode(mode: GameMode): boolean {
  return mode === "kingdom" || mode === "advanced";
}

/** Ruleset a room of this mode plays. */
export function variantForMode(mode: GameMode): KingdomVariant {
  return mode === "advanced" ? "advanced" : "classic";
}

/** The mode a room using this ruleset belongs in. */
export function modeForVariant(variant: KingdomVariant): GameMode {
  return variant === "advanced" ? "advanced" : "kingdom";
}

export type Phase = "lobby" | "playing" | "finished";

// Card shapes live in lib/content; imported here for the state that embeds them.
import type { PlaneCard, RoleClass, SchemeCard } from "@/lib/content";
export type { RoleClass };

/**
 * Role families: the level the win conditions are written against.
 * "usurper" is the legacy six-player role from classic Kingdoms and is kept so
 * saved rooms still load; it behaves as a Renegade.
 */
export type RoleId =
  | "king"
  | "knight"
  | "bandit"
  | "assassin"
  | "renegade"
  | "usurper";

export type PlanarFace = "blank" | "chaos" | "planeswalk";

export interface PlayerState {
  id: string;
  name: string;
  /** Stable seat index, used for colours and turn order. */
  seat: number;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  /** Extra {2} per previous cast from the command zone. Pure bookkeeping. */
  commanderTax: number;
  /**
   * Commander damage taken FROM another player, keyed by that player's id.
   * Only damage dealt by a commander counts toward the 21-point loss.
   */
  commanderDamage: Record<string, number>;
  eliminated: boolean;
  /** Why the player was knocked out, for the post-game summary. */
  deathReason?: string;
  /** Kingdom only. Secret unless the id is also in kingdom.revealed. */
  role?: RoleId;
}

export interface PlanechaseState {
  /**
   * Cards remaining in the planar deck, index 0 is the top.
   *
   * Full card objects rather than ids on purpose: a game holds its own copy,
   * so the admin panel can add or edit planes without reaching into a table
   * that is already being played.
   */
  deck: PlaneCard[];
  /** The face-up plane, if the game has started. */
  current: PlaneCard | null;
  /** Cards revealed and then put on the bottom of the deck. */
  bottom: PlaneCard[];
  /** Player who last rolled the planeswalk symbol (owns planar choices). */
  controllerId: string | null;
  /** True after a chaos roll until it is acknowledged. */
  chaosPending: boolean;
  /** Number of planar die rolls the active player has made this turn. */
  rollsThisTurn: number;
}

export interface ArchenemyState {
  archenemyId: string | null;
  /** Scheme cards, index 0 is the top of the scheme deck. */
  deck: SchemeCard[];
  /** Ongoing schemes currently set in motion. */
  active: SchemeCard[];
  /** The scheme most recently set in motion (for the reveal animation). */
  lastRevealed: SchemeCard | null;
  /** Schemes that have finished resolving. */
  resolved: string[];
}

export interface KingdomState {
  variant: KingdomVariant;
  dealt: boolean;
  /**
   * How many of each role are in play, chosen in the setup window.
   * A count of 0 means the role is not in this game.
   */
  setup: Record<RoleId, number>;
  /** Player id -> role family. Undefined until roles are dealt. */
  roles: Record<string, RoleId>;
  /**
   * Advanced Kingdoms only: player id -> printed card id. The family lives in
   * `roles`; this is the specific card whose art and text the player sees.
   */
  cards: Record<string, string>;
  /** Player id -> class id, picked at random inside their role. */
  classes: Record<string, string>;
  /** Player ids whose role is public knowledge. */
  revealed: string[];
  /**
   * Advanced Kingdoms only: player id -> when they Announced.
   *
   * Announcing is the printed way of flipping a role card face up, and it is
   * the trigger some cards key off ("when a player announces…"). It is kept
   * apart from `revealed` because a host revealing a card to settle an argument
   * is not an Announce and must not fire those triggers.
   */
  announced: Record<string, number>;
  /** Player ids that have claimed a role out loud (social layer, not rules). */
  claims: Record<string, RoleId>;
  /**
   * Host override: show every role at the table. Useful when adjudicating a
   * rules dispute or when a player drops out mid-game. Roles are hidden by the
   * UI either way, never by the server.
   */
  revealAll: boolean;
}

export interface Spectator {
  id: string;
  name: string;
  joinedAt: number;
}

export type RollKind = "die" | "coin" | "planar";

/**
 * The most recent roll, shared with the whole table.
 *
 * Rolls used to be local state inside one phone, which meant the result only
 * existed where it happened. Putting the last roll in the room document lets
 * every player see it, and lets the host correct a die that landed under the
 * sofa by entering the result by hand.
 */
export interface RollResult {
  kind: RollKind;
  /** Short name for display: "d20", "Coin", "Planar die". */
  label: string;
  /** Display form of the result: "17", "Heads", "Chaos". */
  value: string;
  sides: number | null;
  byId: string;
  at: number;
  /** True when a human entered the result rather than the app rolling it. */
  manual: boolean;
}

export interface LogEntry {
  id: string;
  at: number;
  /** Player id responsible, or null for system events. */
  actorId: string | null;
  text: string;
  kind: "life" | "commander" | "counters" | "mode" | "system" | "roll";
}

export interface RoomState {
  code: string;
  mode: GameMode;
  phase: Phase;
  startingLife: number;
  hostId: string;
  players: PlayerState[];
  /** Hard cap on seated players. Spectators are not counted. */
  maxPlayers: number;
  /** People watching from the couch. Read-only, never part of the game. */
  spectators: Spectator[];
  planechase: PlanechaseState;
  archenemy: ArchenemyState;
  kingdom: KingdomState;
  log: LogEntry[];
  /** Most recent dice, coin or planar roll, shared with everyone. */
  lastRoll: RollResult | null;
  /** Populated when the game ends. */
  winners: string[] | null;
  createdAt: number;
  updatedAt: number;
}

export interface StoredRoom {
  code: string;
  state: RoomState;
  /** Incremented on every successful write; drives optimistic concurrency. */
  version: number;
  updatedAt: string;
}

export type ModeMeta = {
  id: GameMode;
  name: string;
  tagline: string;
  players: string;
  defaultLife: number;
  defaultMaxPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  accent: string;
  summary: string;
};

export const MODE_META: Record<GameMode, ModeMeta> = {
  commander: {
    id: "commander",
    name: "Commander",
    tagline: "The classic",
    players: "2–8 players",
    defaultLife: 40,
    defaultMaxPlayers: 4,
    minPlayers: 2,
    maxPlayers: 8,
    accent: "#a881ff",
    summary:
      "40 life, 21 commander damage from a single commander, and poison at 10.",
  },
  planechase: {
    id: "planechase",
    name: "Planechase",
    tagline: "Chaos everywhere",
    players: "2–8 players",
    defaultLife: 40,
    defaultMaxPlayers: 4,
    minPlayers: 2,
    maxPlayers: 8,
    accent: "#38bdf8",
    summary:
      "Shared planar deck and the planar die. Roll chaos, then planeswalk.",
  },
  archenemy: {
    id: "archenemy",
    name: "Archenemy",
    tagline: "One against many",
    players: "3–6 players",
    defaultLife: 20,
    defaultMaxPlayers: 4,
    minPlayers: 3,
    maxPlayers: 6,
    accent: "#f97316",
    summary:
      "One player starts at 40 life with a scheme deck against everyone else on 20.",
  },
  kingdom: {
    id: "kingdom",
    name: "Kingdoms",
    tagline: "Trust nobody",
    players: "2–9 players",
    defaultLife: 40,
    defaultMaxPlayers: 6,
    minPlayers: 2,
    // Nine seats so Advanced Kingdoms can run its full printed table. Classic
    // Kingdoms still tops out at eight in practice — the setup window governs
    // what actually gets dealt.
    maxPlayers: 9,
    accent: "#facc15",
    summary:
      "The Treachery / Kingdoms variant: secret roles and asymmetric win conditions. The King is public and starts at 50. Advanced Kingdoms adds 21 printed role cards for 5–9 players.",
  },
  advanced: {
    id: "advanced",
    name: "Advanced Kingdoms",
    tagline: "21 printed roles",
    players: "5–9 players",
    defaultLife: 40,
    defaultMaxPlayers: 6,
    minPlayers: 5,
    maxPlayers: 9,
    accent: "#c9a227",
    summary:
      "The printed card set: one specific role card each, face down until you Announce. Announce flips your card up and fires its ability — The Priestess swaps life totals, commander damage and poison with a player of your choice. The King starts 10 life ahead.",
  },
};
