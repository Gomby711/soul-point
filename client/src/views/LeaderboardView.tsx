import { useState, useEffect } from "react";
import { Crown, Trophy, Users } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { TierBadge } from "@/components/common/TierBadge";
import { ChampPortrait } from "@/components/common/ChampPortrait";
import { WinRateBar } from "@/components/common/WinRateBar";
import { fetchLeaderboard } from "@/api/client";
import { rankColor } from "@/lib/utils";
import type { Region } from "@/api/types";

const REGIONS: Region[] = ["NA", "EUW", "EUNE", "KR", "BR", "LAN", "LAS", "OCE", "TR", "RU", "JP"];
const TIERS = ["CHALLENGER", "GRANDMASTER", "MASTER"];

interface LeaderboardEntry {
  rank: number;
  summonerName: string;
  tier: string;
  lp: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
}

const STATIC_DATA: LeaderboardEntry[] = [
  { rank: 1,  summonerName: "Faker",      tier: "CHALLENGER",  lp: 1847, wins: 312, losses: 198, hotStreak: true,  veteran: true,  freshBlood: false },
  { rank: 2,  summonerName: "Caps",       tier: "CHALLENGER",  lp: 1623, wins: 287, losses: 201, hotStreak: false, veteran: true,  freshBlood: false },
  { rank: 3,  summonerName: "Ruler",      tier: "CHALLENGER",  lp: 1591, wins: 301, losses: 214, hotStreak: true,  veteran: false, freshBlood: false },
  { rank: 4,  summonerName: "Zeus",       tier: "CHALLENGER",  lp: 1544, wins: 278, losses: 195, hotStreak: false, veteran: true,  freshBlood: false },
  { rank: 5,  summonerName: "BeryL",      tier: "CHALLENGER",  lp: 1511, wins: 265, losses: 188, hotStreak: false, veteran: false, freshBlood: false },
  { rank: 6,  summonerName: "Keria",      tier: "CHALLENGER",  lp: 1488, wins: 241, losses: 179, hotStreak: true,  veteran: false, freshBlood: false },
  { rank: 7,  summonerName: "Oner",       tier: "GRANDMASTER", lp: 1342, wins: 220, losses: 172, hotStreak: false, veteran: false, freshBlood: false },
  { rank: 8,  summonerName: "Jankos",     tier: "GRANDMASTER", lp: 1290, wins: 198, losses: 163, hotStreak: false, veteran: true,  freshBlood: false },
  { rank: 9,  summonerName: "Humanoid",   tier: "GRANDMASTER", lp: 1261, wins: 187, losses: 155, hotStreak: true,  veteran: false, freshBlood: false },
  { rank: 10, summonerName: "Inspired",   tier: "GRANDMASTER", lp: 1198, wins: 176, losses: 148, hotStreak: false, veteran: false, freshBlood: false },
];

