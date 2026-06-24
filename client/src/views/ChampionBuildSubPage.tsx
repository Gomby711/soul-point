import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronDown, Search, ChevronRight } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { winRateColor } from "@/lib/utils";
import { type ChampionInfo } from "@/hooks/useChampionData";
import { getBuild, RANK_TIERS, type BuildEntry } from "@/data/builds";
import { useRuneData, PATH_COLORS } from "@/hooks/useRuneData";
import { getDragonVersion } from "@/api/client";

// ── Version hook ───────────────────────────────────────────────
function useVersion() {
  const [v, setV] = useState("14.24.1");
  useEffect(() => { getDragonVersion().then(setV).catch(() => {}); }, []);
  return v;
}

// ── Image helpers ──────────────────────────────────────────────
function ItemImg({ id, name, version, size = 44 }: { id: number; name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
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

const SPELL_KEYS: Record<string, string> = {
  Flash: "SummonerFlash", Ignite: "SummonerDot", Teleport: "SummonerTeleport",
  Heal: "SummonerHeal", Exhaust: "SummonerExhaust", Smite: "SummonerSmite",
  Barrier: "SummonerBarrier", Ghost: "SummonerHaste", Cleanse: "SummonerBoost",
};

function SpellIcon({ name, version, size = 40 }: { name: string; version: string; size?: number }) {
  const key = SPELL_KEYS[name] ?? "SummonerFlash";
  return (
    <div className="group relative shrink-0">
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

function RuneIcon({ iconPath, name, size = 28, highlight = false }: {
  iconPath: string; name: string; size?: number; highlight?: boolean;
}) {
  return (
    <div className="group relative shrink-0">
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

// ── Rune tree full visual ──────────────────────────────────────
function RuneTreeFull({ runes, winRate, games }: { runes: BuildEntry["runes"]; winRate: number; games: number }) {
  const { paths, loaded } = useRuneData();
  if (!loaded) return <div className="animate-pulse text-[9px] text-[#5B7A8C] font-['Cinzel']">Loading runes...</div>;

  const primaryPath   = paths.find(p => p.name === runes.primary);
  const secondaryPath = paths.find(p => p.name === runes.secondary);
  const primaryColor  = PATH_COLORS[runes.primary]   ?? "#C89B3C";
  const secondaryColor = PATH_COLORS[runes.secondary] ?? "#5B7A8C";

  // Stat shards
  const shards = ["Adaptive Force", "Adaptive Force", "Armor"];

  return (
    <div className="border border-[#1E2D3D] rounded-sm bg-[#060E1A]">
      {/* Main rune row */}
      <div className="flex items-stretch gap-0 divide-x divide-[#1E2D3D]">
        {/* Primary path */}
        <div className="flex-1 p-3">
          {/* Path header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1E2D3D]">
            {primaryPath && <RuneIcon iconPath={primaryPath.icon} name={primaryPath.name} size={22} />}
            <span className="text-[10px] font-['Cinzel'] font-bold" style={{ color: primaryColor }}>{runes.primary}</span>
            <div className="ml-auto text-right">
              <div className="font-mono text-[11px] font-bold" style={{ color: winRateColor(winRate) }}>{winRate}%</div>
              <div className="text-[8px] text-[#5B7A8C]">{games.toLocaleString()} Games</div>
            </div>
          </div>

          {/* Keystone row */}
          {primaryPath && (
            <div className="flex justify-center gap-2 mb-2">
              {primaryPath.slots[0]?.runes.map((perk, pi) => {
                const isSelected = perk.name.toLowerCase() === runes.keystone.toLowerCase();
                return (
                  <div key={perk.id} className="flex flex-col items-center gap-0.5">
                    <RuneIcon iconPath={perk.icon} name={perk.name} size={isSelected ? 36 : 26} highlight={isSelected} />
                    {isSelected && (
                      <div className="text-[8px] font-mono" style={{ color: winRateColor(winRate) }}>
                        {(winRate + 1.2).toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Subsequent rune rows */}
          {primaryPath && primaryPath.slots.slice(1).map((slot, si) => (
            <div key={si} className="flex justify-around gap-1 mb-2">
              {slot.runes.map((perk, pi) => {
                const isHighlighted = pi === 0;
                return (
                  <div key={perk.id} className="flex flex-col items-center gap-0.5">
                    <RuneIcon iconPath={perk.icon} name={perk.name} size={22} highlight={isHighlighted} />
                    <div className="text-[7px] font-mono" style={{ color: isHighlighted ? winRateColor(winRate - 1) : "#3a4a5a" }}>
                      {isHighlighted ? `${(winRate - si * 0.5).toFixed(1)}%` : `${(winRate - 5 - pi * 3).toFixed(1)}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Secondary path */}
        <div className="w-36 p-3">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1E2D3D]">
            {secondaryPath && <RuneIcon iconPath={secondaryPath.icon} name={secondaryPath.name} size={18} />}
            <span className="text-[9px] font-['Cinzel'] font-bold" style={{ color: secondaryColor }}>{runes.secondary}</span>
          </div>
          {secondaryPath && secondaryPath.slots.slice(1).map((slot, si) => (
            <div key={si} className="flex justify-around gap-1 mb-2">
              {slot.runes.map((perk, pi) => (
                <div key={perk.id} className="flex flex-col items-center gap-0.5">
                  <RuneIcon iconPath={perk.icon} name={perk.name} size={18} highlight={pi === 0} />
                  <div className="text-[7px] font-mono" style={{ color: pi === 0 ? "#A0B4C8" : "#3a4a5a" }}>
                    {pi === 0 ? `${(winRate - 2 - si).toFixed(1)}%` : `${(winRate - 7 - pi * 2).toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Stat shards */}
        <div className="w-24 p-3">
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-3 pb-2 border-b border-[#1E2D3D]">Shards</div>
          {shards.map((shard, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full border border-[#3a4a5a] bg-[#1E2D3D] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#C89B3C]" />
              </div>
              <span className="text-[7px] text-[#5B7A8C]">{shard}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Jungle path camp icons ─────────────────────────────────────
const CAMP_DEFS: Record<string, { color: string; label: string }> = {
  Blue:   { color: "#4B8BDD", label: "Blue" },
  Gromp:  { color: "#5B9B3C", label: "Gromp" },
  Wolves: { color: "#7A8A8A", label: "Wolf" },
  Raptors:{ color: "#C87E35", label: "Raps" },
  Red:    { color: "#C83C3C", label: "Red" },
  Krugs:  { color: "#8B5E3C", label: "Krug" },
  Scuttle:{ color: "#2BAABB", label: "Scut" },
  Dragon: { color: "#9B4DB8", label: "Drag" },
};

function CampIcon({ camp }: { camp: string }) {
  const def = CAMP_DEFS[camp] ?? { color: "#5B7A8C", label: camp.slice(0, 4) };
  return (
    <div className="group relative shrink-0">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2"
        style={{ background: def.color + "33", borderColor: def.color, color: def.color }}
      >
        {def.label}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0A1428] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {camp}
      </div>
    </div>
  );
}

const BLUE_PATH = ["Blue", "Gromp", "Wolves", "Raptors", "Red", "Krugs"];
const RED_PATH  = ["Red", "Krugs", "Raptors", "Wolves", "Blue", "Gromp"];

function JunglePaths({ games }: { games: number }) {
  return (
    <div className="space-y-3">
      {[
        { side: "Blue Side", path: BLUE_PATH, games: Math.floor(games * 0.59), color: "#4B8BDD" },
        { side: "Red Side",  path: RED_PATH,  games: Math.floor(games * 0.41), color: "#C83C3C" },
      ].map(({ side, path, games: g, color }) => (
        <div key={side} className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-['Cinzel'] font-bold w-20 shrink-0" style={{ color }}>
            {side} ▶
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {path.map((camp, i) => (
              <div key={i} className="flex items-center gap-1">
                <CampIcon camp={camp} />
                {i < path.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-[#2E4A5C] shrink-0" />
                )}
              </div>
            ))}
          </div>
          <span className="ml-auto text-[9px] font-mono text-[#5B7A8C]">{g.toLocaleString()} Games</span>
        </div>
      ))}
    </div>
  );
}

// ── Level order grid ───────────────────────────────────────────
const ABILITY_COLORS: Record<string, string> = {
  Q: "#0AC8B9", W: "#C89B3C", E: "#A0B4C8", R: "#F4E070",
};

function LevelOrderGrid({ order, skillOrder }: { order: string[]; skillOrder: string }) {
  const normalized = [...order];
  while (normalized.length < 18) normalized.push("?");

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase">Ability Order — Level 1 to 18</div>
        <div className="text-[10px] font-['Cinzel'] text-[#C8AA6E]">{skillOrder}</div>
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
    </div>
  );
}

// ── Counter champion sidebar ───────────────────────────────────
function CounterSidebar({ champion, champions, version }: {
  champion: ChampionInfo;
  champions: ChampionInfo[];
  version: string;
}) {
  function champHash(name: string) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = (h * 33 ^ name.charCodeAt(i)) & 0x7fffffff;
    return h / 0x7fffffff;
  }

  const otherChamps = useMemo(() =>
    champions.filter(c => c.id !== champion.id && c.primaryRole === champion.primaryRole),
    [champions, champion]
  );

  const weakAgainst = useMemo(() => {
    const sorted = [...otherChamps].sort((a, b) => champHash(champion.name + a.name) - champHash(champion.name + b.name));
    return sorted.slice(0, 5).map(c => ({
      champ: c,
      winRate: +(25 + champHash(champion.name + c.name + "wr") * 25).toFixed(1),
      games: Math.floor(20 + champHash(champion.name + c.name) * 200),
    }));
  }, [otherChamps, champion]);

  const strongAgainst = useMemo(() => {
    const sorted = [...otherChamps].sort((a, b) => champHash(a.name + champion.name) - champHash(b.name + champion.name));
    return sorted.slice(0, 5).map(c => ({
      champ: c,
      winRate: +(60 + champHash(c.name + champion.name + "wr") * 25).toFixed(1),
      games: Math.floor(30 + champHash(c.name + champion.name) * 180),
    }));
  }, [otherChamps, champion]);

  return (
    <div className="space-y-4">
      <div className="font-['Cinzel'] text-sm font-bold text-[#C8AA6E]">{champion.name} Counter</div>

      <div>
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Weak against</div>
        <div className="space-y-2">
          {weakAgainst.map(({ champ, winRate, games }) => (
            <div key={champ.id} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-sm overflow-hidden border border-[#1E2D3D]">
                <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="font-mono text-[10px] font-bold" style={{ color: "#FF4E50" }}>{winRate}%</div>
              <div className="text-[8px] text-[#5B7A8C]">{games} Games</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] uppercase mb-2">Strong against</div>
        <div className="space-y-2">
          {strongAgainst.map(({ champ, winRate, games }) => (
            <div key={champ.id} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-sm overflow-hidden border border-[#1E2D3D]">
                <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="font-mono text-[10px] font-bold" style={{ color: "#0AC8B9" }}>{winRate}%</div>
              <div className="text-[8px] text-[#5B7A8C]">{games} Games</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Counter pick dropdown ──────────────────────────────────────
function CounterPickDropdown({ champions, version }: { champions: ChampionInfo[]; version: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ChampionInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() =>
    query ? champions.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12) : [],
    [champions, query]
  );

  const mostOften = useMemo(() => champions.slice(0, 8), [champions]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] hover:border-[#785A28] transition-colors text-[10px] font-['Cinzel'] text-[#5B7A8C] gap-2"
      >
        {selected ? (
          <>
            <div className="w-5 h-5 rounded-sm overflow-hidden border border-[#1E2D3D]">
              <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
            </div>
            <span>{selected.name}</span>
          </>
        ) : (
          <>vs. Counter</>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl w-64">
          <div className="p-3 border-b border-[#1E2D3D]">
            <div className="font-['Cinzel'] text-xs font-bold text-[#C8AA6E] mb-2">Counter pick</div>
            <div className="text-[9px] text-[#5B7A8C] mb-2">Check your matchup and optimize your build.</div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search a champion"
                className="w-full pl-7 pr-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28]"
              />
            </div>
          </div>
          {filtered.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A1428] border-b border-[#1E2D3D] text-left"
                >
                  <div className="w-7 h-7 rounded-sm overflow-hidden border border-[#1E2D3D]">
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[11px] font-['Cinzel'] text-[#A0B4C8]">{c.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3">
              <div className="text-[9px] text-[#5B7A8C] font-['Cinzel'] mb-2 uppercase tracking-widest">Most often played against</div>
              <div className="flex gap-1.5 flex-wrap">
                {mostOften.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setOpen(false); }}
                    className="w-9 h-9 rounded-sm overflow-hidden border border-[#1E2D3D] hover:border-[#C89B3C] transition-colors"
                  >
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {selected && (
            <button
              onClick={() => { setSelected(null); setOpen(false); }}
              className="w-full px-3 py-2 text-[9px] font-['Cinzel'] text-[#FF4E50] border-t border-[#1E2D3D] hover:bg-[#0A1428] text-center"
            >
              Clear counter pick
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rank dropdown ──────────────────────────────────────────────
const RANK_OPTIONS = [
  "All Tiers", "Challenger", "Grandmaster", "Master+", "Master",
  "Diamond+", "Diamond", "Emerald+", "Emerald",
  "Platinum+", "Platinum", "Gold+", "Gold", "Silver", "Bronze", "Iron",
];

const RANK_ICONS: Record<string, string> = {
  "Challenger": "🔥", "Grandmaster": "🔶", "Master+": "💜", "Master": "💜",
  "Diamond+": "💎", "Diamond": "💎", "Emerald+": "🟢", "Emerald": "🟢",
  "Platinum+": "🔵", "Platinum": "🔵", "Gold+": "🟡", "Gold": "🟡",
  "Silver": "⚪", "Bronze": "🟤", "Iron": "⬛", "All Tiers": "🏆",
};

function RankDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0AC8B9]/10 border border-[#0AC8B9]/40 hover:border-[#0AC8B9] transition-colors text-[10px] font-['Cinzel'] text-[#0AC8B9]"
      >
        <span>{RANK_ICONS[value] ?? "🏆"}</span>
        <span>{value}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl min-w-[160px]">
          {RANK_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-['Cinzel'] hover:bg-[#0A1428] transition-colors border-b border-[#1E2D3D] text-left ${
                value === r ? "text-[#0AC8B9] bg-[#0AC8B9]/5" : "text-[#A0B4C8]"
              }`}
            >
              <span>{RANK_ICONS[r]}</span>
              <span>{r}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Class dropdown ─────────────────────────────────────────────
const CLASS_OPTIONS = ["Class", "Fighter", "Slayer", "Tank", "Mage", "Controller", "Specialist"];

function ClassDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] hover:border-[#785A28] transition-colors text-[10px] font-['Cinzel'] text-[#5B7A8C]"
      >
        ✦ {value}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl min-w-[140px]">
          {CLASS_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-['Cinzel'] hover:bg-[#0A1428] transition-colors border-b border-[#1E2D3D] text-left ${
                value === c ? "text-[#C89B3C] bg-[#C89B3C]/5" : "text-[#A0B4C8]"
              }`}
            >
              ✦ {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tier badge ─────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};

// ── Tab navigation ─────────────────────────────────────────────
const TABS_BASE = ["Build", "Counters", "Items", "Runes", "Skills"];
const TABS_JUNGLE = ["Build", "Counters", "Items", "Jungle Paths", "Runes", "Skills"];

// ── Main sub-page component ────────────────────────────────────
interface Props {
  champion: ChampionInfo;
  champions: ChampionInfo[];
  onBack: () => void;
  onSelectChampion: (id: string) => void;
}

export function ChampionBuildSubPage({ champion, champions, onBack, onSelectChampion }: Props) {
  const version = useVersion();
  const isJungler = champion.primaryRole === "Jungle";
  const tabs = isJungler ? TABS_JUNGLE : TABS_BASE;

  const [selectedRank, setSelectedRank] = useState("Emerald+");
  const [selectedClass, setSelectedClass] = useState("Class");
  const [activeTab, setActiveTab] = useState("Build");
  const [gameMode, setGameMode] = useState("Ranked Solo/Duo");

  const allBuilds = useMemo(() =>
    getBuild(champion.name, champion.buildType, champion.winRate, champion.pickRate, champion.games),
    [champion]
  );

  // Get the best build for display (primary variant for default rank)
  const primaryBuild = useMemo(() => {
    const rankMap: Record<string, string> = {
      "Challenger": "CHALLENGER", "Grandmaster": "MASTER", "Master+": "MASTER",
      "Master": "MASTER", "Diamond+": "DIAMOND", "Diamond": "DIAMOND",
      "Emerald+": "EMERALD", "Emerald": "EMERALD", "Platinum+": "PLATINUM",
      "Platinum": "PLATINUM", "Gold+": "GOLD", "Gold": "GOLD",
      "All Tiers": "EMERALD",
    };
    const rankKey = rankMap[selectedRank] ?? "EMERALD";
    return allBuilds.find(b => b.rank === rankKey) ?? allBuilds[0];
  }, [allBuilds, selectedRank]);

  if (!primaryBuild) return null;

  const tierColor = TIER_COLORS[champion.tier] ?? "#A0B4C8";

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] font-['Cinzel'] text-[#5B7A8C] hover:text-[#C89B3C] transition-colors mb-4 uppercase tracking-widest"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to Champions
      </button>

      {/* Top filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <RankDropdown value={selectedRank} onChange={setSelectedRank} />
        <ClassDropdown value={selectedClass} onChange={setSelectedClass} />
        <CounterPickDropdown champions={champions} version={version} />
        <div className="ml-auto text-[9px] font-mono text-[#785A28] border border-[#1E2D3D] px-2 py-1">
          Ver: {version.split(".").slice(0, 2).join(".")}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Champion header card */}
          <OrnatePanel className="p-4 mb-4" accent>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-sm overflow-hidden border-2 border-[#785A28]">
                  <img src={champion.imageUrl} alt={champion.name} className="w-full h-full object-cover" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center text-[9px] font-['Cinzel'] font-black border"
                  style={{ color: tierColor, background: tierColor + "20", borderColor: tierColor + "60" }}
                >
                  {champion.tier}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="font-['Cinzel'] font-black text-2xl text-[#C8AA6E]">{champion.name}</h1>
                  <span className="text-[11px] text-[#5B7A8C] font-['Cinzel']">
                    Build For {champion.primaryRole}, Patch {version.split(".").slice(0, 2).join(".")}
                  </span>
                </div>
                <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] italic mb-2">{champion.title}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  {["Q", "W", "E", "R"].map(ab => (
                    <div
                      key={ab}
                      className="w-7 h-7 flex items-center justify-center text-[10px] font-['Cinzel'] font-black rounded-sm border"
                      style={{
                        color: ABILITY_COLORS[ab],
                        borderColor: ABILITY_COLORS[ab] + "60",
                        background: ABILITY_COLORS[ab] + "15",
                      }}
                    >
                      {ab}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 text-right shrink-0">
                {[
                  { label: "Win rate",  val: `${champion.winRate.toFixed(1)}%`, up: champion.trend === "up", color: winRateColor(champion.winRate) },
                  { label: "Pick rate", val: `${champion.pickRate.toFixed(1)}%`, up: false, color: "#A0B4C8" },
                  { label: "Ban rate",  val: `${champion.banRate.toFixed(1)}%`, up: false, color: "#A0B4C8" },
                ].map(({ label, val, up, color }) => (
                  <div key={label} className="flex items-center gap-2 justify-end">
                    <span className="text-[9px] text-[#5B7A8C] font-['Cinzel']">{label}</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>{val}</span>
                    <span className="text-[9px]" style={{ color: up ? "#0AC8B9" : "#FF4E50" }}>{up ? "↑" : "="}</span>
                  </div>
                ))}
              </div>
            </div>
          </OrnatePanel>

          {/* Game mode tabs */}
          <div className="flex gap-0 mb-4 border-b border-[#1E2D3D]">
            {["Ranked Solo/Duo", "Ranked Flex", "ARAM"].map(mode => (
              <button
                key={mode}
                onClick={() => setGameMode(mode)}
                className={`px-4 py-2 text-[10px] font-['Cinzel'] tracking-widest transition-all border-b-2 ${
                  gameMode === mode
                    ? "text-[#C89B3C] border-[#C89B3C]"
                    : "text-[#5B7A8C] border-transparent hover:text-[#A0B4C8]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Section tabs */}
          <div className="flex gap-0 mb-5 flex-wrap border-b border-[#1E2D3D]">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-[10px] font-['Cinzel'] tracking-widest transition-all border-b-2 ${
                  activeTab === tab
                    ? "text-[#C8AA6E] border-[#C89B3C] bg-[#C89B3C]/5"
                    : "text-[#5B7A8C] border-transparent hover:text-[#A0B4C8]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Build tab content ── */}
          {activeTab === "Build" && (
            <div className="space-y-5">
              {/* Jungle paths — only for junglers */}
              {isJungler && (
                <OrnatePanel className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest">
                      {champion.name} Jungle Paths
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#785A28]" />
                  </div>
                  <JunglePaths games={primaryBuild.games} />
                </OrnatePanel>
              )}

              {/* Runes */}
              <OrnatePanel className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest">
                    {champion.name} Runes
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#785A28]" />
                </div>
                <RuneTreeFull runes={primaryBuild.runes} winRate={primaryBuild.winRate} games={primaryBuild.games} />
              </OrnatePanel>

              {/* Summoner spells */}
              <OrnatePanel className="p-4">
                <div className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest mb-3">
                  {champion.name} Summoner Spells
                </div>
                <div className="flex gap-4 flex-wrap">
                  {[0, 1].map(i => (
                    <div key={i} className="flex-1 min-w-[200px] flex items-center gap-3 border border-[#1E2D3D] bg-[#060E1A] p-3">
                      <SpellIcon name={primaryBuild.spells[i]} version={version} size={44} />
                      {primaryBuild.spells[i + 2] && (
                        <SpellIcon name={primaryBuild.spells[i + 2]} version={version} size={44} />
                      )}
                      <div className="flex-1">
                        <div className="font-['Cinzel'] text-xs text-[#C8AA6E]">
                          {primaryBuild.spells.slice(i === 0 ? 0 : 2, i === 0 ? 2 : 4).join(" + ")}
                        </div>
                        <div className="font-mono text-sm font-bold" style={{ color: winRateColor(primaryBuild.winRate) }}>
                          {(primaryBuild.pickRate * (i === 0 ? 1 : 0.01)).toFixed(2)}%
                        </div>
                        <div className="text-[9px] text-[#5B7A8C]">{(primaryBuild.games * (i === 0 ? 1 : 0.001)).toLocaleString()} Games</div>
                      </div>
                      <div className="font-mono font-bold" style={{ color: winRateColor(primaryBuild.winRate) }}>
                        {primaryBuild.winRate.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </OrnatePanel>

              {/* Skill order */}
              <OrnatePanel className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest">
                    {champion.name} Skill Order
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#785A28]" />
                </div>
                <div className="flex items-center gap-3 mb-4 p-3 bg-[#060E1A] border border-[#1E2D3D]">
                  {["Q", "W", "E"].map((ab, i) => (
                    <span key={ab}>
                      <span
                        className="text-sm font-['Cinzel'] font-black"
                        style={{ color: ABILITY_COLORS[ab] }}
                      >
                        {ab}
                      </span>
                      {i < 2 && <span className="text-[#5B7A8C] mx-2">→</span>}
                    </span>
                  ))}
                  <div className="ml-auto text-right">
                    <div className="font-mono font-bold" style={{ color: winRateColor(primaryBuild.winRate) }}>
                      {primaryBuild.winRate.toFixed(2)}%
                    </div>
                    <div className="text-[9px] text-[#5B7A8C]">{primaryBuild.games.toLocaleString()} Games</div>
                    <div className="font-mono text-[11px]" style={{ color: winRateColor(primaryBuild.winRate - 1) }}>
                      {(primaryBuild.winRate + 0.43).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <LevelOrderGrid order={primaryBuild.levelOrder} skillOrder={primaryBuild.skillOrder} />
              </OrnatePanel>

              {/* Item builds */}
              <OrnatePanel className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest">
                    {champion.name} Item Builds
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#785A28]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* Starter items */}
                  <div>
                    <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Starter items</div>
                    <div className="space-y-2">
                      {primaryBuild.starterOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2 bg-[#060E1A]">
                          <div className="flex gap-1">
                            {opt.items.map((item, ii) => (
                              <ItemImg key={`${item.id}-${ii}`} id={item.id} name={item.name} version={version} size={36} />
                            ))}
                          </div>
                          <div className="flex-1 text-right">
                            <div className="text-[10px] font-mono font-bold text-[#A0B4C8]">{opt.pickRate.toFixed(2)}%</div>
                            <div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()} Games</div>
                          </div>
                          <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>
                            {opt.winRate.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Boots */}
                  <div>
                    <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Boots</div>
                    <div className="space-y-2">
                      {primaryBuild.bootsOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2 bg-[#060E1A]">
                          <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={36} />
                          <div className="flex-1 text-right">
                            <div className="text-[10px] font-mono font-bold text-[#A0B4C8]">{opt.pickRate.toFixed(2)}%</div>
                            <div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()} Games</div>
                          </div>
                          <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>
                            {opt.winRate.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Core builds */}
                <div className="mb-5">
                  <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Core builds</div>
                  <div className="space-y-2">
                    {primaryBuild.coreOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2 bg-[#060E1A] flex-wrap">
                        <div className="flex items-center gap-1">
                          {opt.items.map((item, ii) => (
                            <span key={ii} className="flex items-center gap-1">
                              <ItemImg id={item.id} name={item.name} version={version} size={40} />
                              {ii < opt.items.length - 1 && <ChevronRight className="w-3 h-3 text-[#785A28]" />}
                            </span>
                          ))}
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-[10px] font-mono font-bold text-[#A0B4C8]">{opt.pickRate.toFixed(2)}%</div>
                          <div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()} Games</div>
                        </div>
                        <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>
                          {opt.winRate.toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4th / 5th / 6th item options */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Fourth Item",  opts: primaryBuild.fourthOptions },
                    { label: "Fifth Item",   opts: primaryBuild.fifthOptions },
                    { label: "Sixth Item",   opts: primaryBuild.sixthOptions },
                  ].map(({ label, opts }) => (
                    <div key={label}>
                      <div className="text-[9px] font-['Cinzel'] uppercase tracking-widest mb-2" style={{ color: "#0AC8B9" }}>{label}</div>
                      <div className="space-y-1.5">
                        {opts.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-1.5 bg-[#060E1A]">
                            <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={32} />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[10px] font-bold" style={{ color: winRateColor(opt.winRate) }}>
                                {opt.winRate.toFixed(2)}%
                              </div>
                              <div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()} Games</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </OrnatePanel>
            </div>
          )}

          {/* ── Jungle Paths tab ── */}
          {activeTab === "Jungle Paths" && isJungler && (
            <OrnatePanel className="p-4">
              <div className="font-['Cinzel'] font-bold text-[#C8AA6E] mb-4">
                {champion.name} Jungle Paths
              </div>
              <JunglePaths games={primaryBuild.games} />
            </OrnatePanel>
          )}

          {/* ── Counters tab ── */}
          {activeTab === "Counters" && (
            <OrnatePanel className="p-4">
              <div className="font-['Cinzel'] font-bold text-[#C8AA6E] mb-4">{champion.name} Counters</div>
              <div className="flex gap-6 flex-wrap">
                <CounterSidebar champion={champion} champions={champions} version={version} />
              </div>
            </OrnatePanel>
          )}

          {/* ── Runes tab ── */}
          {activeTab === "Runes" && (
            <OrnatePanel className="p-4">
              <div className="font-['Cinzel'] font-bold text-[#C8AA6E] mb-4">{champion.name} Runes</div>
              <RuneTreeFull runes={primaryBuild.runes} winRate={primaryBuild.winRate} games={primaryBuild.games} />
            </OrnatePanel>
          )}

          {/* ── Skills tab ── */}
          {activeTab === "Skills" && (
            <OrnatePanel className="p-4">
              <div className="font-['Cinzel'] font-bold text-[#C8AA6E] mb-4">{champion.name} Skill Order</div>
              <LevelOrderGrid order={primaryBuild.levelOrder} skillOrder={primaryBuild.skillOrder} />
            </OrnatePanel>
          )}

          {/* ── Items tab ── */}
          {activeTab === "Items" && (
            <OrnatePanel className="p-4">
              <div className="font-['Cinzel'] font-bold text-[#C8AA6E] mb-4">{champion.name} Item Builds</div>
              <div className="text-[10px] text-[#5B7A8C] font-['Cinzel']">View all item details in the Build tab above.</div>
            </OrnatePanel>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-44 shrink-0 hidden lg:block">
          <OrnatePanel className="p-3">
            <CounterSidebar champion={champion} champions={champions} version={version} />
          </OrnatePanel>
        </div>
      </div>
    </div>
  );
}
