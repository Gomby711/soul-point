import { riotFetch, platformUrl, regionalUrl } from "./riot.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");

// Boots — excluded from core item grouping
const BOOT_IDS = new Set([3006, 3009, 3020, 3047, 3111, 3117, 3158, 1001]);
// Trinkets — excluded
const TRINKET_IDS = new Set([3340, 3348, 3364, 2422, 4642, 4004, 4643, 4645]);

export interface BuildEntry {
  wins: number;
  losses: number;
  keystoneId: number;
  primaryPath: number;
  secondaryPath: number;
  coreItems: number[];
  runes: number[];
}

export type BuildStats = Record<string, Record<string, BuildEntry>>;

export interface CrawlStatus {
  state: "idle" | "running" | "done" | "error";
  progress: number;
  totalPlayers: number;
  processedPlayers: number;
  totalMatches: number;
  processedMatches: number;
  champsCovered: number;
  matchesInDB: number;
  message: string;
  startedAt: number | null;
  completedAt: number | null;
  region: string;
}

let crawlStatus: CrawlStatus = {
  state: "idle",
  progress: 0,
  totalPlayers: 0,
  processedPlayers: 0,
  totalMatches: 0,
  processedMatches: 0,
  champsCovered: 0,
  matchesInDB: 0,
  message: "No crawl has been started yet.",
  startedAt: null,
  completedAt: null,
  region: "NA",
};

export function getCrawlStatus(): CrawlStatus {
  return { ...crawlStatus };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadBuildStats(): Promise<BuildStats> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "build-stats.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveBuildStats(stats: BuildStats) {
  await fs.writeFile(path.join(DATA_DIR, "build-stats.json"), JSON.stringify(stats), "utf-8");
}

async function loadCrawledMatches(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "crawled-matches.json"), "utf-8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveCrawledMatches(set: Set<string>) {
  await fs.writeFile(
    path.join(DATA_DIR, "crawled-matches.json"),
    JSON.stringify([...set]),
    "utf-8"
  );
}

function getCoreItems(item0: number, item1: number, item2: number, item3: number, item4: number, item5: number): number[] {
  return [item0, item1, item2, item3, item4, item5]
    .filter(id => id !== 0 && !BOOT_IDS.has(id) && !TRINKET_IDS.has(id))
    .sort((a, b) => a - b)
    .slice(0, 3);
}

function makeBuildKey(keystoneId: number, coreItems: number[]): string {
  return `${keystoneId}|${coreItems.join(",")}`;
}

// Rate limiter — stays safely under dev key's 100 req/2 min limit
const RATE_MS = 1800;
let lastReqTime = 0;

