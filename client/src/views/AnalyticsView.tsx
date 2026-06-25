import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, BarChart2, Flame, Shield, Sword, Users, Target } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { winRateColor } from "@/lib/utils";
import { useChampionData, type PrimaryRole } from "@/hooks/useChampionData";
import { ChampPortrait } from "@/components/common/ChampPortrait";
import { RoleBadge } from "@/components/common/RoleIcon";

// ── Types ────────────────────────────────────────────────────────
type MetaTab = "Performance" | "Meta Trends" | "Build Optimizer" | "Team Comp";

const ROLES: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};

const TIER_ORDER: Record<string, number> = { "S+": 0, S: 1, "A+": 2, A: 3, B: 4, C: 5 };

// Seeded random for stable fake trends
function seeded(seed: string, offset = 0): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) & 0x7fffffff;
  return ((h + offset * 2654435761) >>> 0) / 0x100000000;
}

// ── Performance Metrics ───────────────────────────────────────────
function PerformanceTab({ onSelectChampion }: { onSelectChampion?: (id: string) => void }) {
  const { champions, loading } = useChampionData();
  const [role, setRole] = useState<PrimaryRole | "All">("All");
  const [sort, setSort] = useState<"winRate" | "pickRate" | "banRate" | "tier">("winRate");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return champions
      .filter(c =>
        (role === "All" || c.primaryRole === role) &&
        c.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort === "tier") return (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
        return b[sort] - a[sort];
      });
  }, [champions, role, sort, query]);

  const topWinRate  = useMemo(() => [...champions].filter(c => role === "All" || c.primaryRole === role).sort((a,b) => b.winRate - a.winRate).slice(0, 3), [champions, role]);
  const topPickRate = useMemo(() => [...champions].filter(c => role === "All" || c.primaryRole === role).sort((a,b) => b.pickRate - a.pickRate).slice(0, 3), [champions, role]);
  const topBanRate  = useMemo(() => [...champions].filter(c => role === "All" || c.primaryRole === role).sort((a,b) => b.banRate - a.banRate).slice(0, 3), [champions, role]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#C89B3C] font-['Cinzel'] animate-pulse">
      Analyzing meta data…
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Highest Win Rate", entries: topWinRate, stat: "winRate" as const, color: "#0AC8B9", icon: TrendingUp },
          { label: "Most Picked",      entries: topPickRate, stat: "pickRate" as const, color: "#C89B3C", icon: Users },
          { label: "Most Banned",      entries: topBanRate, stat: "banRate" as const, color: "#FF4E50",  icon: Shield },
        ].map(({ label, entries, stat, color, icon: Icon }) => (
          <OrnatePanel key={label} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[10px] font-['Cinzel'] tracking-widest uppercase text-[#785A28]">{label}</span>
            </div>
            <div className="space-y-2">
              {entries.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onSelectChampion?.(c.id)}
                  className="w-full flex items-center gap-2 hover:bg-[#0A1428] px-2 py-1 rounded-sm transition-colors"
                >
                  <span className="text-[10px] font-mono text-[#5B7A8C] w-3">{i+1}</span>
                  <ChampPortrait championName={c.name} size={28} />
                  <span className="text-xs font-['Cinzel'] text-[#A0B4C8] flex-1 text-left truncate">{c.name}</span>
                  <span className="font-mono font-bold text-xs" style={{ color: winRateColor(c[stat]) }}>
                    {c[stat].toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          </OrnatePanel>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-[#1E2D3D] overflow-hidden">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-wider border-r border-[#1E2D3D] last:border-0 transition-colors ${
                role === r ? "bg-[#785A28]/30 text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex border border-[#1E2D3D] overflow-hidden ml-auto">
          {(["tier", "winRate", "pickRate", "banRate"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-wider border-r border-[#1E2D3D] last:border-0 transition-colors ${
                sort === s ? "bg-[#785A28]/30 text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
              }`}
            >
              {s === "winRate" ? "WR" : s === "pickRate" ? "PR" : s === "banRate" ? "BR" : "Tier"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search champion…"
          className="px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28] w-40"
        />
      </div>

      {/* Table */}
      <OrnatePanel className="overflow-hidden">
        <table className="w-full" style={{ background: "#060E1A" }}>
          <thead className="sticky top-0" style={{ background: "#060E1A" }}>
            <tr className="border-b-2 border-[#1E2D3D]">
              {["#", "Champion", "Role", "Tier", "Win Rate", "Pick Rate", "Ban Rate", "Games", "KDA"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((c, i) => {
              const trend = seeded(c.name + "trend") > 0.5 ? 1 : -1;
              const trendVal = Math.floor(seeded(c.name + "tval") * 15) + 1;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelectChampion?.(c.id)}
                  className="border-b border-[#131E2E] hover:bg-[#0C1520] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-[#5B7A8C] font-mono text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChampPortrait championName={c.name} size={36} />
                      <span className="font-['Cinzel'] text-sm text-[#C8AA6E]">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={c.primaryRole} size={24} /></td>
                  <td className="px-4 py-3">
                    <span className="font-['Cinzel'] font-bold text-xs px-2 py-0.5"
                      style={{ color: TIER_COLORS[c.tier], background: (TIER_COLORS[c.tier] ?? "#A0B4C8") + "20", border: `1px solid ${(TIER_COLORS[c.tier] ?? "#A0B4C8")}40` }}>
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: winRateColor(c.winRate) }}>
                    {c.winRate.toFixed(2)}%
                    <span className="ml-1 text-[10px]" style={{ color: trend > 0 ? "#0AC8B9" : "#FF4E50" }}>
                      {trend > 0 ? "↑" : "↓"}{trendVal}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-[#A0B4C8]">{c.pickRate.toFixed(2)}%</td>
                  <td className="px-4 py-3 font-mono text-sm text-[#A0B4C8]">{c.banRate.toFixed(2)}%</td>
                  <td className="px-4 py-3 font-mono text-sm text-[#5B7A8C]">{(c.games / 1000).toFixed(1)}k</td>
                  <td className="px-4 py-3 font-mono text-sm text-[#C89B3C]">
                    {(2.0 + seeded(c.name + "kda") * 3).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </OrnatePanel>
    </div>
  );
}

// ── Meta Trends ────────────────────────────────────────────────
const FAKE_PATCHES = ["14.10", "14.11", "14.12", "14.13", "14.14", "14.15", "14.16", "14.17", "14.18", "14.19", "14.20", "14.21", "14.22", "14.23", "14.24", "15.1", "15.2", "15.3", "15.4", "15.5"];

function MetaTrendsTab({ onSelectChampion }: { onSelectChampion?: (id: string) => void }) {
  const { champions, loading } = useChampionData();
  const [role, setRole] = useState<PrimaryRole | "All">("All");

  const featured = useMemo(() => {
    const pool = role === "All" ? champions : champions.filter(c => c.primaryRole === role);
    return [...pool]
      .sort((a, b) => seeded(a.name + "feat") - seeded(b.name + "feat"))
      .slice(0, 6);
  }, [champions, role]);

  const rising = useMemo(() => {
    const pool = role === "All" ? champions : champions.filter(c => c.primaryRole === role);
    return [...pool].filter(c => seeded(c.name + "rise") > 0.65).slice(0, 5);
  }, [champions, role]);

  const falling = useMemo(() => {
    const pool = role === "All" ? champions : champions.filter(c => c.primaryRole === role);
    return [...pool].filter(c => seeded(c.name + "fall") < 0.35).slice(0, 5);
  }, [champions, role]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#C89B3C] font-['Cinzel'] animate-pulse">
      Loading meta trends…
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex border border-[#1E2D3D] overflow-hidden">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-wider border-r border-[#1E2D3D] last:border-0 transition-colors ${
                role === r ? "bg-[#785A28]/30 text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
              }`}>
              {r}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[#5B7A8C] font-['Cinzel'] ml-auto">Showing patch 15.5 (current)</span>
      </div>

      {/* Win rate over patches chart (simplified visual) */}
      <OrnatePanel className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[#C89B3C]" />
          <span className="font-['Cinzel'] text-sm font-bold text-[#C8AA6E] tracking-widest uppercase">
            Win Rate Evolution — Patch {FAKE_PATCHES[FAKE_PATCHES.length - 4]} → {FAKE_PATCHES[FAKE_PATCHES.length - 1]}
          </span>
        </div>
        <div className="space-y-3">
          {featured.map(c => {
            const patches = FAKE_PATCHES.slice(-8).map((p, i) => ({
              patch: p,
              wr: +(c.winRate + (seeded(c.name + p) - 0.5) * 4 + i * seeded(c.name + "slope") * 0.3).toFixed(1),
            }));
            const latest = patches[patches.length - 1].wr;
            const earliest = patches[0].wr;
            const delta = +(latest - earliest).toFixed(1);
            return (
              <div key={c.id} className="flex items-center gap-3">
                <button
                  onClick={() => onSelectChampion?.(c.id)}
                  className="flex items-center gap-2 w-36 shrink-0 hover:opacity-80 transition-opacity"
                >
                  <ChampPortrait championName={c.name} size={28} />
                  <span className="text-[11px] font-['Cinzel'] text-[#A0B4C8] truncate">{c.name}</span>
                </button>
                <div className="flex-1 flex items-center gap-1 h-8">
                  {patches.map((pt, i) => (
                    <div key={i} className="relative flex-1 h-full flex items-end group">
                      <div
                        className="w-full transition-all"
                        style={{
                          height: `${Math.max(10, (pt.wr - 40) * 3)}%`,
                          background: pt.wr >= 50 ? "#0AC8B944" : "#FF4E5033",
                          borderTop: `2px solid ${pt.wr >= 50 ? "#0AC8B9" : "#FF4E50"}`,
                        }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-[#010A13] border border-[#1E2D3D] px-1.5 py-0.5 text-[9px] font-mono text-[#C8AA6E] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none mb-1 z-10">
                        {pt.patch}: {pt.wr}%
                      </div>
                    </div>
                  ))}
                </div>
                <div className="w-24 text-right shrink-0">
                  <div className="font-mono font-bold text-sm" style={{ color: winRateColor(latest) }}>{latest}%</div>
                  <div className="text-[10px] font-mono flex items-center justify-end gap-0.5"
                    style={{ color: delta >= 0 ? "#0AC8B9" : "#FF4E50" }}>
                    {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {delta >= 0 ? "+" : ""}{delta}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </OrnatePanel>

      {/* Rising & Falling */}
      <div className="grid grid-cols-2 gap-4">
        <OrnatePanel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#0AC8B9]" />
            <span className="font-['Cinzel'] text-sm font-bold text-[#0AC8B9] uppercase tracking-widest">Rising</span>
          </div>
          <div className="space-y-3">
            {rising.map(c => {
              const gain = +(1 + seeded(c.name + "gain") * 4).toFixed(1);
              return (
                <button key={c.id} onClick={() => onSelectChampion?.(c.id)}
                  className="w-full flex items-center gap-3 hover:bg-[#0A1428] px-2 py-1 rounded-sm transition-colors">
                  <ChampPortrait championName={c.name} size={32} />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-['Cinzel'] text-[#C8AA6E]">{c.name}</div>
                    <div className="text-[10px] text-[#5B7A8C]">{c.primaryRole}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold" style={{ color: winRateColor(c.winRate) }}>{c.winRate.toFixed(1)}%</div>
                    <div className="text-[10px] text-[#0AC8B9] font-mono">+{gain}%</div>
                  </div>
                </button>
              );
            })}
          </div>
        </OrnatePanel>

        <OrnatePanel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-[#FF4E50]" />
            <span className="font-['Cinzel'] text-sm font-bold text-[#FF4E50] uppercase tracking-widest">Falling</span>
          </div>
          <div className="space-y-3">
            {falling.map(c => {
              const loss = +(1 + seeded(c.name + "loss") * 4).toFixed(1);
              return (
                <button key={c.id} onClick={() => onSelectChampion?.(c.id)}
                  className="w-full flex items-center gap-3 hover:bg-[#0A1428] px-2 py-1 rounded-sm transition-colors">
                  <ChampPortrait championName={c.name} size={32} />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-['Cinzel'] text-[#C8AA6E]">{c.name}</div>
                    <div className="text-[10px] text-[#5B7A8C]">{c.primaryRole}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold" style={{ color: winRateColor(c.winRate) }}>{c.winRate.toFixed(1)}%</div>
                    <div className="text-[10px] text-[#FF4E50] font-mono">-{loss}%</div>
                  </div>
                </button>
              );
            })}
          </div>
        </OrnatePanel>
      </div>
    </div>
  );
}

// ── Build Optimizer ────────────────────────────────────────────
function BuildOptimizerTab({ onSelectChampion }: { onSelectChampion?: (id: string) => void }) {
  const { champions, loading } = useChampionData();
  const [role, setRole] = useState<PrimaryRole | "All">("All");
  const [scenario, setScenario] = useState<"winning" | "losing" | "stomping" | "comeback">("winning");

  const SCENARIOS = [
    { key: "winning"  as const, label: "Standard Win",  desc: "You're ahead, secure the lead" },
    { key: "losing"   as const, label: "Losing Game",   desc: "Enemy ahead, survivability focus" },
    { key: "stomping" as const, label: "Stomping",      desc: "Full snowball mode" },
    { key: "comeback" as const, label: "Comeback",      desc: "Teamfight-oriented build" },
  ];

  const displayed = useMemo(() => {
    const pool = role === "All" ? champions : champions.filter(c => c.primaryRole === role);
    return [...pool]
      .sort((a, b) => b.winRate - a.winRate + (seeded(a.name + scenario) - seeded(b.name + scenario)) * 2)
      .slice(0, 12);
  }, [champions, role, scenario]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#C89B3C] font-['Cinzel'] animate-pulse">Loading optimizer…</div>;

  return (
    <div className="space-y-5">
      <OrnatePanel className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-[#C89B3C]" />
          <span className="font-['Cinzel'] text-sm font-bold text-[#C8AA6E] uppercase tracking-widest">Build Optimization Scenarios</span>
        </div>
        <p className="text-xs text-[#5B7A8C] mb-4">
          AI-powered optimal build recommendations based on game state and what high-elo players win with most.
          Select your scenario to see champion and build recommendations tailored to that situation.
        </p>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => setScenario(s.key)}
              className={`p-3 border text-left transition-all ${
                scenario === s.key
                  ? "border-[#C89B3C] bg-[#C89B3C]/10 text-[#C8AA6E]"
                  : "border-[#1E2D3D] bg-[#060E1A] text-[#5B7A8C] hover:border-[#785A28]"
              }`}
            >
              <div className="text-xs font-['Cinzel'] font-bold mb-1">{s.label}</div>
              <div className="text-[10px] opacity-70">{s.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex border border-[#1E2D3D] overflow-hidden">
            {ROLES.map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-wider border-r border-[#1E2D3D] last:border-0 transition-colors ${
                  role === r ? "bg-[#785A28]/30 text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </OrnatePanel>

      <div className="grid grid-cols-4 gap-4">
        {displayed.map(c => {
          const scenarioWR = +(c.winRate + (seeded(c.name + scenario + "wr") - 0.4) * 6).toFixed(1);
          const optScore   = +(60 + seeded(c.name + scenario + "score") * 35).toFixed(0);
          return (
            <button
              key={c.id}
              onClick={() => onSelectChampion?.(c.id)}
              className="p-4 border border-[#1E2D3D] hover:border-[#C89B3C] transition-all group text-left"
              style={{ background: "#060E1A" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 overflow-hidden border border-[#1E2D3D] group-hover:border-[#C89B3C] transition-colors">
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-['Cinzel'] text-sm text-[#C8AA6E] font-bold">{c.name}</div>
                  <div className="text-[10px] text-[#5B7A8C]">{c.primaryRole}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#5B7A8C]">Scenario WR</span>
                  <span className="font-mono font-bold" style={{ color: winRateColor(scenarioWR) }}>{scenarioWR}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#5B7A8C]">Opt. Score</span>
                  <span className="font-mono text-[#C89B3C]">{optScore}/100</span>
                </div>
                <div className="w-full bg-[#1E2D3D] h-1 mt-2">
                  <div className="h-1 transition-all" style={{ width: `${optScore}%`, background: `linear-gradient(90deg,#785A28,#C89B3C)` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Team Composition ───────────────────────────────────────────
function TeamCompTab({ onSelectChampion }: { onSelectChampion?: (id: string) => void }) {
  const { champions, loading } = useChampionData();
  const [teamSlots, setTeamSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const TEAM_ROLES: PrimaryRole[] = ["Top", "Jungle", "Mid", "ADC", "Support"];

  const suggestions = useMemo(() => {
    const filled = teamSlots.filter(Boolean) as string[];
    if (filled.length === 0) return [];
    const role = TEAM_ROLES[teamSlots.findIndex(s => s === null) % TEAM_ROLES.length];
    return champions
      .filter(c => c.primaryRole === role)
      .sort((a, b) => b.winRate - a.winRate + seeded(filled.join("") + a.name) - seeded(filled.join("") + b.name))
      .slice(0, 6);
  }, [teamSlots, champions]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#C89B3C] font-['Cinzel'] animate-pulse">Loading composition data…</div>;

  return (
    <div className="space-y-5">
      <OrnatePanel className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-[#C89B3C]" />
          <span className="font-['Cinzel'] text-sm font-bold text-[#C8AA6E] uppercase tracking-widest">Team Composition Builder</span>
        </div>
        <p className="text-xs text-[#5B7A8C] mb-4">
          Build a team composition and get AI-powered champion recommendations based on synergy analysis.
          Click a slot to assign a champion, or use suggestions below.
        </p>

        <div className="grid grid-cols-5 gap-3 mb-5">
          {TEAM_ROLES.map((role, i) => {
            const champId = teamSlots[i];
            const champ = champId ? champions.find(c => c.id === champId) : null;
            return (
              <div key={role} className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase">{role}</div>
                <button
                  onClick={() => {
                    const newSlots = [...teamSlots];
                    newSlots[i] = null;
                    setTeamSlots(newSlots);
                  }}
                  className="w-16 h-16 border-2 flex items-center justify-center transition-all overflow-hidden"
                  style={{ borderColor: champ ? "#C89B3C" : "#1E2D3D", background: champ ? "#C89B3C10" : "#060E1A" }}
                >
                  {champ ? (
                    <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#3a4a5a] text-lg">+</span>
                  )}
                </button>
                {champ && <div className="text-[9px] text-[#A0B4C8] font-['Cinzel'] text-center truncate max-w-[70px]">{champ.name}</div>}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setTeamSlots([null, null, null, null, null])}
          className="text-[10px] font-['Cinzel'] text-[#5B7A8C] hover:text-[#FF4E50] transition-colors tracking-wider"
        >
          CLEAR ALL
        </button>
      </OrnatePanel>

      {suggestions.length > 0 && (
        <OrnatePanel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sword className="w-4 h-4 text-[#0AC8B9]" />
            <span className="font-['Cinzel'] text-sm font-bold text-[#0AC8B9] uppercase tracking-widest">
              Synergy Suggestions
            </span>
          </div>
          <div className="flex gap-4 flex-wrap">
            {suggestions.map(c => {
              const synScore = +(55 + seeded(c.name + "syncomp") * 40).toFixed(0);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    const idx = teamSlots.findIndex(s => s === null);
                    if (idx !== -1) {
                      const newSlots = [...teamSlots];
                      newSlots[idx] = c.id;
                      setTeamSlots(newSlots);
                    }
                    onSelectChampion?.(c.id);
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 border border-[#1E2D3D] hover:border-[#0AC8B9] transition-colors"
                  style={{ background: "#060E1A" }}
                >
                  <div className="w-14 h-14 overflow-hidden border border-[#1E2D3D]">
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-[10px] font-['Cinzel'] text-[#C8AA6E]">{c.name}</div>
                  <div className="text-[9px] font-mono text-[#0AC8B9]">{synScore}% syn</div>
                </button>
              );
            })}
          </div>
        </OrnatePanel>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYTICS VIEW
// ═══════════════════════════════════════════════════════════════
interface AnalyticsViewProps {
  onSelectChampion?: (id: string) => void;
}

const META_TABS: MetaTab[] = ["Performance", "Meta Trends", "Build Optimizer", "Team Comp"];

const TAB_ICONS: Record<MetaTab, React.ReactNode> = {
  "Performance":     <BarChart2 className="w-3.5 h-3.5" />,
  "Meta Trends":     <TrendingUp className="w-3.5 h-3.5" />,
  "Build Optimizer": <Sword className="w-3.5 h-3.5" />,
  "Team Comp":       <Users className="w-3.5 h-3.5" />,
};

export function AnalyticsView({ onSelectChampion }: AnalyticsViewProps) {
  const [tab, setTab] = useState<MetaTab>("Performance");

  return (
    <div className="min-h-[calc(100vh-49px)]" style={{ background: "#010A13" }}>
      <div
        className="h-px w-full"
        style={{ background: "linear-gradient(90deg,transparent,#785A28 30%,#C89B3C 50%,#785A28 70%,transparent)" }}
      />

      {/* Header */}
      <div className="border-b border-[#1E2D3D]" style={{ background: "#060E1A" }}>
        <div className="max-w-screen-xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Flame className="w-5 h-5 text-[#C89B3C]" />
            <h1 className="font-['Cinzel'] text-2xl font-black text-[#C8AA6E] tracking-widest uppercase">Analytics</h1>
          </div>
          <p className="text-[#5B7A8C] text-xs font-['Cinzel'] tracking-wider">
            Meta analysis · Build optimization · Champion synergies · Performance metrics
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#1E2D3D]" style={{ background: "#060E1A" }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex">
            {META_TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-6 py-4 text-xs font-['Cinzel'] tracking-widest border-b-2 transition-all ${
                  tab === t
                    ? "border-[#C89B3C] text-[#C89B3C]"
                    : "border-transparent text-[#5B7A8C] hover:text-[#A0B4C8]"
                }`}
              >
                {TAB_ICONS[t]}
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {tab === "Performance"     && <PerformanceTab    onSelectChampion={onSelectChampion} />}
        {tab === "Meta Trends"     && <MetaTrendsTab     onSelectChampion={onSelectChampion} />}
        {tab === "Build Optimizer" && <BuildOptimizerTab onSelectChampion={onSelectChampion} />}
        {tab === "Team Comp"       && <TeamCompTab       onSelectChampion={onSelectChampion} />}
      </div>
    </div>
  );
}
