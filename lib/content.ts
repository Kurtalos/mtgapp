import { PLANAR_CARDS, type PlaneCard } from "@/lib/data/planechase";
import { DEFAULT_CLASSES } from "@/lib/data/classes";
import type { RoleId } from "@/lib/types";

export type { PlaneCard };

/**
 * Game content: planes, schemes and role classes.
 *
 * Three layers, merged cheapest-first:
 *   1. Bundled defaults — everything the app ships with, always available.
 *   2. Server content  — what an admin has added from the admin panel.
 *   3. Scryfall        — art and rules text fetched in the browser.
 *
 * A running game stores *copies* of the plane and scheme cards it was dealt
 * (see PlanechaseState.deck), so editing content in the admin panel can never
 * corrupt a table that is mid-game.
 */

export interface SchemeCard {
  id: string;
  name: string;
  oracleText: string;
  image?: string | null;
  custom?: boolean;
}

/**
 * A class is a flavour variant inside a role — the White Knight and the Black
 * Knight both win as Knights, but the table reads a different card. Roles are
 * fixed because their win conditions are code; classes are unlimited.
 */
export interface RoleClass {
  id: string;
  role: RoleId;
  name: string;
  description: string;
  custom?: boolean;
}

export interface ContentBundle {
  planes: PlaneCard[];
  schemes: SchemeCard[];
  classes: RoleClass[];
}

export const DEFAULT_PLANES: PlaneCard[] = PLANAR_CARDS;

export const DEFAULT_SCHEMES: SchemeCard[] = [];

export const BUNDLED_CLASSES: RoleClass[] = DEFAULT_CLASSES;

export function mergeContent(custom: Partial<ContentBundle> | null): ContentBundle {
  const added = {
    planes: custom?.planes ?? [],
    schemes: custom?.schemes ?? [],
    classes: custom?.classes ?? [],
  };

  const byId = <T extends { id: string }>(...lists: T[][]): T[] => {
    const map = new Map<string, T>();
    for (const list of lists) {
      for (const item of list) map.set(item.id, item);
    }
    return Array.from(map.values());
  };

  return {
    planes: byId(DEFAULT_PLANES, added.planes),
    schemes: byId(DEFAULT_SCHEMES, added.schemes),
    classes: byId(BUNDLED_CLASSES, added.classes),
  };
}

export function planesOf(bundle: ContentBundle): PlaneCard[] {
  return bundle.planes.filter((plane) => plane.type === "Plane");
}

export function classesForRole(
  bundle: ContentBundle,
  role: RoleId,
): RoleClass[] {
  const matches = bundle.classes.filter((entry) => entry.role === role);
  return matches.length > 0
    ? matches
    : [{ id: `default_${role}`, role, name: role, description: "" }];
}
