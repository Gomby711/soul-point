import { useState, useEffect, useCallback } from "react";
import { Trophy, Flame, Eye, Coins, Star, Shield, Zap, Crown } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, BarChart, Bar, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { SearchBar } from "@/components/layout/SearchBar";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { TierBadge } from "@/components/common/TierBadge";
import { WinRateBar } from "@/components/common/WinRateBar";
import { ChampPortrait } from "@/components/common/ChampPortrait";
import { ItemSlot } from "@/components/common/ItemSlot";
import {
  fetchAccount, fetchSummoner, fetchLeagueEntries,
  fetchMatchIds, fetchMatch, fetchMastery, fetchChallenges,
  fetchTFTLeague, fetchTFTMatchIds, fetchTFTMatch,
  getDragonVersion, getProfileIconUrl,
} from "@/api/client";
import {
  rankColor, winRateColor, kdaRatio, formatDuration,
  timeAgo, getMultiKillLabel, QUEUE_NAMES, formatNumber,
} from "@/lib/utils";
import type { Region, Match, LeagueEntry, ChampionMastery, ChallengeData } from "@/api/types";

type Tab = "overview" | "matches" | "champions" | "mastery" | "challenges" | "tft" | "analysis";
type ModeFilter = "All" | "Ranked Solo" | "Ranked Flex" | "ARAM" | "Normal" | "Arena";

const QUEUE_FILTER_MAP: Record<ModeFilter, number[]> = {
  "All":         [],
  "Ranked Solo": [420],
  "Ranked Flex": [440],
  "ARAM":        [450],
  "Normal":      [400, 430],
  "Arena":       [1700],
};

interface ProfileState {
  gameName: string;
  tagLine: string;
  region: Region;
  summonerLevel: number;
  profileIconId: number;
  profileIconUrl: string;
  summonerId: string;
  puuid: string;
  soloQueue: LeagueEntry | null;
  flexQueue: LeagueEntry | null;
  matches: Match[];
  mastery: ChampionMastery[];
  challenges: ChallengeData | null;
  tftLeague: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  loading: boolean;
  loadingMatches: boolean;
  error: string | null;
}

