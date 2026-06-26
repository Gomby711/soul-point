import type { BuildType } from "@/hooks/useChampionData";

export interface ItemRef { id: number; name: string }

export interface ItemOption {
  item: ItemRef;
  pickRate: number;
  games: number;
  winRate: number;
}

export interface CoreOption {
  items: ItemRef[];
  pickRate: number;
  games: number;
  winRate: number;
}

export interface StarterOption {
  items: ItemRef[];
  pickRate: number;
  games: number;
  winRate: number;
}

export interface BootOption {
  item: ItemRef;
  pickRate: number;
  games: number;
  winRate: number;
}

export interface BuildEntry {
  rank: string;
  rankLabel: string;
  buildName: string;
  buildDesc: string;
  recommended?: boolean;
  winRate: number;
  pickRate: number;
  games: number;
  boots: ItemRef;
  items: ItemRef[];
  startItems: ItemRef[];
  optionalItems: ItemRef[];
  runes: { keystone: string; primary: string; secondary: string; primaryRunes?: string[]; secondaryRunes?: string[] };
  spells: string[];
  spellIds: number[];
  skillOrder: string;
  levelOrder: string[];    // exactly 18 elements
  starterOptions: StarterOption[];
  bootsOptions: BootOption[];
  coreOptions: CoreOption[];
  fourthOptions: ItemOption[];
  fifthOptions: ItemOption[];
  sixthOptions: ItemOption[];
}

// ── Item pools ────────────────────────────────────────────────
const ITEMS: Record<string, ItemRef> = {
  // Boots
  sorcShoes:     { id: 3020, name: "Sorcerer's Shoes"      },
  berserkers:    { id: 3006, name: "Berserker's Greaves"    },
  steelcaps:     { id: 3047, name: "Plated Steelcaps"       },
  mercTreads:    { id: 3111, name: "Mercury's Treads"       },
  ionian:        { id: 3158, name: "Ionian Boots of Lucidity"},
  mobility:      { id: 3117, name: "Boots of Mobility"      },
  swiftness:     { id: 3009, name: "Boots of Swiftness"     },
  // AP
  ludens:        { id: 6655, name: "Luden's Companion"      },
  shadowflame:   { id: 4645, name: "Shadowflame"            },
  deathcap:      { id: 3089, name: "Rabadon's Deathcap"     },
  voidStaff:     { id: 3135, name: "Void Staff"             },
  zhonyas:       { id: 3157, name: "Zhonya's Hourglass"     },
  morell:        { id: 3165, name: "Morellonomicon"          },
  cryptbloom:    { id: 6620, name: "Cryptbloom"             },
  nashors:       { id: 3115, name: "Nashor's Tooth"         },
  rylais:        { id: 3116, name: "Rylai's Crystal Scepter"},
  everfrost:     { id: 3907, name: "Everfrost"              },
  banshees:      { id: 3102, name: "Banshee's Veil"         },
  seraPh:        { id: 3040, name: "Seraph's Embrace"       },
  horizon:       { id: 4628, name: "Horizon Focus"          },
  // ADC
  ie:            { id: 3031, name: "Infinity Edge"           },
  galeforce:     { id: 6671, name: "Galeforce"              },
  kraken:        { id: 6672, name: "Kraken Slayer"          },
  bt:            { id: 3072, name: "Bloodthirster"           },
  shieldbow:     { id: 6673, name: "Immortal Shieldbow"     },
  navori:        { id: 6694, name: "Navori Quickblades"     },
  rfc:           { id: 3094, name: "Rapid Firecannon"       },
  ldr:           { id: 3036, name: "Lord Dominik's Regards" },
  mortalRem:     { id: 3033, name: "Mortal Reminder"        },
  witEnd:        { id: 3091, name: "Wit's End"              },
  runaan:        { id: 3085, name: "Runaan's Hurricane"     },
  collector:     { id: 6676, name: "The Collector"          },
  // Fighter / Bruiser
  trinity:       { id: 3078, name: "Trinity Force"          },
  stridebreaker: { id: 6631, name: "Stridebreaker"          },
  blackCleaver:  { id: 3071, name: "Black Cleaver"          },
  deathsDance:   { id: 6333, name: "Death's Dance"          },
  steraks:       { id: 3053, name: "Sterak's Gage"          },
  hydra:         { id: 3074, name: "Ravenous Hydra"         },
  divineSund:    { id: 6632, name: "Divine Sunderer"        },
  titanicHyd:    { id: 3748, name: "Titanic Hydra"          },
  sunfire:       { id: 3068, name: "Sunfire Aegis"          },
  shojin:        { id: 3161, name: "Spear of Shojin"        },
  maw:           { id: 3156, name: "Maw of Malmortius"      },
  goredrinker:   { id: 6630, name: "Goredrinker"            },
  // Tank
  thornmail:     { id: 3075, name: "Thornmail"              },
  warmogs:       { id: 3083, name: "Warmog's Armor"         },
  gargoyle:      { id: 3193, name: "Gargoyle Stoneplate"    },
  ibg:           { id: 3110, name: "Iceborn Gauntlet"       },
  fon:           { id: 4401, name: "Force of Nature"        },
  heartsteel:    { id: 3459, name: "Heartsteel"             },
  jaksho:        { id: 6656, name: "Jak'Sho, The Protean"  },
  abyssalMask:   { id: 3001, name: "Abyssal Mask"           },
  // AD Assassin
  duskblade:     { id: 6691, name: "Duskblade of Draktharr"},
  edgeOfNight:   { id: 6692, name: "Edge of Night"          },
  youmuus:       { id: 3142, name: "Youmuu's Ghostblade"   },
  serp:          { id: 3814, name: "Serpent's Fang"         },
  axiom:         { id: 6697, name: "Axiom Arc"              },
  // Support
  shurelyas:     { id: 2065, name: "Shurelya's Battlesong" },
  redemption:    { id: 3107, name: "Redemption"             },
  locket:        { id: 3190, name: "Locket of Iron Solari"  },
  knightsVow:    { id: 3109, name: "Knight's Vow"           },
  zekes:         { id: 3050, name: "Zeke's Convergence"     },
  mandate:       { id: 4005, name: "Imperial Mandate"       },
  ardent:        { id: 3504, name: "Ardent Censer"          },
  staffFlow:     { id: 3850, name: "Staff of Flowing Water" },
  moonstone:     { id: 6616, name: "Moonstone Renewer"      },
  // Starters
  dorans:        { id: 1055, name: "Doran's Blade"          },
  doransRing:    { id: 1056, name: "Doran's Ring"           },
  doransShield:  { id: 1054, name: "Doran's Shield"         },
  longSword:     { id: 1036, name: "Long Sword"             },
  amplifyingTome:{ id: 1052, name: "Amplifying Tome"        },
  faerieCharm:   { id: 1004, name: "Faerie Charm"           },
  wards:         { id: 2055, name: "Control Ward"           },
};

