export interface PlaneCard {
  id: string;
  name: string;
  type: "Plane" | "Phenomenon";
  oracleText: string;
  chaosText: string;
}

export const PLANAR_CARDS: PlaneCard[] = [
  {
    id: 'academy-at-tolaria-west',
    name: 'Academy at Tolaria West',
    type: 'Plane',
    oracleText: 'At the beginning of your end step, if you have no cards in hand, draw seven cards.',
    chaosText: 'Whenever chaos ensues, discard your hand.'
  },
  {
    id: 'agyrem',
    name: 'Agyrem',
    type: 'Plane',
    oracleText: 'Whenever a white creature dies, return it to the battlefield under its owner\'s control at the beginning of the next end step. Whenever a nonwhite creature dies, return it to its owner\'s hand at the beginning of the next end step.',
    chaosText: 'Whenever chaos ensues, target creature gains shadow until end of turn.'
  },
  {
    id: 'akoum',
    name: 'Akoum',
    type: 'Plane',
    oracleText: 'Players may cast enchantment spells as though they had flash.',
    chaosText: 'Whenever chaos ensues, destroy target non-enchantment permanent.'
  },
  {
    id: 'aretopolis',
    name: 'Aretopolis',
    type: 'Plane',
    oracleText: 'When you planeswalk to Aretopolis or at the beginning of your upkeep, put a scroll counter on Aretopolis, then draw a card for each scroll counter on it.',
    chaosText: 'Whenever chaos ensues, destroy target permanent with total mana value equal to or less than the number of scroll counters on Aretopolis.'
  },
  {
    id: 'astral-arena',
    name: 'Astral Arena',
    type: 'Plane',
    oracleText: 'No more than one creature can attack each turn. No more than one creature can block each turn.',
    chaosText: 'Whenever chaos ensues, Astral Arena deals 2 damage to each creature.'
  },
  {
    id: 'bant',
    name: 'Bant',
    type: 'Plane',
    oracleText: 'All creatures have exalted. (Whenever a creature attacks alone, it gets +1/+1 until end of turn for each instance of exalted among permanents its controller controls.)',
    chaosText: 'Whenever chaos ensues, target creature gains double strike until end of turn.'
  },
  {
    id: 'bloodhill-bastion',
    name: 'Bloodhill Bastion',
    type: 'Plane',
    oracleText: 'Whenever a creature enters the battlefield, it gains haste until end of turn.',
    chaosText: 'Whenever chaos ensues, gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.'
  },
  {
    id: 'celestine-reef',
    name: 'Celestine Reef',
    type: 'Plane',
    oracleText: 'Spells cost {1} less to cast for each other spell cast before them this turn.',
    chaosText: 'Whenever chaos ensues, target player mills cards equal to the number of spells cast this turn.'
  },
  {
    id: 'cliffside-market',
    name: 'Cliffside Market',
    type: 'Plane',
    oracleText: 'When you planeswalk to Cliffside Market or at the beginning of your upkeep, exchange life totals with target player.',
    chaosText: 'Whenever chaos ensues, exchange control of two target permanents that share a card type.'
  },
  {
    id: 'edge-of-malacol',
    name: 'Edge of Malacol',
    type: 'Plane',
    oracleText: 'Untap all permanents during each player\'s untap step.',
    chaosText: 'Whenever chaos ensues, tap target permanent. It doesn\'t untap during its controller\'s next untap step.'
  },
  {
    id: 'eloren-wilds',
    name: 'Eloren Wilds',
    type: 'Plane',
    oracleText: 'Whenever a player taps a land for mana, that land produces one extra mana of any type that land produced.',
    chaosText: 'Whenever chaos ensues, target player can\'t cast spells this turn.'
  },
  {
    id: 'feeding-grounds',
    name: 'Feeding Grounds',
    type: 'Plane',
    oracleText: 'Green spells cost {2} less to cast.',
    chaosText: 'Whenever chaos ensues, create a 3/3 green Centaur creature token.'
  },
  {
    id: 'fields-of-summer',
    name: 'Fields of Summer',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, that player gains 2 life.',
    chaosText: 'Whenever chaos ensues, you gain 10 life.'
  },
  {
    id: 'furnace-layer',
    name: 'Furnace Layer',
    type: 'Plane',
    oracleText: 'Whenever a player casts a red spell, Furnace Layer deals 2 damage to target creature or player.',
    chaosText: 'Whenever chaos ensues, destroy target artifact.'
  },
  {
    id: 'gavony',
    name: 'Gavony',
    type: 'Plane',
    oracleText: 'All creatures have undying.',
    chaosText: 'Whenever chaos ensues, remove all counters from target permanent.'
  },
  {
    id: 'glen-elendra',
    name: 'Glen Elendra',
    type: 'Plane',
    oracleText: 'At the beginning of the end step, discard your hand.',
    chaosText: 'Whenever chaos ensues, search your library for a card, put it into your hand, then shuffle.'
  },
  {
    id: 'glimmervoid-basin',
    name: 'Glimmervoid Basin',
    type: 'Plane',
    oracleText: 'Whenever a player casts an instant or sorcery spell with a single target, that player copies that spell for each other permanent or player the spell could target. Each copy targets a different one of those permanents and players.',
    chaosText: 'Whenever chaos ensues, choose target instant or sorcery card in a graveyard. Copy it. You may choose new targets for the copy.'
  },
  {
    id: 'goldmeadow',
    name: 'Goldmeadow',
    type: 'Plane',
    oracleText: 'Whenever a land enters the battlefield, its controller creates three 0/1 white Goat creature tokens.',
    chaosText: 'Whenever chaos ensues, create a 0/1 white Goat creature token.'
  },
  {
    id: 'grand-ossuary',
    name: 'Grand Ossuary',
    type: 'Plane',
    oracleText: 'Whenever a creature dies, its controller distributes a number of +1/+1 counters equal to its power among any number of target creatures.',
    chaosText: 'Whenever chaos ensues, each player sacrifices a creature.'
  },
  {
    id: 'grixis',
    name: 'Grixis',
    type: 'Plane',
    oracleText: 'Blue, black, and red creature cards in graveyards have unearth. The unearth cost is equal to the card\'s mana cost.',
    chaosText: 'Whenever chaos ensues, return target creature card from your graveyard to your hand.'
  },
  {
    id: 'grove-of-the-dreampods',
    name: 'Grove of the Dreampods',
    type: 'Plane',
    oracleText: 'When you planeswalk to Grove of the Dreampods or at the beginning of your upkeep, reveal cards from the top of your library until you reveal a creature card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.',
    chaosText: 'Whenever chaos ensues, return target creature card from a graveyard to the battlefield under your control.'
  },
  {
    id: 'hedron-fields-of-agadeem',
    name: 'Hedron Fields of Agadeem',
    type: 'Plane',
    oracleText: 'Creatures with power 7 or greater can\'t attack or block.',
    chaosText: 'Whenever chaos ensues, create a 7/7 colorless Eldrazi creature token.'
  },
  {
    id: 'horizon-boughs',
    name: 'Horizon Boughs',
    type: 'Plane',
    oracleText: 'All lands have "{T}: Add one mana of any color."',
    chaosText: 'Whenever chaos ensues, untap all lands you control.'
  },
  {
    id: 'immersturm',
    name: 'Immersturm',
    type: 'Plane',
    oracleText: 'Whenever a creature enters the battlefield, its controller may have it deal damage equal to its power to target creature or player.',
    chaosText: 'Whenever chaos ensues, create a 1/1 red Goblin creature token.'
  },
  {
    id: 'interplanar-tunnel',
    name: 'Interplanar Tunnel',
    type: 'Phenomenon',
    oracleText: 'When you encounter Interplanar Tunnel, reveal cards from the top of your planar deck until you reveal a plane card. Planeswalk to that plane, then shuffle all other cards revealed this way into your planar deck.',
    chaosText: ''
  },
  {
    id: 'isle-of-vesuva',
    name: 'Isle of Vesuva',
    type: 'Plane',
    oracleText: 'Whenever a nontoken creature enters the battlefield, its controller creates a token that\'s a copy of that creature.',
    chaosText: 'Whenever chaos ensues, destroy target creature and all other creatures with the same name as that creature.'
  },
  {
    id: 'izzet-steam-maze',
    name: 'Izzet Steam Maze',
    type: 'Plane',
    oracleText: 'Whenever a player casts an instant or sorcery spell, that player may copy it. The player may choose new targets for the copy.',
    chaosText: 'Whenever chaos ensues, target instant or sorcery card in your graveyard gains jump-start until end of turn.'
  },
  {
    id: 'jund',
    name: 'Jund',
    type: 'Plane',
    oracleText: 'Whenever a player casts a green, red, or black creature spell, that spell has devour 5.',
    chaosText: 'Whenever chaos ensues, create two 1/1 green Saproling creature tokens.'
  },
  {
    id: 'kessig',
    name: 'Kessig',
    type: 'Plane',
    oracleText: 'Prevent all combat damage that would be dealt by non-Werewolf creatures.',
    chaosText: 'Whenever chaos ensues, destroy target non-Werewolf creature.'
  },
  {
    id: 'kharasha-foothills',
    name: 'Kharasha Foothills',
    type: 'Plane',
    oracleText: 'Whenever a creature attacks, its controller creates a token that\'s a copy of that creature attacking. Sacrifice the token at end of combat.',
    chaosText: 'Whenever chaos ensues, Kharasha Foothills deals 3 damage to target player or planeswalker.'
  },
  {
    id: 'kilnspire-district',
    name: 'Kilnspire District',
    type: 'Plane',
    oracleText: 'When you planeswalk to Kilnspire District or at the beginning of your upkeep, put a charge counter on Kilnspire District. Red spells cost {1} less to cast for each charge counter on Kilnspire District.',
    chaosText: 'Whenever chaos ensues, Kilnspire District deals damage equal to the number of charge counters on it to target player or planeswalker.'
  },
  {
    id: 'krosa',
    name: 'Krosa',
    type: 'Plane',
    oracleText: 'All creature cards that aren\'t on the battlefield, all spells, and all nonland permanents are green.',
    chaosText: 'Whenever chaos ensues, target creature gets +4/+4 and gains trample until end of turn.'
  },
  {
    id: 'lair-of-the-ashen-idol',
    name: 'Lair of the Ashen Idol',
    type: 'Plane',
    oracleText: 'At the beginning of each player\'s upkeep, that player sacrifices a creature unless they pay {2}.',
    chaosText: 'Whenever chaos ensues, create a 1/1 black Spirit creature token with flying.'
  },
  {
    id: 'lethe-lake',
    name: 'Lethe Lake',
    type: 'Plane',
    oracleText: 'At the beginning of each player\'s upkeep, that player mills ten cards.',
    chaosText: 'Whenever chaos ensues, target player puts the top ten cards of their library into their graveyard.'
  },
  {
    id: 'llanowar',
    name: 'Llanowar',
    type: 'Plane',
    oracleText: 'All creature spells cost {2} less to cast.',
    chaosText: 'Whenever chaos ensues, untap all creatures you control.'
  },
  {
    id: 'minamo',
    name: 'Minamo',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, that player may draw a card.',
    chaosText: 'Whenever chaos ensues, draw a card for each nonland permanent you control.'
  },
  {
    id: 'mirrored-depths',
    name: 'Mirrored Depths',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, that player flips a coin. If they lose the flip, counter that spell.',
    chaosText: 'Whenever chaos ensues, target player reveals their hand. You choose a spell from it and copy it. You may choose new targets for the copy.'
  },
  {
    id: 'morphic-tide',
    name: 'Morphic Tide',
    type: 'Phenomenon',
    oracleText: 'When you encounter Morphic Tide, each player sacrifices all permanents they control, then reveals that many cards from the top of their library and puts all permanent cards revealed this way onto the battlefield.',
    chaosText: ''
  },
  {
    id: 'mount-keralia',
    name: 'Mount Keralia',
    type: 'Plane',
    oracleText: 'At the beginning of your end step, put a pressure counter on Mount Keralia. Then Mount Keralia deals damage equal to the number of pressure counters on it to each player and each creature without flying.',
    chaosText: 'Whenever chaos ensues, prevent all damage Mount Keralia would deal this turn.'
  },
  {
    id: 'murasa',
    name: 'Murasa',
    type: 'Plane',
    oracleText: 'Whenever a player plays a land, that player gains 3 life.',
    chaosText: 'Whenever chaos ensues, target land becomes a 4/4 Elemental creature with haste in addition to its other types.'
  },
  {
    id: 'mutual-epiphany',
    name: 'Mutual Epiphany',
    type: 'Phenomenon',
    oracleText: 'When you encounter Mutual Epiphany, each player draws four cards, then planeswalks.',
    chaosText: ''
  },
  {
    id: 'naar-isle',
    name: 'Naar Isle',
    type: 'Plane',
    oracleText: 'At the beginning of your upkeep, put a flame counter on Naar Isle, then Naar Isle deals damage equal to the number of flame counters on it to you.',
    chaosText: 'Whenever chaos ensues, Naar Isle deals 3 damage to target player.'
  },
  {
    id: 'naya',
    name: 'Naya',
    type: 'Plane',
    oracleText: 'You may play any number of additional lands on each of your turns.',
    chaosText: 'Whenever chaos ensues, target creature you control gets +1/+1 for each land you control until end of turn.'
  },
  {
    id: 'nephalia',
    name: 'Nephalia',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, that player puts the top two cards of their library into their graveyard.',
    chaosText: 'Whenever chaos ensues, return target card from your graveyard to your hand.'
  },
  {
    id: 'norn-s-dominion',
    name: 'Norn\'s Dominion',
    type: 'Plane',
    oracleText: 'When you planeswalk to Norn\'s Dominion or at the beginning of your upkeep, choose land or nonland. Tap all permanents of the chosen type target player controls.',
    chaosText: 'Whenever chaos ensues, destroy target tapped permanent.'
  },
{
    id: 'onakke-catacomb',
    name: 'Onakke Catacomb',
    type: 'Plane',
    oracleText: 'All creatures are Black and have deathtouch.',
    chaosText: 'Whenever chaos ensues, target creature gains intimidate until end of turn.'
  },
  {
    id: 'orochi-colony',
    name: 'Orochi Colony',
    type: 'Plane',
    oracleText: 'Whenever a creature deals combat damage to a player, put a +1/+1 counter on it.',
    chaosText: 'Whenever chaos ensues, target creature gets +2/+2 and gains poison 1 until end of turn.'
  },
  {
    id: 'orzhova',
    name: 'Orzhova',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, that player loses 1 life and you gain 1 life.',
    chaosText: 'Whenever chaos ensues, target player loses life equal to the number of permanents they control, and you gain that much life.'
  },
  {
    id: 'otaria',
    name: 'Otaria',
    type: 'Plane',
    oracleText: 'Instant and sorcery cards in all graveyards have flashback. The flashback cost is equal to the card\'s mana cost.',
    chaosText: 'Whenever chaos ensues, take an extra turn after this one.'
  },
  {
    id: 'panopticon',
    name: 'Panopticon',
    type: 'Plane',
    oracleText: 'When you planeswalk to Panopticon or at the beginning of your upkeep, draw a card.',
    chaosText: 'Whenever chaos ensues, draw a card for each player in the game.'
  },
  {
    id: 'planewide-disaster',
    name: 'Planewide Disaster',
    type: 'Phenomenon',
    oracleText: 'When you encounter Planewide Disaster, destroy all creatures, then planeswalk.',
    chaosText: ''
  },
  {
    id: 'pools-of-becoming',
    name: 'Pools of Becoming',
    type: 'Plane',
    oracleText: 'At the beginning of your end step, trigger the chaos ability of the top card of the planar deck.',
    chaosText: 'Whenever chaos ensues, reveal the top three cards of your planar deck. Put one on top and the rest on the bottom.'
  },
  {
    id: 'prahv',
    name: 'Prahv',
    type: 'Plane',
    oracleText: 'If a source would deal damage to a player, prevent 1 of that damage.',
    chaosText: 'Whenever chaos ensues, target player gains 5 life.'
  },
  {
    id: 'quicksilver-sea',
    name: 'Quicksilver Sea',
    type: 'Plane',
    oracleText: 'When you planeswalk to Quicksilver Sea or at the beginning of your upkeep, scry 4.',
    chaosText: 'Whenever chaos ensues, reveal the top card of your library. If it\'s a nonland card, you may cast it without paying its mana cost.'
  },
  {
    id: 'raven-s-run',
    name: 'Raven\'s Run',
    type: 'Plane',
    oracleText: 'All lands are Swamps in addition to their other types.',
    chaosText: 'Whenever chaos ensues, each player loses life equal to the number of Swamps they control.'
  },
  {
    id: 'reality-shaping',
    name: 'Reality Shaping',
    type: 'Phenomenon',
    oracleText: 'When you encounter Reality Shaping, starting with you, each player puts a permanent card from their hand onto the battlefield, then planeswalk.',
    chaosText: ''
  },
  {
    id: 'sanctum-of-serra',
    name: 'Sanctum of Serra',
    type: 'Plane',
    oracleText: 'When you planeswalk away from Sanctum of Serra, destroy all nonland permanents.',
    chaosText: 'Whenever chaos ensues, you gain 7 life.'
  },
  {
    id: 'sea-of-sand',
    name: 'Sea of Sand',
    type: 'Plane',
    oracleText: 'Players draw cards from the bottom of their libraries instead of the top.',
    chaosText: 'Whenever chaos ensues, put target permanent on the bottom of its owner\'s library.'
  },
  {
    id: 'selesnya-loft-gardens',
    name: 'Selesnya Loft Gardens',
    type: 'Plane',
    oracleText: 'If an effect would create one or more tokens, it creates twice that many of those tokens instead.',
    chaosText: 'Whenever chaos ensues, populate.'
  },
  {
    id: 'shiv',
    name: 'Shiv',
    type: 'Plane',
    oracleText: 'All Dragon creatures get +2/+2 and have flying.',
    chaosText: 'Whenever chaos ensues, create a 5/5 red Dragon creature token with flying.'
  },
  {
    id: 'skybreen',
    name: 'Skybreen',
    type: 'Plane',
    oracleText: 'Players play with their hands revealed. Spells with the same name as a revealed card can\'t be cast.',
    chaosText: 'Whenever chaos ensues, target player discards a card of your choice.'
  },
  {
    id: 'sokenzan',
    name: 'Sokenzan',
    type: 'Plane',
    oracleText: 'All creatures gain haste and attack each turn if able.',
    chaosText: 'Whenever chaos ensues, untap all creatures that attacked this turn. After this phase, there is an additional combat phase.'
  },
  {
    id: 'spatial-merging',
    name: 'Spatial Merging',
    type: 'Phenomenon',
    oracleText: 'When you encounter Spatial Merging, reveal the top two plane cards of the planar deck. You planeswalk to both simultaneously.',
    chaosText: ''
  },
  {
    id: 'stairs-to-infinity',
    name: 'Stairs to Infinity',
    type: 'Plane',
    oracleText: 'At the beginning of your end step, draw a card for each time you rolled the planar die this turn.',
    chaosText: 'Whenever chaos ensues, roll the planar die.'
  },
  {
    id: 'stensia',
    name: 'Stensia',
    type: 'Plane',
    oracleText: 'Whenever a creature dies, put a +1/+1 counter on each Vampire creature you control.',
    chaosText: 'Whenever chaos ensues, target Vampire creature you control gets +3/+3 and gains lifelink until end of turn.'
  },
  {
    id: 'stronghold-furnace',
    name: 'Stronghold Furnace',
    type: 'Plane',
    oracleText: 'If a source would deal damage to a creature or player, it deals double that damage to that creature or player instead.',
    chaosText: 'Whenever chaos ensues, Stronghold Furnace deals 1 damage to each creature and player.'
  },
  {
    id: 'takenuma',
    name: 'Takenuma',
    type: 'Plane',
    oracleText: 'Whenever a creature dies, its controller loses 1 life.',
    chaosText: 'Whenever chaos ensues, return target creature card from a graveyard to the battlefield under your control.'
  },
  {
    id: 'talon-gates',
    name: 'Talon Gates',
    type: 'Plane',
    oracleText: 'When you planeswalk to Talon Gates or at the beginning of your upkeep, exile target nonland permanent until Talon Gates is planeswalked away from.',
    chaosText: 'Whenever chaos ensues, choose target nonland permanent. Its controller exiles it, then suspends it with two time counters.'
  },
  {
    id: 'tazeem',
    name: 'Tazeem',
    type: 'Plane',
    oracleText: 'Creatures without flying can\'t block.',
    chaosText: 'Whenever chaos ensues, target creature gains flying permanently.'
  },
  {
    id: 'tember-city',
    name: 'Tember City',
    type: 'Plane',
    oracleText: 'Whenever a player casts a spell, Tember City deals damage equal to that spell\'s mana value to each creature.',
    chaosText: 'Whenever chaos ensues, Tember City deals 3 damage to target player.'
  },
  {
    id: 'the-aether-flues',
    name: 'The Aether Flues',
    type: 'Plane',
    oracleText: 'When you planeswalk to The Aether Flues or at the beginning of your upkeep, sacrifice a creature. If you do, reveal cards from the top of your library until you reveal a creature card, put that card onto the battlefield, then shuffle.',
    chaosText: 'Whenever chaos ensues, target player sacrifices a creature.'
  },
  {
    id: 'the-dark-barony',
    name: 'The Dark Barony',
    type: 'Plane',
    oracleText: 'Whenever a nonblack creature dies, return it to the battlefield under its owner\'s control at the beginning of the next end step.',
    chaosText: 'Whenever chaos ensues, target player discards a card.'
  },
  {
    id: 'the-eon-fog',
    name: 'The Eon Fog',
    type: 'Plane',
    oracleText: 'Players skip their untap steps.',
    chaosText: 'Whenever chaos ensues, untap all permanents you control.'
  },
  {
    id: 'the-fourth-sphere',
    name: 'The Fourth Sphere',
    type: 'Plane',
    oracleText: 'At the beginning of your upkeep, sacrifice a non-Demon creature.',
    chaosText: 'Whenever chaos ensues, create a 5/5 black Demon creature token with flying.'
  },
  {
    id: 'the-great-forest',
    name: 'The Great Forest',
    type: 'Plane',
    oracleText: 'Each creature gets +1/+1 for each other creature on the battlefield that shares a creature type with it.',
    chaosText: 'Whenever chaos ensues, target creature gets +3/+3 until end of turn.'
  },
  {
    id: 'the-hippodrome',
    name: 'The Hippodrome',
    type: 'Plane',
    oracleText: 'All creatures get -2/-0.',
    chaosText: 'Whenever chaos ensues, destroy target creature with power 0 or less.'
  },
  {
    id: 'the-maelstrom',
    name: 'The Maelstrom',
    type: 'Plane',
    oracleText: 'When you planeswalk to The Maelstrom or at the beginning of your upkeep, reveal top cards of your library until you reveal a permanent card. Put it onto the battlefield, then shuffle.',
    chaosText: 'Whenever chaos ensues, target player loses 3 life.'
  },
  {
    id: 'the-zephyr-maze',
    name: 'The Zephyr Maze',
    type: 'Plane',
    oracleText: 'Creatures with flying get +2/+0. Creatures without flying get -2/-0.',
    chaosText: 'Whenever chaos ensues, target creature gains flying until end of turn.'
  },
  {
    id: 'time-distortion',
    name: 'Time Distortion',
    type: 'Phenomenon',
    oracleText: 'When you encounter Time Distortion, turn order is reversed, then planeswalk.',
    chaosText: ''
  },
  {
    id: 'trail-of-the-mage-rings',
    name: 'Trail of the Mage-Rings',
    type: 'Plane',
    oracleText: 'Instant and sorcery spells have rebound.',
    chaosText: 'Whenever chaos ensues, target instant or sorcery card in your graveyard gains rebound until end of turn.'
  },
  {
    id: 'truga-jungle',
    name: 'Truga Jungle',
    type: 'Plane',
    oracleText: 'All lands have "{T}: Add two mana of any one color."',
    chaosText: 'Whenever chaos ensues, reveal the top card of your library. If it\'s a land card, put it onto the battlefield.'
  },
  {
    id: 'turri-island',
    name: 'Turri Island',
    type: 'Plane',
    oracleText: 'Creature spells cost {2} less to cast.',
    chaosText: 'Whenever chaos ensues, reveal the top card of your library. If it\'s a creature card, put it onto the battlefield.'
  },
  {
    id: 'undercity-reaches',
    name: 'Undercity Reaches',
    type: 'Plane',
    oracleText: 'Whenever a creature deals combat damage to a player, its controller draws a card.',
    chaosText: 'Whenever chaos ensues, target creature can\'t be blocked this turn.'
  },
  {
    id: 'velis-vel',
    name: 'Velis Vel',
    type: 'Plane',
    oracleText: 'Each creature gets +1/+1 and has all creature types.',
    chaosText: 'Whenever chaos ensues, target creature gains all creature types permanently.'
  },
  {
    id: 'windriddle-palaces',
    name: 'Windriddle Palaces',
    type: 'Plane',
    oracleText: 'Each player plays with the top card of their library revealed. You may play the top card of any player\'s library.',
    chaosText: 'Whenever chaos ensues, each player mills a card.'
  }
];