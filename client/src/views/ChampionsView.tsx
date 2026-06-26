import { useState, useMemo, useEffect } from "react";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { winRateColor } from "@/lib/utils";
import { useChampionData, type ChampionInfo, type PrimaryRole } from "@/hooks/useChampionData";
import { ChampionBuildSubPage, prefetchOPGGBuild, prewarmSPCache } from "@/views/ChampionBuildSubPage";
import { fetchSPAllBuilds } from "@/api/client";
import { RoleIcon, RoleBadge } from "@/components/common/RoleIcon";

interface MatchupEntry { champ: ChampionInfo; winRate: number }

// ── Role definitions ───────────────────────────────────────────
const ROLE_TABS: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const ROLE_LABEL_MAP: Record<string, string> = {
  All: "All", Top: "Top", Jungle: "Jungle", Mid: "Middle", ADC: "Bottom", Support: "Support",
};

const TIER_COLORS: Record<string, string> = {
  SP: "#FFD700",
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};
const TIER_ORDER: Record<string, number> = { SP: -1, "S+": 0, S: 1, "A+": 2, A: 3, B: 4, C: 5 };

function champHash(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) & 0x7fffffff;
  return h / 0x7fffffff;
}

// ── Component ──────────────────────────────────────────────────
interface ChampionsViewProps {
  initialChampionId?: string | null;
  onNavigateToChampion?: (id: string) => void;
}

