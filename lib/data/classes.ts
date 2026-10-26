import type { RoleClass } from "@/lib/content";

/**
 * Default classes, one per role.
 *
 * These are the plain roles from the standard Kingdoms setup. The host can add
 * more from the admin panel — a second Knight (White/Black), a Queen in place
 * of a King, flavour names for a particular playgroup, and so on. Adding a
 * class never changes how a role wins; it only changes the card the player is
 * shown.
 */
export const DEFAULT_CLASSES: RoleClass[] = [
  {
    id: "class_king",
    role: "king",
    name: "King",
    description: "Ruler of the table. Public from the first turn.",
  },
  {
    id: "class_knight",
    role: "knight",
    name: "Knight",
    description: "Sworn to the throne, whatever it costs.",
  },
  {
    id: "class_bandit",
    role: "bandit",
    name: "Bandit",
    description: "Out for the crown, and the crown's head.",
  },
  {
    id: "class_assassin",
    role: "assassin",
    name: "Assassin",
    description: "Patient. Everyone else dies first.",
  },
  {
    id: "class_usurper",
    role: "usurper",
    name: "Usurper",
    description: "The throne is only worth what you take yourself.",
  },
];