// ── Spell data ────────────────────────────────────────────────
// Numeric IDs map to in-game spell IDs for DDragon icon lookup
export const SUMMONER_SPELLS: Record<string, { id: number; key: string }> = {
  Flash:     { id: 4,  key: "SummonerFlash"     },
  Ignite:    { id: 14, key: "SummonerDot"        },
  Teleport:  { id: 12, key: "SummonerTeleport"  },
  Heal:      { id: 7,  key: "SummonerHeal"       },
  Exhaust:   { id: 3,  key: "SummonerExhaust"   },
  Smite:     { id: 11, key: "SummonerSmite"     },
  Barrier:   { id: 21, key: "SummonerBarrier"   },
  Ghost:     { id: 6,  key: "SummonerHaste"     },
  Cleanse:   { id: 1,  key: "SummonerBoost"     },
};

// ── Rune pools per archetype ──────────────────────────────────
const RUNES: Record<BuildType, { keystone: string; primary: string; secondary: string }[]> = {
  MAGE:            [{ keystone: "Arcane Comet",        primary: "Sorcery",    secondary: "Domination" },
                    { keystone: "Phase Rush",           primary: "Sorcery",    secondary: "Inspiration"},
                    { keystone: "Electrocute",          primary: "Domination", secondary: "Sorcery"   }],
  AP_ASSASSIN:     [{ keystone: "Electrocute",         primary: "Domination", secondary: "Sorcery"   },
                    { keystone: "Dark Harvest",         primary: "Domination", secondary: "Precision" },
                    { keystone: "Phase Rush",           primary: "Sorcery",    secondary: "Domination"}],
  AD_ASSASSIN:     [{ keystone: "Electrocute",         primary: "Domination", secondary: "Precision" },
                    { keystone: "Dark Harvest",         primary: "Domination", secondary: "Sorcery"  },
                    { keystone: "Conqueror",            primary: "Precision",  secondary: "Domination"}],
  MARKSMAN:        [{ keystone: "Lethal Tempo",        primary: "Precision",  secondary: "Domination"},
                    { keystone: "Fleet Footwork",       primary: "Precision",  secondary: "Resolve"  },
                    { keystone: "Press the Attack",     primary: "Precision",  secondary: "Domination"}],
  FIGHTER:         [{ keystone: "Conqueror",           primary: "Precision",  secondary: "Resolve"   },
                    { keystone: "Lethal Tempo",         primary: "Precision",  secondary: "Resolve"  },
                    { keystone: "Grasp of the Undying", primary: "Resolve",    secondary: "Precision" }],
  BRUISER:         [{ keystone: "Conqueror",           primary: "Precision",  secondary: "Resolve"   },
                    { keystone: "Grasp of the Undying", primary: "Resolve",   secondary: "Precision" },
                    { keystone: "Fleet Footwork",       primary: "Precision",  secondary: "Resolve"  }],
  TANK:            [{ keystone: "Grasp of the Undying",primary: "Resolve",    secondary: "Precision" },
                    { keystone: "Aftershock",           primary: "Resolve",    secondary: "Inspiration"},
                    { keystone: "Glacial Augment",      primary: "Inspiration",secondary: "Resolve"  }],
  SUPPORT_AP:      [{ keystone: "Arcane Comet",        primary: "Sorcery",    secondary: "Resolve"   },
                    { keystone: "Electrocute",          primary: "Domination", secondary: "Sorcery"  },
                    { keystone: "Summon Aery",          primary: "Sorcery",    secondary: "Inspiration"}],
  SUPPORT_TANK:    [{ keystone: "Aftershock",          primary: "Resolve",    secondary: "Inspiration"},
                    { keystone: "Glacial Augment",      primary: "Inspiration",secondary: "Resolve"  },
                    { keystone: "Grasp of the Undying", primary: "Resolve",   secondary: "Inspiration"}],
  ENCHANTER:       [{ keystone: "Summon Aery",         primary: "Sorcery",    secondary: "Inspiration"},
                    { keystone: "Arcane Comet",         primary: "Sorcery",    secondary: "Resolve"  },
                    { keystone: "Glacial Augment",      primary: "Inspiration",secondary: "Sorcery"  }],
  JUNGLE_ASSASSIN: [{ keystone: "Dark Harvest",        primary: "Domination", secondary: "Precision" },
                    { keystone: "Electrocute",          primary: "Domination", secondary: "Sorcery"  },
                    { keystone: "Conqueror",            primary: "Precision",  secondary: "Domination"}],
  JUNGLE_FIGHTER:  [{ keystone: "Conqueror",           primary: "Precision",  secondary: "Resolve"   },
                    { keystone: "Grasp of the Undying", primary: "Resolve",   secondary: "Precision" },
                    { keystone: "Lethal Tempo",         primary: "Precision",  secondary: "Resolve"  }],
  AP_FIGHTER:      [{ keystone: "Conqueror",           primary: "Precision",  secondary: "Sorcery"   },
                    { keystone: "Phase Rush",           primary: "Sorcery",    secondary: "Resolve"  },
                    { keystone: "Electrocute",          primary: "Domination", secondary: "Sorcery"  }],
};

