import "dotenv/config";
import express from "express";
import cors from "cors";
import NodeCache from "node-cache";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platformUrl, regionalUrl, riotFetch } from "./riot.js";
import { fetchChampionAnalysis, fetchLaneMetaChampions, fetchChampionSynergies } from "./opgg.js";
import {
  getChampionStats, getChampionAbilities, getChampionPatchNote,
  getItemData, getItemPatchNote, getRuneData, getRunePatchNote,
} from "./lol-data-mcp.js";
import { startCrawl, queueMultiRegionCrawl, getCrawlStatus, hasApiKeyChanged } from "./crawler.js";
import { getChampionBuilds, getAllBuilds, getChampionList } from "./algo.js";

const app  = express();
const PORT = process.env.PORT ?? 3001;
const KEY  = process.env.RIOT_API_KEY ?? "";

const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://sp.evtlee.com",
    /\.railway\.app$/,
  ],
}));
app.use(express.json());

// ── Cache middleware ──────────────────────────────────────────
function cached(ttl: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.originalUrl;
    const hit = cache.get(key);
    if (hit !== undefined) {
      res.json(hit);
      return;
    }
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cache.set(key, body, ttl);
      return origJson(body);
    };
    next();
  };
}

// ── Error handler ─────────────────────────────────────────────
function handleError(err: unknown, res: express.Response) {
  const e = err as Error & { status?: number };
  console.error("[API Error]", e.message);
  res.status(e.status ?? 500).json({ message: e.message });
}

function requireKey(res: express.Response): boolean {
  if (!KEY) {
    res.status(500).json({ message: "RIOT_API_KEY not configured. Add it to server/.env" });
    return false;
  }
  return true;
}

