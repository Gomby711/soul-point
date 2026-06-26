import { riotFetch, platformUrl, regionalUrl } from "./riot.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");

// Boots — excluded from core item grouping
const BOOT_IDS = new Set([3006, 3009, 3020, 3047, 3111, 3117, 3158, 1001]);
// Trinkets — excluded (only the 3 actual trinket-slot items; do NOT add finished items here)
const TRINKET_IDS = new Set([3340, 3348, 3364]);

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

// champion → position → game count (from teamPosition field in Riot match data)
export type PositionStats = Record<string, Record<string, number>>;

export interface CrawlStatus {
  state: "idle" | "running" | "done" | "error";
  progress: number;
  totalPlayers: number;
  processedPlayers: number;
  totalMatches: number;
  processedMatches: number;
  champsCovered: number;
  champsAtTarget: number;
  matchesInDB: number;
  message: string;
  startedAt: number | null;
  completedAt: number | null;
  region: string;
  regionsQueued: string[];
}

const MIN_GAMES_PER_CHAMP = 20; // target games per champion for accurate builds

let crawlStatus: CrawlStatus = {
  state: "idle",
  progress: 0,
  totalPlayers: 0,
  processedPlayers: 0,
  totalMatches: 0,
  processedMatches: 0,
  champsCovered: 0,
  champsAtTarget: 0,
  matchesInDB: 0,
  message: "No crawl has been started yet.",
  startedAt: null,
  completedAt: null,
  region: "NA",
  regionsQueued: [],
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

export async function loadPositionStats(): Promise<PositionStats> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "champion-positions.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function savePositionStats(stats: PositionStats) {
  await fs.writeFile(path.join(DATA_DIR, "champion-positions.json"), JSON.stringify(stats), "utf-8");
}

// ── API key change detection ──────────────────────────────────

function keyHash(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

async function loadLastKeyHash(): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "last-key-hash.json"), "utf-8");
    return (JSON.parse(raw) as { hash: string }).hash;
  } catch {
    return null;
  }
}

async function saveLastKeyHash(hash: string) {
  await ensureDataDir();
  await fs.writeFile(path.join(DATA_DIR, "last-key-hash.json"), JSON.stringify({ hash, savedAt: Date.now() }), "utf-8");
}

export async function hasApiKeyChanged(apiKey: string): Promise<boolean> {
  const current = keyHash(apiKey);
  const last = await loadLastKeyHash();
  if (current !== last) {
    await saveLastKeyHash(current);
    return true;
  }
  return false;
}

// ── Item parsing ──────────────────────────────────────────────

function getCoreItems(...items: number[]): number[] {
  return items
    .filter(id => id !== 0 && !BOOT_IDS.has(id) && !TRINKET_IDS.has(id))
    .sort((a, b) => a - b)
    .slice(0, 3);
}

// Build key includes keystone + primary rune path + sorted core items
// This ensures builds on different rune paths are tracked separately
function makeBuildKey(keystoneId: number, primaryPath: number, secondaryPath: number, coreItems: number[]): string {
  return `${keystoneId}:${primaryPath}:${secondaryPath}|${coreItems.join(",")}`;
}

// ── Rate limiter — dev key: 100 req/2 min ─────────────────────
const RATE_MS = 1300; // ~46 req/min, well under 50/s and 100/2min
let lastReqTime = 0;