const SPELLS: Record<BuildType, { names: string[]; ids: number[] }[]> = {
  MAGE:            [{ names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] },
                    { names: ["Flash", "Teleport"],  ids: [4, 12] }],
  AP_ASSASSIN:     [{ names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] }],
  AD_ASSASSIN:     [{ names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Ghost"],     ids: [4, 6]  }],
  MARKSMAN:        [{ names: ["Flash", "Heal"],      ids: [4, 7]  },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] },
                    { names: ["Flash", "Cleanse"],   ids: [4, 1]  }],
  FIGHTER:         [{ names: ["Flash", "Teleport"],  ids: [4, 12] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Ghost", "Teleport"],  ids: [6, 12] }],
  BRUISER:         [{ names: ["Flash", "Teleport"],  ids: [4, 12] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Ghost", "Ignite"],    ids: [6, 14] }],
  TANK:            [{ names: ["Flash", "Teleport"],  ids: [4, 12] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Ghost", "Teleport"],  ids: [6, 12] }],
  SUPPORT_AP:      [{ names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Exhaust"],   ids: [4, 3]  },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] }],
  SUPPORT_TANK:    [{ names: ["Flash", "Exhaust"],   ids: [4, 3]  },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] }],
  ENCHANTER:       [{ names: ["Flash", "Exhaust"],   ids: [4, 3]  },
                    { names: ["Flash", "Barrier"],   ids: [4, 21] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] }],
  JUNGLE_ASSASSIN: [{ names: ["Smite", "Flash"],     ids: [11, 4] },
                    { names: ["Smite", "Flash"],     ids: [11, 4] },
                    { names: ["Smite", "Ignite"],    ids: [11, 14]}],
  JUNGLE_FIGHTER:  [{ names: ["Smite", "Flash"],     ids: [11, 4] },
                    { names: ["Smite", "Ghost"],     ids: [11, 6] },
                    { names: ["Smite", "Flash"],     ids: [11, 4] }],
  AP_FIGHTER:      [{ names: ["Flash", "Teleport"],  ids: [4, 12] },
                    { names: ["Flash", "Ignite"],    ids: [4, 14] },
                    { names: ["Ghost", "Teleport"],  ids: [6, 12] }],
};

// ── Level 1-18 skill order generators ───────────────────────
// Each string is Q/W/E/R for that level
function mkLevelOrder(max1: string, max2: string, max3: string): string[] {
  // R at 6, 11, 16. Primary gets levels 2,4,5,7,8,9. Secondary gets 3,10,12,13. Tertiary gets the rest.
  const order = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  const abilities: Record<string, number[]> = { Q: [], W: [], E: [], R: [] };

  // Place R first
  abilities.R = [5, 10, 15]; // 0-indexed levels 6,11,16

  // Fill primary (max1) at levels that aren't R, prioritized
  const remaining: number[] = [];
  for (let i = 0; i < 18; i++) {
    if (!abilities.R.includes(i)) remaining.push(i);
  }

  // Primary: gets 5 levels (or until 9 for Q max)
  const primaryLevels = remaining.slice(0, 5);
  abilities[max1] = primaryLevels;

  const after = remaining.slice(5);
  // Secondary: 5 levels
  abilities[max2] = after.slice(0, 5);
  // Tertiary: all remaining levels (5 slots, filling levels 17 & 18)
  abilities[max3] = after.slice(5);

  // Also need level 1 pick (always max1) and level 2 (usually max2 or max3 for early point)
  // Override: level 0 = max1, level 1 = max2 (often), but keep it simple
  // Sort each ability's levels and assign to order array
  for (const [ab, levels] of Object.entries(abilities)) {
    for (const lvl of levels) {
      if (lvl >= 0 && lvl < 18) order[lvl] = ab;
    }
  }

  return order;
}

const LEVEL_ORDERS: Record<BuildType, string[][]> = {
  MAGE:            [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("W", "Q", "E"),
  ],
  AP_ASSASSIN:     [
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("E", "Q", "W"),
  ],
  AD_ASSASSIN:     [
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("E", "Q", "W"),
  ],
  MARKSMAN:        [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("E", "Q", "W"),
  ],
  FIGHTER:         [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("E", "Q", "W"),
  ],
  BRUISER:         [
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("E", "Q", "W"),
  ],
  TANK:            [
    mkLevelOrder("W", "Q", "E"),
    mkLevelOrder("E", "W", "Q"),
    mkLevelOrder("Q", "W", "E"),
  ],
  SUPPORT_AP:      [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("W", "Q", "E"),
  ],
  SUPPORT_TANK:    [
    mkLevelOrder("E", "W", "Q"),
    mkLevelOrder("W", "E", "Q"),
    mkLevelOrder("E", "Q", "W"),
  ],
  ENCHANTER:       [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("W", "Q", "E"),
    mkLevelOrder("E", "Q", "W"),
  ],
  JUNGLE_ASSASSIN: [
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("E", "Q", "W"),
  ],
  JUNGLE_FIGHTER:  [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("Q", "E", "W"),
    mkLevelOrder("W", "Q", "E"),
  ],
  AP_FIGHTER:      [
    mkLevelOrder("Q", "W", "E"),
    mkLevelOrder("W", "Q", "E"),
    mkLevelOrder("E", "Q", "W"),
  ],
};

// Compact skill order string from levelOrder array
function compactOrder(lo: string[]): string {
  // Find which ability is maxed first (most appearances in 1-9 range excluding R)
  const counts: Record<string, number> = { Q: 0, W: 0, E: 0 };
  lo.slice(0, 9).forEach(a => { if (a in counts) counts[a]++; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return sorted.join(" → ");
}

// ── Optional/situational item pools per archetype ─────────────
const OPTIONAL_ITEMS: Record<BuildType, ItemRef[]> = {
  MAGE:            [ITEMS.rylais, ITEMS.seraPh, ITEMS.everfrost, ITEMS.banshees, ITEMS.horizon, ITEMS.morell],
  AP_ASSASSIN:     [ITEMS.seraPh, ITEMS.everfrost, ITEMS.banshees, ITEMS.rylais, ITEMS.cryptbloom],
  AD_ASSASSIN:     [ITEMS.maw, ITEMS.steraks, ITEMS.axiom, ITEMS.serp, ITEMS.collector],
  MARKSMAN:        [ITEMS.rfc, ITEMS.witEnd, ITEMS.mortalRem, ITEMS.bt, ITEMS.runaan, ITEMS.shieldbow],
  FIGHTER:         [ITEMS.shojin, ITEMS.hydra, ITEMS.divineSund, ITEMS.titanicHyd, ITEMS.fon, ITEMS.warmogs],
  BRUISER:         [ITEMS.shojin, ITEMS.fon, ITEMS.goredrinker, ITEMS.maw, ITEMS.warmogs, ITEMS.ibg],
  TANK:            [ITEMS.abyssalMask, ITEMS.jaksho, ITEMS.ibg, ITEMS.fon, ITEMS.zekes, ITEMS.knightsVow],
  SUPPORT_AP:      [ITEMS.banshees, ITEMS.cryptbloom, ITEMS.seraPh, ITEMS.everfrost, ITEMS.morell],
  SUPPORT_TANK:    [ITEMS.zekes, ITEMS.redemption, ITEMS.knightsVow, ITEMS.fon, ITEMS.abyssalMask],
  ENCHANTER:       [ITEMS.zekes, ITEMS.knightsVow, ITEMS.cryptbloom, ITEMS.banshees, ITEMS.morell],
  JUNGLE_ASSASSIN: [ITEMS.axiom, ITEMS.maw, ITEMS.collector, ITEMS.witEnd, ITEMS.trinity],
  JUNGLE_FIGHTER:  [ITEMS.shojin, ITEMS.hydra, ITEMS.fon, ITEMS.deathsDance, ITEMS.jaksho],
  AP_FIGHTER:      [ITEMS.seraPh, ITEMS.rylais, ITEMS.banshees, ITEMS.cryptbloom, ITEMS.nashors],
};

// ── Build variations per archetype ───────────────────────────
interface BuildVariant {
  name: string;
  desc: string;
  boots: ItemRef;
  items: ItemRef[];
  startItems: ItemRef[];
}

const BUILD_VARIANTS: Record<BuildType, BuildVariant[]> = {
  MAGE: [
    { name: "Burst",       desc: "Max damage burst combo",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.doransRing],
      items: [ITEMS.ludens, ITEMS.shadowflame, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.zhonyas] },
    { name: "Poke",        desc: "Sustained poke & healing",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.doransRing, ITEMS.amplifyingTome],
      items: [ITEMS.horizon, ITEMS.shadowflame, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.banshees] },
    { name: "Safe",        desc: "Defensive setup vs assassins",
      boots: ITEMS.mercTreads, startItems: [ITEMS.doransRing],
      items: [ITEMS.banshees, ITEMS.shadowflame, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.zhonyas] },
  ],
  AP_ASSASSIN: [
    { name: "Standard",   desc: "Core assassin burst",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.doransRing],
      items: [ITEMS.shadowflame, ITEMS.zhonyas, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.cryptbloom] },
    { name: "Snowball",   desc: "High risk, high reward",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.amplifyingTome],
      items: [ITEMS.shadowflame, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.cryptbloom, ITEMS.zhonyas] },
    { name: "Sustain",    desc: "Trading-heavy pattern",
      boots: ITEMS.mercTreads, startItems: [ITEMS.doransRing],
      items: [ITEMS.banshees, ITEMS.shadowflame, ITEMS.deathcap, ITEMS.zhonyas, ITEMS.voidStaff] },
  ],
  AD_ASSASSIN: [
    { name: "Lethality",  desc: "Full lethality burst",
      boots: ITEMS.ionian, startItems: [ITEMS.longSword],
      items: [ITEMS.duskblade, ITEMS.edgeOfNight, ITEMS.youmuus, ITEMS.serp, ITEMS.ldr] },
    { name: "Crit",       desc: "Crit + lethality hybrid",
      boots: ITEMS.ionian, startItems: [ITEMS.dorans],
      items: [ITEMS.youmuus, ITEMS.ie, ITEMS.edgeOfNight, ITEMS.collector, ITEMS.ldr] },
    { name: "Survivability", desc: "Safer extended fights",
      boots: ITEMS.steelcaps, startItems: [ITEMS.longSword],
      items: [ITEMS.duskblade, ITEMS.maw, ITEMS.edgeOfNight, ITEMS.steraks, ITEMS.ldr] },
  ],
  MARKSMAN: [
    { name: "Crit",       desc: "Max crit damage output",
      boots: ITEMS.berserkers, startItems: [ITEMS.dorans],
      items: [ITEMS.ie, ITEMS.galeforce, ITEMS.kraken, ITEMS.navori, ITEMS.ldr] },
    { name: "Shieldbow",  desc: "Safe all-in fighter",
      boots: ITEMS.berserkers, startItems: [ITEMS.dorans],
      items: [ITEMS.shieldbow, ITEMS.ie, ITEMS.kraken, ITEMS.navori, ITEMS.mortalRem] },
    { name: "On-Hit",     desc: "Attack speed & on-hit",
      boots: ITEMS.berserkers, startItems: [ITEMS.dorans],
      items: [ITEMS.kraken, ITEMS.witEnd, ITEMS.runaan, ITEMS.mortalRem, ITEMS.bt] },
  ],
  FIGHTER: [
    { name: "Trinity",    desc: "Spellblade brawler",
      boots: ITEMS.steelcaps, startItems: [ITEMS.dorans],
      items: [ITEMS.trinity, ITEMS.steraks, ITEMS.blackCleaver, ITEMS.deathsDance, ITEMS.maw] },
    { name: "Cleaver",    desc: "Shred & sustained damage",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.blackCleaver, ITEMS.steraks, ITEMS.deathsDance, ITEMS.maw, ITEMS.hydra] },
    { name: "Sustain",    desc: "HP & lifesteal combo",
      boots: ITEMS.steelcaps, startItems: [ITEMS.dorans],
      items: [ITEMS.goredrinker, ITEMS.steraks, ITEMS.blackCleaver, ITEMS.deathsDance, ITEMS.maw] },
  ],
  BRUISER: [
    { name: "Trinity",    desc: "Spellblade tank hybrid",
      boots: ITEMS.steelcaps, startItems: [ITEMS.dorans],
      items: [ITEMS.trinity, ITEMS.steraks, ITEMS.hydra, ITEMS.deathsDance, ITEMS.blackCleaver] },
    { name: "Sunderer",   desc: "Anti-tank shred",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.divineSund, ITEMS.steraks, ITEMS.titanicHyd, ITEMS.deathsDance, ITEMS.blackCleaver] },
    { name: "Grasp",      desc: "Grasp + health scaling",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.heartsteel, ITEMS.titanicHyd, ITEMS.steraks, ITEMS.warmogs, ITEMS.thornmail] },
  ],
  TANK: [
    { name: "Standard",   desc: "Core front-line tank",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.sunfire, ITEMS.ibg, ITEMS.warmogs, ITEMS.thornmail, ITEMS.gargoyle] },
    { name: "Heartsteel", desc: "Stacking HP tank",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.heartsteel, ITEMS.titanicHyd, ITEMS.warmogs, ITEMS.thornmail, ITEMS.gargoyle] },
    { name: "MR",         desc: "Anti-mage front-line",
      boots: ITEMS.mercTreads, startItems: [ITEMS.doransShield],
      items: [ITEMS.fon, ITEMS.abyssalMask, ITEMS.warmogs, ITEMS.ibg, ITEMS.gargoyle] },
  ],
  SUPPORT_AP: [
    { name: "Burst",      desc: "Poke & burst support",
      boots: ITEMS.ionian, startItems: [ITEMS.doransRing],
      items: [ITEMS.ludens, ITEMS.shadowflame, ITEMS.redemption, ITEMS.zhonyas, ITEMS.deathcap] },
    { name: "Zone Control",desc: "AoE crowd control",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.doransRing],
      items: [ITEMS.rylais, ITEMS.shadowflame, ITEMS.morell, ITEMS.banshees, ITEMS.deathcap] },
    { name: "Safe",       desc: "Utility for team fights",
      boots: ITEMS.ionian, startItems: [ITEMS.doransRing, ITEMS.faerieCharm],
      items: [ITEMS.mandate, ITEMS.redemption, ITEMS.shadowflame, ITEMS.zhonyas, ITEMS.deathcap] },
  ],
  SUPPORT_TANK: [
    { name: "Engage",     desc: "Hard engage & peel",
      boots: ITEMS.mobility, startItems: [ITEMS.doransShield, ITEMS.wards],
      items: [ITEMS.locket, ITEMS.knightsVow, ITEMS.thornmail, ITEMS.warmogs, ITEMS.gargoyle] },
    { name: "Aftershock",  desc: "CC into tank stats",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield, ITEMS.wards],
      items: [ITEMS.ibg, ITEMS.locket, ITEMS.thornmail, ITEMS.warmogs, ITEMS.gargoyle] },
    { name: "Utility",    desc: "Roam-heavy playmaking",
      boots: ITEMS.mobility, startItems: [ITEMS.doransShield, ITEMS.wards],
      items: [ITEMS.shurelyas, ITEMS.locket, ITEMS.redemption, ITEMS.warmogs, ITEMS.thornmail] },
  ],
  ENCHANTER: [
    { name: "Healing",    desc: "Max healing output",
      boots: ITEMS.ionian, startItems: [ITEMS.faerieCharm, ITEMS.wards],
      items: [ITEMS.shurelyas, ITEMS.redemption, ITEMS.ardent, ITEMS.staffFlow, ITEMS.locket] },
    { name: "Mandate",    desc: "Poke + empower carries",
      boots: ITEMS.ionian, startItems: [ITEMS.faerieCharm, ITEMS.wards],
      items: [ITEMS.mandate, ITEMS.ardent, ITEMS.redemption, ITEMS.staffFlow, ITEMS.moonstone] },
    { name: "Moonstone",  desc: "Sustained teamfight heals",
      boots: ITEMS.ionian, startItems: [ITEMS.faerieCharm, ITEMS.wards],
      items: [ITEMS.moonstone, ITEMS.redemption, ITEMS.ardent, ITEMS.staffFlow, ITEMS.shurelyas] },
  ],
  JUNGLE_ASSASSIN: [
    { name: "Lethality",  desc: "One-shot from stealth",
      boots: ITEMS.ionian, startItems: [ITEMS.longSword],
      items: [ITEMS.duskblade, ITEMS.edgeOfNight, ITEMS.youmuus, ITEMS.ldr, ITEMS.serp] },
    { name: "Dark Harvest",desc: "Snowball stacking",
      boots: ITEMS.ionian, startItems: [ITEMS.longSword],
      items: [ITEMS.youmuus, ITEMS.duskblade, ITEMS.collector, ITEMS.axiom, ITEMS.serp] },
    { name: "Tanky",      desc: "Assassin with survivability",
      boots: ITEMS.steelcaps, startItems: [ITEMS.longSword],
      items: [ITEMS.duskblade, ITEMS.maw, ITEMS.edgeOfNight, ITEMS.steraks, ITEMS.blackCleaver] },
  ],
  JUNGLE_FIGHTER: [
    { name: "Stridebreaker",desc: "Mobility + burst",
      boots: ITEMS.steelcaps, startItems: [ITEMS.dorans],
      items: [ITEMS.stridebreaker, ITEMS.steraks, ITEMS.blackCleaver, ITEMS.sunfire, ITEMS.deathsDance] },
    { name: "Tank",       desc: "Frontline jungle presence",
      boots: ITEMS.steelcaps, startItems: [ITEMS.doransShield],
      items: [ITEMS.sunfire, ITEMS.ibg, ITEMS.steraks, ITEMS.warmogs, ITEMS.thornmail] },
    { name: "Lethality",  desc: "Aggressive snowball",
      boots: ITEMS.ionian, startItems: [ITEMS.dorans],
      items: [ITEMS.blackCleaver, ITEMS.stridebreaker, ITEMS.deathsDance, ITEMS.steraks, ITEMS.maw] },
  ],
  AP_FIGHTER: [
    { name: "Nashor's",   desc: "Auto-attack AP hybrid",
      boots: ITEMS.ionian, startItems: [ITEMS.doransRing],
      items: [ITEMS.nashors, ITEMS.rylais, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.zhonyas] },
    { name: "Burst",      desc: "Full AP burst fighter",
      boots: ITEMS.sorcShoes, startItems: [ITEMS.doransRing],
      items: [ITEMS.shadowflame, ITEMS.deathcap, ITEMS.voidStaff, ITEMS.zhonyas, ITEMS.banshees] },
    { name: "Tanky AP",   desc: "Bruiser AP hybrid",
      boots: ITEMS.mercTreads, startItems: [ITEMS.doransRing],
      items: [ITEMS.rylais, ITEMS.abyssalMask, ITEMS.deathcap, ITEMS.warmogs, ITEMS.voidStaff] },
  ],
};

