/**
 * Core domain types.
 *
 * The whole room is one plain-JSON object so it can be persisted in a single
 * database row and pushed to every phone as-is. That keeps the UI trivially
 * simple: one state in, one state out.
 */

export type GameMode = "commander" | "planechase" | "archenemy" | "kingdom";

export const GAME_MODES: GameMode[] = [
  "commander",
  "planechase",
  "archenemy",
  "kingdom",
];

export type Phase = "lobby" | "playing" | "finished";

export type RoleId =
  | "king"
  | "knight"
  | "bandit"
  | "assassin"
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
  /** Card ids remaining in the planar deck, index 0 is the top. */
  deck: string[];
  /** The face-up plane, if the game has started. */
  current: string | null;
  /** Cards revealed and then put on the bottom of the deck. */
  bottom: string[];
  /** Player who last rolled the planeswalk symbol (owns planar choices). */
  controllerId: string | null;
  /** True after a chaos roll until it is acknowledged. */
  chaosPending: boolean;
  /** Number of planar die rolls the active player has made this turn. */
  rollsThisTurn: number;
}

export interface ArchenemyState {
  archenemyId: string | null;
  /** Scheme names, index 0 is the top of the scheme deck. */
  deck: string[];
  /** Ongoing schemes currently set in motion. */
  active: string[];
  /** The scheme most recently set in motion (for the reveal animation). */
  lastRevealed: string | null;
  /** Names of schemes that have finished resolving. */
  resolved: string[];
}

export interface KingdomState {
  dealt: boolean;
  /** Player id -> role. Undefined until roles are dealt. */
  roles: Record<string, RoleId>;
  /** Player ids whose role is public knowledge. */
  revealed: string[];
  /** Player ids that have claimed a role out loud (social layer, not rules). */
  claims: Record<string, RoleId>;
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
  planechase: PlanechaseState;
  archenemy: ArchenemyState;
  kingdom: KingdomState;
  log: LogEntry[];
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
    accent: "#f97316",
    summary:
      "One player starts at 40 life with a scheme deck against everyone else on 20.",
  },
  kingdom: {
    id: "kingdom",
    name: "Kingdoms",
    tagline: "Trust nobody",
    players: "5–8 players",
    defaultLife: 40,
    accent: "#facc15",
    summary:
      "Secret roles and asymmetric win conditions. The King is public and starts at 50.",
  },
};
