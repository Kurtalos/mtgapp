import type { RoleId } from "@/lib/types";

/** Alias: the role id union is also the set of keys used by the setup table. */
export type RoleKey = RoleId;

/**
 * A role *family*. Advanced Kingdoms groups every role card under one of
 * these, and the family is what decides the win condition — "The Queen" and
 * "The Knight in Shining Armor" both win or lose as Knights, and "The Mimic"
 * and "The Cultist" both read "Refer to the Role card".
 *
 * This is the level the engine reasons about. Individual role cards are the
 * flavour layer on top of it.
 */
export type RoleFamily = "king" | "knight" | "assassin" | "bandit" | "renegade";

export interface RoleMeta {
  id: RoleKey;
  /** Family this role belongs to, for win-condition purposes. */
  family: RoleFamily;
  name: string;
  land: string;
  colour: string;
  /** One-line goal shown on the private role card. */
  goal: string;
  /** Long-form rules shown when the player peeks. */
  detail: string;
  /** Only the King is face up. */
  public?: boolean;
  /** Starting life override, when the card sets one. */
  startingLife?: number;
}

export const ROLE_FAMILIES: RoleFamily[] = [
  "king",
  "knight",
  "assassin",
  "bandit",
  "renegade",
];

/** Full name of each family, as printed on the reference sheet. */
export const FAMILY_LABEL: Record<RoleFamily, string> = {
  king: "The King",
  knight: "Knights",
  assassin: "Assassins",
  bandit: "Bandits",
  renegade: "Renegades",
};

/** Colour used for each family, matching the card frames. */
export const FAMILY_COLOUR: Record<RoleFamily, string> = {
  king: "#f5d76e",
  knight: "#e8e6df",
  assassin: "#a087d6",
  bandit: "#e0653f",
  renegade: "#5fa8e0",
};

/** Win conditions, transcribed from the Advanced Kingdoms reference sheet. */
export const FAMILY_GOAL: Record<RoleFamily, { victory: string; defeat: string }> = {
  king: {
    victory: "All Assassins, Bandits and Renegades are eliminated.",
    defeat: "You are eliminated.",
  },
  knight: {
    victory: "The King wins. (Unless the card says otherwise.)",
    defeat: "The King is eliminated.",
  },
  assassin: {
    victory: "The King is eliminated.",
    defeat: "You are eliminated.",
  },
  bandit: {
    victory: "All non-Bandits are eliminated.",
    defeat: "You or a teammate are eliminated.",
  },
  renegade: {
    victory: "Refer to the role card.",
    defeat: "You are eliminated.",
  },
};

/**
 * The classic Kingdoms roles. These stay as the default because they are the
 * ones most tables already know; Advanced Kingdoms deals from the full card
 * list in `lib/data/advancedKingdoms.ts`.
 */
export const ROLES: Record<RoleKey, RoleMeta> = {
  king: {
    id: "king",
    family: "king",
    name: "King",
    land: "Plains",
    colour: FAMILY_COLOUR.king,
    goal: "Survive. Everyone else is out.",
    detail:
      "Your role is public from the start, you take the first turn, and you start with +10 life. You win when every Assassin, Bandit and Renegade is eliminated. If you eliminate a player who had a Knight role card, you lose the game.",
    public: true,
    startingLife: 50,
  },
  knight: {
    id: "knight",
    family: "knight",
    name: "Knight",
    land: "Forest",
    colour: FAMILY_COLOUR.knight,
    goal: "Keep the King alive.",
    detail:
      "You win when the King wins. You lose the moment the King is eliminated, whatever else is happening.",
  },
  bandit: {
    id: "bandit",
    family: "bandit",
    name: "Bandit",
    land: "Mountain",
    colour: FAMILY_COLOUR.bandit,
    goal: "Kill the King, together.",
    detail:
      "You win when every non-Bandit is eliminated. You lose as soon as you or a teammate is eliminated — so a Bandit falling early costs the whole team.",
  },
  assassin: {
    id: "assassin",
    family: "assassin",
    name: "Assassin",
    land: "Swamp",
    colour: FAMILY_COLOUR.assassin,
    goal: "Kill the King.",
    detail:
      "You win when the King is eliminated. You lose if you are eliminated — there is no team to fall back on.",
  },
  renegade: {
    id: "renegade",
    family: "renegade",
    name: "Renegade",
    land: "Island",
    colour: FAMILY_COLOUR.renegade,
    goal: "Your own win condition — read your card.",
    detail:
      "Renegades have no shared goal. Each card states its own Victory and Defeat conditions, so read yours carefully and keep it hidden.",
  },
  usurper: {
    id: "usurper",
    family: "renegade",
    name: "Usurper",
    land: "Island",
    colour: FAMILY_COLOUR.renegade,
    goal: "Take the throne for yourself.",
    detail:
      "If you are the one who makes the King lose, you swap roles: you become the new King at 50 life and the old King survives as the Usurper at 5 life.",
  },
};

/** Order shown in the setup window and the claim bar. */
export const ROLE_ORDER: RoleKey[] = [
  "king",
  "knight",
  "bandit",
  "assassin",
  "renegade",
  "usurper",
];

export function roleMeta(role: RoleKey): RoleMeta {
  return ROLES[role];
}

export function familyOf(role: RoleKey): RoleFamily {
  return ROLES[role].family;
}

/**
 * Default composition by table size, for the *classic* role set.
 *
 * Advanced Kingdoms has its own table (5–9 players) — see
 * `advancedSetupFor` in `lib/data/advancedKingdoms.ts`.
 */
export function roleSetFor(playerCount: number): RoleKey[] {
  switch (playerCount) {
    case 2:
      return ["king", "assassin"];
    case 3:
      return ["king", "bandit", "assassin"];
    case 4:
      return ["king", "knight", "bandit", "assassin"];
    case 5:
      return ["king", "knight", "bandit", "bandit", "assassin"];
    case 6:
      return ["king", "knight", "bandit", "bandit", "assassin", "usurper"];
    case 7:
      return [
        "king",
        "knight",
        "bandit",
        "bandit",
        "assassin",
        "assassin",
        "usurper",
      ];
    default:
      return [
        "king",
        "knight",
        "knight",
        "bandit",
        "bandit",
        "assassin",
        "assassin",
        "usurper",
      ];
  }
}