export const RANK_TIERS = [
  { rank: "CHALLENGER",  label: "Challenger",  wr_bonus: 2.0, pr_bonus: -4, games_mult: 0.07 },
  { rank: "MASTER",      label: "Master+",     wr_bonus: 1.2, pr_bonus: -2, games_mult: 0.12 },
  { rank: "DIAMOND",     label: "Diamond",     wr_bonus: 0.6, pr_bonus:  0, games_mult: 0.18 },
  { rank: "EMERALD",     label: "Emerald",     wr_bonus: 0.3, pr_bonus:  1, games_mult: 0.22 },
  { rank: "PLATINUM",    label: "Platinum",    wr_bonus: 0.1, pr_bonus:  2, games_mult: 0.27 },
  { rank: "GOLD",        label: "Gold",        wr_bonus: 0.0, pr_bonus:  4, games_mult: 0.34 },
];

// ── Deterministic hash helpers for item option generation ─────
function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) & 0x7fffffff;
  return h / 0x7fffffff;
}

function mkItemOptions(pool: ItemRef[], baseWr: number, baseGames: number, seed: string): ItemOption[] {
  const sorted = [...pool].sort((a, b) => strHash(a.name + seed) - strHash(b.name + seed));
  const picks = sorted.slice(0, 5);
  const rates = [32, 22, 18, 15, 13];
  return picks.map((item, i) => {
    const pr = rates[i] + strHash(item.name + seed + i) * 4 - 2;
    const games = Math.max(5, Math.floor(baseGames * pr / 100));
    const wr = Math.min(99, Math.max(35, baseWr + (strHash(item.name + seed) - 0.5) * 12));
    return { item, pickRate: +pr.toFixed(1), games, winRate: +wr.toFixed(2) };
  });
}

