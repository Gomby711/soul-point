import { useState, useEffect, useCallback, useMemo } from "react";
import { Flame, Eye, Star, Shield, Crown, ChevronDown, ChevronUp } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar,
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
  fetchTFTLeague, getDragonVersion, getProfileIconUrl, getChampions,
} from "@/api/client";
import {
  rankColor, winRateColor, kdaRatio, formatDuration,
  timeAgo, getMultiKillLabel, QUEUE_NAMES, formatNumber,
} from "@/lib/utils";
import { useRuneData, type RunePath } from "@/hooks/useRuneData";
import type { Region, Match, LeagueEntry, ChampionMastery, ChallengeData } from "@/api/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "champions" | "mastery" | "challenges" | "tft" | "analysis";
type ModeFilter = "All" | "Ranked Solo" | "Ranked Flex" | "ARAM" | "ARAM Mayhem" | "Normal" | "Arena";

const QUEUE_FILTER_MAP: Record<ModeFilter, number[]> = {
  "All":          [],
  "Ranked Solo":  [420],
  "Ranked Flex":  [440],
  "ARAM":         [450],
  "ARAM Mayhem":  [1900],
  "Normal":       [400, 430],
  "Arena":        [1700],
};

interface ProfileState {
  gameName: string; tagLine: string; region: Region;
  summonerLevel: number; profileIconId: number; profileIconUrl: string;
  summonerId: string; puuid: string;
  soloQueue: LeagueEntry | null; flexQueue: LeagueEntry | null;
  matches: Match[]; mastery: ChampionMastery[];
  challenges: ChallengeData | null;
  tftLeague: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  loading: boolean; loadingMatches: boolean; error: string | null;
}

