import { useState, useEffect } from "react";
import { getDragonVersion, fetchChampionMeta, fetchSPPositions, type ChampMetaEntry } from "@/api/client";

// ── Build archetypes ──────────────────────────────────────────
export type BuildType =
  | "MAGE" | "AP_ASSASSIN" | "AD_ASSASSIN" | "MARKSMAN"
  | "FIGHTER" | "BRUISER" | "TANK" | "SUPPORT_AP"
  | "SUPPORT_TANK" | "ENCHANTER" | "JUNGLE_ASSASSIN"
  | "JUNGLE_FIGHTER" | "AP_FIGHTER";

export type PrimaryRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

export interface ChampionInfo {
  id: string;           // Dragon key e.g. "MonkeyKing"
  name: string;         // Display name e.g. "Wukong"
  title: string;
  tags: string[];
  imageUrl: string;
  primaryRole: PrimaryRole;
  buildType: BuildType;
  winRate: number;
  pickRate: number;
  banRate: number;
  tier: string;
  trend: "up" | "down";
  kda: string;
  games: number;
}

// ── Stable pseudo-random from name ───────────────────────────
function champHash(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) & 0x7fffffff;
  return h / 0x7fffffff;
}

function seeded(name: string, salt: number): number {
  return champHash(name + String(salt));
}

// Champions known to be primarily jungle (not derivable from tags alone)
const JUNGLE_PRIMARY = new Set([
  "Lee Sin", "Vi", "Warwick", "Hecarim", "Amumu", "Evelynn",
  "Nidalee", "Graves", "Kindred", "Kha'Zix", "Rengar", "Elise",
  "Shaco", "Nocturne", "Kayn", "Taliyah", "Ivern", "Karthus",
  "Sejuani", "Nunu & Willump", "Rammus", "Lillia", "Viego",
  "Fiddlesticks", "Diana", "Ekko", "Zac", "Shyvana", "Udyr",
  "Master Yi", "Xin Zhao", "Jarvan IV", "Volibear",
  "Wukong", "Bel'Veth", "Briar", "Naafiri",
  // Note: Brand → Support, Mordekaiser → Top, Maokai → Support removed
]);

// ── Exact role overrides — beats tag-based logic ──────────────

// Marksman-tagged champions whose PRIMARY role is ADC
// (Ashe has "Support" secondary tag which wrongly made her Support)
const ADC_PRIMARY = new Set([
  "Ashe", "Tristana", "Smolder", "Yunara",
]);

// Marksman/Assassin-tagged champions who primarily play Mid (not ADC)
const MID_MARKSMAN_OVERRIDE = new Set([
  "Azir",    // Mage/Marksman → Mid emperor
  "Akshan",  // Marksman/Assassin → Mid
  "Corki",   // Marksman → predominantly Mid in high-elo
]);

// Marksman/Assassin-tagged champions who primarily play Top
const TOP_PRIMARY = new Set([
  "Teemo", "Gnar", "Kennen", "Quinn", "Jayce", "Ambessa", "Zaahen",
]);

// Marksman-tagged champions who primarily play Support
const SUPPORT_PRIMARY = new Set([
  "Senna", "Mel",
]);

// Support-tagged champions who primarily play Support (not Mid)
const SUPPORT_OVERRIDE = new Set([
  "Lux", "Zyra",
]);

// Support-tagged champions who primarily play Mid
const MID_SUPPORT_OVERRIDE = new Set([
  "Xerath", "Vel'Koz", "Aurora", "Locke",
]);

// ── Role derivation ───────────────────────────────────────────
function deriveRole(name: string, tags: string[]): PrimaryRole {
  // Hard overrides first (most specific wins)
  if (ADC_PRIMARY.has(name))           return "ADC";
  if (MID_MARKSMAN_OVERRIDE.has(name)) return "Mid";
  if (TOP_PRIMARY.has(name))           return "Top";
  if (SUPPORT_PRIMARY.has(name))       return "Support";
  if (SUPPORT_OVERRIDE.has(name))      return "Support";
  if (MID_SUPPORT_OVERRIDE.has(name))  return "Mid";
  if (JUNGLE_PRIMARY.has(name))        return "Jungle";

  const has = (t: string) => tags.includes(t);
  if (has("Marksman")) return "ADC";
  if (has("Support"))  return "Support";
  if (has("Assassin")) return "Mid";
  if (has("Mage"))     return "Mid";
  if (has("Fighter"))  return "Top";
  if (has("Tank"))     return "Top";
  return "Top";
}