function mkCoreOptions(variants: BuildVariant[], baseWr: number, baseGames: number): CoreOption[] {
  const rates = [28, 20, 14, 10, 8];
  return variants.map((v, i) => {
    const pr = rates[i] ?? 5;
    const games = Math.max(10, Math.floor(baseGames * pr / 100));
    const wr = Math.min(99, Math.max(35, baseWr + (i === 0 ? 2 : i === 1 ? 0.5 : -1)));
    return { items: v.items.slice(0, 3), pickRate: +pr.toFixed(1), games, winRate: +wr.toFixed(2) };
  });
}

function mkStarterOptions(starters: ItemRef[][], baseWr: number, baseGames: number): StarterOption[] {
  const rates = [55, 32, 13];
  return starters.slice(0, 3).map((items, i) => {
    const pr = rates[i] ?? 5;
    const games = Math.max(5, Math.floor(baseGames * pr / 100));
    const wr = Math.min(99, Math.max(35, baseWr + (i === 0 ? 0 : -1.5)));
    return { items, pickRate: +pr.toFixed(1), games, winRate: +wr.toFixed(2) };
  });
}

function mkBootsOptions(boots: ItemRef[], baseWr: number, baseGames: number): BootOption[] {
  const rates = [52, 28, 12, 8];
  return boots.slice(0, 4).map((item, i) => {
    const pr = rates[i] ?? 3;
    const games = Math.max(5, Math.floor(baseGames * pr / 100));
    const wr = Math.min(99, Math.max(35, baseWr + (i === 0 ? 0.3 : -0.8)));
    return { item, pickRate: +pr.toFixed(1), games, winRate: +wr.toFixed(2) };
  });
}