export function LeaderboardView({ onSearch }: { onSearch: (name: string, tag: string, region: Region) => void }) {
  const [selectedRegion, setSelectedRegion] = useState<Region>("KR");
  const [selectedTier, setSelectedTier]     = useState("CHALLENGER");
  const [entries, setEntries]               = useState<LeaderboardEntry[]>(STATIC_DATA);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(selectedRegion, selectedTier)
      .then(data => {
        const mapped: LeaderboardEntry[] = data.entries
          .sort((a, b) => b.leaguePoints - a.leaguePoints)
          .slice(0, 50)
          .map((e, i) => ({
            rank: i + 1,
            summonerName: e.summonerName,
            tier: data.tier,
            lp: e.leaguePoints,
            wins: e.wins,
            losses: e.losses,
            hotStreak: e.hotStreak,
            veteran: e.veteran,
            freshBlood: e.freshBlood,
          }));
        setEntries(mapped);
      })
      .catch(() => { /* fallback to static */ })
      .finally(() => setLoading(false));
  }, [selectedRegion, selectedTier]);

  const topThree = entries.slice(0, 3);

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">Leaderboard</h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
                selectedRegion === r
                  ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                  : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TIERS.map(t => (
            <button
              key={t}
              onClick={() => setSelectedTier(t)}
              className="px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all"
              style={
                selectedTier === t
                  ? { color: rankColor(t), borderColor: rankColor(t), background: rankColor(t) + "18" }
                  : { color: "#5B7A8C", borderColor: "#1E2D3D" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      {topThree.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[topThree[1], topThree[0], topThree[2]].map((p, i) => {
            const displayRank = i === 1 ? 1 : i === 0 ? 2 : 3;
            const size = i === 1 ? "large" : "small";
            const col = ["#C89B3C", "#F4E070", "#A0522D"][displayRank - 1];
            return (
              <OrnatePanel
                key={p.summonerName}
                className={`p-4 text-center ${i === 1 ? "" : "mt-8"}`}
                accent={displayRank === 1}
              >
                <div
                  className="font-['Cinzel'] font-black text-3xl mb-2"
                  style={{ color: col }}
                >
                  {["②", "①", "③"][i]}
                </div>
                <div
                  className={`mx-auto flex items-center justify-center font-['Cinzel'] font-black rounded-sm mb-3 ${size === "large" ? "w-16 h-16 text-2xl" : "w-12 h-12 text-xl"}`}
                  style={{ background: col + "22", border: `2px solid ${col}66`, color: col }}
                >
                  {p.summonerName[0]}
                </div>
                <div className="font-['Cinzel'] font-bold text-sm text-[#C8AA6E]">{p.summonerName}</div>
                <div className="font-mono text-xs mt-1" style={{ color: col }}>{p.lp.toLocaleString()} LP</div>
                <TierBadge tier={p.tier} small />
              </OrnatePanel>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <OrnatePanel className="overflow-hidden" accent>
        {loading ? (
          <div className="p-8 text-center text-[#C89B3C] font-['Cinzel'] text-xs animate-pulse">Loading leaderboard...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#785A28]/40">
                {["Rank", "Summoner", "Tier", "LP", "W / L", "Win Rate", "Status"].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${
                      h === "Rank" || h === "Summoner" ? "text-left" : "text-center"
                    }`}
                    style={{ fontSize: 10 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const wr = Math.round((e.wins / (e.wins + e.losses)) * 100);
                return (
                  <tr
                    key={e.rank}
                    className="border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors cursor-pointer"
                    onClick={() => onSearch(e.summonerName, "NA1", selectedRegion)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="font-['Cinzel'] font-bold text-sm"
                        style={{ color: e.rank <= 3 ? "#C89B3C" : "#5B7A8C" }}
                      >
                        #{e.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-['Cinzel'] text-[#C8AA6E] hover:text-[#F0E6BE]">{e.summonerName}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TierBadge tier={e.tier} small />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold text-[#C89B3C]">{e.lp.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[#0AC8B9]">{e.wins}W</span>
                      <span className="text-[#1E2D3D] mx-1">/</span>
                      <span className="text-[#FF4E50]">{e.losses}L</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold" style={{ color: wr >= 55 ? "#0AC8B9" : wr >= 50 ? "#C89B3C" : "#FF4E50" }}>
                        {wr}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {e.hotStreak && (
                          <span className="text-[8px] px-1 py-0.5 font-['Cinzel']" style={{ background: "#FF4E5015", color: "#FF4E50", border: "1px solid #FF4E5040" }}>
                            HOT
                          </span>
                        )}
                        {e.veteran && (
                          <span className="text-[8px] px-1 py-0.5 font-['Cinzel']" style={{ background: "#C89B3C15", color: "#C89B3C", border: "1px solid #C89B3C40" }}>
                            VET
                          </span>
                        )}
                        {e.freshBlood && (
                          <span className="text-[8px] px-1 py-0.5 font-['Cinzel']" style={{ background: "#0AC8B915", color: "#0AC8B9", border: "1px solid #0AC8B940" }}>
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
        )}
      </OrnatePanel>
    </div>
  );
}
