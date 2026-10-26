import type { RoleFamily, RoleKey } from "@/lib/data/roles";

/**
 * Advanced Kingdoms v1.71 — the full role card set.
 *
 * Transcribed from the printable card fronts, with the art extracted from the
 * same document into `public/kingdoms/`. Every card belongs to one of five
 * families; the family decides the base win condition and the individual card
 * adds to it.
 *
 * A handful of cards ("The Champion", "The Cultist", "The Straw Man",
 * "The Sellsword", "The Rightful Heir", "The Kingslayer") need table state the
 * app cannot see — who dealt the killing blow, who has been eliminated, what
 * another player's card says. Those are flagged `tracksManually` and the panel
 * tells the table to resolve them by hand rather than pretending to automate
 * them. Everything else is either purely informational or an "Announce"
 * ability the player simply reads out.
 */

export interface KingdomCard {
  /** Stable id — this is what gets dealt and persisted. */
  id: string;
  name: string;
  family: RoleFamily;
  /** Rules text, transcribed verbatim from the card. */
  text: string;
  /** Optional second ability block (Defeat / Victory lines). */
  secondary?: string;
  /** Card art, served from `public/`. */
  image: string;
  set: "advanced-kingdoms";
  /**
   * True when the card's outcome depends on table history the app does not
   * track, so the panel prompts the table instead of guessing.
   */
  tracksManually?: boolean;
}