interface ProfileViewProps {
  gameName: string; tagLine: string; region: Region;
  onSearch: (name: string, tag: string, region: Region) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPELL_MAP: Record<number, string> = {
  1: "SummonerBoost", 3: "SummonerExhaust", 4: "SummonerFlash",
  6: "SummonerHaste", 7: "SummonerHeal", 11: "SummonerSmite",
  12: "SummonerTeleport", 13: "SummonerMana", 14: "SummonerDot",
  21: "SummonerBarrier", 32: "SummonerSnowball",
};

function spellUrl(id: number, ver: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/spell/${SPELL_MAP[id] ?? "SummonerFlash"}.png`;
}

function buildRuneMap(paths: RunePath[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const path of paths)
    for (const slot of path.slots)
      for (const rune of slot.runes)
        m.set(rune.id, rune.icon);
  return m;
}

function killParticipation(match: Match, puuid: string): number {
  const me = match.info?.participants?.find(p => p.puuid === puuid);
  if (!me) return 0;
  const teamKills = (match.info?.participants ?? [])
    .filter(p => p.teamId === me.teamId)
    .reduce((s, p) => s + p.kills, 0);
  return teamKills > 0 ? Math.round((me.kills + me.assists) / teamKills * 100) : 0;
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function WinLossDonut({ wins, losses, size = 88 }: { wins: number; losses: number; size?: number }) {
  const total = wins + losses;
  if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-[#1E2D3D]" />;
  const wr = wins / total;
  const r = (size / 2) * 0.7;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const sw = size * 0.13;
  const winLen = wr * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#C84B4B" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4A7FC1"
        strokeWidth={sw} strokeDasharray={`${winLen} ${circ - winLen}`}
        transform={`rotate(-90, ${cx}, ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle"
        fill="#C8AA6E" fontSize={size * 0.19} fontFamily="Cinzel, serif" fontWeight="bold">
        {Math.round(wr * 100)}%
      </text>
      <text x={cx} y={cy + size * 0.14} textAnchor="middle"
        fill="#5B7A8C" fontSize={size * 0.105} fontFamily="sans-serif">
        {wins}W {losses}L
      </text>
    </svg>
  );
}

// ─── Spell + Rune icons ───────────────────────────────────────────────────────

function SpellIcon({ spellId, ver, size = 16 }: { spellId: number; ver: string; size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="rounded-sm overflow-hidden bg-[#1E2D3D] shrink-0">
      <img src={spellUrl(spellId, ver)} width={size} height={size}
        className="w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
    </div>
  );
}

function RuneIcon({ perkId, runeMap, size = 16 }: { perkId?: number; runeMap: Map<number, string>; size?: number }) {
  const icon = perkId ? runeMap.get(perkId) : undefined;
  if (!icon) return <div style={{ width: size, height: size }} className="rounded-full bg-[#1E2D3D] shrink-0" />;
  return (
    <div style={{ width: size, height: size }} className="rounded-full overflow-hidden bg-[#0D1F2D] shrink-0">
      <img src={`https://ddragon.leagueoflegends.com/cdn/img/${icon}`} width={size} height={size}
        className="w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
    </div>
  );
}

// ─── Rank Emblem Image ────────────────────────────────────────────────────────

function RankEmblem({ tier, size = 48 }: { tier: string; size?: number }) {
  const t = tier?.toLowerCase();
  const src = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${t}.png`;
  return (
    <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
      <img src={src} width={size} height={size} className="object-contain"
        onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
    </div>
  );
}

// ─── Recent Games Summary ─────────────────────────────────────────────────────

function RecentGamesSummary({ matches, puuid }: { matches: Match[]; puuid: string }) {
  const myP = matches.map(m => m.info?.participants?.find(p => p.puuid === puuid)).filter(Boolean);
  if (myP.length === 0) return null;

  const wins   = myP.filter(p => p!.win).length;
  const losses = myP.length - wins;
  const avgK   = (myP.reduce((s, p) => s + p!.kills,   0) / myP.length).toFixed(1);
  const avgD   = (myP.reduce((s, p) => s + p!.deaths,  0) / myP.length).toFixed(1);
  const avgA   = (myP.reduce((s, p) => s + p!.assists, 0) / myP.length).toFixed(1);
  const kdaNum = Number(avgD) > 0 ? ((Number(avgK) + Number(avgA)) / Number(avgD)).toFixed(2) : "Perfect";
  const avgPKill = Math.round(matches.reduce((s, m) => s + killParticipation(m, puuid), 0) / matches.length);

  // Most played champions
  const champMap: Record<string, { games: number; wins: number }> = {};
  for (const m of matches) {
    const me = m.info?.participants?.find(p => p.puuid === puuid);
    if (!me) continue;
    if (!champMap[me.championName]) champMap[me.championName] = { games: 0, wins: 0 };
    champMap[me.championName].games++;
    if (me.win) champMap[me.championName].wins++;
  }
  const topChamps = Object.entries(champMap)
    .sort((a, b) => b[1].games - a[1].games).slice(0, 3)
    .map(([name, s]) => ({ name, ...s, wr: Math.round((s.wins / s.games) * 100) }));

  // Preferred role
  const roleMap: Record<string, number> = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 };
  for (const m of matches) {
    const me = m.info?.participants?.find(p => p.puuid === puuid);
    if (!me) continue;
    const pos = (me.teamPosition || me.individualPosition || "").toUpperCase();
    if (pos in roleMap) roleMap[pos]++;
  }
  const maxRole = Math.max(...Object.values(roleMap), 1);
  const roleLabels: Record<string, string> = {
    TOP: "Top", JUNGLE: "JGL", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Sup",
  };

  return (
    <OrnatePanel className="p-4 mb-3">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Donut + W/L stats */}
        <div className="flex items-center gap-3 shrink-0">
          <WinLossDonut wins={wins} losses={losses} size={88} />
          <div>
            <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] mb-0.5">{matches.length}G · {wins}W {losses}L</div>
            <div className="font-mono font-bold text-base text-[#C8AA6E]">
              {avgK} / <span className="text-[#FF4E50]">{avgD}</span> / {avgA}
            </div>
            <div className="font-mono font-bold text-sm text-[#C89B3C]">{kdaNum}:1 KDA</div>
            <div className="text-[10px] text-[#0AC8B9] font-['Cinzel'] mt-0.5">P/Kill {avgPKill}%</div>
          </div>
        </div>

        <div className="w-px self-stretch bg-[#1E2D3D] hidden sm:block" />

        {/* Most played champions */}
        <div className="shrink-0">
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Most Played</div>
          <div className="flex flex-col gap-1.5">
            {topChamps.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <ChampPortrait championName={c.name} size={28} />
                <div className="text-[10px]">
                  <span className="font-mono font-bold" style={{ color: winRateColor(c.wr) }}>{c.wr}%</span>
                  <span className="text-[#5B7A8C] ml-1">({c.wins}W {c.games - c.wins}L)</span>
                  <div className="text-[9px] text-[#5B7A8C]">{c.games} game{c.games !== 1 ? "s" : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-[#1E2D3D] hidden sm:block" />

        {/* Preferred role bar chart */}
        <div className="shrink-0">
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Preferred Role (Ranked)</div>
          <div className="flex items-end gap-2" style={{ height: 56 }}>
            {Object.entries(roleMap).map(([role, count]) => {
              const hPct = (count / maxRole) * 100;
              const isTop = count === maxRole && count > 0;
              return (
                <div key={role} className="flex flex-col items-center gap-0.5">
                  <div className="w-7 relative bg-[#1E2D3D]" style={{ height: 44 }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all"
                      style={{ height: `${hPct}%`, background: isTop ? "#4A7FC1" : "#1E3D5C" }}
                    />
                  </div>
                  <span className="text-[8px] text-[#5B7A8C]">{roleLabels[role]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </OrnatePanel>
  );
}

// ─── Expanded Match Detail Panel ──────────────────────────────────────────────

function MatchDetailPanel({
  match, puuid, ver, runeMap,
}: { match: Match; puuid: string; ver: string; runeMap: Map<number, string> }) {
  const [activeTab, setActiveTab] = useState<"overview" | "build">("overview");

  const participants = match.info?.participants ?? [];
  const teamGroups = [
    { id: 100, players: participants.filter(p => p.teamId === 100) },
    { id: 200, players: participants.filter(p => p.teamId === 200) },
  ];
  const teamResults: Record<number, boolean> = match.info?.teams?.length
    ? Object.fromEntries(match.info.teams.map(t => [t.teamId, t.win]))
    : { 100: teamGroups[0].players[0]?.win ?? false, 200: teamGroups[1].players[0]?.win ?? false };
  const maxDmg = Math.max(...participants.map(p => p.totalDamageDealtToChampions), 1);
  const duration = match.info?.gameDuration ?? 0;

  return (
    <div className="border-t border-[#1E2D3D]" style={{ background: "#040D18" }}>
      {/* Sub-tabs */}
      <div className="flex gap-0.5 px-4 pt-2 border-b border-[#1E2D3D]">
        {(["overview", "build"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-[10px] font-['Cinzel'] tracking-widest uppercase relative transition-colors ${
              activeTab === t ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
            }`}>
            {t === "overview" ? "Overview" : "Build"}
            {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-px bg-[#C89B3C]" />}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          {teamGroups.map(({ id: teamId, players }) => {
            const won = teamResults[teamId] ?? false;
            const teamKills = players.reduce((s, p) => s + p.kills, 0);
            const teamGold  = players.reduce((s, p) => s + p.goldEarned, 0);

            // Simple MVP: highest (kills*3 + assists - deaths) on team
            let mvpPuuid = players[0]?.puuid ?? "";
            let mvpScore = -Infinity;
            for (const p of players) {
              const sc = p.kills * 3 + p.assists - p.deaths;
              if (sc > mvpScore) { mvpScore = sc; mvpPuuid = p.puuid; }
            }

            return (
              <div key={teamId} className="mb-1">
                {/* Team header */}
                <div className="flex items-center gap-3 px-4 py-2"
                  style={{ background: won ? "rgba(10,200,185,0.05)" : "rgba(255,78,80,0.05)" }}>
                  <span className="font-['Cinzel'] font-bold text-xs" style={{ color: won ? "#0AC8B9" : "#FF4E50" }}>
                    {won ? "Victory" : "Defeat"}
                  </span>
                  <span className="text-[9px] text-[#5B7A8C]">({teamId === 100 ? "Blue" : "Red"} Team)</span>
                  <div className="ml-auto flex items-center gap-4 text-[9px] font-mono text-[#5B7A8C]">
                    <span>Kills: <span className="text-[#A0B4C8]">{teamKills}</span></span>
                    <span>Gold: <span className="text-[#C89B3C]">{(teamGold / 1000).toFixed(1)}k</span></span>
                  </div>
                </div>

                {/* Column headers (desktop) */}
                <div className="hidden md:grid px-4 py-1.5 text-[9px] font-['Cinzel'] tracking-wider text-[#5B7A8C] uppercase border-b border-[#0D1F2D]"
                  style={{ gridTemplateColumns: "minmax(160px,2fr) 96px 130px 68px 68px 1fr" }}>
                  <span>Summoner</span>
                  <span className="text-center">KDA</span>
                  <span className="text-center">Damage</span>
                  <span className="text-center">Wards</span>
                  <span className="text-center">CS</span>
                  <span>Items</span>
                </div>

                {/* Players */}
                {players.map(p => {
                  const isMe   = p.puuid === puuid;
                  const isMvp  = p.puuid === mvpPuuid;
                  const cs     = p.totalMinionsKilled + p.neutralMinionsKilled;
                  const cspm   = duration > 0 ? (cs / (duration / 60)).toFixed(1) : "0";
                  const kPart  = teamKills > 0 ? Math.round((p.kills + p.assists) / teamKills * 100) : 0;
                  const dmgPct = (p.totalDamageDealtToChampions / maxDmg) * 100;
                  const items  = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
                  const keystoneId = p.perks?.styles?.[0]?.selections?.[0]?.perk;
                  const name = p.riotIdGameName || p.summonerName || "Unknown";

                  return (
                    <div key={p.puuid}
                      className="grid px-4 py-2 border-b border-[#0D1F2D] items-center gap-2"
                      style={{
                        gridTemplateColumns: "minmax(160px,2fr) 96px 130px 68px 68px 1fr",
                        background: isMe ? "rgba(200,155,60,0.06)" : undefined,
                      }}>
                      {/* Champion + spells + rune + name */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ChampPortrait championName={p.championName} size={32} />
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <SpellIcon spellId={p.summoner1Id} ver={ver} size={15} />
                          <SpellIcon spellId={p.summoner2Id} ver={ver} size={15} />
                        </div>
                        <RuneIcon perkId={keystoneId} runeMap={runeMap} size={15} />
                        <div className="min-w-0 ml-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`text-[11px] font-['Cinzel'] truncate ${isMe ? "text-[#C8AA6E] font-bold" : "text-[#A0B4C8]"}`}>
                              {name}
                            </span>
                            {isMvp && (
                              <span className="text-[8px] px-1 py-0.5 font-bold shrink-0"
                                style={{ background: "#C89B3C22", color: "#C89B3C", border: "1px solid #C89B3C44" }}>
                                MVP
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-[#3A4A5A]">{p.championName}</div>
                        </div>
                      </div>

                      {/* KDA */}
                      <div className="text-center">
                        <div className="font-mono text-[11px]">
                          <span className="text-[#C8AA6E]">{p.kills}</span>
                          <span className="text-[#3A4A5A]">/</span>
                          <span className="text-[#FF4E50]">{p.deaths}</span>
                          <span className="text-[#3A4A5A]">/</span>
                          <span className="text-[#C8AA6E]">{p.assists}</span>
                        </div>
                        <div className="text-[9px] text-[#5B7A8C]">P/Kill {kPart}%</div>
                      </div>

                      {/* Damage */}
                      <div className="text-center">
                        <div className="text-[10px] font-mono text-[#A0B4C8]">
                          {formatNumber(p.totalDamageDealtToChampions)}
                        </div>
                        <div className="h-1.5 bg-[#0D1F2D] rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${dmgPct}%`, background: won ? "#4A7FC1" : "#E84057" }} />
                        </div>
                      </div>

                      {/* Wards */}
                      <div className="text-center">
                        <div className="text-[10px] font-mono text-[#A0B4C8]">{p.visionScore}</div>
                        <div className="text-[9px] text-[#5B7A8C]">VS</div>
                      </div>

                      {/* CS */}
                      <div className="text-center">
                        <div className="text-[10px] font-mono text-[#A0B4C8]">{cs}</div>
                        <div className="text-[9px] text-[#5B7A8C]">{cspm}/m</div>
                      </div>

                      {/* Items */}
                      <div className="flex gap-0.5 flex-wrap">
                        {items.map((id, i) => <ItemSlot key={i} itemId={id} size={22} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "build" && (() => {
        const me = (match.info?.participants ?? []).find(p => p.puuid === puuid);
        if (!me) return <div className="p-4 text-[#5B7A8C] text-xs font-['Cinzel']">No build data</div>;
        const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6];
        const cs = me.totalMinionsKilled + me.neutralMinionsKilled;
        return (
          <div className="p-4">
            <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-3">
              Your Build — {me.championName}
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {items.map((id, i) => <ItemSlot key={i} itemId={id} size={40} />)}
            </div>
            <div className="flex gap-2 mb-4">
              <SpellIcon spellId={me.summoner1Id} ver={ver} size={36} />
              <SpellIcon spellId={me.summoner2Id} ver={ver} size={36} />
            </div>
            <div className="text-[10px] text-[#5B7A8C] space-y-1">
              <div><span className="text-[#A0B4C8] font-['Cinzel']">{me.kills}/{me.deaths}/{me.assists}</span> KDA</div>
              <div><span className="text-[#A0B4C8] font-['Cinzel']">{cs}</span> CS · <span className="text-[#C89B3C] font-['Cinzel']">{(me.goldEarned/1000).toFixed(1)}k</span> Gold</div>
              <div>Damage: <span className="text-[#A0B4C8] font-['Cinzel']">{formatNumber(me.totalDamageDealtToChampions)}</span></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Match Row (compact + expandable) ────────────────────────────────────────

function MatchRow({
  match, puuid, ver, runeMap, expanded, onToggle,
}: {
  match: Match; puuid: string; ver: string;
  runeMap: Map<number, string>; expanded: boolean; onToggle: () => void;
}) {
  if (!match?.info?.participants) return null;
  const me = match.info.participants.find(p => p.puuid === puuid);
  if (!me) return null;

  const win      = me.win;
  const kda      = kdaRatio(me.kills, me.deaths, me.assists);
  const kdaNum   = me.deaths === 0 ? 99 : (me.kills + me.assists) / me.deaths;
  const kdaCol   = kdaNum >= 4 ? "#0AC8B9" : kdaNum >= 3 ? "#C89B3C" : kdaNum >= 2 ? "#A0B4C8" : "#FF4E50";
  const cs       = me.totalMinionsKilled + me.neutralMinionsKilled;
  const gameDur  = match.info.gameDuration ?? 0;
  const cspm     = gameDur > 0 ? (cs / (gameDur / 60)).toFixed(1) : "0";
  const duration = formatDuration(gameDur);
  const ago      = timeAgo((match.info.gameEndTimestamp ?? 0) || (match.info.gameCreation + gameDur * 1000));
  const queue    = QUEUE_NAMES[match.info.queueId] ?? match.info.gameMode ?? "Game";
  const multi    = getMultiKillLabel(me);
  const kPart    = killParticipation(match, puuid);
  const items    = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6];
  const keystoneId = me.perks?.styles?.[0]?.selections?.[0]?.perk;

  const blue = match.info.participants.filter(p => p.teamId === 100);
  const red  = match.info.participants.filter(p => p.teamId === 200);

  const winColor  = "#4A7FC1";
  const lossColor = "#C84B4B";

  return (
    <div>
      <div
        className="relative flex items-center gap-2 px-3 py-2.5 border-b border-[#1E2D3D] hover:bg-[#071020] transition-colors cursor-pointer"
        style={{ borderLeft: `3px solid ${win ? winColor : lossColor}` }}
        onClick={onToggle}
      >
        {/* Result + queue */}
        <div className="shrink-0 w-[88px]">
          <div className="text-[11px] font-['Cinzel'] font-bold" style={{ color: win ? winColor : lossColor }}>
            {win ? "Victory" : "Defeat"}
          </div>
          <div className="text-[9px] text-[#5B7A8C] leading-tight truncate">{queue}</div>
          <div className="text-[9px] text-[#3A4A5A]">{ago}</div>
          <div className="text-[9px] font-mono text-[#3A4A5A]">{duration}</div>
        </div>

        {/* Champion portrait */}
        <div className="shrink-0">
          <ChampPortrait championName={me.championName} size={44} ring />
        </div>

        {/* Spells + Rune */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <SpellIcon spellId={me.summoner1Id} ver={ver} size={16} />
          <SpellIcon spellId={me.summoner2Id} ver={ver} size={16} />
          <RuneIcon perkId={keystoneId} runeMap={runeMap} size={16} />
        </div>

        {/* KDA */}
        <div className="shrink-0 w-[94px]">
          <div className="font-mono text-sm font-bold" style={{ color: kdaCol }}>
            {me.kills} / <span className="text-[#FF4E50]">{me.deaths}</span> / {me.assists}
          </div>
          <div className="text-[10px] text-[#5B7A8C]">{kda} KDA</div>
          {multi && <div className="text-[9px] font-bold text-[#C89B3C]">{multi}!</div>}
        </div>

        {/* CS + Vision + P/Kill */}
        <div className="shrink-0 w-[88px] hidden sm:block">
          <div className="text-[10px] font-mono text-[#A0B4C8]">{cs} CS <span className="text-[#5B7A8C]">({cspm}/m)</span></div>
          <div className="flex items-center gap-1 text-[9px] text-[#5B7A8C]">
            <Eye className="w-2.5 h-2.5" />{me.visionScore}
          </div>
          <div className="text-[10px] text-[#0AC8B9] font-['Cinzel']">P/Kill {kPart}%</div>
        </div>

        {/* Items */}
        <div className="hidden md:flex gap-0.5 shrink-0">
          {items.map((id, i) => <ItemSlot key={i} itemId={id} size={26} />)}
        </div>

        {/* 5v5 player names */}
        <div className="hidden xl:flex gap-3 ml-auto shrink-0">
          <div className="flex flex-col gap-px">
            {blue.map(p => (
              <div key={p.puuid}
                className={`text-[9px] truncate max-w-[72px] ${p.puuid === puuid ? "text-[#C8AA6E] font-bold" : "text-[#5B7A8C]"}`}>
                {p.riotIdGameName || p.summonerName || "?"}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-px">
            {red.map(p => (
              <div key={p.puuid}
                className={`text-[9px] truncate max-w-[72px] ${p.puuid === puuid ? "text-[#C8AA6E] font-bold" : "text-[#5B7A8C]"}`}>
                {p.riotIdGameName || p.summonerName || "?"}
              </div>
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="ml-auto xl:ml-0 shrink-0 p-1 text-[#5B7A8C] hover:text-[#C89B3C] transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <MatchDetailPanel match={match} puuid={puuid} ver={ver} runeMap={runeMap} />
      )}
    </div>
  );
}

// ─── Rank Sidebar Card ────────────────────────────────────────────────────────

function RankSidebarCard({ label, entry }: { label: string; entry: LeagueEntry | null }) {
  const [showHistory, setShowHistory] = useState(false);

  if (!entry) {
    return (
      <OrnatePanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-['Cinzel'] font-bold text-[#C8AA6E]">{label}</div>
          <span className="text-[9px] text-[#5B7A8C] border border-[#1E2D3D] px-1.5 py-0.5 font-['Cinzel']">Unranked</span>
        </div>
        <div className="text-[10px] text-[#5B7A8C] font-['Cinzel']">No ranked data this season</div>
      </OrnatePanel>
    );
  }

  const col   = rankColor(entry.tier);
  const total = entry.wins + entry.losses;
  const wr    = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  const tierLabel = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();

  return (
    <OrnatePanel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-['Cinzel'] font-bold text-[#C8AA6E]">{label}</div>
        <div className="text-[9px] text-[#5B7A8C] font-mono">{entry.wins}W {entry.losses}L</div>
      </div>

      <div className="flex flex-col items-center mb-3">
        <RankEmblem tier={entry.tier} size={160} />
        <div className="text-center mt-2">
          <div className="font-['Cinzel'] font-black text-lg" style={{ color: col }}>
            {tierLabel} {entry.rank}
          </div>
          <div className="font-mono text-sm text-[#C89B3C]">{entry.leaguePoints} LP</div>
          <div className="text-[10px] text-[#5B7A8C]">
            Win rate <span style={{ color: winRateColor(wr) }}>{wr}%</span>
          </div>
        </div>
      </div>

      <WinRateBar wins={entry.wins} losses={entry.losses} />

      <div className="flex gap-1 mt-2 flex-wrap">
        {entry.hotStreak && (
          <span className="text-[8px] font-['Cinzel'] px-1.5 py-0.5 flex items-center gap-0.5"
            style={{ background: "rgba(255,78,80,0.1)", border: "1px solid rgba(255,78,80,0.3)", color: "#FF4E50" }}>
            <Flame className="w-2 h-2" />HOT STREAK
          </span>
        )}
        {entry.veteran && (
          <span className="text-[8px] font-['Cinzel'] px-1.5 py-0.5"
            style={{ background: "rgba(200,155,60,0.1)", border: "1px solid rgba(200,155,60,0.3)", color: "#C89B3C" }}>
            VETERAN
          </span>
        )}
        {entry.freshBlood && (
          <span className="text-[8px] font-['Cinzel'] px-1.5 py-0.5"
            style={{ background: "rgba(10,200,185,0.1)", border: "1px solid rgba(10,200,185,0.3)", color: "#0AC8B9" }}>
            FRESH BLOOD
          </span>
        )}
      </div>

      {/* Season history */}
      <div className="mt-3 border-t border-[#1E2D3D] pt-2">
        <table className="w-full">
          <thead>
            <tr className="text-[9px] font-['Cinzel'] tracking-wider text-[#5B7A8C] uppercase">
              <th className="text-left py-1">Season</th>
              <th className="text-left py-1">Tier</th>
              <th className="text-right py-1">LP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 font-['Cinzel'] text-[10px] text-[#C89B3C] font-bold">S2026</td>
              <td className="py-1 font-['Cinzel'] text-[10px]" style={{ color: col }}>{tierLabel} {entry.rank}</td>
              <td className="py-1 text-right font-mono text-[10px] text-[#A0B4C8]">{entry.leaguePoints}</td>
            </tr>
            {showHistory && (
              <tr>
                <td colSpan={3} className="pt-2 pb-1">
                  <div className="text-[9px] text-[#3A4A5A] font-['Cinzel'] italic border border-[#1E2D3D] p-2 text-center">
                    Previous season history requires<br />a historical data provider
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <button onClick={() => setShowHistory(s => !s)}
          className="mt-1 flex items-center gap-0.5 text-[9px] text-[#5B7A8C] hover:text-[#A0B4C8] font-['Cinzel'] transition-colors">
          {showHistory ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          {showHistory ? "Hide season tiers" : "View all season tiers"}
        </button>
      </div>
    </OrnatePanel>
  );
}

// ─── TFT Sidebar Card ─────────────────────────────────────────────────────────

function TFTSidebarCard({ tft }: { tft: { tier: string; rank: string; lp: number; wins: number; losses: number } }) {
  const col   = rankColor(tft.tier);
  const total = tft.wins + tft.losses;
  const wr    = total > 0 ? Math.round((tft.wins / total) * 100) : 0;
  return (
    <OrnatePanel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-['Cinzel'] font-bold text-[#C8AA6E]">TFT Ranked</div>
        <Crown className="w-3.5 h-3.5" style={{ color: col }} />
      </div>
      <div className="flex flex-col items-center mb-2">
        <RankEmblem tier={tft.tier} size={140} />
        <div className="text-center mt-2">
          <div className="font-['Cinzel'] font-bold text-sm" style={{ color: col }}>{tft.tier} {tft.rank}</div>
          <div className="font-mono text-xs text-[#C89B3C]">{tft.lp} LP</div>
          <div className="text-[9px] text-[#5B7A8C]">WR <span style={{ color: winRateColor(wr) }}>{wr}%</span></div>
        </div>
      </div>
      <WinRateBar wins={tft.wins} losses={tft.losses} />
    </OrnatePanel>
  );
}

// ─── Profile View Main ────────────────────────────────────────────────────────

export function ProfileView({ gameName, tagLine, region, onSearch }: ProfileViewProps) {
  const [tab, setTab]                   = useState<Tab>("overview");
  const [modeFilter, setModeFilter]     = useState<ModeFilter>("All");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [ver, setVer]                   = useState("26.13.1");
  const [champIdMap, setChampIdMap]     = useState<Map<number, string>>(new Map());
  const [loadingQueueFilter, setLoadingQueueFilter] = useState(false);
  const [fetchedQueues, setFetchedQueues]           = useState<Set<number>>(new Set());
  const { paths: runePaths }            = useRuneData();

  const [state, setState] = useState<ProfileState>({
    gameName, tagLine, region,
    summonerLevel: 0, profileIconId: 0, profileIconUrl: "",
    summonerId: "", puuid: "",
    soloQueue: null, flexQueue: null,
    matches: [], mastery: [], challenges: null, tftLeague: null,
    loading: true, loadingMatches: false, error: null,
  });

  useEffect(() => { getDragonVersion().then(setVer).catch(() => {}); }, []);

  useEffect(() => {
    getChampions().then(champs => {
      const map = new Map<number, string>();
      for (const champ of Object.values(champs)) {
        map.set(Number(champ.key), champ.id);
      }
      setChampIdMap(map);
    }).catch(() => {});
  }, []);

  const runeMap = useMemo(() => buildRuneMap(runePaths), [runePaths]);

  // Auto-fetch queue-specific matches when a filter is selected but the initial batch has none
  useEffect(() => {
    if (modeFilter === "All" || !state.puuid || state.loading || state.loadingMatches) return;
    const queueIds = QUEUE_FILTER_MAP[modeFilter];
    if (queueIds.length === 0) return;
    const alreadyHave = state.matches.some(m => queueIds.includes(m.info?.queueId));
    // Only fetch once per queue type per profile session
    const alreadyFetched = queueIds.every(q => fetchedQueues.has(q));
    if (alreadyHave || alreadyFetched) return;

    let cancelled = false;
    setLoadingQueueFilter(true);
    (async () => {
      try {
        for (const queueId of queueIds) {
          if (fetchedQueues.has(queueId)) continue;
          const ids = await fetchMatchIds(state.puuid, region, { queue: queueId, count: 20 });
          if (cancelled) return;
          const existing = new Set(state.matches.map(m => m.metadata.matchId));
          const newIds = ids.filter(id => !existing.has(id));
          if (newIds.length > 0) {
            const settled = await Promise.allSettled(newIds.map(id => fetchMatch(id, region)));
            if (cancelled) return;
            const newMatches = settled
              .filter((r): r is PromiseFulfilledResult<Match> => r.status === "fulfilled" && !!r.value?.info?.participants)
              .map(r => r.value);
            setState(s => ({
              ...s,
              matches: [...s.matches, ...newMatches].sort(
                (a, b) => (b.info.gameEndTimestamp ?? 0) - (a.info.gameEndTimestamp ?? 0),
              ),
            }));
          }
          setFetchedQueues(s => new Set([...s, queueId]));
        }
      } catch { /* silently ignore */ }
      if (!cancelled) setLoadingQueueFilter(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeFilter, state.puuid, state.loading, state.loadingMatches]);

  const loadProfile = useCallback(async () => {
    setFetchedQueues(new Set());
    setLoadingQueueFilter(false);
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const account  = await fetchAccount(gameName, tagLine, region);
      const summoner = await fetchSummoner(account.puuid, region);
      const iconUrl  = await getProfileIconUrl(summoner.profileIconId);
      const entries  = await fetchLeagueEntries(account.puuid, region);
      const solo     = entries.find(e => e.queueType === "RANKED_SOLO_5x5") ?? null;
      const flex     = entries.find(e => e.queueType === "RANKED_FLEX_SR")  ?? null;

      setState(s => ({
        ...s,
        gameName: account.gameName, tagLine: account.tagLine,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId, profileIconUrl: iconUrl,
        summonerId: account.puuid, puuid: account.puuid,
        soloQueue: solo, flexQueue: flex, loading: false,
      }));

      setState(s => ({ ...s, loadingMatches: true }));
      const matchIds     = await fetchMatchIds(account.puuid, region, { count: 20 });
      const settled      = await Promise.allSettled(matchIds.map(id => fetchMatch(id, region)));
      const matchDetails = settled
        .filter((r): r is PromiseFulfilledResult<Match> => r.status === "fulfilled" && !!r.value?.info?.participants)
        .map(r => r.value);
      setState(s => ({ ...s, matches: matchDetails, loadingMatches: false }));

      const mastery = await fetchMastery(account.puuid, region, 20);
      setState(s => ({ ...s, mastery }));

      try {
        const challenges = await fetchChallenges(account.puuid, region);
        setState(s => ({ ...s, challenges }));
      } catch { /* unavailable in some regions */ }

      try {
        const tftEntries = await fetchTFTLeague(account.puuid, region);
        const tft = tftEntries[0] ?? null;
        if (tft) {
          setState(s => ({
            ...s,
            tftLeague: { tier: tft.tier, rank: tft.rank, lp: tft.leaguePoints, wins: tft.wins, losses: tft.losses },
          }));
        }
      } catch { /* TFT unavailable */ }

    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [gameName, tagLine, region]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const filteredMatches = state.matches.filter(m => {
    const queues = QUEUE_FILTER_MAP[modeFilter];
    return queues.length === 0 || queues.includes(m.info.queueId);
  });

  const champStats = useMemo(() => {
    const map: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }> = {};
    for (const m of state.matches) {
      const me = m.info?.participants?.find(p => p.puuid === state.puuid);
      if (!me) continue;
      if (!map[me.championName]) map[me.championName] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      map[me.championName].games++;
      if (me.win) map[me.championName].wins++;
      map[me.championName].kills   += me.kills;
      map[me.championName].deaths  += me.deaths;
      map[me.championName].assists += me.assists;
    }
    return Object.entries(map)
      .map(([name, s]) => ({
        name, ...s,
        wr:  Math.round((s.wins / s.games) * 100),
        kda: kdaRatio(s.kills, s.deaths, s.assists),
      }))
      .sort((a, b) => b.games - a.games);
  }, [state.matches, state.puuid]);

  const lpHistory = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    date: `Day ${i + 1}`,
    lp: Math.max(0, Math.min(100, (state.soloQueue?.leaguePoints ?? 50) + (Math.sin(i) * 12) + i * 1.2)),
  })), [state.soloQueue]);

  const tierCol = rankColor(state.soloQueue?.tier ?? "");

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "Overview"   },
    { id: "champions",  label: "Champions"  },
    { id: "mastery",    label: "Mastery"    },
    { id: "challenges", label: "Challenges" },
    { id: "tft",        label: "TFT"        },
    { id: "analysis",   label: "Analysis"   },
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-5">
      <div className="mb-4">
        <SearchBar onSearch={onSearch} compact initialRegion={region} />
      </div>

      {/* Error */}
      {state.error && (
        <OrnatePanel className="p-8 text-center mb-4">
          <div className="text-[#FF4E50] font-['Cinzel'] text-sm mb-2">
            {state.error.toLowerCase().includes("forbidden") || state.error.includes("403")
              ? "API Key Expired"
              : state.error.toLowerCase().includes("404") || state.error.toLowerCase().includes("not found")
              ? "Summoner Not Found"
              : state.error.toLowerCase().includes("failed to fetch") || state.error.toLowerCase().includes("network")
              ? "Server Unavailable"
              : "Search Error"}
          </div>
          <div className="text-[#5B7A8C] text-xs mb-3">{state.error}</div>
          {(state.error.toLowerCase().includes("forbidden") || state.error.includes("403")) && (
            <div className="text-[#785A28] text-xs font-['Cinzel'] mt-2 border border-[#785A2844] p-3">
              Your Riot API key has expired. Renew at{" "}
              <span className="text-[#C89B3C]">developer.riotgames.com</span>{" "}
              then update <code className="text-[#0AC8B9]">server/.env</code>.
            </div>
          )}
          {(state.error.toLowerCase().includes("failed to fetch") || state.error.toLowerCase().includes("network")) && (
            <div className="text-[#785A28] text-xs font-['Cinzel'] mt-2 border border-[#785A2844] p-3">
              Make sure the API server is running: <code className="text-[#0AC8B9]">npm run dev:server</code>
            </div>
          )}
        </OrnatePanel>
      )}

      {/* Loading skeleton */}
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

      {/* Main content */}
      {!state.loading && !state.error && (
        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── Left Sidebar ── */}
          <div className="w-full lg:w-[280px] shrink-0 space-y-3">
            {/* Profile header */}
            <OrnatePanel className="overflow-hidden" accent>
              <div className="relative h-16 overflow-hidden"
                style={{ background: `linear-gradient(135deg,${tierCol}18,#071523,#010A13)` }}>
                <div className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,50 28,64 2,50 2,16' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "56px 100px",
                  }} />
              </div>
              <div className="px-4 pb-4 flex gap-3 -mt-7">
                <div className="relative w-14 h-14 shrink-0">
                  {state.profileIconUrl ? (
                    <img src={state.profileIconUrl} alt="icon" className="w-full h-full object-cover"
                      style={{ border: `2px solid ${tierCol}66` }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-['Cinzel'] font-black text-xl"
                      style={{ background: `linear-gradient(135deg,${tierCol}33,#071523)`, border: `2px solid ${tierCol}66`, color: tierCol }}>
                      {state.gameName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-['Cinzel'] font-bold px-1.5 py-0.5 bg-[#010A13] border whitespace-nowrap"
                    style={{ borderColor: tierCol + "44", color: tierCol }}>
                    {state.summonerLevel}
                  </div>
                </div>
                <div className="pt-2 min-w-0">
                  <h1 className="font-['Cinzel'] font-black text-base text-[#C8AA6E] truncate">{state.gameName}</h1>
                  <div className="text-[10px] text-[#5B7A8C] font-['Cinzel']">#{state.tagLine}</div>
                  <div className="text-[10px] text-[#5B7A8C]">{region}</div>
                </div>
              </div>
            </OrnatePanel>

            <RankSidebarCard label="Ranked Solo / Duo" entry={state.soloQueue} />
            <RankSidebarCard label="Ranked Flex 5v5"   entry={state.flexQueue} />
            {state.tftLeague && <TFTSidebarCard tft={state.tftLeague} />}
          </div>

          {/* ── Right Main ── */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-[#1E2D3D] mb-4 shrink-0">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`shrink-0 px-4 py-2.5 text-xs font-['Cinzel'] tracking-widest uppercase transition-all relative ${
                    tab === t.id ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
                  }`}>
                  {t.label}
                  {tab === t.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ background: "linear-gradient(90deg,transparent,#C89B3C,transparent)" }} />
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview tab ── */}
            {tab === "overview" && (
              <>
                {state.matches.length > 0 && !state.loadingMatches && (
                  <RecentGamesSummary matches={state.matches} puuid={state.puuid} />
                )}

                {/* Mode filter */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {(["All", "Ranked Solo", "Ranked Flex", "ARAM", "ARAM Mayhem", "Normal", "Arena"] as ModeFilter[]).map(f => (
                    <button key={f} onClick={() => setModeFilter(f)}
                      className={`px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
                        modeFilter === f
                          ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                          : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#A0B4C8]"
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>

                {/* Match list */}
                {state.loadingMatches ? (
                  <OrnatePanel className="p-6 text-center">
                    <div className="text-[#C89B3C] font-['Cinzel'] text-xs animate-pulse">Loading match history...</div>
                  </OrnatePanel>
                ) : (
                  <OrnatePanel className="overflow-hidden">
                    {filteredMatches.map(m => (
                      <MatchRow
                        key={m.metadata.matchId}
                        match={m}
                        puuid={state.puuid}
                        ver={ver}
                        runeMap={runeMap}
                        expanded={expandedId === m.metadata.matchId}
                        onToggle={() => setExpandedId(
                          expandedId === m.metadata.matchId ? null : m.metadata.matchId,
                        )}
                      />
                    ))}
                    {filteredMatches.length === 0 && (
                      loadingQueueFilter ? (
                        <div className="p-8 text-center">
                          <div className="text-[#C89B3C] font-['Cinzel'] text-xs animate-pulse">
                            Fetching {modeFilter} games...
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                          No {modeFilter} games found in recent history
                        </div>
                      )
                    )}
                  </OrnatePanel>
                )}
              </>
            )}

            {/* ── Champions tab ── */}
            {tab === "champions" && (
              <OrnatePanel className="overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1E2D3D]">
                      {["#", "Champion", "Games", "Win Rate", "KDA", "W / L"].map(h => (
                        <th key={h}
                          className={`px-4 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${h === "#" || h === "Champion" ? "text-left" : "text-center"}`}
                          style={{ fontSize: 10 }}>
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
                            <span className="font-['Cinzel'] text-[#C8AA6E]">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[#A0B4C8]">{c.games}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono font-bold" style={{ color: winRateColor(c.wr) }}>{c.wr}%</span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-[#C89B3C]">{c.kda}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[#0AC8B9]">{c.wins}W</span>
                          <span className="text-[#1E2D3D] mx-1">/</span>
                          <span className="text-[#FF4E50]">{c.games - c.wins}L</span>
                        </td>
                      </tr>
                    ))}
                    {champStats.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">No match data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </OrnatePanel>
            )}

            {/* ── Mastery tab ── */}
            {tab === "mastery" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Star className="w-4 h-4 text-[#C89B3C]" />
                  <h2 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Champion Mastery</h2>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {state.mastery.map(m => {
                    const champName = champIdMap.get(m.championId) ?? String(m.championId);
                    return (
                      <OrnatePanel key={m.championId} className="p-3 text-center" accent={m.championLevel >= 7}>
                        <ChampPortrait championName={champName} size={56} ring={m.championLevel >= 7} />
                        <div className="mt-2">
                          <div className="font-['Cinzel'] text-xs text-[#C8AA6E] truncate">{champName}</div>
                          <div className="font-['Cinzel'] text-[9px] text-[#A0B4C8]">Level {m.championLevel}</div>
                          <div className="font-mono text-[10px] text-[#C89B3C]">{m.championPoints.toLocaleString()} pts</div>
                          {m.chestGranted && <div className="text-[9px] text-[#0AC8B9] mt-1">✓ Chest</div>}
                        </div>
                      </OrnatePanel>
                    );
                  })}
                  {state.mastery.length === 0 && (
                    <div className="col-span-full p-8 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                      Loading mastery data...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Challenges tab ── */}
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
                        <div className="h-full rounded-full"
                          style={{
                            width: `${(state.challenges.totalPoints.current / state.challenges.totalPoints.max) * 100}%`,
                            background: rankColor(state.challenges.totalPoints.level),
                          }} />
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

            {/* ── TFT tab ── */}
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
                      <TFTSidebarCard tft={state.tftLeague} />
                    </OrnatePanel>
                  </div>
                ) : (
                  <OrnatePanel className="p-8 text-center">
                    <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">No TFT ranked data found</div>
                  </OrnatePanel>
                )}
              </div>
            )}

            {/* ── Analysis tab ── */}
            {tab === "analysis" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <OrnatePanel className="p-5">
                  <div className="font-['Cinzel'] text-xs tracking-widest text-[#785A28] uppercase mb-4">LP Trend (Estimated)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={lpHistory}>
                      <defs>
                        <linearGradient id="lpG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#C89B3C" stopOpacity={0.25} />
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
                    const g   = state.matches.map(m => m.info?.participants?.find(p => p.puuid === state.puuid)).filter(Boolean);
                    const w   = g.filter(m => m!.win).length;
                    const avgK = (g.reduce((a, m) => a + m!.kills,   0) / (g.length || 1)).toFixed(1);
                    const avgD = (g.reduce((a, m) => a + m!.deaths,  0) / (g.length || 1)).toFixed(1);
                    const avgA = (g.reduce((a, m) => a + m!.assists, 0) / (g.length || 1)).toFixed(1);
                    const avgCS = Math.round(g.reduce((a, m) => a + m!.totalMinionsKilled + m!.neutralMinionsKilled, 0) / (g.length || 1));
                    const wr20  = g.length ? Math.round((w / g.length) * 100) : 0;
                    return (
                      <div className="space-y-3">
                        {[
                          { label: "Win Rate",       value: `${wr20}%`,            sub: `${w}W ${g.length - w}L`, color: winRateColor(wr20) },
                          { label: "Avg KDA",        value: `${avgK}/${avgD}/${avgA}`, color: "#C89B3C" },
                          { label: "Avg CS",         value: String(avgCS),          color: "#A0B4C8" },
                          { label: "Games Analyzed", value: String(g.length),       color: "#A0B4C8" },
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
          </div>
        </div>
      )}
    </div>
  );
}
