import "dotenv/config";
import express from "express";
import cors from "cors";
import NodeCache from "node-cache";
import { platformUrl, regionalUrl, riotFetch } from "./riot.js";
import { fetchChampionAnalysis, fetchLaneMetaChampions, fetchChampionSynergies } from "./opgg.js";

const app  = express();
const PORT = process.env.PORT ?? 3001;
const KEY  = process.env.RIOT_API_KEY ?? "";

const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
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

// ── Account ───────────────────────────────────────────────────
app.get("/api/account/:region/:gameName/:tagLine", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, gameName, tagLine } = req.params as Record<string, string>;
    const url = `${regionalUrl(region)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
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
app.get("/api/league/:region/:summonerId", cached(120), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, summonerId } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/lol/league/v4/entries/by-summoner/${summonerId}`;
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
app.get("/api/leaderboard/:region/:tier", cached(300), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, tier } = req.params as Record<string, string>;
    const queue = "RANKED_SOLO_5x5";
    let url: string;
    if (tier === "CHALLENGER") {
      url = `${platformUrl(region)}/lol/league/v4/challengerleagues/by-queue/${queue}`;
    } else if (tier === "GRANDMASTER") {
      url = `${platformUrl(region)}/lol/league/v4/grandmasterleagues/by-queue/${queue}`;
    } else {
      url = `${platformUrl(region)}/lol/league/v4/masterleagues/by-queue/${queue}`;
    }
    const data = await riotFetch(url, KEY);
    res.json(data);
  } catch (e) { handleError(e, res); }
});

// ── TFT League ────────────────────────────────────────────────
app.get("/api/tft/league/:region/:summonerId", cached(120), async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { region, summonerId } = req.params as Record<string, string>;
    const url = `${platformUrl(region)}/tft/league/v1/entries/by-summoner/${summonerId}`;
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

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    keyConfigured: Boolean(KEY),
    message: KEY ? "Riot API key is configured" : "⚠️  Set RIOT_API_KEY in server/.env",
  });
});

app.listen(PORT, () => {
  console.log(`\n  ⚔  Soul Point API — http://localhost:${PORT}`);
  if (!KEY) {
    console.log("  ⚠️  RIOT_API_KEY not set. Add it to server/.env to enable live data.\n");
  } else {
    console.log("  ✓  Riot API key configured\n");
  }
});