// ── Account by Riot ID ────────────────────────────────────────
app.get("/api/account/:region/:gameName/:tagLine", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, gameName, tagLine } = req.params as Record<string, string>;
    const url = `${regionalUrl(region)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Account by PUUID (for leaderboard player lookups) ─────────
app.get("/api/riotid/:region/:puuid", cached(600), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const url = `${regionalUrl(region)}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Summoner ──────────────────────────────────────────────────
app.get("/api/summoner/:region/:puuid", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── League entries ────────────────────────────────────────────
app.get("/api/league/:region/:puuid", cached(120), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/lol/league/v4/entries/by-puuid/${puuid}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Match IDs ─────────────────────────────────────────────────
app.get("/api/matches/:region/:puuid/ids", cached(60), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const { queue, count = "20", start = "0" } = req.query as Record<string, string>;
    const params = new URLSearchParams({ count, start });
    if (queue) params.set("queue", queue);
    const url = `${regionalUrl(region)}/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Match detail ──────────────────────────────────────────────
app.get("/api/matches/:region/match/:matchId", cached(3600), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, matchId } = req.params as Record<string, string>;
    const url = `${regionalUrl(region)}/lol/match/v5/matches/${matchId}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Mastery ───────────────────────────────────────────────────
app.get("/api/mastery/:region/:puuid", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const { count = "20" } = req.query as Record<string, string>;
    const url = `${platformUrl(region)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Challenges ────────────────────────────────────────────────
app.get("/api/challenges/:region/:puuid", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/lol/challenges/v1/player-data/${puuid}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Leaderboard ───────────────────────────────────────────────
app.get("/api/leaderboard/:region/:tier", cached(180), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, tier } = req.params as Record<string, string>;
    const queue = "RANKED_SOLO_5x5";
    let url: string;
    const tierUpper = tier.toUpperCase();
    if (tierUpper === "CHALLENGER") {
      url = `${platformUrl(region)}/lol/league/v4/challengerleagues/by-queue/${queue}`;
    } else if (tierUpper === "GRANDMASTER") {
      url = `${platformUrl(region)}/lol/league/v4/grandmasterleagues/by-queue/${queue}`;
    } else {
      url = `${platformUrl(region)}/lol/league/v4/masterleagues/by-queue/${queue}`;
    }
    const data = await riotFetch(url, KEY) as {
      tier: string;
      name: string;
      queue: string;
      leagueId: string;
      entries: Array<{
        summonerId: string;
        puuid?: string;
        summonerName?: string;
        riotIdGameName?: string;
        riotIdTagline?: string;
        leaguePoints: number;
        rank: string;
        wins: number;
        losses: number;
        hotStreak: boolean;
        veteran: boolean;
        freshBlood: boolean;
        inactive: boolean;
      }>;
    };

    // Normalize entries — prefer riotIdGameName if summonerName is empty
    const normalized = {
      ...data,
      entries: data.entries.map(e => ({
        ...e,
        summonerName: e.summonerName?.trim() || e.riotIdGameName || `Player ${e.leaguePoints}LP`,
      })),
    };

    res.json(normalized);
  } catch (e) { handleError(e, res); }
});

// ── TFT League ────────────────────────────────────────────────
app.get("/api/tft/league/:region/:puuid", cached(120), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/tft/league/v1/entries/by-puuid/${puuid}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── TFT Match IDs ─────────────────────────────────────────────
app.get("/api/tft/matches/:region/:puuid/ids", cached(60), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, puuid } = req.params as Record<string, string>;
    const { count = "20" } = req.query as Record<string, string>;
    const url = `${regionalUrl(region)}/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── TFT Match detail ──────────────────────────────────────────
app.get("/api/tft/matches/:region/match/:matchId", cached(3600), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, matchId } = req.params as Record<string, string>;
    const url = `${regionalUrl(region)}/tft/match/v1/matches/${matchId}`;
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Champion meta stats (all roles aggregated from OP.GG) ─────
const OPGG_POSITIONS = [
  { label: "Top",     key: "top"     },
  { label: "Jungle",  key: "jungle"  },
  { label: "Mid",     key: "mid"     },
  { label: "ADC",     key: "adc"     },
  { label: "Support", key: "support" },
] as const;

const OPGG_TIER_LABEL: Record<number, string> = { 1: "S+", 2: "S", 3: "A+", 4: "A", 5: "B" };

interface ChampMeta {
  winRate: number; pickRate: number; banRate: number;
  tier: string; games: number; kda: number; rank: number; position: string;
}

app.get("/api/champion-meta", cached(3600), async (_req, res) => {
  try {
    const results = await Promise.all(
      OPGG_POSITIONS.map(p => fetchLaneMetaChampions(p.label, "EMERALD").catch(() => null))
    );

    const statsMap: Record<string, ChampMeta> = {};

    for (let i = 0; i < OPGG_POSITIONS.length; i++) {
      const pos = OPGG_POSITIONS[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any[] = (results[i] as any)?.data?.positions?.[pos.key] ?? [];
      if (!Array.isArray(entries)) continue;

      for (const e of entries) {
        if (!e?.champion) continue;
        const name = e.champion as string;
        const existing = statsMap[name];
        const pickRate = +((e.pick_rate ?? 0) * 100).toFixed(2);
        if (!existing || pickRate > existing.pickRate) {
          statsMap[name] = {
            winRate:  +((e.win_rate  ?? 0.5)  * 100).toFixed(2),
            pickRate,
            banRate:  +((e.ban_rate  ?? 0.02) * 100).toFixed(2),
            tier:     OPGG_TIER_LABEL[e.tier as number] ?? "C",
            games:    e.play  ?? 0,
            kda:      +((e.kda ?? 2.0) as number).toFixed(2),
            rank:     e.rank  ?? 99,
            position: pos.label,
          };
        }
      }
    }

    res.json(statsMap);
  } catch (e) { handleError(e, res); }
});

// ── OP.GG MCP proxy routes ────────────────────────────────────

app.get("/api/opgg/champion/:name/:position", cached(300), async (req, res) => {
  try {
    const { name, position } = req.params as Record<string, string>;
    const { tier } = req.query as Record<string, string>;
    const data = await fetchChampionAnalysis(name, position, tier);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

app.get("/api/opgg/meta/:position", cached(300), async (req, res) => {
  try {
    const { position } = req.params as Record<string, string>;
    const { tier } = req.query as Record<string, string>;
    const data = await fetchLaneMetaChampions(position, tier);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

app.get("/api/opgg/synergies/:name/:position", cached(600), async (req, res) => {
  try {
    const { name, position } = req.params as Record<string, string>;
    const data = await fetchChampionSynergies(name, position);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// Returns 3 builds at different tiers for the same champion/position
app.get("/api/opgg/champion/:name/:position/builds", cached(600), async (req, res) => {
  try {
    const { name, position } = req.params as Record<string, string>;
    const tiers = [
      { key: "EMERALD",     label: "Most Popular" },
      { key: "DIAMOND",     label: "High Elo"     },
      { key: "CHALLENGER",  label: "Challenger"   },
    ];
    const settled = await Promise.allSettled(
      tiers.map(t => fetchChampionAnalysis(name, position, t.key))
    );
    const builds = tiers.map((t, i) => ({
      tier:  t.key,
      label: t.label,
      data:  settled[i].status === "fulfilled" ? settled[i].value : null,
    })).filter(b => b.data !== null);
    res.json({ builds });
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Champion stats ─────────────────────────────
app.get("/api/lol/champion/:name/stats", cached(3600), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const level = req.query.level ? parseInt(req.query.level as string) : undefined;
    const data = await getChampionStats(name, level);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Champion abilities ─────────────────────────
app.get("/api/lol/champion/:name/abilities", cached(3600), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const slot = req.query.slot as string | undefined;
    const data = await getChampionAbilities(name, slot);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Champion patch notes ───────────────────────
app.get("/api/lol/champion/:name/patch-notes", cached(1800), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const patch = req.query.patch as string | undefined;
    const data = await getChampionPatchNote(name, patch);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Item data ───────────────────────────────────
app.get("/api/lol/item/:name/data", cached(3600), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const data = await getItemData(decodeURIComponent(name));
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Item patch notes ───────────────────────────
app.get("/api/lol/item/:name/patch-notes", cached(1800), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const patch = req.query.patch as string | undefined;
    const data = await getItemPatchNote(decodeURIComponent(name), patch);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Rune data ───────────────────────────────────
app.get("/api/lol/rune/:name/data", cached(3600), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const data = await getRuneData(decodeURIComponent(name));
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── LoL Data MCP: Rune patch notes ───────────────────────────
app.get("/api/lol/rune/:name/patch-notes", cached(1800), async (req, res) => {
  try {
    const { name } = req.params as Record<string, string>;
    const patch = req.query.patch as string | undefined;
    const data = await getRunePatchNote(decodeURIComponent(name), patch);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Advanced analytics: full meta snapshot ────────────────────
app.get("/api/analytics/meta", cached(3600), async (_req, res) => {
  try {
    const results = await Promise.all(
      OPGG_POSITIONS.map(p =>
        Promise.all([
          fetchLaneMetaChampions(p.label, "EMERALD").catch(() => null),
          fetchLaneMetaChampions(p.label, "DIAMOND").catch(() => null),
          fetchLaneMetaChampions(p.label, "MASTER").catch(() => null),
        ]).then(([emerald, diamond, master]) => ({
          position: p.label,
          emerald, diamond, master,
        }))
      )
    );
    res.json({ positions: results, generatedAt: Date.now() });
  } catch (e) { handleError(e, res); }
});

// ── Advanced analytics: champion synergies ────────────────────
app.get("/api/analytics/synergies/:name/:position", cached(600), async (req, res) => {
  try {
    const { name, position } = req.params as Record<string, string>;
    const data = await fetchChampionSynergies(name, position);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Advanced analytics: champion build recommendation ─────────
app.get("/api/analytics/build/:name/:position", cached(300), async (req, res) => {
  try {
    const { name, position } = req.params as Record<string, string>;
    const { tier } = req.query as Record<string, string>;
    const data = await fetchChampionAnalysis(name, position, tier ?? "EMERALD");
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── Soul Point Crawler ────────────────────────────────────────

app.post("/api/sp/crawl/start", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region = "NA", playerCount = 50, matchesPerPlayer = 10 } = req.body as Record<string, unknown>;
    await startCrawl({
      apiKey: KEY,
      region: String(region),
      playerCount: Number(playerCount),
      matchesPerPlayer: Number(matchesPerPlayer),
    });
    res.json({ ok: true, message: "Crawl started." });
  } catch (e) { handleError(e, res); }
});

app.get("/api/sp/crawl/status", (_, res) => {
  res.json(getCrawlStatus());
});

app.get("/api/sp/champions", async (_req, res) => {
  try {
    const list = await getChampionList();
    res.json(list);
  } catch (e) { handleError(e, res); }
});

app.get("/api/sp/builds/:champion", async (req, res) => {
  try {
    const { champion } = req.params as Record<string, string>;
    const builds = await getChampionBuilds(champion);
    if (!builds) return void res.status(404).json({ message: "No data for this champion yet." });
    res.json(builds);
  } catch (e) { handleError(e, res); }
});

app.get("/api/sp/builds", cached(300), async (_req, res) => {
  try {
    const all = await getAllBuilds();
    res.json(all);
  } catch (e) { handleError(e, res); }
});

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    keyConfigured: Boolean(KEY),
    message: KEY ? "Riot API key is configured" : "⚠️  Set RIOT_API_KEY in server/.env",
  });
});

// ── Serve React app in production ─────────────────────────────
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.join(__dirname, "../public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

const CRAWL_REGIONS = ["NA", "KR", "EUW", "EUNE", "BR", "LAN", "LAS", "OCE", "TR", "RU", "JP"];
const CRAWL_PLAYER_COUNT = 150;
const CRAWL_MATCHES_PER = 15;
const RECRAWL_INTERVAL_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours

async function autoStartCrawlIfNeeded() {
  if (!KEY) return;
  try {
    const [keyChanged, existingBuilds] = await Promise.all([
      hasApiKeyChanged(KEY),
      getAllBuilds(),
    ]);

    const noData = existingBuilds.length === 0;

    if (keyChanged || noData) {
      const reason = keyChanged ? "new API key detected" : "no build data found";
      console.log(`\n  📊  Soul Point Crawler starting (${reason})...`);
      console.log(`     Regions: ${CRAWL_REGIONS.join(" → ")} | ${CRAWL_PLAYER_COUNT} players × ${CRAWL_MATCHES_PER} matches each`);
      queueMultiRegionCrawl({
        apiKey: KEY,
        regions: CRAWL_REGIONS,
        playerCount: CRAWL_PLAYER_COUNT,
        matchesPerPlayer: CRAWL_MATCHES_PER,
      });
    } else {
      console.log(`  ✓  Build data loaded: ${existingBuilds.length} champions covered`);
      console.log(`     Next refresh in ~6h (or restart with a new key to trigger immediately)\n`);
    }
  } catch (e) {
    console.error("  ⚠️  Auto-crawl init failed:", (e as Error).message);
  }
}

app.listen(PORT, async () => {
  console.log(`\n  ⚔  Soul Point API — http://localhost:${PORT}`);
  if (!KEY) {
    console.log("  ⚠️  RIOT_API_KEY not set. Add it to server/.env to enable live data.\n");
  } else {
    console.log("  ✓  Riot API key configured");
    await autoStartCrawlIfNeeded();

    // Schedule periodic re-crawl every 6 hours to keep data fresh
    setInterval(async () => {
      const status = getCrawlStatus();
      if (status.state === "running") return;
      console.log("\n  🔄  Scheduled Soul Point re-crawl starting...");
      queueMultiRegionCrawl({
        apiKey: KEY,
        regions: CRAWL_REGIONS,
        playerCount: CRAWL_PLAYER_COUNT,
        matchesPerPlayer: CRAWL_MATCHES_PER,
      });
    }, RECRAWL_INTERVAL_MS);
  }
});
