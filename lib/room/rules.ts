import type { PlayerState, RoleId, RoomState } from "@/lib/types";

/** A single commander needs 21 damage to remove a player. */
export const COMMANDER_DAMAGE_LETHAL = 21;
/** Ten poison counters lose the game. */
export const POISON_LETHAL = 10;
/** Archenemy starts with double the life of each opposing player. */
export const ARCHENEMY_LIFE = 40;
/** The King's larger starting life total in Kingdoms. */
export const KING_LIFE = 50;
/** What the deposed King is left on after a successful usurpation. */
export const USURPED_KING_LIFE = 5;

export function commanderDamageAgainst(
  player: PlayerState,
  sourceId: string,
): number {
  return player.commanderDamage[sourceId] ?? 0;
}

/** Total commander damage from all sources — used for a quick table read. */
export function totalCommanderDamage(player: PlayerState): number {
  return Object.values(player.commanderDamage).reduce((a, b) => a + b, 0);
}

/** The single biggest commander-damage number, for the tile badge. */
export function highestCommanderDamage(player: PlayerState): number {
  return Object.values(player.commanderDamage).reduce((a, b) => Math.max(a, b), 0);
}

export function lethalCommanderSource(player: PlayerState): string | null {
  for (const [sourceId, dmg] of Object.entries(player.commanderDamage)) {
    if (dmg >= COMMANDER_DAMAGE_LETHAL) return sourceId;
  }
  return null;
}

/**
 * State-based lethal check. Returns a human-readable reason, or null.
 * Order matters only for the message shown in the feed.
 */
export function lethalReason(
  player: PlayerState,
  state: RoomState,
): string | null {
  if (player.poison >= POISON_LETHAL) return "10 poison counters";
  const cmdSource = lethalCommanderSource(player);
  if (cmdSource) {
    const source = state.players.find((p) => p.id === cmdSource);
    return `${COMMANDER_DAMAGE_LETHAL} commander damage from ${
      source?.name ?? "a commander"
    }`;
  }
  if (player.life <= 0) return "life total reached 0";
  return null;
}

export function alivePlayers(state: RoomState): PlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}

export function playerName(state: RoomState, id: string | null): string {
  if (!id) return "the table";
  return state.players.find((p) => p.id === id)?.name ?? "Unknown";
}

export function roleOf(state: RoomState, playerId: string): RoleId | undefined {
  return state.kingdom.roles[playerId];
}

export function livingRole(
  state: RoomState,
  role: RoleId,
  exclude?: string,
): PlayerState[] {
  return state.players.filter(
    (p) => !p.eliminated && p.id !== exclude && state.kingdom.roles[p.id] === role,
  );
}

/**
 * Work out who has won, if anyone.
 *
 * Commander / Planechase: last player standing.
 * Archenemy: the team wins when the archenemy falls; the archenemy wins when
 *   every opposing player is out.
 * Kingdoms: every role has its own condition, evaluated on the living.
 */
export function computeOutcome(state: RoomState): string[] | null {
  const living = state.players.filter((p) => !p.eliminated);
  if (state.players.length === 0) return null;

  if (state.mode === "archenemy") {
    const archId = state.archenemy.archenemyId;
    const archenemy = state.players.find((p) => p.id === archId);
    const team = living.filter((p) => p.id !== archId);
    if (archenemy && archenemy.eliminated) return team.map((p) => p.id);
    if (archId && team.length === 0) return archenemy ? [archenemy.id] : [];
    return null;
  }

  if (state.mode === "kingdom" && state.kingdom.dealt) {
    return computeKingdomOutcome(state);
  }

  // Free-for-all modes.
  if (living.length === 1 && state.players.length > 1) return [living[0].id];
  return null;
}

function computeKingdomOutcome(state: RoomState): string[] | null {
  const roles = state.kingdom.roles;
  const king = state.players.find((p) => roles[p.id] === "king");
  const living = state.players.filter((p) => !p.eliminated);

  if (!king) return null;

  const kingAlive = !king.eliminated;
  const livingBandits = living.filter((p) => roles[p.id] === "bandit");

  // The King has fallen and nobody has taken the throne.
  if (!kingAlive) {
    // A live Usurper may still claim the game by being the last one standing.
    const usurper = living.find((p) => roles[p.id] === "usurper");
    if (livingBandits.length > 0) {
      // Bandits win as a team the moment the King falls, provided one lives.
      const knights = living.filter((p) => roles[p.id] === "knight");
      const assassins = living.filter((p) => roles[p.id] === "assassin");
      void knights;
      void assassins;
      return livingBandits.map((p) => p.id);
    }
    if (usurper && living.length === 1) return [usurper.id];
    if (living.length === 1 && roles[living[0].id] === "assassin") {
      return [living[0].id];
    }
    if (living.length === 1 && roles[living[0].id] === "knight") {
      // The Knight cannot win without the King.
      return [];
    }
    return null;
  }

  // King still alive: only the King and Knight may remain.
  if (living.length === 2) {
    const others = living.filter((p) => p.id !== king.id);
    const knight = others[0];
    if (knight && roles[knight.id] === "knight") {
      return [king.id, knight.id];
    }
  }
  if (living.length === 1 && living[0].id === king.id) return [king.id];
  return null;
}

/** True when the given player may be targeted by a role swap. */
export function isUsurper(state: RoomState, playerId: string): boolean {
  return state.kingdom.roles[playerId] === "usurper";
}
