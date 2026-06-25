import { useState, useEffect } from "react";
import { Crown, Flame } from "lucide-react";

function RankEmblem({ tier, size = 32 }: { tier: string; size?: number }) {
  const src = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <img src={src} width={size} height={size} className="object-contain w-full h-full"
        onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
    </div>
  );
}
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { TierBadge } from "@/components/common/TierBadge";
import { WinRateBar } from "@/components/common/WinRateBar";
import { fetchLeaderboard, fetchRiotIdByPuuid } from "@/api/client";
import { rankColor, winRateColor } from "@/lib/utils";
import type { Region } from "@/api/types";

const REGIONS: Region[] = ["NA", "EUW", "EUNE", "KR", "BR", "LAN", "LAS", "OCE", "TR", "RU", "JP"];
const TIERS = ["CHALLENGER", "GRANDMASTER", "MASTER"] as const;
type Tier = (typeof TIERS)[number];

const REGION_DEFAULT_TAG: Record<Region, string> = {
  NA: "NA1", EUW: "EUW", EUNE: "EUNE", KR: "KR1",
  BR: "BR1", LAN: "LAN1", LAS: "LAS2", OCE: "OCE1", TR: "TR1", RU: "RU", JP: "JP1",
};

const TIER_META: Record<Tier, { color: string; medal: string }> = {
  CHALLENGER:  { color: "#F4E070", medal: "🥇" },
  GRANDMASTER: { color: "#E84057", medal: "🥈" },
  MASTER:      { color: "#F178B6", medal: "🥉" },
};

interface LeaderboardEntry {
  rank: number;
  summonerName: string;
  puuid?: string;
  tier: Tier;
  lp: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
}