interface ProfileViewProps {
  gameName: string;
  tagLine: string;
  region: Region;
  onSearch: (name: string, tag: string, region: Region) => void;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-sm ${className}`} />;
}

function MatchRow({ match, puuid }: { match: Match; puuid: string }) {
  const me = match.info.participants.find(p => p.puuid === puuid);
  if (!me) return null;

  const win = me.win;
  const kda = kdaRatio(me.kills, me.deaths, me.assists);
  const kdaNum = me.deaths === 0 ? 99 : (me.kills + me.assists) / me.deaths;
  const kdaCol = kdaNum >= 4 ? "#0AC8B9" : kdaNum >= 3 ? "#C89B3C" : kdaNum >= 2 ? "#A0B4C8" : "#FF4E50";
  const cs = me.totalMinionsKilled + me.neutralMinionsKilled;
  const duration = formatDuration(match.info.gameDuration);
  const ago = timeAgo(match.info.gameEndTimestamp ?? match.info.gameCreation + match.info.gameDuration * 1000);
  const queueName = QUEUE_NAMES[match.info.queueId] ?? match.info.gameMode;
  const multiKill = getMultiKillLabel(me);
  const teamDmg = match.info.participants
    .filter(p => p.teamId === me.teamId)
    .reduce((s, p) => s + p.totalDamageDealtToChampions, 0);
  const dmgShare = teamDmg > 0 ? Math.round((me.totalDamageDealtToChampions / teamDmg) * 100) : 0;
  const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors ${win ? "win-stripe" : "loss-stripe"}`}>
      {/* Champ + result */}
      <div className="flex items-center gap-2 min-w-[130px]">
        <div className="relative">
          <ChampPortrait championName={me.championName} size={44} ring />
          <div
            className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded-sm font-mono"
            style={{
              background: win ? "#0AC8B922" : "#FF4E5022",
              color: win ? "#0AC8B9" : "#FF4E50",
              border: `1px solid ${win ? "#0AC8B944" : "#FF4E5044"}`,
            }}
          >
            {win ? "W" : "L"}
          </div>
        </div>
        <div>
          <div className="font-['Cinzel'] text-xs text-[#C8AA6E] font-bold">{me.championName}</div>
          <div className="text-[10px] text-[#5B7A8C]">{queueName}</div>
          <div className="text-[10px]" style={{ color: win ? "#0AC8B9" : "#FF4E50" }}>{ago}</div>
        </div>
      </div>

      {/* KDA */}
      <div className="min-w-[100px]">
        <div className="font-mono text-sm font-bold" style={{ color: kdaCol }}>
          {me.kills} / <span className="text-[#FF4E50]">{me.deaths}</span> / {me.assists}
        </div>
        <div className="text-[10px] text-[#5B7A8C]">{kda} KDA</div>
        {multiKill && <div className="text-[10px] font-bold text-[#C89B3C]">{multiKill}!</div>}
      </div>

      {/* CS + Vision */}
      <div className="min-w-[80px]">
        <div className="text-xs text-[#A0B4C8] font-mono">{cs} CS</div>
        <div className="flex items-center gap-1 text-[10px] text-[#5B7A8C]">
          <Eye className="w-2.5 h-2.5" />{me.visionScore}
        </div>
        <div className="text-[10px] text-[#5B7A8C] font-mono">{duration}</div>
      </div>

      {/* Gold */}
      <div className="min-w-[90px] hidden sm:block">
        <div className="flex items-center gap-1 text-xs font-mono text-[#C89B3C]">
          <Coins className="w-3 h-3" />{(me.goldEarned / 1000).toFixed(1)}k
        </div>
        <div className="text-[10px] text-[#5B7A8C]">Dmg: {formatNumber(me.totalDamageDealtToChampions)}</div>
        <div className="text-[10px] text-[#5B7A8C]">Share: {dmgShare}%</div>
      </div>

      {/* Items */}
      <div className="flex gap-1 flex-wrap ml-auto">
        {items.map((itemId, i) => (
          <ItemSlot key={i} itemId={itemId} size={28} />
        ))}
      </div>
    </div>
  );
}

function RankCard({
  label, entry,
}: {
  label: string;
  entry: LeagueEntry | null;
}) {
  if (!entry) {
    return (
      <OrnatePanel className="p-4" accent>
        <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-3">{label}</div>
        <div className="text-xs text-[#5B7A8C] font-['Cinzel']">Unranked</div>
      </OrnatePanel>
    );
  }
  const col = rankColor(entry.tier);
  return (
    <OrnatePanel className="p-4" accent>
      <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-3">{label}</div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-12 h-12 shrink-0">
          <div className="hex-clip w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg,${col}33,#071523)` }}>
            <Trophy className="w-5 h-5" style={{ color: col }} />
          </div>
        </div>
        <div>
          <div className="font-['Cinzel'] font-black text-base" style={{ color: col }}>{entry.tier}</div>
          <div className="font-['Cinzel'] text-sm text-[#A0B4C8]">
            {entry.rank} · <span className="font-mono text-[#C89B3C]">{entry.leaguePoints} LP</span>
          </div>
        </div>
      </div>
      <WinRateBar wins={entry.wins} losses={entry.losses} />
      <div className="flex gap-2 mt-2">
        {entry.hotStreak && (
          <span className="text-[9px] font-['Cinzel'] px-1.5 py-0.5 flex items-center gap-1"
            style={{ background: "rgba(255,78,80,0.1)", border: "1px solid rgba(255,78,80,0.3)", color: "#FF4E50" }}>
            <Flame className="w-2 h-2" />HOT STREAK
          </span>
        )}
        {entry.veteran && (
          <span className="text-[9px] font-['Cinzel'] px-1.5 py-0.5"
            style={{ background: "rgba(200,155,60,0.1)", border: "1px solid rgba(200,155,60,0.3)", color: "#C89B3C" }}>
            VETERAN
          </span>
        )}
      </div>
    </OrnatePanel>
  );
}

