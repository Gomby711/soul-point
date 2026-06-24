import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { winRateColor } from "@/lib/utils";
import { useChampionData, type ChampionInfo, type PrimaryRole } from "@/hooks/useChampionData";
import { ChampionBuildSubPage } from "@/views/ChampionBuildSubPage";

// ── Role filter icons ──────────────────────────────────────────
const ROLE_TABS: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const ROLE_ICONS: Record<string, string> = {
  All: "★", Top: "⚔", Jungle: "🌿", Mid: "◈", ADC: "🏹", Support: "🛡",
};

const ROLE_LABEL_MAP: Record<string, string> = {
  All: "All", Top: "Top", Jungle: "Jungle", Mid: "Middle", ADC: "Bottom", Support: "Support",
};

const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};

const TIER_ORDER: Record<string, number> = { "S+": 0, S: 1, "A+": 2, A: 3, B: 4, C: 5 };

// Deterministic hash for picking weak-against champions
function champHash(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) & 0x7fffffff;
  return h / 0x7fffffff;
}

interface ChampionsViewProps {
  initialChampionId?: string | null;
  onNavigateToChampion?: (id: string) => void;
}

export function ChampionsView({ initialChampionId, onNavigateToChampion }: ChampionsViewProps) {
  const { champions, loading } = useChampionData();
  const [selectedId, setSelectedId]     = useState<string | null>(initialChampionId ?? null);
  const [leftRole, setLeftRole]         = useState<PrimaryRole | "All">("All");
  const [leftQuery, setLeftQuery]       = useState("");
  const [rightRole, setRightRole]       = useState<PrimaryRole | "All">("All");

  // Sync external initialChampionId changes
  useEffect(() => {
    if (initialChampionId) setSelectedId(initialChampionId);
  }, [initialChampionId]);

  const handleSelectChampion = (id: string) => {
    setSelectedId(id);
    onNavigateToChampion?.(id);
  };

  const selectedChampion = selectedId ? champions.find(c => c.id === selectedId) ?? null : null;

  // If a champion is selected, show the build sub-page
  if (selectedChampion) {
    return (
      <ChampionBuildSubPage
        champion={selectedChampion}
        champions={champions}
        onBack={() => setSelectedId(null)}
        onSelectChampion={handleSelectChampion}
      />
    );
  }

  // ── Left panel data ────────────────────────────────────────
  const leftFiltered = useMemo(() => {
    const q = leftQuery.toLowerCase();
    return champions
      .filter(c => (leftRole === "All" || c.primaryRole === leftRole) && c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, leftRole, leftQuery]);

  // ── Right panel data ───────────────────────────────────────
  const rightFiltered = useMemo(() => {
    const list = rightRole === "All"
      ? champions
      : champions.filter(c => c.primaryRole === rightRole);
    return [...list].sort((a, b) =>
      (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99) || b.winRate - a.winRate
    );
  }, [champions, rightRole]);

  // Generate "weak against" champion icons for each champion in the right panel
  const weakAgainstMap = useMemo(() => {
    const map: Record<string, ChampionInfo[]> = {};
    const all = [...champions];
    for (const champ of rightFiltered) {
      const others = all.filter(c => c.id !== champ.id && c.primaryRole === champ.primaryRole);
      const sorted = [...others].sort((a, b) => champHash(champ.name + a.name) - champHash(champ.name + b.name));
      map[champ.id] = sorted.slice(0, 3);
    }
    return map;
  }, [rightFiltered, champions]);

  // Trend rank changes (simulated)
  const trendMap = useMemo(() => {
    const map: Record<string, number> = {};
    rightFiltered.forEach((c, i) => {
      const h = champHash(c.name + "rank");
      map[c.id] = Math.round((h - 0.5) * 40);
    });
    return map;
  }, [rightFiltered]);

  return (
    <div className="flex" style={{ height: "calc(100vh - 49px)" }}>
      {/* ── Left panel: champion icon grid ───────────────────── */}
      <div
        className="flex flex-col border-r border-[#1E2D3D] shrink-0"
        style={{ width: 280, background: "#060E1A" }}
      >
        {/* Search */}
        <div className="p-2 border-b border-[#1E2D3D]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
            <input
              value={leftQuery}
              onChange={e => setLeftQuery(e.target.value)}
              placeholder="Search a champion"
              className="w-full pl-8 pr-3 py-2 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28]"
            />
          </div>
        </div>

        {/* Role filter icons */}
        <div className="flex items-center gap-0.5 p-2 border-b border-[#1E2D3D] flex-wrap">
          {ROLE_TABS.map(r => (
            <button
              key={r}
              onClick={() => setLeftRole(r)}
              title={r}
              className={`flex-1 min-w-[32px] h-8 flex items-center justify-center text-sm rounded-sm transition-all border ${
                leftRole === r
                  ? "border-[#C89B3C] bg-[#C89B3C]/15 text-[#C89B3C]"
                  : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#A0B4C8]"
              }`}
            >
              {ROLE_ICONS[r]}
            </button>
          ))}
        </div>

        {/* Champion grid */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-[#C89B3C] text-xs font-['Cinzel'] animate-pulse">Loading...</div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {leftFiltered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectChampion(c.id)}
                  className="flex flex-col items-center gap-0.5 p-1 rounded-sm hover:bg-[#0A1428] transition-colors group"
                  title={c.name}
                >
                  <div className="w-10 h-10 rounded-sm overflow-hidden border border-[#1E2D3D] group-hover:border-[#785A28] transition-colors">
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                    />
                  </div>
                  <div className="text-[7px] font-['Cinzel'] text-[#5B7A8C] group-hover:text-[#C89B3C] transition-colors text-center leading-tight w-full truncate">
                    {c.name.split(" ")[0]}
                  </div>
                </button>
              ))}
              {leftFiltered.length === 0 && (
                <div className="col-span-5 text-center py-8 text-[#2E4A5C] font-['Cinzel'] text-xs">
                  No champions found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: ranked tier list ────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Role tab buttons */}
        <div className="flex border-b border-[#1E2D3D] shrink-0" style={{ background: "#060E1A" }}>
          {ROLE_TABS.map(r => (
            <button
              key={r}
              onClick={() => setRightRole(r)}
              className={`flex-1 py-3 text-[11px] font-['Cinzel'] tracking-widest transition-all border-b-2 ${
                rightRole === r
                  ? "text-[#C8AA6E] border-[#0AC8B9] bg-[#0AC8B9]/8"
                  : "text-[#5B7A8C] border-transparent hover:text-[#A0B4C8] hover:bg-[#0A1428]"
              }`}
            >
              {ROLE_LABEL_MAP[r]}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="text-[#C89B3C] font-['Cinzel'] text-sm animate-pulse">Loading champions...</div>
            </div>
          ) : (
            <table className="w-full text-xs" style={{ background: "#060E1A" }}>
              <thead className="sticky top-0 z-10" style={{ background: "#060E1A" }}>
                <tr className="border-b border-[#1E2D3D]">
                  {["Rank", "Champion", "Tier", "Role", "Win rate", "Pick rate", "Ban rate", "Weak against"].map(h => (
                    <th
                      key={h}
                      className={`px-3 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${
                        ["Rank", "Champion"].includes(h) ? "text-left" : "text-center"
                      }`}
                      style={{ fontSize: 9 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rightFiltered.map((c, i) => {
                  const trend = trendMap[c.id] ?? 0;
                  const weakAgainst = weakAgainstMap[c.id] ?? [];
                  const tierColor = TIER_COLORS[c.tier] ?? "#A0B4C8";

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors cursor-pointer group"
                      onClick={() => handleSelectChampion(c.id)}
                    >
                      {/* Rank */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#5B7A8C] text-[10px] w-5 text-right">{i + 1}</span>
                          {trend !== 0 && (
                            <div className="flex items-center gap-0.5" style={{ color: trend > 0 ? "#0AC8B9" : "#FF4E50" }}>
                              {trend > 0 ? (
                                <><ArrowUp className="w-2.5 h-2.5" /><span className="text-[8px] font-mono">{trend}</span></>
                              ) : (
                                <><ArrowDown className="w-2.5 h-2.5" /><span className="text-[8px] font-mono">{Math.abs(trend)}</span></>
                              )}
                            </div>
                          )}
                          {trend === 0 && <span className="text-[8px] text-[#3a4a5a] font-mono w-8">=</span>}
                        </div>
                      </td>

                      {/* Champion */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D] group-hover:border-[#785A28] transition-colors">
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                            />
                          </div>
                          <span className="font-['Cinzel'] text-[11px] text-[#C8AA6E] group-hover:text-[#F0E6BE] transition-colors whitespace-nowrap">
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-3 py-2 text-center">
                        <span
                          className="font-['Cinzel'] font-bold text-[10px] px-2 py-0.5 rounded-sm"
                          style={{
                            color: tierColor,
                            background: tierColor + "18",
                            border: `1px solid ${tierColor}44`,
                          }}
                        >
                          {c.tier}
                        </span>
                      </td>

                      {/* Role icon */}
                      <td className="px-3 py-2 text-center">
                        <span className="text-sm" title={c.primaryRole}>{ROLE_ICONS[c.primaryRole]}</span>
                      </td>

                      {/* Win rate */}
                      <td className="px-3 py-2 text-center">
                        <div className="font-mono font-bold text-[11px]" style={{ color: winRateColor(c.winRate) }}>
                          {c.winRate.toFixed(2)}%
                        </div>
                      </td>

                      {/* Pick rate */}
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-[#A0B4C8]">
                        {c.pickRate.toFixed(2)}%
                      </td>

                      {/* Ban rate */}
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-[#A0B4C8]">
                        {c.banRate.toFixed(2)}%
                      </td>

                      {/* Weak against */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {weakAgainst.map(wc => (
                            <div
                              key={wc.id}
                              className="w-7 h-7 rounded-sm overflow-hidden border border-[#1E2D3D] hover:border-[#FF4E50] transition-colors"
                              title={wc.name}
                              onClick={e => { e.stopPropagation(); handleSelectChampion(wc.id); }}
                            >
                              <img
                                src={wc.imageUrl}
                                alt={wc.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={e2 => { (e2.target as HTMLImageElement).style.opacity = "0.2"; }}
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rightFiltered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                      No champions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