// Pool of common boots per archetype for boots options
const BOOTS_POOL: Record<BuildType, ItemRef[]> = {
  MAGE:            [ITEMS.sorcShoes, ITEMS.ionian, ITEMS.mercTreads, ITEMS.steelcaps],
  AP_ASSASSIN:     [ITEMS.sorcShoes, ITEMS.ionian, ITEMS.mercTreads, ITEMS.steelcaps],
  AD_ASSASSIN:     [ITEMS.ionian, ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.swiftness],
  MARKSMAN:        [ITEMS.berserkers, ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.swiftness],
  FIGHTER:         [ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian, ITEMS.swiftness],
  BRUISER:         [ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian, ITEMS.swiftness],
  TANK:            [ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian, ITEMS.swiftness],
  SUPPORT_AP:      [ITEMS.ionian, ITEMS.sorcShoes, ITEMS.mercTreads, ITEMS.steelcaps],
  SUPPORT_TANK:    [ITEMS.mobility, ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian],
  ENCHANTER:       [ITEMS.ionian, ITEMS.mobility, ITEMS.steelcaps, ITEMS.mercTreads],
  JUNGLE_ASSASSIN: [ITEMS.ionian, ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.swiftness],
  JUNGLE_FIGHTER:  [ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian, ITEMS.swiftness],
  AP_FIGHTER:      [ITEMS.ionian, ITEMS.sorcShoes, ITEMS.mercTreads, ITEMS.steelcaps],
};