export function ProfileView({ gameName, tagLine, region, onSearch }: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("All");
  const [state, setState] = useState<ProfileState>({
    gameName, tagLine, region,
    summonerLevel: 0, profileIconId: 0, profileIconUrl: "",
    summonerId: "", puuid: "",
    soloQueue: null, flexQueue: null,
    matches: [], mastery: [], challenges: null, tftLeague: null,
    loading: true, loadingMatches: false, error: null,
  });

  const loadProfile = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const account = await fetchAccount(gameName, tagLine, region);
      const summoner = await fetchSummoner(account.puuid, region);
      const iconUrl = await getProfileIconUrl(summoner.profileIconId);
      const entries = await fetchLeagueEntries(summoner.id, region);
      const solo = entries.find(e => e.queueType === "RANKED_SOLO_5x5") ?? null;
      const flex = entries.find(e => e.queueType === "RANKED_FLEX_SR") ?? null;

      setState(s => ({
        ...s,
        gameName: account.gameName,
        tagLine: account.tagLine,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
        profileIconUrl: iconUrl,
        summonerId: summoner.id,
        puuid: account.puuid,
        soloQueue: solo,
        flexQueue: flex,
        loading: false,
      }));

      // Load matches in background
      setState(s => ({ ...s, loadingMatches: true }));
      const matchIds = await fetchMatchIds(account.puuid, region, { count: 20 });
      const matchDetails = await Promise.all(matchIds.map(id => fetchMatch(id, region)));
      setState(s => ({ ...s, matches: matchDetails, loadingMatches: false }));

      // Load mastery
      const mastery = await fetchMastery(account.puuid, region, 20);
      setState(s => ({ ...s, mastery }));

      // Load challenges (may fail for some regions)
      try {
        const challenges = await fetchChallenges(account.puuid, region);
        setState(s => ({ ...s, challenges }));
      } catch { /* challenges not available in all regions */ }

      // Load TFT
      try {
        const tftEntries = await fetchTFTLeague(summoner.id, region);
        const tft = tftEntries[0] ?? null;
        if (tft) {
          setState(s => ({
            ...s,
            tftLeague: { tier: tft.tier, rank: tft.rank, lp: tft.leaguePoints, wins: tft.wins, losses: tft.losses },
          }));
        }
      } catch { /* TFT not available */ }

    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [gameName, tagLine, region]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const filteredMatches = state.matches.filter(m => {
    const queues = QUEUE_FILTER_MAP[modeFilter];
    return queues.length === 0 || queues.includes(m.info.queueId);
  });

  const tierCol = rankColor(state.soloQueue?.tier ?? "");

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "Overview"   },
    { id: "matches",    label: "Matches"    },
    { id: "champions",  label: "Champions"  },
    { id: "mastery",    label: "Mastery"    },
    { id: "challenges", label: "Challenges" },
    { id: "tft",        label: "TFT"        },
    { id: "analysis",   label: "Analysis"   },
  ];

  // Champion stats computed from matches
  const champStats = (() => {
    const map: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> = {};
    for (const m of state.matches) {
      const me = m.info.participants.find(p => p.puuid === state.puuid);
      if (!me) continue;
      const c = me.championName;
      if (!map[c]) map[c] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      map[c].games++;
      if (me.win) map[c].wins++;
      map[c].kills += me.kills;
      map[c].deaths += me.deaths;
      map[c].assists += me.assists;
    }
    return Object.entries(map)
      .map(([name, s]) => ({ name, ...s, wr: Math.round((s.wins / s.games) * 100), kda: kdaRatio(s.kills, s.deaths, s.assists) }))
      .sort((a, b) => b.games - a.games);
  })();

  // LP history from ranked entries
  const lpHistory = Array.from({ length: 14 }, (_, i) => ({
    date: `Day ${i + 1}`,
    lp: Math.max(0, Math.min(100, (state.soloQueue?.leaguePoints ?? 50) + (Math.random() * 30 - 15) + i * 1.2)),
  }));

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-5">
      <div className="mb-5">
        <SearchBar onSearch={onSearch} compact initialRegion={region} />
      </div>

      {/* Error state */}
      {state.error && (
        <OrnatePanel className="p-8 text-center mb-4">
          <div className="text-[#FF4E50] font-['Cinzel'] text-sm mb-2">Summoner Not Found</div>
          <div className="text-[#5B7A8C] text-xs">{state.error}</div>
        </OrnatePanel>
      )}

      {/* Loading state */}
      {state.loading && !state.error && (
        <OrnatePanel className="p-8 text-center mb-4">
          <div className="text-[#C89B3C] font-['Cinzel'] text-sm mb-2 animate-pulse">Summoning data...</div>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </OrnatePanel>
      )}

      {/* Profile content */}
      {!state.loading && !state.error && (
        <>
          {/* ── Profile Header ── */}
          <OrnatePanel className="mb-4 overflow-hidden" accent>
            <div
              className="relative h-20 overflow-hidden"
              style={{ background: `linear-gradient(135deg,${tierCol}18,#071523,#010A13)` }}
            >
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,50 28,64 2,50 2,16' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
                  backgroundSize: "56px 100px",
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${tierCol}44,transparent)` }} />
            </div>

            <div className="px-5 pb-4 flex flex-col md:flex-row gap-4 -mt-8">
              {/* Avatar */}
              <div className="relative w-16 h-16 shrink-0">
                {state.profileIconUrl ? (
                  <img src={state.profileIconUrl} alt="Profile Icon" className="w-full h-full object-cover" style={{ border: `2px solid ${tierCol}66` }} />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-['Cinzel'] font-black text-2xl"
                    style={{ background: `linear-gradient(135deg,${tierCol}33,#071523)`, border: `2px solid ${tierCol}66`, color: tierCol }}
                  >
                    {state.gameName[0]?.toUpperCase()}
                  </div>
                )}
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-['Cinzel'] font-bold px-2 py-0.5 bg-[#010A13] border whitespace-nowrap"
                  style={{ borderColor: tierCol + "44", color: tierCol }}
                >
                  LV {state.summonerLevel}
                </div>
              </div>

              <div className="flex-1 pt-1">
                <div className="flex flex-wrap items-start gap-3">
                  <div>
                    <h1 className="font-['Cinzel'] font-black text-2xl" style={{ color: "#C8AA6E" }}>{state.gameName}</h1>
                    <div className="text-[11px] text-[#5B7A8C] font-['Cinzel'] tracking-wider">#{state.tagLine} · {region}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {state.soloQueue && <TierBadge tier={state.soloQueue.tier} rank={state.soloQueue.rank} />}
                    {state.soloQueue?.hotStreak && (
                      <span className="text-[10px] font-['Cinzel'] px-2 py-0.5 flex items-center gap-1"
                        style={{ background: "rgba(255,78,80,0.1)", border: "1px solid rgba(255,78,80,0.3)", color: "#FF4E50" }}>
                        <Flame className="w-2.5 h-2.5" />HOT STREAK
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-5 mt-3 flex-wrap">
                  {state.soloQueue && (() => {
                    const wr = Math.round((state.soloQueue.wins / (state.soloQueue.wins + state.soloQueue.losses)) * 100);
                    return (
                      <>
                        <div className="border-l border-[#1E2D3D] pl-4 first:border-l-0 first:pl-0">
                          <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] tracking-wider">Solo/Duo</div>
                          <div className="font-['Cinzel'] font-bold text-sm" style={{ color: rankColor(state.soloQueue.tier) }}>
                            {state.soloQueue.tier} {state.soloQueue.rank}
                          </div>
                          <div className="text-[10px] text-[#5B7A8C] font-mono">{state.soloQueue.leaguePoints} LP</div>
                        </div>
                        <div className="border-l border-[#1E2D3D] pl-4">
                          <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] tracking-wider">Win Rate</div>
                          <div className="font-['Cinzel'] font-bold text-sm" style={{ color: winRateColor(wr) }}>{wr}%</div>
                          <div className="text-[10px] text-[#5B7A8C] font-mono">{state.soloQueue.wins}W {state.soloQueue.losses}L</div>
                        </div>
                      </>
                    );
                  })()}
                  {state.flexQueue && (
                    <div className="border-l border-[#1E2D3D] pl-4">
                      <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] tracking-wider">Flex</div>
                      <div className="font-['Cinzel'] font-bold text-sm" style={{ color: rankColor(state.flexQueue.tier) }}>
                        {state.flexQueue.tier} {state.flexQueue.rank}
                      </div>
                      <div className="text-[10px] text-[#5B7A8C] font-mono">{state.flexQueue.leaguePoints} LP</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-t border-[#1E2D3D] flex overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-4 py-2.5 text-xs font-['Cinzel'] tracking-widest uppercase transition-all relative ${
                    tab === t.id ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
                  }`}
                >
                  {t.label}
                  {tab === t.id && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ background: "linear-gradient(90deg,transparent,#C89B3C,transparent)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </OrnatePanel>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <RankCard label="Ranked Solo / Duo" entry={state.soloQueue} />
                <RankCard label="Ranked Flex 5v5" entry={state.flexQueue} />
                {champStats.length > 0 && (
                  <OrnatePanel className="p-4">
                    <div className="font-['Cinzel'] text-[10px] tracking-widest text-[#5B7A8C] uppercase mb-3">Most Played</div>
                    <div className="space-y-3">
                      {champStats.slice(0, 4).map(c => (
                        <div key={c.name} className="flex items-center gap-2">
                          <ChampPortrait championName={c.name} size={34} ring />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span className="font-['Cinzel'] text-[#C8AA6E] truncate">{c.name}</span>
                              <span className="font-mono font-bold" style={{ color: winRateColor(c.wr) }}>{c.wr}%</span>
                            </div>
                            <div className="h-px bg-[#1E2D3D]">
                              <div className="h-full" style={{ width: `${c.wr}%`, background: winRateColor(c.wr) }} />
                            </div>
                            <div className="text-[10px] text-[#5B7A8C] mt-0.5">{c.games}G · {c.kda} KDA</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </OrnatePanel>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
                  <span className="text-[10px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase">Recent Matches</span>
                  <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,#785A28)" }} />
                </div>
                {state.loadingMatches ? (
                  <OrnatePanel className="p-6 text-center">
                    <div className="text-[#C89B3C] font-['Cinzel'] text-xs animate-pulse">Loading match history...</div>
                  </OrnatePanel>
                ) : (
                  <OrnatePanel className="overflow-hidden">
                    {state.matches.slice(0, 10).map(m => (
                      <MatchRow key={m.metadata.matchId} match={m} puuid={state.puuid} />
                    ))}
                    {state.matches.length === 0 && (
                      <div className="p-6 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">No recent matches found</div>
                    )}
                  </OrnatePanel>
                )}
              </div>
            </div>
          )}

          {/* ── MATCHES ── */}
          {tab === "matches" && (
            <div>
              <div className="flex gap-2 flex-wrap mb-4">
                {(["All", "Ranked Solo", "Ranked Flex", "ARAM", "Normal", "Arena"] as ModeFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setModeFilter(f)}
                    className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
                      modeFilter === f
                        ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                        : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#A0B4C8]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <OrnatePanel className="overflow-hidden">
                {filteredMatches.map(m => (
                  <MatchRow key={m.metadata.matchId} match={m} puuid={state.puuid} />
                ))}
                {filteredMatches.length === 0 && (
                  <div className="p-8 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">No matches found for this filter</div>
                )}
              </OrnatePanel>
            </div>
          )}

          {/* ── CHAMPIONS ── */}
          {tab === "champions" && (
            <OrnatePanel className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1E2D3D]">
                    {["#", "Champion", "Games", "Win Rate", "KDA", "W / L"].map(h => (
                      <th key={h} className={`px-4 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${h === "#" || h === "Champion" ? "text-left" : "text-center"}`} style={{ fontSize: 10 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {champStats.map((c, i) => (
                    <tr key={c.name} className="border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors">
                      <td className="px-4 py-3 font-mono text-[#5B7A8C]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChampPortrait championName={c.name} size={36} ring />
                          <div>
                            <div className="font-['Cinzel'] text-[#C8AA6E]">{c.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[#A0B4C8]">{c.games}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-mono font-bold" style={{ color: winRateColor(c.wr) }}>{c.wr}%</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#C89B3C]">{c.kda}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[#0AC8B9]">{c.wins}W</span>
                        <span className="text-[#1E2D3D] mx-1">/</span>
                        <span className="text-[#FF4E50]">{c.games - c.wins}L</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </OrnatePanel>
          )}

          {/* ── MASTERY ── */}
          {tab === "mastery" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-4 h-4 text-[#C89B3C]" />
                <h2 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Champion Mastery</h2>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {state.mastery.map(m => (
                  <OrnatePanel key={m.championId} className="p-3 text-center" accent={m.championLevel >= 7}>
                    <ChampPortrait championName={String(m.championId)} size={56} ring={m.championLevel >= 7} />
                    <div className="mt-2">
                      <div className="font-['Cinzel'] text-xs text-[#C8AA6E]">Level {m.championLevel}</div>
                      <div className="font-mono text-[10px] text-[#C89B3C]">{m.championPoints.toLocaleString()} pts</div>
                      {m.chestGranted && (
                        <div className="text-[9px] text-[#0AC8B9] mt-1">✓ Chest</div>
                      )}
                    </div>
                  </OrnatePanel>
                ))}
                {state.mastery.length === 0 && (
                  <div className="col-span-full p-8 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                    Loading mastery data...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {tab === "challenges" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-4 h-4 text-[#C89B3C]" />
                <h2 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Challenges</h2>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
              </div>
              {state.challenges ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OrnatePanel className="p-4" accent>
                    <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-3">Overall Level</div>
                    <div className="font-['Cinzel'] font-black text-2xl" style={{ color: rankColor(state.challenges.totalPoints.level) }}>
                      {state.challenges.totalPoints.level}
                    </div>
                    <div className="text-xs text-[#A0B4C8] font-mono mt-1">
                      {state.challenges.totalPoints.current.toLocaleString()} / {state.challenges.totalPoints.max.toLocaleString()} points
                    </div>
                    <div className="h-1 bg-[#1E2D3D] rounded-full mt-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(state.challenges.totalPoints.current / state.challenges.totalPoints.max) * 100}%`,
                          background: rankColor(state.challenges.totalPoints.level),
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#5B7A8C] mt-1">
                      Top {(state.challenges.totalPoints.percentile * 100).toFixed(1)}% of players
                    </div>
                  </OrnatePanel>

                  {Object.entries(state.challenges.categoryPoints).map(([cat, pts]) => (
                    <OrnatePanel key={cat} className="p-4">
                      <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">{cat}</div>
                      <div className="font-['Cinzel'] font-bold text-sm" style={{ color: rankColor(pts.level) }}>{pts.level}</div>
                      <div className="text-[10px] text-[#A0B4C8] font-mono">{pts.current} / {pts.max}</div>
                    </OrnatePanel>
                  ))}
                </div>
              ) : (
                <OrnatePanel className="p-8 text-center">
                  <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">Challenges data not available</div>
                </OrnatePanel>
              )}
            </div>
          )}

          {/* ── TFT ── */}
          {tab === "tft" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Crown className="w-4 h-4 text-[#C89B3C]" />
                <h2 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Teamfight Tactics</h2>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
              </div>
              {state.tftLeague ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OrnatePanel className="p-4" accent>
                    <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-3">TFT Ranked</div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative w-12 h-12 shrink-0">
                        <div className="hex-clip w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg,${rankColor(state.tftLeague.tier)}33,#071523)` }}>
                          <Trophy className="w-5 h-5" style={{ color: rankColor(state.tftLeague.tier) }} />
                        </div>
                      </div>
                      <div>
                        <div className="font-['Cinzel'] font-black text-base" style={{ color: rankColor(state.tftLeague.tier) }}>
                          {state.tftLeague.tier}
                        </div>
                        <div className="font-['Cinzel'] text-sm text-[#A0B4C8]">
                          {state.tftLeague.rank} · <span className="font-mono text-[#C89B3C]">{state.tftLeague.lp} LP</span>
                        </div>
                      </div>
                    </div>
                    <WinRateBar wins={state.tftLeague.wins} losses={state.tftLeague.losses} />
                  </OrnatePanel>
                </div>
              ) : (
                <OrnatePanel className="p-8 text-center">
                  <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">No TFT ranked data found</div>
                </OrnatePanel>
              )}
            </div>
          )}

          {/* ── ANALYSIS ── */}
          {tab === "analysis" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OrnatePanel className="p-5">
                <div className="font-['Cinzel'] text-xs tracking-widest text-[#785A28] uppercase mb-4">LP Progress (Simulated)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lpHistory}>
                    <defs>
                      <linearGradient id="lpG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C89B3C" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#C89B3C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1E2D3D" />
                    <XAxis dataKey="date" tick={{ fill: "#5B7A8C", fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#5B7A8C", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#0A1428", border: "1px solid #785A28", color: "#C8AA6E", fontFamily: "Cinzel", fontSize: 11 }} />
                    <Area type="monotone" dataKey="lp" stroke="#C89B3C" strokeWidth={1.5} fill="url(#lpG)" />
                  </AreaChart>
                </ResponsiveContainer>
              </OrnatePanel>

              {champStats.length > 0 && (
                <OrnatePanel className="p-5">
                  <div className="font-['Cinzel'] text-xs tracking-widest text-[#785A28] uppercase mb-4">Champion Win Rates</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={champStats.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1E2D3D" />
                      <XAxis dataKey="name" tick={{ fill: "#5B7A8C", fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#5B7A8C", fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: "#0A1428", border: "1px solid #785A28", color: "#C8AA6E", fontFamily: "Cinzel", fontSize: 11 }} />
                      <Bar dataKey="wr" fill="#C89B3C" radius={[2, 2, 0, 0]} name="Win Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </OrnatePanel>
              )}

              <OrnatePanel className="p-5">
                <div className="font-['Cinzel'] text-xs tracking-widest text-[#785A28] uppercase mb-4">Last 20 Games Summary</div>
                {(() => {
                  const myGames = state.matches.map(m => m.info.participants.find(p => p.puuid === state.puuid)).filter(Boolean);
                  const wins = myGames.filter(m => m!.win).length;
                  const avgK = (myGames.reduce((a, m) => a + m!.kills, 0) / (myGames.length || 1)).toFixed(1);
                  const avgD = (myGames.reduce((a, m) => a + m!.deaths, 0) / (myGames.length || 1)).toFixed(1);
                  const avgA = (myGames.reduce((a, m) => a + m!.assists, 0) / (myGames.length || 1)).toFixed(1);
                  const avgCS = Math.round(myGames.reduce((a, m) => a + m!.totalMinionsKilled + m!.neutralMinionsKilled, 0) / (myGames.length || 1));
                  const wr20 = myGames.length ? Math.round((wins / myGames.length) * 100) : 0;
                  return (
                    <div className="space-y-3">
                      {[
                        { label: "Win Rate", value: `${wr20}%`, sub: `${wins}W ${myGames.length - wins}L`, color: winRateColor(wr20) },
                        { label: "Avg KDA", value: `${avgK}/${avgD}/${avgA}`, color: "#C89B3C" },
                        { label: "Avg CS", value: String(avgCS), color: "#A0B4C8" },
                        { label: "Games Analyzed", value: String(myGames.length), color: "#A0B4C8" },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center border-b border-[#1E2D3D] pb-2">
                          <span className="text-[10px] font-['Cinzel'] tracking-wider text-[#5B7A8C] uppercase">{row.label}</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm" style={{ color: row.color }}>{row.value}</span>
                            {row.sub && <div className="text-[10px] text-[#5B7A8C]">{row.sub}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </OrnatePanel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