// Map OP.GG/Riot position strings to our PrimaryRole enum
function positionToRole(position: string): PrimaryRole | null {
  switch ((position ?? "").toUpperCase()) {
    case "TOP":                   return "Top";
    case "JUNGLE":                return "Jungle";
    case "MID": case "MIDDLE":    return "Mid";
    case "BOT": case "BOTTOM":
    case "ADC": case "CARRY":     return "ADC";
    case "SUPPORT": case "UTILITY": return "Support";
    default: return null;
  }
}

function deriveBuildType(name: string, tags: string[]): BuildType {
  if (JUNGLE_PRIMARY.has(name)) {
    const has = (t: string) => tags.includes(t);
    if (has("Assassin")) return "JUNGLE_ASSASSIN";
    if (has("Mage"))     return "MAGE";
    return "JUNGLE_FIGHTER";
  }
  const has = (t: string) => tags.includes(t);

  // ADC + mid marksman overrides → both use MARKSMAN build type
  if (ADC_PRIMARY.has(name))             return "MARKSMAN";
  if (MID_MARKSMAN_OVERRIDE.has(name))   return "MARKSMAN";
  if (SUPPORT_PRIMARY.has(name)) {
    // Senna is an enchanter-ish support
    return "ENCHANTER";
  }
  if (TOP_PRIMARY.has(name)) {
    // Teemo etc. — treat as mage/fighter
    if (has("Mage")) return "MAGE";
    return "FIGHTER";
  }
  if (SUPPORT_OVERRIDE.has(name)) return "SUPPORT_AP";
  if (MID_SUPPORT_OVERRIDE.has(name)) return "MAGE";

  if (has("Support")) {
    if (has("Mage")) return "SUPPORT_AP";
    if (has("Tank")) return "SUPPORT_TANK";
    return "ENCHANTER";
  }
  if (has("Marksman"))                    return "MARKSMAN";
  if (has("Assassin") && !has("Fighter")) return "AD_ASSASSIN";
  if (has("Assassin") && has("Mage"))     return "AP_ASSASSIN";
  if (has("Mage") && has("Fighter"))      return "AP_FIGHTER";
  if (has("Mage"))                        return "MAGE";
  if (has("Fighter") && has("Tank"))      return "BRUISER";
  if (has("Fighter"))                     return "FIGHTER";
  if (has("Tank"))                        return "TANK";
  return "FIGHTER";
}

// Normalize name for fuzzy matching (strip non-alphanum, lowercase)
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function champScore(wr: number, pr: number, br: number, kda: number): number {
  const wrScore  = (wr - 47) * 4;
  const prScore  = pr * 1.5;
  const brScore  = br * 2;
  const kdaScore = (kda - 2.0) * 1.5;
  return wrScore + prScore + brScore + kdaScore;
}

// SP = Soul Power — top 3% of champions by combined metrics
const TIER_CUTOFFS: { frac: number; tier: string }[] = [
  { frac: 0.03, tier: "SP" },
  { frac: 0.06, tier: "S+" },
  { frac: 0.11, tier: "S"  },
  { frac: 0.16, tier: "A+" },
  { frac: 0.21, tier: "A"  },
  { frac: 0.26, tier: "B"  },
  { frac: 1.00, tier: "C"  },
];

function assignTiersByPercentile(champs: ChampionInfo[]): ChampionInfo[] {
  const scored = champs.map(c => ({ c, score: champScore(c.winRate, c.pickRate, c.banRate, parseFloat(c.kda)) }));
  scored.sort((a, b) => b.score - a.score);
  const n = scored.length;
  let cumFrac = 0;
  let tierIdx = 0;
  return scored.map((entry, i) => {
    const pct = i / n;
    while (tierIdx < TIER_CUTOFFS.length - 1 && pct >= cumFrac + TIER_CUTOFFS[tierIdx].frac) {
      cumFrac += TIER_CUTOFFS[tierIdx].frac;
      tierIdx++;
    }
    return { ...entry.c, tier: TIER_CUTOFFS[tierIdx].tier };
  });
}

