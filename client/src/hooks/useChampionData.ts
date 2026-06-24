import { useState, useEffect } from "react";
import { getDragonVersion } from "@/api/client";

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
  "Ashe", "Corki", "Tristana", "Quinn", "Smolder",
]);

// Marksman/Assassin-tagged champions who primarily play Top
const TOP_PRIMARY = new Set([
  "Teemo", "Gnar", "Kennen",
]);

// Marksman-tagged champions who primarily play Support
const SUPPORT_PRIMARY = new Set([
  "Senna",
]);

// Support-tagged champions who primarily play Mid
const MID_SUPPORT_OVERRIDE = new Set([
  "Lux", "Xerath", "Vel'Koz", "Zyra",
]);

// ── Role derivation ───────────────────────────────────────────
function deriveRole(name: string, tags: string[]): PrimaryRole {
  // Hard overrides first
  if (ADC_PRIMARY.has(name))     return "ADC";
  if (TOP_PRIMARY.has(name))     return "Top";
  if (SUPPORT_PRIMARY.has(name)) return "Support";
  if (MID_SUPPORT_OVERRIDE.has(name)) return "Mid";
  if (JUNGLE_PRIMARY.has(name))  return "Jungle";

  const has = (t: string) => tags.includes(t);
  // Marksman BEFORE Support so champions with both tags (e.g. Ashe handled above)
  // go to ADC correctly if not in an override set
  if (has("Marksman")) return "ADC";
  if (has("Support"))  return "Support";
  if (has("Assassin")) return "Mid";
  if (has("Mage"))     return "Mid";
  if (has("Fighter"))  return "Top";
  if (has("Tank"))     return "Top";
  return "Top";
}

function deriveBuildType(name: string, tags: string[]): BuildType {
  if (JUNGLE_PRIMARY.has(name)) {
    const has = (t: string) => tags.includes(t);
    if (has("Assassin")) return "JUNGLE_ASSASSIN";
    if (has("Mage"))     return "MAGE";
    return "JUNGLE_FIGHTER";
  }
  const has = (t: string) => tags.includes(t);

  // ADC overrides
  if (ADC_PRIMARY.has(name))    return "MARKSMAN";
  if (SUPPORT_PRIMARY.has(name)) {
    // Senna is an enchanter-ish support
    return "ENCHANTER";
  }
  if (TOP_PRIMARY.has(name)) {
    // Teemo etc. — treat as mage/fighter
    if (has("Mage")) return "MAGE";
    return "FIGHTER";
  }
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

const TIER_THRESHOLDS = [
  { min: 0.88, tier: "S+" },
  { min: 0.75, tier: "S"  },
  { min: 0.60, tier: "A+" },
  { min: 0.45, tier: "A"  },
  { min: 0.30, tier: "B"  },
  { min: 0,    tier: "C"  },
];

function deriveTier(wr: number, pr: number): string {
  const score = (wr - 47) * 3 + pr * 2;
  const norm = Math.max(0, Math.min(1, score / 30));
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (norm >= min) return tier;
  }
  return "C";
}

// ── Public hook ───────────────────────────────────────────────
export function useChampionData() {
  const [champions, setChampions] = useState<ChampionInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [version, setVersion]     = useState("");

  useEffect(() => {
    async function load() {
      try {
        const ver = await getDragonVersion();
        setVersion(ver);
        const res  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`);
        const data = await res.json() as {
          data: Record<string, { id: string; name: string; title: string; tags: string[] }>;
        };

        const champs: ChampionInfo[] = Object.values(data.data).map(c => {
          const h  = champHash(c.name);
          const h2 = seeded(c.name, 2);
          const h3 = seeded(c.name, 3);
          const h4 = seeded(c.name, 4);
          const h5 = seeded(c.name, 5);

          const wr = 47 + h * 10;           // 47–57%
          const pr = 2  + h2 * 22;          // 2–24%
          const br = 1  + h3 * 35;          // 1–36%
          const tier = deriveTier(wr, pr);
          const role = deriveRole(c.name, c.tags);
          const buildType = deriveBuildType(c.name, c.tags);

          return {
            id: c.id,
            name: c.name,
            title: c.title,
            tags: c.tags,
            imageUrl: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.id}.png`,
            primaryRole: role,
            buildType,
            winRate: +wr.toFixed(1),
            pickRate: +pr.toFixed(1),
            banRate: +br.toFixed(1),
            tier,
            trend: h4 > 0.5 ? "up" : "down",
            kda: (1.4 + h5 * 3.6).toFixed(2),
            games: Math.floor(5000 + h * 200000),
          };
        });

        champs.sort((a, b) => a.name.localeCompare(b.name));
        setChampions(champs);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { champions, loading, version };
}
