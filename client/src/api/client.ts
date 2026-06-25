import type {
  RiotAccount, Summoner, LeagueEntry, Match,
  ChampionMastery, ChallengeData, TFTLeagueEntry,
  DragonChampion, DragonItem, Region,
  SoulPointBuild, ChampionSoulPoint, CrawlStatus,
} from "./types";

export type { SoulPointBuild, ChampionSoulPoint, CrawlStatus };

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error ${res.status}`);
  }
  return res.json();
}

// ── Summoner / Account ───────────────────────────────────────

export function fetchAccount(gameName: string, tagLine: string, region: Region): Promise<RiotAccount> {
  return get(`/account/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
}

export function fetchSummoner(puuid: string, region: Region): Promise<Summoner> {
  return get(`/summoner/${region}/${puuid}`);
}

export function fetchLeagueEntries(puuid: string, region: Region): Promise<LeagueEntry[]> {
  return get(`/league/${region}/${puuid}`);
}

// ── Matches ──────────────────────────────────────────────────

export function fetchMatchIds(
  puuid: string,
  region: Region,
  opts: { queue?: number; count?: number; start?: number } = {}
): Promise<string[]> {
  const params = new URLSearchParams();
  if (opts.queue !== undefined) params.set("queue", String(opts.queue));
  if (opts.count !== undefined) params.set("count", String(opts.count));
  if (opts.start !== undefined) params.set("start", String(opts.start));
  const qs = params.toString();
  return get(`/matches/${region}/${puuid}/ids${qs ? `?${qs}` : ""}`);
}

export function fetchMatch(matchId: string, region: Region): Promise<Match> {
  return get(`/matches/${region}/match/${matchId}`);
}

// ── Mastery ──────────────────────────────────────────────────

export function fetchMastery(puuid: string, region: Region, count = 20): Promise<ChampionMastery[]> {
  return get(`/mastery/${region}/${puuid}?count=${count}`);
}

// ── Challenges ───────────────────────────────────────────────

export function fetchChallenges(puuid: string, region: Region): Promise<ChallengeData> {
  return get(`/challenges/${region}/${puuid}`);
}

// ── TFT ──────────────────────────────────────────────────────

export function fetchTFTLeague(puuid: string, region: Region): Promise<TFTLeagueEntry[]> {
  return get(`/tft/league/${region}/${puuid}`);
}

export function fetchTFTMatchIds(puuid: string, region: Region, count = 20): Promise<string[]> {
  return get(`/tft/matches/${region}/${puuid}/ids?count=${count}`);
}

export function fetchTFTMatch(matchId: string, region: Region): Promise<Match> {
  return get(`/tft/matches/${region}/match/${matchId}`);
}

// ── Dragon Data (static) ────────────────────────────────────

let _version: string | null = null;
let _champions: Record<string, DragonChampion> | null = null;
let _items: Record<string, DragonItem> | null = null;

export async function getDragonVersion(): Promise<string> {
  if (_version) return _version;
  const versions: string[] = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json());
  _version = versions[0];
  return _version;
}

export async function getChampions(): Promise<Record<string, DragonChampion>> {
  if (_champions) return _champions;
  const version = await getDragonVersion();
  const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`).then(r => r.json());
  _champions = data.data;
  return _champions!;
}

export async function getItems(): Promise<Record<string, DragonItem>> {
  if (_items) return _items;
  const version = await getDragonVersion();
  const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`).then(r => r.json());
  _items = data.data;
  return _items!;
}