export function LeaderboardView({ onSearch }: { onSearch: (name: string, tag: string, region: Region) => void }) {
  const [region, setRegion]       = useState<Region>("NA");
  const [tier, setTier]           = useState<Tier>("CHALLENGER");
  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [clickingPuuid, setClickingPuuid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries([]);

    fetchLeaderboard(region, tier)
      .then(data => {
        if (cancelled) return;
        const mapped: LeaderboardEntry[] = (data.entries ?? [])
          .sort((a, b) => b.leaguePoints - a.leaguePoints)
          .slice(0, 50)
          .map((e, i) => ({
            rank: i + 1,
            summonerName: e.summonerName || `Player #${i + 1}`,
            puuid: e.puuid,
            tier: (data.tier ?? tier) as Tier,
            lp: e.leaguePoints ?? 0,
            wins: e.wins ?? 0,
            losses: e.losses ?? 0,
            hotStreak: e.hotStreak ?? false,
            veteran: e.veteran ?? false,
            freshBlood: e.freshBlood ?? false,
          }));
        setEntries(mapped);
      })
      .catch(err => {
        if (cancelled) return;
        setError((err as Error).message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [region, tier]);

  async function handlePlayerClick(entry: LeaderboardEntry) {
    if (clickingPuuid) return;
    if (entry.puuid) {
      setClickingPuuid(entry.puuid);
      try {
        const { gameName, tagLine } = await fetchRiotIdByPuuid(entry.puuid, region);
        onSearch(gameName, tagLine, region);
      } catch {
        onSearch(entry.summonerName, REGION_DEFAULT_TAG[region], region);
      } finally {
        setClickingPuuid(null);
      }
    } else {
      onSearch(entry.summonerName, REGION_DEFAULT_TAG[region], region);
    }
  }

  const topThree = entries.length >= 3 ? entries.slice(0, 3) : null;
  const tierMeta = TIER_META[tier];

  // Podium order: 2nd, 1st, 3rd
  const podium = topThree
    ? [topThree[1], topThree[0], topThree[2]] as const
    : null;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">
          Leaderboard
        </h2>
        <span className="text-[9px] font-['Cinzel'] px-2 py-0.5 border border-[#785A28]/40 text-[#785A28]">
          PATCH 26.13
        </span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
        {error && (
          <span className="text-[9px] text-[#FF4E50] font-['Cinzel']">API unavailable</span>
        )}
      </div>

      {/* Region + Tier filters */}
      <OrnatePanel className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Region */}
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Region</div>
            <div className="flex gap-1 flex-wrap">
              {REGIONS.map(r => (
                <button key={r} onClick={() => setRegion(r)}
                  className={`px-2.5 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
                    region === r
                      ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                      : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#A0B4C8]"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Tier */}
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Tier</div>
            <div className="flex gap-1">
              {TIERS.map(t => {
                const meta = TIER_META[t];
                return (
                  <button key={t} onClick={() => setTier(t)}
                    className="px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all"
                    style={tier === t
                      ? { color: meta.color, borderColor: meta.color, background: meta.color + "18" }
                      : { color: "#5B7A8C", borderColor: "#1E2D3D" }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </OrnatePanel>

      {/* Podium top 3 */}
      {!loading && podium && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {podium.map((player, podiumIdx) => {
            if (!player) return <div key={podiumIdx} />;
            const displayRank = [2, 1, 3][podiumIdx];
            const isFirst = displayRank === 1;
            const col = ["#C89B3C", "#F4E070", "#A0522D"][displayRank - 1];
            const total = (player.wins + player.losses) || 1;
            const wr = Math.round((player.wins / total) * 100);
            return (
              <OrnatePanel
                key={player.rank}
                className={`p-4 text-center cursor-pointer hover:bg-[#0A1428] transition-colors ${!isFirst ? "mt-8" : ""}`}
                accent={isFirst}
                onClick={() => handlePlayerClick(player)}
              >
                <div className="font-['Cinzel'] font-black text-3xl mb-2" style={{ color: col }}>
                  {["②", "①", "③"][podiumIdx]}
                </div>
                <div className={`mx-auto mb-2 ${isFirst ? "w-28 h-28" : "w-24 h-24"}`}
                  style={{ filter: `drop-shadow(0 0 6px ${col}66)` }}>
                  <RankEmblem tier={player.tier} size={isFirst ? 112 : 96} />
                </div>
                <div className="font-['Cinzel'] font-bold text-xs text-[#C8AA6E] truncate">{player.summonerName}</div>
                <div className="font-mono text-xs mt-1 font-bold" style={{ color: col }}>
                  {player.lp.toLocaleString()} LP
                </div>
                <TierBadge tier={player.tier} small />
                <div className="text-[9px] text-[#5B7A8C] font-mono mt-1">
                  {player.wins}W {player.losses}L · <span style={{ color: winRateColor(wr) }}>{wr}%</span>
                </div>
              </OrnatePanel>
            );
          })}
        </div>
      )}

      {/* Table */}
      <OrnatePanel className="overflow-hidden" accent>
        {loading ? (
          <div className="p-12 text-center">
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <div className="text-[#C89B3C] font-['Cinzel'] text-xs animate-pulse">Loading leaderboard...</div>
          </div>
        ) : (
          <>
            {error && (
              <div className="px-4 py-3 text-[10px] text-[#FF4E50] font-['Cinzel'] border-b border-[#1E2D3D] bg-[#FF4E5008]">
                Failed to load {region} {tier}: {error}
              </div>
            )}
            {!error && entries.length === 0 && (
              <div className="p-12 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                No data available for {region} {tier}
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#785A28]/40">
                  {["Rank", "Summoner", "Tier", "LP", "W / L", "Win Rate", "Status"].map(h => (
                    <th key={h}
                      className={`px-4 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${
                        h === "Rank" || h === "Summoner" ? "text-left" : "text-center"
                      }`}
                      style={{ fontSize: 10 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const total = (e.wins + e.losses) || 1;
                  const wr    = Math.round((e.wins / total) * 100);
                  const isTop3 = e.rank <= 3;
                  const col   = rankColor(e.tier);
                  return (
                    <tr
                      key={`${e.rank}-${e.summonerName}`}
                      className={`border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors cursor-pointer group ${clickingPuuid === e.puuid ? "opacity-60 pointer-events-none" : ""}`}
                      onClick={() => handlePlayerClick(e)}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isTop3 && (
                            <div className="w-5 h-5 flex items-center justify-center text-xs"
                              style={{ color: ["#F4E070", "#C89B3C", "#A0522D"][e.rank - 1] }}>
                              {["①", "②", "③"][e.rank - 1]}
                            </div>
                          )}
                          <span
                            className="font-['Cinzel'] font-bold text-sm"
                            style={{ color: isTop3 ? col : "#5B7A8C" }}>
                            #{e.rank}
                          </span>
                        </div>
                      </td>

                      {/* Summoner */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <RankEmblem tier={e.tier} size={80} />
                          <span className="font-['Cinzel'] text-[#C8AA6E] group-hover:text-[#F0E6BE] transition-colors truncate max-w-[160px]">
                            {e.summonerName}
                          </span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3 text-center">
                        <TierBadge tier={e.tier} small />
                      </td>

                      {/* LP */}
                      <td className="px-4 py-3 text-center">
                        <div className="font-mono font-bold text-sm" style={{ color: col }}>
                          {e.lp.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-[#5B7A8C]">LP</div>
                      </td>

                      {/* W / L */}
                      <td className="px-4 py-3 text-center">
                        <div>
                          <span className="text-[#0AC8B9] font-mono">{e.wins}W</span>
                          <span className="text-[#3A4A5A] mx-1">/</span>
                          <span className="text-[#FF4E50] font-mono">{e.losses}L</span>
                        </div>
                        <div className="w-24 mx-auto mt-1">
                          <WinRateBar wins={e.wins} losses={e.losses} />
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold text-sm" style={{ color: winRateColor(wr) }}>
                          {wr}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {e.hotStreak && (
                            <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 font-['Cinzel']"
                              style={{ background: "#FF4E5015", color: "#FF4E50", border: "1px solid #FF4E5040" }}>
                              <Flame className="w-2 h-2" />HOT
                            </span>
                          )}
                          {e.veteran && (
                            <span className="text-[8px] px-1.5 py-0.5 font-['Cinzel']"
                              style={{ background: "#C89B3C15", color: "#C89B3C", border: "1px solid #C89B3C40" }}>
                              VET
                            </span>
                          )}
                          {e.freshBlood && (
                            <span className="text-[8px] px-1.5 py-0.5 font-['Cinzel']"
                              style={{ background: "#0AC8B915", color: "#0AC8B9", border: "1px solid #0AC8B940" }}>
                              NEW
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-[#1E2D3D] flex items-center justify-between">
              <div className="text-[9px] text-[#5B7A8C] font-['Cinzel']">
                Showing top {entries.length} players · {region} {tier}
              </div>
              <div className="text-[9px] text-[#3A4A5A] font-mono">Patch 26.13</div>
            </div>
          </>
        )}
      </OrnatePanel>
    </div>
  );
}
