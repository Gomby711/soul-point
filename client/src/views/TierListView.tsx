import { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import { useChampionData } from "@/hooks/useChampionData";
import type { PrimaryRole } from "@/hooks/useChampionData";
import { RoleIcon, RoleBadge } from "@/components/common/RoleIcon";
import { useState } from "react";
import { prefetchOPGGBuild } from "@/views/ChampionBuildSubPage";

const TIERS_DISPLAY = ["S+", "S", "A+", "A", "B", "C"] as const;
const ROLES: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const TIER_BG: Record<string, string> = {
  "S+": "rgba(244,224,112,0.05)", S: "rgba(200,155,60,0.05)",
  "A+": "rgba(10,200,185,0.05)",  A: "rgba(160,180,200,0.05)",
  B:   "rgba(91,122,140,0.05)",   C: "rgba(58,74,90,0.05)",
};
const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};
const TIER_BORDER: Record<string, string> = {
  "S+": "#F4E07040", S: "#C89B3C40", "A+": "#0AC8B940", A: "#A0B4C840", B: "#5B7A8C40", C: "#3a4a5a40",
};

interface TierListViewProps {
  onSelectChampion?: (id: string) => void;
}

export function TierListView({ onSelectChampion }: TierListViewProps) {
  const { champions, loading, version } = useChampionData();
  const [role, setRole] = useState<PrimaryRole | "All">("All");

  const patchLabel = useMemo(() => {
    if (!version) return "Loading...";
    // version looks like "15.12.1" — show first two parts
    const parts = version.split(".");
    return parts.length >= 2 ? `Patch ${parts[0]}.${parts[1]}` : `Patch ${version}`;
  }, [version]);

  const byTier = useMemo(() => {
    const map: Record<string, typeof champions> = { "S+": [], S: [], "A+": [], A: [], B: [], C: [] };
    for (const c of champions) {
      if (role !== "All" && c.primaryRole !== role) continue;
      const tier = c.tier in map ? c.tier : "C";
      map[tier].push(c);
    }
    // Sort within each tier by win rate descending
    for (const tier of TIERS_DISPLAY) {
      map[tier].sort((a, b) => b.winRate - a.winRate);
    }
    return map;
  }, [champions, role]);

  const totalShown = useMemo(
    () => TIERS_DISPLAY.reduce((sum, t) => sum + (byTier[t]?.length ?? 0), 0),
    [byTier],
  );

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">
          Tier List — {patchLabel}
        </h2>
        {!loading && (
          <span className="text-[10px] font-['Cinzel'] text-[#5B7A8C] ml-1">
            {totalShown} champions
          </span>
        )}
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
      </div>

      {/* Role filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
              role === r
                ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
            }`}
          >
            {r !== "All" && (
              role === r
                ? <RoleBadge role={r} size={18} />
                : <RoleIcon role={r} size={16} color="#5B7A8C" />
            )}
            {r}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-[#C89B3C] font-['Cinzel'] animate-pulse">Loading champions...</div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Tier rows */}
      {!loading && (
        <div className="space-y-2">
          {TIERS_DISPLAY.map(tier => {
            const champs = byTier[tier] ?? [];
            return (
              <div
                key={tier}
                className="flex items-start gap-0 rounded-sm border overflow-hidden"
                style={{ background: TIER_BG[tier], borderColor: TIER_BORDER[tier] }}
              >
                {/* Tier label column */}
                <div
                  className="w-14 shrink-0 flex items-center justify-center font-['Cinzel'] font-black text-2xl self-stretch"
                  style={{
                    color: TIER_COLORS[tier],
                    background: TIER_COLORS[tier] + "10",
                    borderRight: `1px solid ${TIER_BORDER[tier]}`,
                    minHeight: 64,
                  }}
                >
                  {tier}
                </div>

                {/* Champion icons */}
                <div className="flex flex-wrap gap-2 p-2.5 flex-1" style={{ minHeight: 64 }}>
                  {champs.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onSelectChampion?.(c.id)}
                      onMouseEnter={() => prefetchOPGGBuild(c.name, c.primaryRole)}
                      title={`${c.name} — ${c.primaryRole} — WR ${c.winRate.toFixed(1)}%`}
                      className="flex flex-col items-center gap-0.5 group cursor-pointer"
                    >
                      <div className="relative w-11 h-11 shrink-0">
                        <div
                          className="w-11 h-11 rounded-sm overflow-hidden border transition-colors"
                          style={{ borderColor: TIER_BORDER[tier] }}
                        >
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                          />
                        </div>
                        {/* Role badge */}
                        <div className="absolute -bottom-1 -right-1">
                          <RoleBadge role={c.primaryRole} size={18} />
                        </div>
                      </div>
                      <span
                        className="text-[8px] font-['Cinzel'] transition-colors text-center leading-tight w-11 truncate"
                        style={{ color: TIER_COLORS[tier] + "99" }}
                      >
                        {c.name.split(/[\s']/)[0]}
                      </span>
                    </button>
                  ))}
                  {champs.length === 0 && (
                    <div className="text-[10px] text-[#2E4A5C] font-['Cinzel'] self-center px-2">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