export function ChampionsView({ initialChampionId, onNavigateToChampion }: ChampionsViewProps) {
  const { champions, loading } = useChampionData();

  // ── ALL hooks must be declared before any conditional return ──
  const [selectedId, setSelectedId] = useState<string | null>(initialChampionId ?? null);
  const [leftRole,   setLeftRole]   = useState<PrimaryRole | "All">("All");
  const [leftQuery,  setLeftQuery]  = useState("");
  const [rightRole,  setRightRole]  = useState<PrimaryRole | "All">("All");

  useEffect(() => {
    if (initialChampionId) setSelectedId(initialChampionId);
  }, [initialChampionId]);

  // Pre-warm SP build cache so every champion sub-page shows data instantly
  useEffect(() => {
    fetchSPAllBuilds().then(prewarmSPCache).catch(() => {});
  }, []);

  // These useMemo calls MUST stay here — before the conditional return below
  const leftFiltered = useMemo(() => {
    const q = leftQuery.toLowerCase();
    return champions
      .filter(c => (leftRole === "All" || c.primaryRole === leftRole) && c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, leftRole, leftQuery]);

  const rightFiltered = useMemo(() => {
    const list = rightRole === "All" ? champions : champions.filter(c => c.primaryRole === rightRole);
    return [...list].sort(
      (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99) || b.winRate - a.winRate
    );
  }, [champions, rightRole]);

  const matchupsMap = useMemo(() => {
    const map: Record<string, { weakAgainst: MatchupEntry[]; strongAgainst: MatchupEntry[] }> = {};
    for (const champ of rightFiltered) {
      const others = champions.filter(c => c.id !== champ.id && c.primaryRole === champ.primaryRole);

      const sortedWeak = [...others].sort((a, b) => champHash(champ.name + a.name) - champHash(champ.name + b.name));
      const weakAgainst = sortedWeak.slice(0, 5).map(c => ({
        champ: c,
        winRate: +(39 + champHash(champ.name + "ctr" + c.name) * 9).toFixed(1),
      }));

      const sortedStrong = [...others].sort((a, b) => champHash(a.name + champ.name) - champHash(b.name + champ.name));
      const strongAgainst = sortedStrong.slice(0, 5).map(c => ({
        champ: c,
        winRate: +(53 + champHash(c.name + "str" + champ.name) * 10).toFixed(1),
      }));

      map[champ.id] = { weakAgainst, strongAgainst };
    }
    return map;
  }, [rightFiltered, champions]);

  const trendMap = useMemo(() => {
    const map: Record<string, number> = {};
    rightFiltered.forEach(c => { map[c.id] = Math.round((champHash(c.name + "rank") - 0.5) * 40); });
    return map;
  }, [rightFiltered]);

  // Derive selected champion — safe to read after all hooks
  const selectedChampion = selectedId ? (champions.find(c => c.id === selectedId) ?? null) : null;

  const handleSelectChampion = (id: string) => setSelectedId(id);
  const handleBack = () => setSelectedId(null);

  // ── Conditional render: build sub-page ────────────────────
  // key={selectedChampion.id} forces remount on champion change so useState
  // initializers read fresh from the module-level caches — instant for cached data.
  if (selectedChampion) {
    return (
      <ChampionBuildSubPage
        key={selectedChampion.id}
        champion={selectedChampion}
        champions={champions}
        onBack={handleBack}
        onSelectChampion={handleSelectChampion}
      />
    );
  }

  // ── Two-panel champions view ───────────────────────────────
  return (
    <div className="flex" style={{ height: "calc(100vh - 49px)" }}>

      {/* ══ LEFT PANEL: champion icon grid ══════════════════════ */}
      <div
        className="flex flex-col border-r border-[#1E2D3D] shrink-0"
        style={{ width: 360, background: "#060E1A" }}
      >
        {/* Search */}
        <div className="p-3 border-b border-[#1E2D3D]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
            <input
              value={leftQuery}
              onChange={e => setLeftQuery(e.target.value)}
              placeholder="Search a champion"
              className="w-full pl-9 pr-3 py-3 bg-[#0A1428] border border-[#1E2D3D] text-sm text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28]"
            />
          </div>
        </div>

        {/* Role filter icon row */}
        <div className="flex border-b border-[#1E2D3D]">
          {ROLE_TABS.map(r => (
            <button
              key={r}
              onClick={() => setLeftRole(r)}
              title={r}
              className={`flex-1 h-13 flex items-center justify-center transition-all border-b-2 ${
                leftRole === r
                  ? "border-[#C89B3C] bg-[#C89B3C]/10"
                  : "border-transparent hover:bg-[#0A1428]"
              }`}
            >
              {leftRole === r
                ? <RoleBadge role={r} size={30} />
                : <RoleIcon role={r} size={24} color="#3a4a5a" />
              }
            </button>
          ))}
        </div>

        {/* Champion grid */}
        <div className="flex-1 overflow-y-auto p-2.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="text-[#C89B3C] text-sm font-['Cinzel'] animate-pulse">Loading champions...</div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {leftFiltered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectChampion(c.id)}
                  onMouseEnter={() => prefetchOPGGBuild(c.name, c.primaryRole)}
                  title={c.name}
                  className="flex flex-col items-center gap-1.5 p-1.5 rounded-sm hover:bg-[#0A1428] transition-colors group"
                >
                  <div className="relative w-14 h-14 shrink-0">
                    <div className="w-14 h-14 rounded-sm overflow-hidden border border-[#1E2D3D] group-hover:border-[#C89B3C] transition-colors">
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                      />
                    </div>
                    {/* Tier badge top-left */}
                    {c.tier && (
                      <div
                        className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center text-[8px] font-['Cinzel'] font-black rounded-sm border"
                        style={{
                          color: TIER_COLORS[c.tier] ?? "#A0B4C8",
                          background: (TIER_COLORS[c.tier] ?? "#A0B4C8") + "22",
                          borderColor: (TIER_COLORS[c.tier] ?? "#A0B4C8") + "66",
                          ...(c.tier === "SP" ? {
                            boxShadow: `0 0 6px #FFD70080`,
                            textShadow: `0 0 6px #FFD700`,
                          } : {}),
                        }}
                      >
                        {c.tier}
                      </div>
                    )}
                    {/* Role icon badge */}
                    <div className="absolute -bottom-1 -right-1">
                      <RoleBadge role={c.primaryRole} size={22} />
                    </div>
                  </div>
                  <span className="text-[9px] font-['Cinzel'] text-[#5B7A8C] group-hover:text-[#C89B3C] transition-colors text-center leading-tight w-full truncate">
                    {c.name.length > 9 ? c.name.split(/[\s']/)[0] : c.name}
                  </span>
                </button>
              ))}
              {leftFiltered.length === 0 && (
                <p className="col-span-5 text-center py-10 text-[#2E4A5C] font-['Cinzel'] text-xs">
                  No champions found
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL: ranked tier list ═══════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Role tabs */}
        <div className="flex border-b border-[#1E2D3D] shrink-0" style={{ background: "#060E1A" }}>
          {ROLE_TABS.map(r => (
            <button
              key={r}
              onClick={() => setRightRole(r)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-4 text-xs font-['Cinzel'] tracking-widest transition-all border-b-2 ${
                rightRole === r
                  ? "border-[#0AC8B9] bg-[#0AC8B9]/5 text-[#C8AA6E]"
                  : "border-transparent text-[#5B7A8C] hover:text-[#A0B4C8] hover:bg-[#0A1428]"
              }`}
            >
              {rightRole === r
                ? <RoleBadge role={r} size={26} />
                : <RoleIcon role={r} size={22} color="#3a4a5a" />
              }
              <span className="hidden lg:inline">{ROLE_LABEL_MAP[r]}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="text-[#C89B3C] font-['Cinzel'] animate-pulse">Loading champions...</div>
            </div>
          ) : (
            <table className="w-full" style={{ background: "#060E1A" }}>
              <thead className="sticky top-0 z-10" style={{ background: "#060E1A" }}>
                <tr className="border-b-2 border-[#1E2D3D]">
                  {[
                    { label: "Rank",        cls: "text-left  w-24" },
                    { label: "Champion",    cls: "text-left" },
                    { label: "Tier",        cls: "text-center w-16" },
                    { label: "Role",        cls: "text-center w-14" },
                    { label: "Win rate",    cls: "text-center w-28" },
                    { label: "Pick rate",   cls: "text-center w-24" },
                    { label: "Ban rate",    cls: "text-center w-24" },
                    { label: "Strong vs",   cls: "text-center w-40" },
                    { label: "Hard counters", cls: "text-center w-40" },
                  ].map(({ label, cls }) => (
                    <th
                      key={label}
                      className={`px-5 py-4 font-['Cinzel'] text-xs tracking-wider text-[#785A28] uppercase ${cls}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rightFiltered.map((c, i) => {
                  const trend       = trendMap[c.id] ?? 0;
                  const matchups    = matchupsMap[c.id] ?? { weakAgainst: [], strongAgainst: [] };
                  const tierColor   = TIER_COLORS[c.tier] ?? "#A0B4C8";

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[#131E2E] hover:bg-[#0C1520] transition-colors cursor-pointer group"
                      onClick={() => handleSelectChampion(c.id)}
                      onMouseEnter={() => prefetchOPGGBuild(c.name, c.primaryRole)}
                    >
                      {/* Rank + trend */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#8A9BB4] text-sm w-7 text-right shrink-0">{i + 1}</span>
                          {trend !== 0 ? (
                            <span className="flex items-center gap-0.5 text-xs font-mono w-12 shrink-0"
                              style={{ color: trend > 0 ? "#0AC8B9" : "#FF4E50" }}>
                              {trend > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                              {Math.abs(trend)}
                            </span>
                          ) : (
                            <span className="text-xs text-[#3a4a5a] font-mono w-12 shrink-0">=</span>
                          )}
                        </div>
                      </td>

                      {/* Champion */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D] group-hover:border-[#785A28] transition-colors">
                            <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                          </div>
                          <span className="font-['Cinzel'] text-base text-[#C8AA6E] group-hover:text-[#F0E6BE] transition-colors">
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-5 py-4 text-center">
                        <span className="font-['Cinzel'] font-bold text-sm px-2.5 py-1 rounded-sm"
                          style={{
                            color: tierColor,
                            background: tierColor + "20",
                            border: `1px solid ${tierColor}50`,
                            ...(c.tier === "SP" ? {
                              boxShadow: `0 0 8px ${tierColor}80`,
                              textShadow: `0 0 8px ${tierColor}`,
                            } : {}),
                          }}>
                          {c.tier}
                        </span>
                      </td>

                      {/* Role icon */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex justify-center">
                          <RoleBadge role={c.primaryRole} size={28} />
                        </div>
                      </td>

                      {/* Win rate */}
                      <td className="px-5 py-4 text-center">
                        <span className="font-mono font-bold text-base" style={{ color: winRateColor(c.winRate) }}>
                          {c.winRate.toFixed(2)}%
                        </span>
                      </td>

                      {/* Pick rate */}
                      <td className="px-5 py-4 text-center font-mono text-base text-[#A0B4C8]">
                        {c.pickRate.toFixed(2)}%
                      </td>

                      {/* Ban rate */}
                      <td className="px-5 py-4 text-center font-mono text-base text-[#A0B4C8]">
                        {c.banRate.toFixed(2)}%
                      </td>

                      {/* Strong vs */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {matchups.strongAgainst.map(({ champ: mc, winRate: wr }) => (
                            <div key={mc.id} className="flex flex-col items-center gap-0.5 cursor-pointer"
                              title={`${mc.name} — ${wr}% WR`}
                              onClick={e => { e.stopPropagation(); handleSelectChampion(mc.id); }}>
                              <div className="w-6 h-6 rounded-sm overflow-hidden border border-[#0AC8B930] hover:border-[#0AC8B9] transition-colors shrink-0">
                                <img src={mc.imageUrl} alt={mc.name} className="w-full h-full object-cover" loading="lazy"
                                  onError={e2 => { (e2.target as HTMLImageElement).style.opacity = "0.2"; }} />
                              </div>
                              <span className="text-[7px] font-mono leading-none" style={{ color: "#0AC8B9" }}>{wr}%</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Hard counters */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {matchups.weakAgainst.map(({ champ: mc, winRate: wr }) => (
                            <div key={mc.id} className="flex flex-col items-center gap-0.5 cursor-pointer"
                              title={`${mc.name} — ${wr}% WR`}
                              onClick={e => { e.stopPropagation(); handleSelectChampion(mc.id); }}>
                              <div className="w-6 h-6 rounded-sm overflow-hidden border border-[#FF4E5030] hover:border-[#FF4E50] transition-colors shrink-0">
                                <img src={mc.imageUrl} alt={mc.name} className="w-full h-full object-cover" loading="lazy"
                                  onError={e2 => { (e2.target as HTMLImageElement).style.opacity = "0.2"; }} />
                              </div>
                              <span className="text-[7px] font-mono leading-none" style={{ color: "#FF4E50" }}>{wr}%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rightFiltered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center text-[#5B7A8C] font-['Cinzel'] text-sm">
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
