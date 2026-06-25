import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBuildStats, type BuildStats } from "./crawler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
void __dirname; // used for import side effects only

// ── Rune metadata ────────────────────────────────────────────

export const RUNE_PATH_NAMES: Record<number, string> = {
  8000: "Precision",
  8100: "Domination",
  8200: "Sorcery",
  8300: "Inspiration",
  8400: "Resolve",
};

export const RUNE_PATH_COLORS: Record<number, string> = {
  8000: "#C89B3C",
  8100: "#E74C3C",
  8200: "#9B59B6",
  8300: "#2ECC71",
  8400: "#1ABC9C",
};

export const KEYSTONE_NAMES: Record<number, string> = {
  8005: "Press the Attack",
  8008: "Lethal Tempo",
  8010: "Conqueror",
  8021: "Conqueror",
  8112: "Electrocute",
  8124: "Predator",
  8128: "Dark Harvest",
  8214: "Summon Aery",
  8229: "Arcane Comet",
  8230: "Phase Rush",
  8351: "Glacial Augment",
  8358: "Unsealed Spellbook",
  8360: "First Strike",
  8369: "First Strike",
  8437: "Grasp of the Undying",
  8439: "Aftershock",
  8465: "Guardian",
  9923: "Hail of Blades",
};

// ── Soul Point Formula ───────────────────────────────────────
//
// SPF(build) = α·WR + β·nPR + γ·CF
//
//   α  = 0.60  — win rate is the primary signal
//   β  = 0.25  — pick rate shows viability (not just luck)
//   γ  = 0.15  — confidence rewards well-tested builds
//
//   WR  = wins / games
//   nPR = games_for_build / total_games_for_champion  (0→1)
//   CF  = min(1, log(games+1) / log(16))  full confidence at 15 games
//
// Minimum 5 games required to be ranked.

const ALPHA = 0.60;
const BETA  = 0.25;
const GAMMA = 0.15;
const MIN_GAMES = 5;
const CONFIDENCE_FULL_AT = 15;

function soulPointScore(winRate: number, normPickRate: number, games: number): number {
  const confidence = Math.min(1, Math.log(games + 1) / Math.log(CONFIDENCE_FULL_AT + 1));
  return ALPHA * winRate + BETA * normPickRate + GAMMA * confidence;
}

function buildLabel(rank: number, winRate: number, normPickRate: number): string {
  if (rank === 1) {
    return winRate >= 0.54 ? "Soul Point Meta"   : "Soul Point Optimal";
  }
  if (rank === 2) {
    return normPickRate > 0.35 ? "Challenger Favorite" : "Calculated Play";
  }
  return winRate >= 0.54 ? "Hidden OP" : "Situational Pick";
}

// ── Public types ─────────────────────────────────────────────

export interface SoulPointBuild {
  rank: number;
  label: string;
  coreItems: number[];
  keystoneId: number;
  keystoneName: string;
  primaryPath: number;
  primaryPathName: string;
  primaryPathColor: string;
  secondaryPath: number;
  secondaryPathName: string;
  secondaryPathColor: string;
  runes: number[];
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  pickRate: number;
  soulPointScore: number;
}

export interface ChampionSoulPoint {
  champion: string;
  totalGames: number;
  builds: SoulPointBuild[];
  lastUpdated: number;
}

// ── Per-champion computation ─────────────────────────────────

function computeForChampion(
  champion: string,
  entries: BuildStats[string],
  now: number
): ChampionSoulPoint | null {
  const totalGames = Object.values(entries).reduce((s, b) => s + b.wins + b.losses, 0);
  if (totalGames === 0) return null;

  const builds = Object.values(entries)
    .filter(b => (b.wins + b.losses) >= MIN_GAMES)
    .map(b => {
      const games      = b.wins + b.losses;
      const winRate    = b.wins / games;
      const normPR     = games / totalGames;
      const score      = soulPointScore(winRate, normPR, games);
      return { ...b, games, winRate, normPR, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((b, i): SoulPointBuild => ({
      rank:              i + 1,
      label:             buildLabel(i + 1, b.winRate, b.normPR),
      coreItems:         b.coreItems,
      keystoneId:        b.keystoneId,
      keystoneName:      KEYSTONE_NAMES[b.keystoneId] ?? `Keystone ${b.keystoneId}`,
      primaryPath:       b.primaryPath,
      primaryPathName:   RUNE_PATH_NAMES[b.primaryPath] ?? "Unknown",
      primaryPathColor:  RUNE_PATH_COLORS[b.primaryPath] ?? "#C8AA6E",
      secondaryPath:     b.secondaryPath,
      secondaryPathName: RUNE_PATH_NAMES[b.secondaryPath] ?? "Unknown",
      secondaryPathColor:RUNE_PATH_COLORS[b.secondaryPath] ?? "#C8AA6E",
      runes:             b.runes,
      wins:              b.wins,
      losses:            b.losses,
      games:             b.games,
      winRate:           parseFloat(b.winRate.toFixed(4)),
      pickRate:          parseFloat(b.normPR.toFixed(4)),
      soulPointScore:    parseFloat(b.score.toFixed(4)),
    }));

  if (builds.length === 0) return null;

  return { champion, totalGames, builds, lastUpdated: now };
}

// ── Public API ───────────────────────────────────────────────

export async function getChampionBuilds(champion: string): Promise<ChampionSoulPoint | null> {
  const all = await loadBuildStats();
  const entries = all[champion];
  if (!entries) return null;
  return computeForChampion(champion, entries, Date.now());
}

export async function getAllBuilds(): Promise<ChampionSoulPoint[]> {
  const all = await loadBuildStats();
  const now = Date.now();
  return Object.entries(all)
    .map(([c, entries]) => computeForChampion(c, entries, now))
    .filter(Boolean) as ChampionSoulPoint[];
}

export async function getChampionList(): Promise<string[]> {
  const all = await loadBuildStats();
  return Object.keys(all).sort();
}