export async function getChampionImage(championName: string): Promise<string> {
  const version = await getDragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

export async function getItemImage(itemId: number): Promise<string> {
  const version = await getDragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

export async function getProfileIconUrl(iconId: number): Promise<string> {
  const version = await getDragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function getSummonerSpellImage(spellId: number): string {
  const spellMap: Record<number, string> = {
    1: "SummonerBoost", 3: "SummonerExhaust", 4: "SummonerFlash",
    6: "SummonerHaste", 7: "SummonerHeal", 11: "SummonerSmite",
    12: "SummonerTeleport", 13: "SummonerMana", 14: "SummonerDot",
    21: "SummonerBarrier", 32: "SummonerSnowball",
  };
  return `https://ddragon.leagueoflegends.com/cdn/14.9.1/img/spell/${spellMap[spellId] ?? "SummonerFlash"}.png`;
}

// ── LoL Data MCP (champion stats, abilities, items, runes) ───

export async function fetchChampionStats(name: string, level?: number): Promise<unknown> {
  const qs = level !== undefined ? `?level=${level}` : "";
  return get(`/lol/champion/${encodeURIComponent(name)}/stats${qs}`);
}

export async function fetchChampionAbilities(name: string, slot?: string): Promise<unknown> {
  const qs = slot ? `?slot=${slot}` : "";
  return get(`/lol/champion/${encodeURIComponent(name)}/abilities${qs}`);
}

export async function fetchChampionPatchNotes(name: string, patch?: string): Promise<unknown> {
  const qs = patch ? `?patch=${patch}` : "";
  return get(`/lol/champion/${encodeURIComponent(name)}/patch-notes${qs}`);
}

export async function fetchItemData(name: string): Promise<unknown> {
  return get(`/lol/item/${encodeURIComponent(name)}/data`);
}

export async function fetchItemPatchNotes(name: string, patch?: string): Promise<unknown> {
  const qs = patch ? `?patch=${patch}` : "";
  return get(`/lol/item/${encodeURIComponent(name)}/patch-notes${qs}`);
}

export async function fetchRuneData(name: string): Promise<unknown> {
  return get(`/lol/rune/${encodeURIComponent(name)}/data`);
}

export async function fetchRunePatchNotes(name: string, patch?: string): Promise<unknown> {
  const qs = patch ? `?patch=${patch}` : "";
  return get(`/lol/rune/${encodeURIComponent(name)}/patch-notes${qs}`);
}

// ── Advanced analytics ────────────────────────────────────────

export async function fetchMetaSnapshot(): Promise<unknown> {
  return get("/analytics/meta");
}

export async function fetchChampionSynergies(name: string, position: string): Promise<unknown> {
  return get(`/analytics/synergies/${encodeURIComponent(name)}/${encodeURIComponent(position)}`);
}

export async function fetchBuildRecommendation(name: string, position: string, tier?: string): Promise<unknown> {
  const qs = tier ? `?tier=${tier}` : "";
  return get(`/analytics/build/${encodeURIComponent(name)}/${encodeURIComponent(position)}${qs}`);
}

// ── OP.GG Build data (via MCP proxy) ─────────────────────────

export async function fetchOPGGChampionAnalysis(
  championName: string,
  position: string,
  rankKey?: string,
): Promise<unknown> {
  const params = new URLSearchParams();
  if (rankKey) params.set("tier", rankKey);
  const qs = params.toString();
  return get(
    `/opgg/champion/${encodeURIComponent(championName)}/${encodeURIComponent(position)}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchOPGGChampionBuilds(
  championName: string,
  position: string,
): Promise<{ builds: Array<{ tier: string; label: string; data: unknown }> }> {
  return get(
    `/opgg/champion/${encodeURIComponent(championName)}/${encodeURIComponent(position)}/builds`,
  );
}

export async function fetchOPGGMetaChampions(
  position: string,
  rankKey?: string,
): Promise<unknown> {
  const params = new URLSearchParams();
  if (rankKey) params.set("tier", rankKey);
  const qs = params.toString();
  return get(`/opgg/meta/${encodeURIComponent(position)}${qs ? `?${qs}` : ""}`);
}

// ── Soul Point Algorithm ─────────────────────────────────────

export function fetchCrawlStatus(): Promise<CrawlStatus> {
  return get("/sp/crawl/status");
}

export function startCrawl(opts: {
  region?: string;
  playerCount?: number;
  matchesPerPlayer?: number;
}): Promise<{ ok: boolean; message: string }> {
  return fetch("/api/sp/crawl/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).then(r => r.json());
}

export function fetchSPChampions(): Promise<string[]> {
  return get("/sp/champions");
}

export function fetchSPChampionBuilds(champion: string): Promise<ChampionSoulPoint> {
  return get(`/sp/builds/${encodeURIComponent(champion)}`);
}

export function fetchSPAllBuilds(): Promise<ChampionSoulPoint[]> {
  return get("/sp/builds");
}

// ── Champion meta stats ──────────────────────────────────────

export interface ChampMetaEntry {
  winRate: number; pickRate: number; banRate: number;
  tier: string; games: number; kda: number; rank: number; position: string;
}

export function fetchChampionMeta(): Promise<Record<string, ChampMetaEntry>> {
  return get("/champion-meta");
}

// ── Leaderboard ──────────────────────────────────────────────

export function fetchLeaderboard(region: Region, tier: string = "CHALLENGER"): Promise<{
  leagueId: string;
  entries: Array<{
    summonerId: string;
    summonerName: string;
    leaguePoints: number;
    rank: string;
    wins: number;
    losses: number;
    veteran: boolean;
    inactive: boolean;
    freshBlood: boolean;
    hotStreak: boolean;
  }>;
  tier: string;
  name: string;
  queue: string;
}> {
  return get(`/leaderboard/${region}/${tier}`);
}