function mergeLiveMeta(champs: ChampionInfo[], meta: Record<string, ChampMetaEntry>): ChampionInfo[] {
  const normMeta: Record<string, ChampMetaEntry> = {};
  for (const [k, v] of Object.entries(meta)) normMeta[normName(k)] = v;

  return champs.map(c => {
    const live = normMeta[normName(c.name)];
    if (!live) return c;
    // Use OP.GG's position data for role — more accurate than tag-based derivation.
    // Our hard overrides (Azir, Akshan, etc.) already set primaryRole correctly;
    // only apply live position for champions that aren't in an override set.
    const liveRole = positionToRole(live.position);
    const shouldUseOverride =
      ADC_PRIMARY.has(c.name) ||
      MID_MARKSMAN_OVERRIDE.has(c.name) ||
      TOP_PRIMARY.has(c.name) ||
      SUPPORT_PRIMARY.has(c.name) ||
      SUPPORT_OVERRIDE.has(c.name) ||
      MID_SUPPORT_OVERRIDE.has(c.name) ||
      JUNGLE_PRIMARY.has(c.name);
    return {
      ...c,
      winRate:     live.winRate,
      pickRate:    live.pickRate,
      banRate:     live.banRate,
      tier:        live.tier,
      games:       live.games > 0 ? live.games : c.games,
      kda:         live.kda > 0 ? String(live.kda) : c.kda,
      primaryRole: (!shouldUseOverride && liveRole) ? liveRole : c.primaryRole,
    };
  });
}

// ── Public hook ───────────────────────────────────────────────
export function useChampionData() {
  const [champions, setChampions] = useState<ChampionInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [version, setVersion]     = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Fetch DDragon champion list + OP.GG live meta + SP positions in parallel
        const [ver, metaRaw, spPositions] = await Promise.all([
          getDragonVersion(),
          fetchChampionMeta().catch(() => ({} as Record<string, ChampMetaEntry>)),
          fetchSPPositions().catch(() => ({} as Record<string, { primary: string; counts: Record<string, number> }>)),
        ]);
        setVersion(ver);

        const res  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`);
        const data = await res.json() as {
          data: Record<string, { id: string; name: string; title: string; tags: string[] }>;
        };

        const rawChamps: ChampionInfo[] = Object.values(data.data).map(c => {
          // Fallback values (used only when OP.GG has no data for this champ)
          const h  = champHash(c.name);
          const h4 = seeded(c.name, 4);
          const h5 = seeded(c.name, 5);
          const role      = deriveRole(c.name, c.tags);
          const buildType = deriveBuildType(c.name, c.tags);

          return {
            id: c.id,
            name: c.name,
            title: c.title,
            tags: c.tags,
            imageUrl: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.id}.png`,
            primaryRole: role,
            buildType,
            // Placeholder stats — overwritten by live data below
            winRate:  +(47 + h * 10).toFixed(1),
            pickRate: +(2  + seeded(c.name, 2) * 22).toFixed(1),
            banRate:  +(1  + seeded(c.name, 3) * 35).toFixed(1),
            tier: "",
            trend: h4 > 0.5 ? "up" : "down",
            kda: (1.4 + h5 * 3.6).toFixed(2),
            games: Math.floor(5000 + h * 200000),
          };
        });

        // Merge live OP.GG stats (win rate, pick rate, ban rate, games)
        const withLive = mergeLiveMeta(rawChamps, metaRaw);

        // Apply SP crawl positions (highest-confidence source — real high-elo match data)
        const withPositions = withLive.map(c => {
          const hasOverride =
            ADC_PRIMARY.has(c.name) ||
            MID_MARKSMAN_OVERRIDE.has(c.name) ||
            TOP_PRIMARY.has(c.name) ||
            SUPPORT_PRIMARY.has(c.name) ||
            SUPPORT_OVERRIDE.has(c.name) ||
            MID_SUPPORT_OVERRIDE.has(c.name) ||
            JUNGLE_PRIMARY.has(c.name);
          if (hasOverride) return c;
          const spPos = spPositions[c.id] ?? spPositions[c.name];
          const spRole = spPos ? positionToRole(spPos.primary) : null;
          return spRole ? { ...c, primaryRole: spRole } : c;
        });

        // Always assign tiers by percentile based on win rate + pick rate score
        // This ensures the full S+ → C distribution with actual C-tier champs
        const allTiered = assignTiersByPercentile(withPositions);
        allTiered.sort((a, b) => a.name.localeCompare(b.name));
        setChampions(allTiered);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { champions, loading, version };
}