async function throttle(url: string, apiKey: string): Promise<unknown> {
  const wait = RATE_MS - (Date.now() - lastReqTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReqTime = Date.now();
  return riotFetch(url, apiKey);
}

// ── Crawl queue (multi-region sequential) ────────────────────

interface CrawlJob {
  apiKey: string;
  region: string;
  playerCount: number;
  matchesPerPlayer: number;
}

const crawlQueue: CrawlJob[] = [];
let isProcessingQueue = false;

async function processCrawlQueue() {
  if (isProcessingQueue || crawlQueue.length === 0) return;
  isProcessingQueue = true;

  while (crawlQueue.length > 0) {
    const job = crawlQueue.shift()!;
    crawlStatus.regionsQueued = crawlQueue.map(j => j.region);
    await runCrawl(job).catch(err => {
      console.error(`[Crawler] Region ${job.region} crawl error:`, (err as Error).message);
    });
  }

  isProcessingQueue = false;
}

// Push a region onto the queue even if a crawl is already running
export function crawlQueueAdd(opts: {
  apiKey: string;
  region: string;
  playerCount?: number;
  matchesPerPlayer?: number;
}) {
  const playerCount = Math.min(opts.playerCount ?? 100, 500);
  const matchesPerPlayer = Math.min(opts.matchesPerPlayer ?? 15, 20);
  crawlQueue.push({ apiKey: opts.apiKey, region: opts.region, playerCount, matchesPerPlayer });
  crawlStatus.regionsQueued = crawlQueue.map(j => j.region);
  processCrawlQueue().catch(err => console.error("[Crawler] Queue error:", err));
}

export async function startCrawl(opts: {
  apiKey: string;
  region?: string;
  playerCount?: number;
  matchesPerPlayer?: number;
}) {
  if (crawlStatus.state === "running" || isProcessingQueue) throw new Error("Crawl already in progress.");
  const region = opts.region ?? "NA";
  const playerCount = Math.min(opts.playerCount ?? 100, 500);
  const matchesPerPlayer = Math.min(opts.matchesPerPlayer ?? 15, 20);

  crawlStatus = {
    state: "running",
    progress: 0,
    totalPlayers: playerCount,
    processedPlayers: 0,
    totalMatches: 0,
    processedMatches: 0,
    champsCovered: 0,
    champsAtTarget: 0,
    matchesInDB: 0,
    message: `Starting crawl for ${region}...`,
    startedAt: Date.now(),
    completedAt: null,
    region,
    regionsQueued: [],
  };

  runCrawl({ apiKey: opts.apiKey, region, playerCount, matchesPerPlayer }).catch(err => {
    crawlStatus.state = "error";
    crawlStatus.message = `Crawl error: ${(err as Error).message}`;
    console.error("[Crawler] Fatal error:", err);
  });
}

// Start crawls for multiple regions in sequence
export function queueMultiRegionCrawl(opts: {
  apiKey: string;
  regions: string[];
  playerCount?: number;
  matchesPerPlayer?: number;
}) {
  const playerCount = Math.min(opts.playerCount ?? 100, 500);
  const matchesPerPlayer = Math.min(opts.matchesPerPlayer ?? 15, 20);

  for (const region of opts.regions) {
    crawlQueue.push({ apiKey: opts.apiKey, region, playerCount, matchesPerPlayer });
  }

  crawlStatus.regionsQueued = crawlQueue.map(j => j.region);
  processCrawlQueue().catch(err => console.error("[Crawler] Queue error:", err));
}

async function runCrawl(opts: CrawlJob) {
  const { apiKey, region, playerCount, matchesPerPlayer } = opts;
  await ensureDataDir();

  crawlStatus.state = "running";
  crawlStatus.region = region;
  crawlStatus.startedAt = crawlStatus.startedAt ?? Date.now();

  const stats = await loadBuildStats();
  const positions = await loadPositionStats();
  const crawled = await loadCrawledMatches();
  const platUrl = platformUrl(region);
  const regUrl = regionalUrl(region);

  // ── Phase 1: Collect PUUIDs from Challenger → GM → Master → Diamond → Emerald ──
  crawlStatus.message = `[${region}] Fetching high-elo player list...`;
  const puuids: string[] = [];
  const tiers = ["challengerleagues", "grandmasterleagues", "masterleagues"] as const;

  for (const tier of tiers) {
    if (puuids.length >= playerCount) break;
    try {
      const url = `${platUrl}/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`;
      const data = await throttle(url, apiKey) as {
        entries: Array<{ puuid?: string; summonerId?: string; leaguePoints: number }>;
      };
      const sorted = [...data.entries].sort((a, b) => b.leaguePoints - a.leaguePoints);
      for (const e of sorted) {
        if (e.puuid && puuids.length < playerCount) puuids.push(e.puuid);
      }
      crawlStatus.message = `[${region}] Seeded ${puuids.length} players from ${tier.replace("leagues", "")}...`;
    } catch (e) {
      console.error(`[Crawler] [${region}] Failed ${tier}:`, (e as Error).message);
    }
  }

  // Pad with Diamond/Emerald players to maximise champion pool diversity
  if (puuids.length < playerCount) {
    const emeraldTierUrls = [
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/I?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/II?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/I?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/I?page=2`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/II?page=1`,
    ];
    for (const url of emeraldTierUrls) {
      if (puuids.length >= playerCount) break;
      try {
        const entries = await throttle(url, apiKey) as Array<{ puuid?: string }>;
        for (const e of entries) {
          if (e.puuid && !puuids.includes(e.puuid) && puuids.length < playerCount)
            puuids.push(e.puuid);
        }
        crawlStatus.message = `[${region}] Expanded to ${puuids.length} Emerald+ players...`;
      } catch { /* non-fatal */ }
    }
  }

  crawlStatus.totalPlayers = puuids.length;

  // ── Phase 2: Collect match IDs (ranked solo only, queue=420) ──
  const allMatchIds: string[] = [];

  for (let i = 0; i < puuids.length; i++) {
    crawlStatus.processedPlayers = i + 1;
    crawlStatus.progress = Math.floor((i / Math.max(puuids.length, 1)) * 25);
    crawlStatus.message = `[${region}] Fetching match IDs: player ${i + 1}/${puuids.length}`;

    try {
      const url = `${regUrl}/lol/match/v5/matches/by-puuid/${puuids[i]}/ids?count=${matchesPerPlayer}&queue=420`;
      const ids = await throttle(url, apiKey) as string[];
      for (const id of ids) {
        if (!crawled.has(id) && !allMatchIds.includes(id)) allMatchIds.push(id);
      }
    } catch (e) {
      console.error(`[Crawler] [${region}] Match ID fetch failed for player ${i}:`, (e as Error).message);
    }
  }

  crawlStatus.totalMatches = allMatchIds.length;
  crawlStatus.matchesInDB = crawled.size;

  // ── Phase 3: Process match details ──
  for (let i = 0; i < allMatchIds.length; i++) {
    crawlStatus.processedMatches = i + 1;
    crawlStatus.progress = 25 + Math.floor((i / Math.max(allMatchIds.length, 1)) * 70);
    crawlStatus.message = `[${region}] Processing match ${i + 1}/${allMatchIds.length}...`;

    try {
      const url = `${regUrl}/lol/match/v5/matches/${allMatchIds[i]}`;
      const match = await throttle(url, apiKey) as {
        info: {
          participants: Array<{
            championName: string;
            teamPosition: string;
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
        if (coreItems.length < 2) continue;

        const primary = p.perks?.styles?.[0];
        const secondary = p.perks?.styles?.[1];
        if (!primary || !secondary) continue;

        const keystoneId = primary.selections[0]?.perk ?? 0;
        if (!keystoneId) continue;

        // Full rune selection — primary slots [0..3] + secondary slots [0..1]
        const runes = [
          ...primary.selections.map(s => s.perk),
          ...secondary.selections.map(s => s.perk),
        ];

        if (!stats[p.championName]) stats[p.championName] = {};
        // Key includes rune paths so different rune setups are separate builds
        const key = makeBuildKey(keystoneId, primary.style, secondary.style, coreItems);

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

        // Track position (role/lane) counts for accurate role assignment
        const pos = p.teamPosition?.toUpperCase();
        if (pos && pos !== "" && pos !== "INVALID") {
          if (!positions[p.championName]) positions[p.championName] = {};
          positions[p.championName][pos] = (positions[p.championName][pos] ?? 0) + 1;
        }
      }

      crawled.add(allMatchIds[i]);

      if ((i + 1) % 25 === 0) {
        await saveBuildStats(stats);
        await savePositionStats(positions);
        await saveCrawledMatches(crawled);
        crawlStatus.champsCovered = Object.keys(stats).length;
        crawlStatus.champsAtTarget = Object.values(stats).filter(builds => {
          const total = Object.values(builds).reduce((s, b) => s + b.wins + b.losses, 0);
          return total >= MIN_GAMES_PER_CHAMP;
        }).length;
        crawlStatus.matchesInDB = crawled.size;
      }
    } catch (e) {
      console.error(`[Crawler] [${region}] Match ${allMatchIds[i]} failed:`, (e as Error).message);
    }
  }

  // ── Phase 4: Coverage boost — pull Diamond players for underrepresented champs ──
  const underCount = Object.values(stats).filter(builds => {
    const total = Object.values(builds).reduce((s, b) => s + b.wins + b.losses, 0);
    return total < MIN_GAMES_PER_CHAMP;
  }).length;

  if (underCount > 0) {
    crawlStatus.message = `[${region}] Coverage boost: ${underCount} champions below ${MIN_GAMES_PER_CHAMP}-game target...`;

    const extraPuuids: string[] = [];
    const coverageUrls = [
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/I?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/II?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/III?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/IV?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/I?page=1`,
      `${platUrl}/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/II?page=1`,
    ];
    for (const url of coverageUrls) {
      if (extraPuuids.length >= 150) break;
      try {
        const entries = await throttle(url, apiKey) as Array<{ puuid?: string }>;
        for (const e of entries) {
          if (e.puuid && !puuids.includes(e.puuid) && extraPuuids.length < 150) {
            extraPuuids.push(e.puuid);
          }
        }
      } catch (e) {
        console.error(`[Crawler] [${region}] Coverage boost fetch failed:`, (e as Error).message);
      }
    }

    const extraMatchIds: string[] = [];
    for (const puuid of extraPuuids) {
      try {
        const url = `${regUrl}/lol/match/v5/matches/by-puuid/${puuid}/ids?count=10&queue=420`;
        const ids = await throttle(url, apiKey) as string[];
        for (const id of ids) {
          if (!crawled.has(id) && !allMatchIds.includes(id) && !extraMatchIds.includes(id)) {
            extraMatchIds.push(id);
          }
        }
      } catch { /* skip */ }
    }

    for (let i = 0; i < Math.min(extraMatchIds.length, 500); i++) {
      crawlStatus.message = `[${region}] Coverage boost: match ${i + 1}/${Math.min(extraMatchIds.length, 500)}...`;
      try {
        const url = `${regUrl}/lol/match/v5/matches/${extraMatchIds[i]}`;
        const match = await throttle(url, apiKey) as {
          info: { participants: Array<{
            championName: string; teamPosition: string; win: boolean;
            item0: number; item1: number; item2: number;
            item3: number; item4: number; item5: number; item6: number;
            perks?: { styles: Array<{ style: number; selections: Array<{ perk: number }> }> };
          }> };
        };
        for (const p of match.info.participants) {
          const coreItems = getCoreItems(p.item0, p.item1, p.item2, p.item3, p.item4, p.item5);
          if (coreItems.length < 2) continue;
          const primary = p.perks?.styles?.[0];
          const secondary = p.perks?.styles?.[1];
          if (!primary || !secondary) continue;
          const keystoneId = primary.selections[0]?.perk ?? 0;
          if (!keystoneId) continue;
          const runes = [...primary.selections.map(s => s.perk), ...secondary.selections.map(s => s.perk)];
          if (!stats[p.championName]) stats[p.championName] = {};
          const key = makeBuildKey(keystoneId, primary.style, secondary.style, coreItems);
          if (!stats[p.championName][key]) {
            stats[p.championName][key] = { wins: 0, losses: 0, keystoneId, primaryPath: primary.style, secondaryPath: secondary.style, coreItems, runes };
          }
          if (p.win) stats[p.championName][key].wins++;
          else stats[p.championName][key].losses++;
          const pos = p.teamPosition?.toUpperCase();
          if (pos && pos !== "" && pos !== "INVALID") {
            if (!positions[p.championName]) positions[p.championName] = {};
            positions[p.championName][pos] = (positions[p.championName][pos] ?? 0) + 1;
          }
        }
        crawled.add(extraMatchIds[i]);
      } catch { /* skip */ }
    }

    await saveBuildStats(stats);
    await saveCrawledMatches(crawled);
  }

  // Final save
  await saveBuildStats(stats);
  await savePositionStats(positions);
  await saveCrawledMatches(crawled);

  const nextQueue = crawlQueue.map(j => j.region);
  const isDone = nextQueue.length === 0;

  const atTarget = Object.values(stats).filter(builds => {
    const total = Object.values(builds).reduce((s, b) => s + b.wins + b.losses, 0);
    return total >= MIN_GAMES_PER_CHAMP;
  }).length;

  crawlStatus = {
    ...crawlStatus,
    state: isDone ? "done" : "idle",
    progress: isDone ? 100 : 0,
    champsCovered: Object.keys(stats).length,
    champsAtTarget: atTarget,
    matchesInDB: crawled.size,
    completedAt: isDone ? Date.now() : null,
    message: isDone
      ? `Done! ${Object.keys(stats).length} champs covered, ${atTarget} at ${MIN_GAMES_PER_CHAMP}+ games target.`
      : `[${region}] complete — ${allMatchIds.length} matches. Starting ${nextQueue[0]}...`,
    regionsQueued: nextQueue,
  };

  console.log(`[Crawler] [${region}] Finished — ${allMatchIds.length} new matches, ${Object.keys(stats).length} champs`);
}
