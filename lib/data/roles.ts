import type { RoleId } from "@/lib/types";

export interface RoleMeta {
  id: RoleId;
  name: string;
  land: string;
  colour: string;
  /** One-line goal shown on the private role card. */
  goal: string;
  detail: string;
}

/**
 * Kingdoms / Treachery — the widely played Commander hidden-role variant.
 *
 * Sources agree on the core five-role structure (King, Knight, two Bandits,
 * Assassin) with the Usurper added for six players and a second Assassin at
 * seven. Only the King is public.
 */
export const ROLES: Record<RoleId, RoleMeta> = {
  king: {
    id: "king",
    name: "King",
    land: "Plains",
    colour: "#f5d76e",
    goal: "Be the last player standing.",
    detail:
      "Your role is public from the start. You start at 50 life and take the first turn. You win when every other player is out, or when only you and the Knight remain.",
  },
  knight: {
    id: "knight",
    name: "Knight",
    land: "Forest",
    colour: "#5ec26a",
    goal: "Keep the King alive.",
    detail:
      "You win only if everyone except the King is eliminated. You do not need to survive to win, but the King does.",
  },
  bandit: {
    id: "bandit",
    name: "Bandit",
    land: "Mountain",
    colour: "#e0653f",
    goal: "Kill the King.",
    detail:
      "You win the moment the King loses the game, as long as at least one Bandit is still in the game at that point.",
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    land: "Swamp",
    colour: "#a087d6",
    goal: "Be the last one standing.",
    detail:
      "You win only when every other player is out — which means the Bandits must fall before the King, or the Bandits win instead.",
  },
  usurper: {
    id: "usurper",
    name: "Usurper",
    land: "Island",
    colour: "#5fa8e0",
    goal: "Take the throne for yourself.",
    detail:
      "If you are the one who makes the King lose, you swap roles: you become the new King at 50 life and the old King survives as the Usurper at 5 life.",
  },
};

/**
 * Default role composition by table size. These match the standard Kingdoms
 * setup; the host can shuffle again at any time before the game starts.
 */
export function roleSetFor(playerCount: number): RoleId[] {
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