// ── Build generator — returns 3 variants × 6 ranks = 18 entries ─
export function getBuild(
  champName: string,
  buildType: BuildType,
  baseWinRate: number,
  basePickRate: number,
  baseGames: number,
): BuildEntry[] {
  const variants = BUILD_VARIANTS[buildType] ?? BUILD_VARIANTS.FIGHTER;
  const runePool  = RUNES[buildType]   ?? RUNES.FIGHTER;
  const spellPool = SPELLS[buildType]  ?? SPELLS.FIGHTER;
  const loPool    = LEVEL_ORDERS[buildType] ?? LEVEL_ORDERS.FIGHTER;
  const optPool   = OPTIONAL_ITEMS[buildType] ?? [];
  const bootsPool = BOOTS_POOL[buildType] ?? [ITEMS.steelcaps, ITEMS.mercTreads, ITEMS.ionian];

  const allStarters = variants.map(v => v.startItems);
  const coreOpts    = mkCoreOptions(variants, baseWinRate, baseGames);

  return RANK_TIERS.flatMap(tier =>
    variants.map((variant, vi) => {
      const rune     = runePool[vi]  ?? runePool[0];
      const spells   = spellPool[vi] ?? spellPool[0];
      const lo       = loPool[vi]    ?? loPool[0];
      const wrVar  = vi === 0 ? 0 : vi === 1 ? -0.5 : -1.0;
      const prVar  = vi === 0 ? 0 : vi === 1 ?  0.8 : -0.8;
      const wr = Math.min(99, +(baseWinRate + tier.wr_bonus + wrVar).toFixed(1));
      const rankGames = Math.max(10, Math.floor(baseGames * tier.games_mult));

      return {
        rank:           tier.rank,
        rankLabel:      tier.label,
        buildName:      variant.name,
        buildDesc:      variant.desc,
        winRate:        wr,
        pickRate:       Math.max(0.1, +(basePickRate + tier.pr_bonus + prVar).toFixed(1)),
        games:          Math.max(10, Math.floor(rankGames * (vi === 0 ? 1 : vi === 1 ? 0.55 : 0.3))),
        boots:          variant.boots,
        items:          variant.items,
        startItems:     variant.startItems,
        optionalItems:  optPool,
        runes:          rune,
        spells:         spells.names,
        spellIds:       spells.ids,
        skillOrder:     compactOrder(lo),
        levelOrder:     lo,
        starterOptions: mkStarterOptions(allStarters, wr, rankGames),
        bootsOptions:   mkBootsOptions(bootsPool, wr, rankGames),
        coreOptions:    coreOpts,
        fourthOptions:  mkItemOptions(optPool.slice(0, 6),   wr, rankGames, champName + tier.rank + "4"),
        fifthOptions:   mkItemOptions(optPool.slice(0, 6),   wr, rankGames, champName + tier.rank + "5"),
        sixthOptions:   mkItemOptions(optPool.slice(0, 6),   wr, rankGames, champName + tier.rank + "6"),
      };
    })
  );
}