export const ADVANCED_KINGDOM_CARDS: KingdomCard[] = [
  {
    id: "ak_the_king",
    name: "The King",
    family: "king",
    text: "Keep the King face up at all times. Whenever you eliminate a player, if that player had a Knight role card, you lose the game.",
    image: "/kingdoms/the-king.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_queen",
    name: "The Queen",
    family: "knight",
    text: "If damage dealt by another player would eliminate the King, instead Announce (turn this card face up to reveal your role). If you do, the next time a player of your choice would deal damage to the King this turn, prevent that damage. The King gains life equal to the damage prevented this way.",
    image: "/kingdoms/the-queen.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_rightful_heir",
    name: "The Rightful Heir",
    family: "knight",
    text: "When you eliminate a player, Announce (turn this card face up to reveal your role).",
    secondary:
      "When the King is eliminated, if the Rightful Heir is face up, you gain the King role card. If you do, gain 10 life.",
    image: "/kingdoms/the-rightful-heir.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_knight_in_shining_armor",
    name: "The Knight in Shining Armor",
    family: "knight",
    text: "Announce (turn this card face up to reveal your role): Whenever the King would be dealt damage by an opponent this turn, deal that much damage to that opponent instead. That opponent skips their next combat step.",
    secondary:
      "Activate this ability only during combat after blockers are declared.",
    image: "/kingdoms/the-knight-in-shining-armor.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_field_marshal",
    name: "The Field Marshal",
    family: "knight",
    text: "Announce (turn this card face up to reveal your role): Remove all attacking creatures from combat and untap them. After this phase, there is an additional combat phase. All creatures gain double strike and attack that combat if able. They can't attack you or the King that combat.",
    secondary:
      "Activate this ability only during the declare blockers step on an opponent's turn.",
    image: "/kingdoms/the-field-marshal.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_kingslayer",
    name: "The Kingslayer",
    family: "knight",
    text: "When you eliminate the King, Announce (turn this card face up to reveal your role). The King chooses another player. The chosen player gains the King role card. You have a replacement Defeat condition.",
    secondary: "Defeat — The King is eliminated.",
    image: "/kingdoms/the-kingslayer.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_marksman",
    name: "The Marksman",
    family: "assassin",
    text: "Announce (turn this card face up to reveal your role): Creatures lose hexproof and shroud until end of turn. Deal damage to up to three targets equal to the highest converted mana cost among permanents you control.",
    image: "/kingdoms/the-marksman.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_priestess",
    name: "The Priestess",
    family: "assassin",
    text: "Announce (turn this card face up to reveal your role): Exchange life totals, accumulated commander damage, and poison counters with target player.",
    secondary: "Activate this ability only during your turn.",
    image: "/kingdoms/the-priestess.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_bear_trainer",
    name: "The Bear Trainer",
    family: "assassin",
    text: "Announce (turn this card face up to reveal your role): Create three 2/2 green Bear creature tokens named War Bear. They have \"{T}: This creature deals damage equal to its power to target creature. If a creature dealt damage this way dies this turn, put a +1/+1 counter on this creature.\"",
    secondary: "Activate this ability only if an opponent has 30 or less life.",
    image: "/kingdoms/the-bear-trainer.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_schemer",
    name: "The Schemer",
    family: "assassin",
    text: "Announce (turn this card face up to reveal your role): Choose one —",
    secondary:
      "• During the King's next turn, you control that player during all combat phases.\n• During the King's next turn, you control that player during all non-combat phases.\n\nActivate this ability only during your turn.",
    image: "/kingdoms/the-schemer.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_thief",
    name: "The Thief",
    family: "assassin",
    text: "Announce (turn this card face up to reveal your role): Untap target permanent and gain control of it until the beginning of your next end step. It gains haste until end of turn.",
    image: "/kingdoms/the-thief.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_giant",
    name: "The Giant",
    family: "bandit",
    text: "Announce (turn this card face up to reveal your role): Choose one creature with the highest combined power and toughness. Destroy the rest.",
    secondary: "Activate this ability only during your turn.",
    image: "/kingdoms/the-giant.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_necromancer",
    name: "The Necromancer",
    family: "bandit",
    text: "Announce (turn this card face up to reveal your role): Exile all creature cards from target player's graveyard. An opponent with a face up role card separates those cards into two piles. Put all cards from the pile of your choice onto the battlefield under your control and exile the rest.",
    image: "/kingdoms/the-necromancer.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_stalker",
    name: "The Stalker",
    family: "bandit",
    text: "Announce (turn this card face up to reveal your role): Split Second. Exile target permanent. (As long as this ability is on the stack, players can't cast spells or activate abilities that aren't mana abilities.)",
    image: "/kingdoms/the-stalker.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_wizard",
    name: "The Wizard",
    family: "bandit",
    text: "Announce (turn this card face up to reveal your role): Choose one —",
    secondary:
      "• Exile target spell.\n• Change the target of target spell or ability. (Role abilities cannot be targeted.)",
    image: "/kingdoms/the-wizard.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_zealot",
    name: "The Zealot",
    family: "bandit",
    text: "Announce (turn this card face up to reveal your role): Each player with a face up role card reveals cards from the top of their library until they reveal a creature card. For each creature card revealed this way you may put that card onto the battlefield under your control. Shuffle all cards not put onto the battlefield this way into their owners' libraries. Those creatures gain vigilance, haste, and double strike until end of turn.",
    image: "/kingdoms/the-zealot.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_mimic",
    name: "The Mimic",
    family: "renegade",
    text: "Victory — All other players are eliminated.",
    secondary:
      "When you have 20 or less life, Announce (turn this card face up to reveal your role). If you do, draw a card.\n\nAt the beginning of your upkeep, target player loses 1 life. Another target player gains 1 life.\n\nWhenever you and any opponent have the same life total, that opponent is eliminated.",
    image: "/kingdoms/the-mimic.webp",
    set: "advanced-kingdoms",
  },
  {
    id: "ak_the_sellsword",
    name: "The Sellsword",
    family: "renegade",
    text: "Victory — Your teammate wins.",
    secondary:
      "Defeat — You or your teammate are eliminated.\n\nWhen a player Announces, Announce. If you do, starting with the player who triggered this ability, that player bids any amount of life. In turn order, each player may top the high bid. The bidding ends if the high bid stands. The high bidder loses life equal to the high bid and sacrifices a quarter of the lands they control rounded up. Then that player becomes your teammate.",
    image: "/kingdoms/the-sellsword.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_cultist",
    name: "The Cultist",
    family: "renegade",
    text: "Victory — At least half of the starting number of players in the game have Cultist Role cards.",
    secondary:
      "Whenever you eliminate an opponent, instead Announce (turn this card face up to reveal your role). That player's role card becomes a copy of the Cultist except it still has the type King if they were the King. Remove all commander damage and poison counters from that player. Their life total becomes 10.",
    image: "/kingdoms/the-cultist.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_straw_man",
    name: "The Straw Man",
    family: "renegade",
    text: "Victory — You are the first person to be eliminated and another player eliminated you.",
    secondary:
      "Announce (turn this card face up to reveal your role): Until your next turn, creatures your opponents control must attack if able. Activate this ability only on your turn.\n\nAt the beginning of your next upkeep, you have a replacement Victory condition.\n\nVictory — All other players are eliminated.",
    image: "/kingdoms/the-straw-man.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
  {
    id: "ak_the_champion",
    name: "The Champion",
    family: "renegade",
    text: "Victory — The Challenger is eliminated.",
    secondary:
      "When a player has 25 or less life, Announce (turn this card face up to reveal your role). Choose a non-King opponent with the highest life total at random to become the Challenger.\n\nAt the beginning of your upkeep, Scry 1.",
    image: "/kingdoms/the-champion.webp",
    set: "advanced-kingdoms",
    tracksManually: true,
  },
];

export function cardsForFamily(family: RoleFamily): KingdomCard[] {
  return ADVANCED_KINGDOM_CARDS.filter((card) => card.family === family);
}

export function cardById(id: string): KingdomCard | undefined {
  return ADVANCED_KINGDOM_CARDS.find((card) => card.id === id);
}

/**
 * The official composition table from the Advanced Kingdoms setup card.
 *
 * It only covers 5–9 players. Below five the printed game does not run, so we
 * fall back to the classic Kingdoms set and say so in the UI.
 */
export interface AdvancedSetup {
  king: number;
  knight: number;
  bandit: number;
  assassin: number;
  renegade: number;
}

export const ADVANCED_SETUP_BY_SIZE: Record<number, AdvancedSetup> = {
  5: { king: 1, knight: 1, bandit: 0, assassin: 2, renegade: 1 },
  6: { king: 1, knight: 1, bandit: 2, assassin: 2, renegade: 0 },
  7: { king: 1, knight: 1, bandit: 2, assassin: 2, renegade: 1 },
  8: { king: 1, knight: 1, bandit: 2, assassin: 3, renegade: 1 },
  9: { king: 1, knight: 2, bandit: 3, assassin: 3, renegade: 0 },
};

/** The King begins 10 life ahead of the table. */
export const ADVANCED_KING_BONUS = 10;

export const ADVANCED_MIN_PLAYERS = 5;
export const ADVANCED_MAX_PLAYERS = 9;

export function advancedSetupFor(playerCount: number): AdvancedSetup | null {
  return ADVANCED_SETUP_BY_SIZE[playerCount] ?? null;
}

export function setupTotal(setup: AdvancedSetup): number {
  return (
    setup.king + setup.knight + setup.bandit + setup.assassin + setup.renegade
  );
}

export function emptySetup(): AdvancedSetup {
  return { king: 0, knight: 0, bandit: 0, assassin: 0, renegade: 0 };
}

/**
 * Human-readable summary of a composition, e.g. "1 King · 1 Knight · 2
 * Assassins · 1 Renegade". Plurals are handled because the setup card prints
 * them that way and the table reads these out loud.
 */
export function describeSetup(setup: AdvancedSetup): string {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const parts: string[] = [];
  if (setup.king) parts.push(`${setup.king} ${plural(setup.king, "King", "Kings")}`);
  if (setup.knight) parts.push(`${setup.knight} ${plural(setup.knight, "Knight", "Knights")}`);
  if (setup.bandit) parts.push(`${setup.bandit} ${plural(setup.bandit, "Bandit", "Bandits")}`);
  if (setup.assassin)
    parts.push(`${setup.assassin} ${plural(setup.assassin, "Assassin", "Assassins")}`);
  if (setup.renegade)
    parts.push(`${setup.renegade} ${plural(setup.renegade, "Renegade", "Renegades")}`);
  return parts.join(" · ");
}

export type { RoleKey };
