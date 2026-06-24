import { useState, useMemo, useEffect, useRef } from "react";
import { Search, BookOpen, ChevronDown } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { winRateColor, rankColor } from "@/lib/utils";
import { useChampionData, type ChampionInfo, type PrimaryRole } from "@/hooks/useChampionData";
import { getBuild, RANK_TIERS, type BuildEntry } from "@/data/builds";
import { useRuneData, PATH_COLORS } from "@/hooks/useRuneData";
import { getDragonVersion } from "@/api/client";

const ROLES: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const SPELL_KEYS: Record<string, string> = {
  Flash: "SummonerFlash", Ignite: "SummonerDot", Teleport: "SummonerTeleport",
  Heal: "SummonerHeal", Exhaust: "SummonerExhaust", Smite: "SummonerSmite",
  Barrier: "SummonerBarrier", Ghost: "SummonerHaste", Cleanse: "SummonerBoost",
};

function useVersion() {
  const [v, setV] = useState("14.24.1");
  useEffect(() => { getDragonVersion().then(setV).catch(() => {}); }, []);
  return v;
}

// ── Reusable image components ──────────────────────────────────
function SpellIcon({ name, version, size = 36 }: { name: string; version: string; size?: number }) {
  const key = SPELL_KEYS[name] ?? "SummonerFlash";
  return (
    <div className="group relative">
      <div className="rounded-sm border border-[#785A28] overflow-hidden bg-[#0A1428]" style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${key}.png`}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0A1428] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {name}
      </div>
    </div>
  );
}

function ItemImg({ id, name, version, size = 44 }: { id: number; name: string; version: string; size?: number }) {
  return (
    <div className="group relative">
      <div className="rounded-sm border border-[#1E2D3D] bg-[#0A1428] overflow-hidden" style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.15"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0A1428] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {name}
      </div>
    </div>
  );
}

// ── Rune icon from DDragon ─────────────────────────────────────
function RuneIcon({ iconPath, name, size = 28, highlight = false }: {
  iconPath: string; name: string; size?: number; highlight?: boolean;
}) {
  return (
    <div className="group relative">
      <div
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: size, height: size,
          background: highlight ? "rgba(200,155,60,0.15)" : "rgba(10,20,40,0.8)",
          border: highlight ? "1.5px solid #C89B3C" : "1px solid #1E2D3D",
        }}
      >
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0A1428] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {name}
      </div>
    </div>
  );
}

// ── Rune Tree Visual ───────────────────────────────────────────
function RuneTree({ runes }: { runes: BuildEntry["runes"] }) {
  const { paths, loaded } = useRuneData();

  const primaryPath = paths.find(p => p.name === runes.primary);
  const secondaryPath = paths.find(p => p.name === runes.secondary);
  const keystoneData = primaryPath?.slots[0]?.runes.find(r =>
    r.name.toLowerCase() === runes.keystone.toLowerCase()
  );

  const primaryColor = PATH_COLORS[runes.primary] ?? "#C89B3C";
  const secondaryColor = PATH_COLORS[runes.secondary] ?? "#5B7A8C";

  if (!loaded) {
    return (
      <div className="animate-pulse text-[9px] text-[#5B7A8C] font-['Cinzel']">Loading runes...</div>
    );
  }

  return (
    <div className="flex gap-4 flex-wrap">
      {/* Primary path */}
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          {primaryPath && (
            <RuneIcon iconPath={primaryPath.icon} name={primaryPath.name} size={20} />
          )}
          <span className="text-[10px] font-['Cinzel'] font-bold" style={{ color: primaryColor }}>
            {runes.primary}
          </span>
        </div>
        {/* Keystone */}
        <div className="flex items-center gap-2 mb-2 pl-1">
          {keystoneData ? (
            <RuneIcon iconPath={keystoneData.icon} name={keystoneData.name} size={32} highlight />
          ) : (
            <div className="w-8 h-8 rounded-full border border-[#C89B3C] bg-[#C89B3C]/10 flex items-center justify-center">
              <span className="text-[8px] text-[#C89B3C]">K</span>
            </div>
          )}
          <div>
            <div className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E]">{runes.keystone}</div>
            <div className="text-[8px] text-[#5B7A8C]">Keystone</div>
          </div>
        </div>
        {/* Row perks */}
        {primaryPath && primaryPath.slots.slice(1).map((slot, si) => (
          <div key={si} className="flex gap-1 pl-1 mb-1">
            {slot.runes.map((perk, pi) => (
              <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name} size={20} highlight={pi === 0} />
            ))}
          </div>
        ))}
      </div>

      {/* Secondary path */}
      <div className="min-w-[120px]">
        <div className="flex items-center gap-2 mb-2">
          {secondaryPath && (
            <RuneIcon iconPath={secondaryPath.icon} name={secondaryPath.name} size={18} />
          )}
          <span className="text-[10px] font-['Cinzel'] font-bold" style={{ color: secondaryColor }}>
            {runes.secondary}
          </span>
        </div>
        {secondaryPath && secondaryPath.slots.slice(1).map((slot, si) => (
          <div key={si} className="flex gap-1 pl-1 mb-1">
            {slot.runes.map((perk, pi) => (
              <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name} size={18} highlight={pi === 0} />
            ))}
          </div>
        ))}
      </div>

      {/* Stat shards (generic) */}
      <div className="min-w-[80px]">
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-2">Shards</div>
        {[
          runes.primary === "Precision" || runes.primary === "Domination" ? "Adaptive Force" : "Ability Haste",
          "Adaptive Force",
          runes.secondary === "Resolve" ? "Armor" : "Magic Resist",
        ].map((shard, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-full bg-[#1E2D3D] border border-[#3a4a5a]" />
            <span className="text-[8px] text-[#5B7A8C]">{shard}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Level 1-18 order grid ──────────────────────────────────────
const ABILITY_COLORS: Record<string, string> = {
  Q: "#0AC8B9", W: "#C89B3C", E: "#A0B4C8", R: "#F4E070",
};

function LevelOrderGrid({ order }: { order: string[] }) {
  const normalized = [...order];
  // Ensure exactly 18
  while (normalized.length < 18) normalized.push("?");

  return (
    <div>
      <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-2">
        Ability Order — Level 1 to 18
      </div>
      <div className="flex gap-0.5 flex-wrap">
        {normalized.map((ability, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-6 h-6 flex items-center justify-center text-[9px] font-['Cinzel'] font-black border"
              style={{
                color: ABILITY_COLORS[ability] ?? "#5B7A8C",
                borderColor: (ABILITY_COLORS[ability] ?? "#1E2D3D") + "88",
                background: (ABILITY_COLORS[ability] ?? "#1E2D3D") + "22",
              }}
            >
              {ability || "?"}
            </div>
            <div className="text-[7px] font-mono text-[#3a4a5a] leading-none">{i + 1}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {["Q", "W", "E", "R"].map(ab => (
          <div key={ab} className="flex items-center gap-1">
            <div className="w-3 h-3 flex items-center justify-center text-[7px] font-black rounded-sm"
              style={{ color: ABILITY_COLORS[ab], background: ABILITY_COLORS[ab] + "22" }}>
              {ab}
            </div>
            <span className="text-[8px] text-[#5B7A8C]">
              {ab === "Q" ? "Max 1st" : ab === "W" ? "Max 2nd" : ab === "E" ? "Max 3rd" : "Take at 6/11/16"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Champion dropdown (searchable) ─────────────────────────────
function ChampionDropdown({ champions, selected, onSelect }: {
  champions: ChampionInfo[];
  selected: ChampionInfo | undefined;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<PrimaryRole | "All">("All");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return champions.filter(c =>
      (role === "All" || c.primaryRole === role) &&
      c.name.toLowerCase().includes(q)
    );
  }, [champions, query, role]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#0A1428] border border-[#785A28] hover:border-[#C89B3C] transition-colors"
      >
        {selected ? (
          <>
            <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
              <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-['Cinzel'] text-sm text-[#C8AA6E]">{selected.name}</div>
              <div className="text-[10px] text-[#5B7A8C]">{selected.primaryRole} · {selected.buildType.replace(/_/g," ")}</div>
            </div>
          </>
        ) : (
          <span className="text-[#5B7A8C] font-['Cinzel'] text-sm flex-1 text-left">Select a champion...</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#785A28] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl" style={{ maxHeight: 420, overflowY: "auto" }}>
          {/* Search + role filter */}
          <div className="sticky top-0 bg-[#010A13] border-b border-[#1E2D3D] p-2 space-y-1.5">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-2 py-0.5 text-[8px] font-['Cinzel'] uppercase border transition-all ${
                    role === r ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10" : "border-[#1E2D3D] text-[#5B7A8C]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Champion list */}
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false); setQuery(""); }}
              className={`w-full flex items-center gap-2 px-3 py-2 border-b border-[#1E2D3D] text-left transition-colors ${
                selected?.id === c.id ? "bg-[#0A1428] border-l-2 border-l-[#C89B3C]" : "hover:bg-[#0A1428]/60"
              }`}
            >
              <div className="w-7 h-7 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-['Cinzel'] text-[11px] truncate ${selected?.id === c.id ? "text-[#C89B3C]" : "text-[#A0B4C8]"}`}>{c.name}</div>
                <div className="text-[8px] text-[#5B7A8C]">{c.primaryRole}</div>
              </div>
              <div className="text-[9px] font-mono font-bold shrink-0" style={{ color: winRateColor(c.winRate) }}>
                {c.winRate.toFixed(1)}%
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-[#5B7A8C] font-['Cinzel'] text-[10px]">No champions found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Build panel for a single rank's variants ───────────────────
function RankBuildPanel({ rankKey, builds, version }: {
  rankKey: string;
  builds: BuildEntry[];
  version: string;
}) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const col = rankColor(rankKey);
  const build = builds[selectedVariant] ?? builds[0];
  if (!build) return null;

  return (
    <OrnatePanel className="overflow-hidden" accent={rankKey === "CHALLENGER"}>
      {/* Rank header + variant dropdown */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2D3D] flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <div
            className="hex-clip w-8 h-8 flex items-center justify-center text-[10px] font-['Cinzel'] font-black shrink-0"
            style={{ background: `linear-gradient(135deg,${col}33,#071523)`, color: col }}
          >
            {rankKey[0]}
          </div>
          <div>
            <div className="font-['Cinzel'] font-bold text-sm" style={{ color: col }}>{build.rankLabel}</div>
            <div className="text-[9px] text-[#5B7A8C] font-mono">{build.games.toLocaleString()} games</div>
          </div>
        </div>

        {/* Build variant selector dropdown */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-[9px] text-[#5B7A8C] font-['Cinzel'] uppercase tracking-widest">Build:</span>
          <select
            value={selectedVariant}
            onChange={e => setSelectedVariant(Number(e.target.value))}
            className="bg-[#0A1428] border border-[#1E2D3D] text-[10px] text-[#C8AA6E] font-['Cinzel'] px-2 py-1 focus:outline-none focus:border-[#785A28] hover:border-[#785A28] transition-colors cursor-pointer"
          >
            {builds.map((b, i) => (
              <option key={b.buildName} value={i}>
                {b.buildName} — {b.winRate}% WR
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-right">
          <div className="font-mono font-black text-lg" style={{ color: winRateColor(build.winRate) }}>{build.winRate}%</div>
          <div className="text-[9px] text-[#5B7A8C]">{build.pickRate}% pick · {build.buildDesc}</div>
        </div>
      </div>

      {/* Build content */}
      <div className="px-4 py-4 space-y-5">
        {/* Starting items */}
        {build.startItems.length > 0 && (
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-2">Starting Items</div>
            <div className="flex gap-2 flex-wrap">
              {build.startItems.map((item, idx) => (
                <ItemImg key={`${item.id}-${idx}`} id={item.id} name={item.name} version={version} size={32} />
              ))}
            </div>
          </div>
        )}

        {/* Core build */}
        <div>
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-2">Core Build</div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <ItemImg id={build.boots.id} name={build.boots.name} version={version} size={40} />
              <div className="text-[8px] text-[#5B7A8C]">Boots</div>
            </div>
            <span className="text-[#785A28] font-bold mb-4 text-sm">→</span>
            {build.items.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex flex-col items-center gap-1">
                <ItemImg id={item.id} name={item.name} version={version} size={44} />
                <div className="text-[8px] text-[#5B7A8C]">{i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Optional items */}
        {build.optionalItems.length > 0 && (
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-2">
              Situational / Optional Items
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {build.optionalItems.map((item, idx) => (
                <ItemImg key={`opt-${item.id}-${idx}`} id={item.id} name={item.name} version={version} size={36} />
              ))}
              <div className="text-[9px] text-[#5B7A8C] ml-1 italic">Adapt to the game</div>
            </div>
          </div>
        )}

        {/* Level order */}
        <LevelOrderGrid order={build.levelOrder} />

        {/* Summoner spells + Runes split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-[#1E2D3D]">
          {/* Summoner spells */}
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-3">Summoner Spells</div>
            <div className="flex gap-3 items-center">
              {build.spells.map((spell, i) => (
                <SpellIcon key={`${spell}-${i}`} name={spell} version={version} size={42} />
              ))}
              <div className="ml-2">
                <div className="font-['Cinzel'] text-[11px] text-[#C8AA6E]">{build.spells.join(" + ")}</div>
                <div className="text-[9px] text-[#5B7A8C] mt-0.5">
                  {build.spells.includes("Smite") ? "Required for jungle" :
                   build.spells.includes("Teleport") ? "Split-push pressure" :
                   build.spells.includes("Exhaust") ? "Reduce burst damage" :
                   "Standard aggressive setup"}
                </div>
              </div>
            </div>
          </div>

          {/* Rune tree visual */}
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-3">Rune Path</div>
            <RuneTree runes={build.runes} />
          </div>
        </div>
      </div>
    </OrnatePanel>
  );
}

// ── Main view ──────────────────────────────────────────────────
export function BuildsView({ initialChampionId }: { initialChampionId?: string | null }) {
  const { champions, loading } = useChampionData();
  const version = useVersion();
  const [selectedId, setSelectedId] = useState<string | null>(initialChampionId ?? null);
  const [selectedRank, setSelectedRank] = useState<string>("ALL");

  // When initialChampionId changes (navigating from champions page), update selection
  useEffect(() => {
    if (initialChampionId) setSelectedId(initialChampionId);
  }, [initialChampionId]);

  const selected: ChampionInfo | undefined = selectedId
    ? champions.find(c => c.id === selectedId)
    : (champions.length > 0 ? champions[0] : undefined);

  const allBuilds = useMemo(() => {
    if (!selected) return [];
    return getBuild(selected.name, selected.buildType, selected.winRate, selected.pickRate, selected.games);
  }, [selected]);

  // Group builds by rank (each has 3 variants)
  const rankGroups = useMemo(() => {
    const groups: Record<string, BuildEntry[]> = {};
    for (const b of allBuilds) {
      if (!groups[b.rank]) groups[b.rank] = [];
      groups[b.rank].push(b);
    }
    return groups;
  }, [allBuilds]);

  const visibleRanks = selectedRank === "ALL"
    ? RANK_TIERS.map(t => t.rank)
    : [selectedRank];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedRank("ALL");
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BookOpen className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">Champion Builds</h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
        {!loading && selected && (
          <span className="text-[10px] font-mono text-[#5B7A8C]">
            {champions.length} champions · 3 builds per rank · {RANK_TIERS.length} ranks
          </span>
        )}
      </div>

      {/* Champion selector row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="md:col-span-2">
          {loading ? (
            <div className="h-12 bg-[#0A1428] border border-[#1E2D3D] animate-pulse" />
          ) : (
            <ChampionDropdown champions={champions} selected={selected} onSelect={handleSelect} />
          )}
        </div>

        {/* Rank filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-['Cinzel'] text-[#5B7A8C] uppercase tracking-widest">Rank:</span>
          <button
            onClick={() => setSelectedRank("ALL")}
            className={`px-2 py-1 text-[9px] font-['Cinzel'] uppercase border transition-all ${
              selectedRank === "ALL" ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10" : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
            }`}
          >
            All
          </button>
          {RANK_TIERS.map(t => {
            const col = rankColor(t.rank);
            return (
              <button
                key={t.rank}
                onClick={() => setSelectedRank(t.rank)}
                className="px-2 py-1 text-[9px] font-['Cinzel'] uppercase border transition-all"
                style={selectedRank === t.rank
                  ? { color: col, borderColor: col, background: col + "18" }
                  : { color: "#5B7A8C", borderColor: "#1E2D3D" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Champion header card */}
      {selected && !loading && (
        <OrnatePanel className="p-4 mb-5 flex items-center gap-4" accent>
          <div className="w-16 h-16 shrink-0 rounded-sm overflow-hidden border-2 border-[#785A28]">
            <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-['Cinzel'] font-black text-2xl text-[#C8AA6E]">{selected.name}</h3>
            <div className="text-[11px] text-[#5B7A8C] font-['Cinzel'] italic">{selected.title}</div>
            <div className="flex items-center gap-3 mt-1 text-[10px] flex-wrap">
              <span className="text-[#A0B4C8]">{selected.primaryRole}</span>
              <span className="text-[#5B7A8C]">·</span>
              <span className="text-[#A0B4C8]">{selected.tags.join(", ")}</span>
              <span className="text-[#5B7A8C]">·</span>
              <span style={{ color: winRateColor(selected.winRate) }} className="font-mono font-bold">
                {selected.winRate.toFixed(1)}% WR
              </span>
              <span className="text-[#5B7A8C]">·</span>
              <span className="text-[#5B7A8C]">{selected.buildType.replace(/_/g, " ")}</span>
            </div>
          </div>
        </OrnatePanel>
      )}

      {/* Build panels by rank */}
      {!loading && selected ? (
        <div className="space-y-4">
          {visibleRanks.map(rankKey => {
            const builds = rankGroups[rankKey] ?? [];
            if (builds.length === 0) return null;
            return (
              <RankBuildPanel key={rankKey} rankKey={rankKey} builds={builds} version={version} />
            );
          })}
        </div>
      ) : loading ? (
        <OrnatePanel className="p-12 text-center">
          <div className="text-[#C89B3C] font-['Cinzel'] text-sm animate-pulse mb-3">Loading champions...</div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </OrnatePanel>
      ) : (
        <OrnatePanel className="p-12 text-center">
          <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">Select a champion to view builds</div>
        </OrnatePanel>
      )}
    </div>
  );
}