async function throttle(url: string, apiKey: string): Promise<unknown> {
  const wait = RATE_MS - (Date.now() - lastReqTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReqTime = Date.now();
  return riotFetch(url, apiKey);
}

export async function startCrawl(opts: {
  apiKey: string;
  region?: string;
  playerCount?: number;
  matchesPerPlayer?: number;
}) {
  if (crawlStatus.state === "running") throw new Error("Crawl already in progress.");
  const region = opts.region ?? "NA";
  const playerCount = Math.min(opts.playerCount ?? 50, 300);
  const matchesPerPlayer = Math.min(opts.matchesPerPlayer ?? 10, 20);

  crawlStatus = {
    state: "running",
    progress: 0,
    totalPlayers: playerCount,
    processedPlayers: 0,
    totalMatches: 0,
    processedMatches: 0,
    champsCovered: 0,
    matchesInDB: 0,
    message: "Starting crawl...",
    startedAt: Date.now(),
    completedAt: null,
    region,
  };

  runCrawl({ apiKey: opts.apiKey, region, playerCount, matchesPerPlayer }).catch(err => {
    crawlStatus.state = "error";
    crawlStatus.message = `Crawl error: ${(err as Error).message}`;
    console.error("[Crawler] Fatal error:", err);
  });
}

async function runCrawl(opts: {
  apiKey: string;
  region: string;
  playerCount: number;
  matchesPerPlayer: number;
}) {
  const { apiKey, region, playerCount, matchesPerPlayer } = opts;
  await ensureDataDir();

  const stats = await loadBuildStats();
  const crawled = await loadCrawledMatches();
  const platUrl = platformUrl(region);
  const regUrl = regionalUrl(region);

  // ── Phase 1: Collect PUUIDs from Challenger → GM → Master ──
  crawlStatus.message = "Fetching high-elo player list...";
  const puuids: string[] = [];
  const tiers = ["challengerleagues", "grandmasterleagues", "masterleagues"] as const;

  for (const tier of tiers) {
    if (puuids.length >= playerCount) break;
    try {
      const url = `${platUrl}/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`;
      const data = await throttle(url, apiKey) as { entries: Array<{ puuid?: string; leaguePoints: number }> };
      // Sort by LP desc so we seed from the highest-ranked
      const sorted = [...data.entries].sort((a, b) => b.leaguePoints - a.leaguePoints);
      for (const e of sorted) {
        if (e.puuid && puuids.length < playerCount) puuids.push(e.puuid);
      }
      crawlStatus.message = `Seeded ${puuids.length} players from ${tier.replace("leagues", "")}...`;
    } catch (e) {
      console.error(`[Crawler] Failed ${tier}:`, (e as Error).message);
    }
  }

  crawlStatus.totalPlayers = puuids.length;

  // ── Phase 2: Collect match IDs ──
  const allMatchIds: string[] = [];

  for (let i = 0; i < puuids.length; i++) {
    crawlStatus.processedPlayers = i + 1;
    crawlStatus.progress = Math.floor((i / puuids.length) * 25);
    crawlStatus.message = `Fetching match IDs: player ${i + 1}/${puuids.length}`;

    try {
      const url = `${regUrl}/lol/match/v5/matches/by-puuid/${puuids[i]}/ids?count=${matchesPerPlayer}&queue=420`;
      const ids = await throttle(url, apiKey) as string[];
      for (const id of ids) {
        if (!crawled.has(id) && !allMatchIds.includes(id)) allMatchIds.push(id);
      }
    } catch (e) {
      console.error(`[Crawler] Match ID fetch failed for player ${i}:`, (e as Error).message);
    }
  }

  crawlStatus.totalMatches = allMatchIds.length;
  crawlStatus.matchesInDB = crawled.size;

  // ── Phase 3: Process match details ──
  for (let i = 0; i < allMatchIds.length; i++) {
    crawlStatus.processedMatches = i + 1;
    crawlStatus.progress = 25 + Math.floor((i / allMatchIds.length) * 70);
    crawlStatus.message = `Processing match ${i + 1}/${allMatchIds.length}...`;

    try {
      const url = `${regUrl}/lol/match/v5/matches/${allMatchIds[i]}`;
      const match = await throttle(url, apiKey) as {
        info: {
          participants: Array<{
            championName: string;
            win: boolean;
            item0: number; item1: number; item2: number;
            item3: number; item4: number; item5: number; item6: number;
            perks?: {
              styles: Array<{
                style: number;
                selections: Array<{ perk: number }>;
              }>;
            };
          }>;
        };
      };

      for (const p of match.info.participants) {
        const coreItems = getCoreItems(p.item0, p.item1, p.item2, p.item3, p.item4, p.item5);
        if (coreItems.length < 2) continue; // not enough items — early FF or incomplete

        const primary = p.perks?.styles?.[0];
        const secondary = p.perks?.styles?.[1];
        if (!primary || !secondary) continue;

        const keystoneId = primary.selections[0]?.perk ?? 0;
        if (!keystoneId) continue;

        const runes = [
          ...primary.selections.map(s => s.perk),
          ...secondary.selections.map(s => s.perk),
        ];

        if (!stats[p.championName]) stats[p.championName] = {};
        const key = makeBuildKey(keystoneId, coreItems);

        if (!stats[p.championName][key]) {
          stats[p.championName][key] = {
            wins: 0, losses: 0,
            keystoneId,
            primaryPath: primary.style,
            secondaryPath: secondary.style,
            coreItems,
            runes,
          };
        }

        if (p.win) stats[p.championName][key].wins++;
        else stats[p.championName][key].losses++;
      }

      crawled.add(allMatchIds[i]);

      if ((i + 1) % 30 === 0) {
        await saveBuildStats(stats);
        await saveCrawledMatches(crawled);
        crawlStatus.champsCovered = Object.keys(stats).length;
        crawlStatus.matchesInDB = crawled.size;
      }
    } catch (e) {
      console.error(`[Crawler] Match ${allMatchIds[i]} failed:`, (e as Error).message);
    }
  }

  // Final save
  await saveBuildStats(stats);
  await saveCrawledMatches(crawled);

  crawlStatus.state = "done";
  crawlStatus.progress = 100;
  crawlStatus.champsCovered = Object.keys(stats).length;
  crawlStatus.matchesInDB = crawled.size;
  crawlStatus.completedAt = Date.now();
  crawlStatus.message = `Done! Processed ${allMatchIds.length} new matches across ${Object.keys(stats).length} champions.`;
}
