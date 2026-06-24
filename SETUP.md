# Soul Point — Setup Guide

## Prerequisites
- Node.js 18+
- npm

## 1. Install dependencies

```bash
cd soul-point
cd client && npm install
cd ../server && npm install
```

## 2. Get a Riot API Key

1. Go to https://developer.riotgames.com/
2. Log in with your Riot account
3. Generate a Development API Key (valid 24h)
4. For a permanent key, apply for a Production key

## 3. Configure the server

```bash
cd server
cp .env.example .env
# Edit .env and add your key:
# RIOT_API_KEY=RGAPI-your-key-here
```

## 4. Run the app

**Terminal 1 — API server:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:5173**

## Features

| Feature | Status |
|---------|--------|
| Player Search (all regions) | ✅ Live via Riot API |
| Match History | ✅ Live via Riot API |
| Ranked Stats (Solo + Flex) | ✅ Live via Riot API |
| Champion Mastery | ✅ Live via Riot API |
| Challenges | ✅ Live via Riot API |
| TFT Ranked | ✅ Live via Riot API |
| Champion Tier List | ✅ (static, updated per patch) |
| Champion Builds | ✅ (static, updated per patch) |
| Leaderboard | ✅ Live via Riot API |
| Patch Notes | ✅ (static) |

## API Rate Limits

| Key Type | Rate Limit |
|----------|-----------|
| Development | 20 req/s, 100 req/2min |
| Production | Up to 3000 req/s (app tier) |

The server caches responses to minimize API calls.

## Regions Supported
NA, EUW, EUNE, KR, BR, LAN, LAS, OCE, TR, RU, JP
