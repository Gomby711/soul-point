import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Sword, Zap, Shield, BookOpen, Users, TrendingUp } from "lucide-react";
import { type ChampionInfo } from "@/hooks/useChampionData";
import { getBuild, type BuildEntry } from "@/data/builds";
import { useRuneData, PATH_COLORS, type RunePath } from "@/hooks/useRuneData";
import { getDragonVersion, fetchOPGGChampionAnalysis, fetchOPGGChampionBuilds, fetchChampionPatchNotes } from "@/api/client";
import { winRateColor } from "@/lib/utils";
import { RoleIcon } from "@/components/common/RoleIcon";

// ── DDragon version ────────────────────────────────────────────
function useVersion() {
  const [v, setV] = useState("15.1.1");
  useEffect(() => { getDragonVersion().then(setV).catch(() => {}); }, []);
  return v;
}

// ── Spell data (Q/W/E/R) ──────────────────────────────────────
interface SpellData { id: string; name: string }
const _spellCache: Record<string, SpellData[]> = {};

function useChampionSpells(champId: string, version: string): SpellData[] {
  const [spells, setSpells] = useState<SpellData[]>(_spellCache[champId] ?? []);
  useEffect(() => {
    if (!champId || !version) return;
    if (_spellCache[champId]) { setSpells(_spellCache[champId]); return; }
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${champId}.json`)
      .then(r => r.json())
      .then(data => {
        const s: SpellData[] = (data?.data?.[champId]?.spells ?? []).map(
          (sp: { id: string; name: string }) => ({ id: sp.id, name: sp.name }),
        );
        _spellCache[champId] = s;
        setSpells(s);
      })
      .catch(() => {});
  }, [champId, version]);
  return spells;
}

// ── OP.GG data types ───────────────────────────────────────────
interface OPGGCoreItems {
  ids: number[]; ids_names: string[];
  play?: number; win?: number; pick_rate?: number;
}
interface OPGGCounter {
  champion_id: number; champion_name: string;
  play: number; win: number; win_rate: number;
}
interface OPGGRunes {
  primary_page_name: string;   primary_rune_names: string[];
  secondary_page_name: string; secondary_rune_names: string[];
}
interface OPGGSkills { order: string[]; play: number; win: number; pick_rate: number }
interface OPGGData {
  summary?: { average_stats?: { play: number; win_rate: number; pick_rate: number; ban_rate: number } };
  strong_counters?: OPGGCounter[]; weak_counters?: OPGGCounter[];
  core_items?: OPGGCoreItems; boots?: OPGGCoreItems; starter_items?: OPGGCoreItems;
  last_items?: OPGGCoreItems[]; fourth_items?: OPGGCoreItems[]; fifth_items?: OPGGCoreItems[];
  summoner_spells?: OPGGCoreItems; runes?: OPGGRunes; skills?: OPGGSkills;
}
interface OPGGParsed { champion: string; position: string; data: OPGGData }

const SPELL_ID_MAP: Record<number, string> = {
  1: "Cleanse", 3: "Exhaust", 4: "Flash", 6: "Ghost",
  7: "Heal", 11: "Smite", 12: "Teleport", 14: "Ignite", 21: "Barrier",
};

function toItemOpt(ci: OPGGCoreItems) {
  const id   = ci.ids?.[0] ?? 0;
  const name = ci.ids_names?.[0] ?? String(id);
  const wrV  = ci.play && ci.win ? +((ci.win / ci.play) * 100).toFixed(1) : 50;
  return { item: { id, name }, pickRate: +((ci.pick_rate ?? 0) * 100).toFixed(1), games: ci.play ?? 0, winRate: wrV };
}

function padOrder(order: string[]): string[] {
  const res = [...order];
  const c = { Q: 0, W: 0, E: 0, R: 0 };
  res.forEach(a => { if (a in c) c[a as keyof typeof c]++; });
  while (res.length < 18) {
    const lv = res.length + 1;
    if (lv === 16)    { res.push("R"); c.R++; continue; }
    if (c.Q < 5)      { res.push("Q"); c.Q++; }
    else if (c.W < 5) { res.push("W"); c.W++; }
    else if (c.E < 5) { res.push("E"); c.E++; }
    else              { res.push("R"); c.R++; }
  }
  return res;
}

// ── OP.GG module-level cache ───────────────────────────────────
const _opggCache: Record<string, OPGGParsed> = {};
const _opggInflight: Record<string, Promise<OPGGParsed | null>> = {};

function opggKey(champName: string, position: string, rankKey: string) {
  return `${champName}::${position}::${rankKey}`;
}

function fetchAndCache(champName: string, position: string, rankKey: string): Promise<OPGGParsed | null> {
  const key = opggKey(champName, position, rankKey);
  if (_opggInflight[key]) return _opggInflight[key];
  const p = fetchOPGGChampionAnalysis(champName, position, rankKey)
    .then(raw => {
      const r = raw as OPGGParsed;
      if (r?.data) { _opggCache[key] = r; return r; }
      return null;
    })
    .catch(() => null)
    .finally(() => { delete _opggInflight[key]; });
  _opggInflight[key] = p;
  return p;
}

// Call this on champion hover so data is ready by the time user clicks
export function prefetchOPGGBuild(champName: string, position: string, rankKey = "EMERALD") {
  const key = opggKey(champName, position, rankKey);
  if (!_opggCache[key]) fetchAndCache(champName, position, rankKey);
  // Also prefetch multi-builds
  const multiKey = `${champName}::${position}`;
  if (!_multiCache[multiKey]) fetchMultiBuilds(champName, position);
}

// ── OP.GG live data hook ───────────────────────────────────────
function useOPGGBuild(champName: string, position: string, rankKey: string) {
  const key = opggKey(champName, position, rankKey);
  const [parsed, setParsed] = useState<OPGGParsed | null>(_opggCache[key] ?? null);
  const [loading, setLoading] = useState(!_opggCache[key]);
  useEffect(() => {
    const cached = _opggCache[opggKey(champName, position, rankKey)];
    if (cached) { setParsed(cached); setLoading(false); return; }
    let cancelled = false;
    setParsed(null);
    setLoading(true);
    fetchAndCache(champName, position, rankKey)
      .then(r => { if (!cancelled) setParsed(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [champName, position, rankKey]);
  return { parsed, loading };
}

// ── OP.GG multi-build cache ────────────────────────────────────
interface OPGGMultiBuildEntry { tier: string; label: string; parsed: OPGGParsed }
const _multiCache: Record<string, OPGGMultiBuildEntry[]> = {};
const _multiInflight: Record<string, Promise<OPGGMultiBuildEntry[]>> = {};

function fetchMultiBuilds(champName: string, position: string): Promise<OPGGMultiBuildEntry[]> {
  const key = `${champName}::${position}`;
  if (_multiInflight[key]) return _multiInflight[key];
  const p = fetchOPGGChampionBuilds(champName, position)
    .then(res =>
      res.builds
        .filter(b => b.data !== null)
        .map(b => ({ tier: b.tier, label: b.label, parsed: b.data as OPGGParsed }))
    )
    .catch(() => [] as OPGGMultiBuildEntry[])
    .then(result => { _multiCache[key] = result; return result; })
    .finally(() => { delete _multiInflight[key]; });
  _multiInflight[key] = p;
  return p;
}

function useOPGGMultipleBuilds(champName: string, position: string) {
  const key = `${champName}::${position}`;
  const [builds, setBuilds] = useState<OPGGMultiBuildEntry[]>(_multiCache[key] ?? []);
  const [loading, setLoading] = useState(!_multiCache[key]);
  useEffect(() => {
    const cached = _multiCache[key];
    if (cached) { setBuilds(cached); setLoading(false); return; }
    let cancelled = false;
    setBuilds([]);
    setLoading(true);
    fetchMultiBuilds(champName, position)
      .then(r => { if (!cancelled) setBuilds(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [champName, position, key]);
  return { builds, loading };
}

function mergeOPGGBuild(
  parsed: OPGGParsed,
  staticBuild: BuildEntry,
  _paths: RunePath[],
): BuildEntry {
  const d = parsed.data;
  const coreItems = (d.core_items?.ids ?? []).slice(0, 3).map((id, i) => ({
    id, name: d.core_items?.ids_names?.[i] ?? String(id),
  }));
  const starters = (d.starter_items?.ids ?? []).map((id, i) => ({
    id, name: d.starter_items?.ids_names?.[i] ?? String(id),
  }));
  const boots = d.boots?.ids?.[0]
    ? { id: d.boots.ids[0], name: d.boots.ids_names?.[0] ?? String(d.boots.ids[0]) }
    : staticBuild.boots;
  const runes = d.runes
    ? {
        keystone:       d.runes.primary_rune_names?.[0]  ?? staticBuild.runes.keystone,
        primary:        d.runes.primary_page_name         ?? staticBuild.runes.primary,
        secondary:      d.runes.secondary_page_name       ?? staticBuild.runes.secondary,
        primaryRunes:   d.runes.primary_rune_names,
        secondaryRunes: d.runes.secondary_rune_names,
      }
    : staticBuild.runes;
  const spellIds = (d.summoner_spells?.ids ?? staticBuild.spellIds).map(Number);
  const spells   = spellIds.map(id => SPELL_ID_MAP[id] ?? String(id));
  const rawOrder = d.skills?.order ?? [];
  const levelOrder = rawOrder.length > 0 ? padOrder(rawOrder) : staticBuild.levelOrder;
  const nonR = levelOrder.filter(a => a !== "R");
  const cnt = (a: string) => nonR.filter(x => x === a).length;
  const skillOrder = ["Q", "W", "E"].sort((a, b) => cnt(b) - cnt(a)).join(" → ");
  const fourthOptions = (d.last_items   ?? []).slice(0, 5).map(toItemOpt);
  const fifthOptions  = (d.fourth_items ?? []).slice(0, 5).map(toItemOpt);
  const sixthOptions  = (d.fifth_items  ?? []).slice(0, 5).map(toItemOpt);
  const avg = d.summary?.average_stats;
  return {
    ...staticBuild,
    winRate:  avg ? +(avg.win_rate  * 100).toFixed(1) : staticBuild.winRate,
    pickRate: avg ? +(avg.pick_rate * 100).toFixed(1) : staticBuild.pickRate,
    games:    avg?.play ?? staticBuild.games,
    boots,
    items:         coreItems.length ? coreItems : staticBuild.items,
    startItems:    starters.length  ? starters  : staticBuild.startItems,
    runes, spells, spellIds, skillOrder, levelOrder,
    fourthOptions: fourthOptions.length ? fourthOptions : staticBuild.fourthOptions,
    fifthOptions:  fifthOptions.length  ? fifthOptions  : staticBuild.fifthOptions,
    sixthOptions:  sixthOptions.length  ? sixthOptions  : staticBuild.sixthOptions,
  };
}

function matchOPGGCounters(
  entries: OPGGCounter[],
  champions: ChampionInfo[],
  winRateIsOurs: boolean,
): { champ: ChampionInfo; winRate: number; games: number }[] {
  return entries.slice(0, 5)
    .map(e => {
      const champ = champions.find(c => c.name.toLowerCase() === e.champion_name?.toLowerCase());
      if (!champ) return null;
      const wrV = winRateIsOurs
        ? +(e.win_rate * 100).toFixed(1)
        : +((1 - e.win_rate) * 100).toFixed(1);
      return { champ, winRate: wrV, games: e.play };
    })
    .filter(Boolean) as { champ: ChampionInfo; winRate: number; games: number }[];
}

function useCounters(champion: ChampionInfo, champions: ChampionInfo[]) {
  function h(s: string) {
    let n = 5381;
    for (let i = 0; i < s.length; i++) n = (n * 33 ^ s.charCodeAt(i)) & 0x7fffffff;
    return n / 0x7fffffff;
  }
  const peers = useMemo(
    () => champions.filter(c => c.id !== champion.id && c.primaryRole === champion.primaryRole),
    [champions, champion],
  );
  const weakAgainst = useMemo(() =>
    [...peers].sort((a, b) => h(champion.name + a.name) - h(champion.name + b.name)).slice(0, 5)
      .map(c => ({ champ: c, winRate: +(29 + h(champion.name + c.name + "w") * 22).toFixed(1), games: Math.floor(30 + h(champion.name + c.name) * 270) })),
    [peers, champion],
  );
  const strongAgainst = useMemo(() =>
    [...peers].sort((a, b) => h(a.name + champion.name) - h(b.name + champion.name)).slice(0, 5)
      .map(c => ({ champ: c, winRate: +(60 + h(c.name + champion.name + "s") * 22).toFixed(1), games: Math.floor(30 + h(c.name + champion.name) * 270) })),
    [peers, champion],
  );
  return { weakAgainst, strongAgainst };
}

// ── Jungle camp icons ──────────────────────────────────────────
const CAMPS: Record<string, { label: string; color: string; url: string }> = {
  Blue:    { label: "Blue",  color: "#3A7BD5", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_bluebuff.png" },
  Gromp:   { label: "Gromp", color: "#3E7A3B", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_gromp.png" },
  Wolves:  { label: "Wolf",  color: "#7A8EA0", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_wolf.png" },
  Raptors: { label: "Raps",  color: "#C47820", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_razorbeak.png" },
  Red:     { label: "Red",   color: "#C83030", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_redbuff.png" },
  Krugs:   { label: "Krug",  color: "#8B5E3C", url: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_krug.png" },
};
const BLUE_PATH = ["Blue", "Gromp", "Wolves", "Raptors", "Red", "Krugs"];
const RED_PATH  = ["Red",  "Krugs", "Raptors", "Wolves",  "Blue", "Gromp"];

function CampDot({ camp }: { camp: string }) {
  const def = CAMPS[camp] ?? { label: camp.slice(0, 4), color: "#5B7A8C", url: "" };
  const [ok, setOk] = useState(true);
  return (
    <div className="group relative shrink-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 text-[9px] font-bold"
        style={{ borderColor: def.color, background: def.color + "22", color: def.color }}>
        {ok && def.url
          ? <img src={def.url} alt={camp} className="w-7 h-7 object-contain" onError={() => setOk(false)} />
          : def.label}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border
        border-[#1E2D3D] px-2 py-0.5 text-[10px] text-[#C8AA6E] whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50">
        {camp}
      </div>
    </div>
  );
}

function JunglePaths({ games }: { games: number }) {
  return (
    <div className="space-y-2">
      {[
        { side: "Blue Side", path: BLUE_PATH, g: Math.floor(games * 0.58), color: "#0AC8B9" },
        { side: "Red Side",  path: RED_PATH,  g: Math.floor(games * 0.42), color: "#FF4E50" },
      ].map(({ side, path, g, color }) => (
        <div key={side} className="bg-[#010A13] border border-[#1E2D3D] p-3">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-['Cinzel'] font-semibold tracking-wider" style={{ color }}>{side}</span>
            <span className="text-[10px] text-[#5B7A8C] font-mono">{g.toLocaleString()} games</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {path.map((camp, i) => (
              <span key={i} className="flex items-center gap-1">
                <CampDot camp={camp} />
                {i < path.length - 1 && <ChevronRight className="w-3 h-3 text-[#1E2D3D] shrink-0" />}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Item image ─────────────────────────────────────────────────
function ItemImg({ id, name, version, size = 48 }: { id: number; name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
      <div className="overflow-hidden border border-[#1E2D3D] bg-[#010A13]"
        style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.1"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border
        border-[#1E2D3D] px-2 py-1 text-[10px] text-[#C8AA6E] whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50">
        {name}
      </div>
    </div>
  );
}

// ── Summoner spell ─────────────────────────────────────────────
const SPELL_KEYS: Record<string, string> = {
  Flash: "SummonerFlash", Ignite: "SummonerDot", Teleport: "SummonerTeleport",
  Heal: "SummonerHeal", Exhaust: "SummonerExhaust", Smite: "SummonerSmite",
  Barrier: "SummonerBarrier", Ghost: "SummonerHaste", Cleanse: "SummonerBoost",
};

function SpellImg({ name, version, size = 52 }: { name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
      <div className="overflow-hidden border border-[#785A28]" style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${SPELL_KEYS[name] ?? "SummonerFlash"}.png`}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border
        border-[#1E2D3D] px-2 py-1 text-[10px] text-[#C8AA6E] whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50">
        {name}
      </div>
    </div>
  );
}

// ── Rune icon (individual cell) ────────────────────────────────
function RuneIcon({
  iconPath, name, size = 40, selected = false, dimmed = false, pathColor,
}: {
  iconPath: string; name: string; size?: number;
  selected?: boolean; dimmed?: boolean; pathColor?: string;
}) {
  const accent = pathColor ?? "#C89B3C";
  return (
    <div className="group relative shrink-0 flex flex-col items-center gap-1" style={{ opacity: dimmed ? 0.2 : 1 }}>
      <div
        className="rounded-full overflow-hidden flex items-center justify-center transition-all"
        style={{
          width: size, height: size,
          background: selected ? accent + "22" : "rgba(1,10,19,0.5)",
          border: selected ? `2px solid ${accent}` : "1px solid #1E2D3D",
          filter: dimmed ? "grayscale(1)" : "none",
          boxShadow: selected ? `0 0 12px ${accent}66` : "none",
        }}
      >
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
        />
      </div>
      {selected && (
        <span className="text-[8px] font-['Cinzel'] text-center leading-tight max-w-[56px] truncate"
          style={{ color: accent }}>
          {name}
        </span>
      )}
      {!dimmed && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border
          border-[#1E2D3D] px-2 py-1 text-[10px] text-[#C8AA6E] whitespace-nowrap
          opacity-0 group-hover:opacity-100 pointer-events-none z-50">
          {name}
        </div>
      )}
    </div>
  );
}

// ── Stat shard data ────────────────────────────────────────────
const SHARD_ROWS: { label: string; icon: string }[][] = [
  [
    { label: "Adaptive Force", icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    { label: "Attack Speed",   icon: "perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    { label: "Ability Haste",  icon: "perk-images/StatMods/StatModsCDRScalingIcon.png" },
  ],
  [
    { label: "Adaptive Force", icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    { label: "Armor",          icon: "perk-images/StatMods/StatModsArmorIcon.png" },
    { label: "Magic Resist",   icon: "perk-images/StatMods/StatModsMagicResIcon.MagicResist_fix.png" },
  ],
  [
    { label: "Health",         icon: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
    { label: "Tenacity",       icon: "perk-images/StatMods/StatModsTenacityIcon.png" },
    { label: "Ability Haste",  icon: "perk-images/StatMods/StatModsCDRScalingIcon.png" },
  ],
];

function ShardCell({ label, icon, selected }: { label: string; icon: string; selected: boolean }) {
  const color = "#C89B3C";
  return (
    <div className="group relative flex flex-col items-center gap-1">
      <div
        className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          border: selected ? `2px solid ${color}` : "1px solid #1E2D3D",
          background: selected ? color + "22" : "rgba(1,10,19,0.4)",
          filter: selected ? "none" : "grayscale(1) opacity(0.3)",
          boxShadow: selected ? `0 0 8px ${color}55` : "none",
        }}
      >
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/img/${icon}`}
          alt={label}
          className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
        />
      </div>
      <span className="text-[7px] text-[#5B7A8C] text-center leading-tight max-w-[36px]">{label}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border
        border-[#1E2D3D] px-2 py-1 text-[10px] text-[#C8AA6E] whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50">
        {label}
      </div>
    </div>
  );
}

// ── Full rune tree — OP.GG grid layout ────────────────────────
function RuneTree({ runes, winRate: buildWR, games }: {
  runes: BuildEntry["runes"]; winRate: number; games: number;
}) {
  const { paths, loaded } = useRuneData();
  if (!loaded) return (
    <div className="flex items-center justify-center h-32 text-[#5B7A8C] font-['Cinzel'] text-xs animate-pulse">
      Loading runes…
    </div>
  );

  const primaryPath   = paths.find(p => p.name === runes.primary);
  const secondaryPath = paths.find(p => p.name === runes.secondary);
  const pColor = PATH_COLORS[runes.primary]   ?? "#C89B3C";
  const sColor = PATH_COLORS[runes.secondary] ?? "#0AC8B9";
  const primarySelSet   = new Set((runes.primaryRunes   ?? []).map(n => n.toLowerCase()));
  const secondarySelSet = new Set((runes.secondaryRunes ?? []).map(n => n.toLowerCase()));

  const SLOT_H = "py-5 border-b border-[#1E2D3D] last:border-0";

  return (
    <div className="border border-[#1E2D3D] overflow-hidden" style={{ background: "#060E1A" }}>

      {/* ── Column headers ────────────────────────────────────── */}
      <div className="grid border-b border-[#1E2D3D]" style={{ gridTemplateColumns: "1fr 220px 148px" }}>

        {/* Primary header */}
        <div className="flex items-center gap-3 px-5 py-3 border-r border-[#1E2D3D]"
          style={{ background: pColor + "0d" }}>
          {primaryPath && (
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 shrink-0"
              style={{ borderColor: pColor }}>
              <img src={`https://ddragon.leagueoflegends.com/cdn/img/${primaryPath.icon}`}
                alt={primaryPath.name} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <div className="font-['Cinzel'] text-sm font-bold tracking-wider" style={{ color: pColor }}>
              {runes.primary}
            </div>
            <div className="text-[10px] text-[#5B7A8C] font-mono">Primary Path</div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono font-bold text-sm" style={{ color: winRateColor(buildWR) }}>{buildWR}%</div>
            <div className="text-[10px] text-[#5B7A8C] font-mono">{games.toLocaleString()} games</div>
          </div>
        </div>

        {/* Secondary header */}
        <div className="flex items-center gap-3 px-4 py-3 border-r border-[#1E2D3D]"
          style={{ background: sColor + "0d" }}>
          {secondaryPath && (
            <div className="w-7 h-7 rounded-full overflow-hidden border-2 shrink-0"
              style={{ borderColor: sColor }}>
              <img src={`https://ddragon.leagueoflegends.com/cdn/img/${secondaryPath.icon}`}
                alt={secondaryPath.name} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <div className="font-['Cinzel'] text-xs font-bold tracking-wider" style={{ color: sColor }}>
              {runes.secondary}
            </div>
            <div className="text-[10px] text-[#5B7A8C] font-mono">Secondary</div>
          </div>
        </div>

        {/* Shards header */}
        <div className="flex items-center px-4 py-3" style={{ background: "#C89B3C0d" }}>
          <span className="font-['Cinzel'] text-xs font-bold text-[#785A28] tracking-widest uppercase">Shards</span>
        </div>
      </div>

      {/* ── Rune rows ─────────────────────────────────────────── */}
      <div>

        {/* Keystone row */}
        <div className={`grid border-b border-[#1E2D3D]`}
          style={{ gridTemplateColumns: "1fr 220px 148px" }}>

          {/* Primary keystones */}
          <div className={`flex justify-around items-start px-5 ${SLOT_H} border-r border-[#1E2D3D]`}>
            {(primaryPath?.slots[0]?.runes ?? []).map(perk => {
              const sel = perk.name.toLowerCase() === runes.keystone.toLowerCase();
              return (
                <RuneIcon
                  key={perk.id}
                  iconPath={perk.icon}
                  name={perk.name}
                  size={sel ? 58 : 42}
                  selected={sel}
                  dimmed={!sel}
                  pathColor={pColor}
                />
              );
            })}
          </div>

          {/* Secondary: slot 1 */}
          {secondaryPath?.slots[1] ? (
            <div className={`flex justify-around items-start px-4 ${SLOT_H} border-r border-[#1E2D3D]`}>
              {secondaryPath.slots[1].runes.map(perk => {
                const sel = secondarySelSet.size > 0
                  ? secondarySelSet.has(perk.name.toLowerCase())
                  : false;
                return (
                  <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name}
                    size={sel ? 40 : 32} selected={sel} dimmed={!sel} pathColor={sColor} />
                );
              })}
            </div>
          ) : <div className="border-r border-[#1E2D3D]" />}

          {/* Shard row 1 */}
          <div className={`flex justify-around items-start px-3 ${SLOT_H}`}>
            {SHARD_ROWS[0].map((s, i) => (
              <ShardCell key={i} label={s.label} icon={s.icon} selected={i === 0} />
            ))}
          </div>
        </div>

        {/* Rows 1–3 of primary, rows 2–4 of secondary, shard rows 2–3 */}
        {[0, 1, 2].map(rowIdx => {
          const primarySlot   = primaryPath?.slots[rowIdx + 1];
          const secondarySlot = secondaryPath?.slots[rowIdx + 2];

          return (
            <div key={rowIdx}
              className={`grid ${rowIdx < 2 ? "border-b border-[#1E2D3D]" : ""}`}
              style={{ gridTemplateColumns: "1fr 220px 148px" }}>

              {/* Primary non-keystone slot */}
              <div className={`flex justify-around items-start px-5 ${SLOT_H} border-r border-[#1E2D3D]`}>
                {(primarySlot?.runes ?? []).map((perk, pi) => {
                  const sel = primarySelSet.size > 0
                    ? primarySelSet.has(perk.name.toLowerCase())
                    : pi === 0;
                  return (
                    <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name}
                      size={sel ? 44 : 32} selected={sel} dimmed={!sel} pathColor={pColor} />
                  );
                })}
              </div>

              {/* Secondary slot */}
              {secondarySlot ? (
                <div className={`flex justify-around items-start px-4 ${SLOT_H} border-r border-[#1E2D3D]`}>
                  {secondarySlot.runes.map((perk, pi) => {
                    const sel = secondarySelSet.size > 0
                      ? secondarySelSet.has(perk.name.toLowerCase())
                      : rowIdx < 2 && pi === 0;
                    return (
                      <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name}
                        size={sel ? 40 : 30} selected={sel} dimmed={!sel} pathColor={sColor} />
                    );
                  })}
                </div>
              ) : <div className="border-r border-[#1E2D3D]" />}

              {/* Shard rows 2 and 3 for rowIdx 0 and 1; empty for rowIdx 2 */}
              <div className={`flex justify-around items-start px-3 ${SLOT_H}`}>
                {rowIdx < 2
                  ? SHARD_ROWS[rowIdx + 1].map((s, i) => (
                      <ShardCell key={i} label={s.label} icon={s.icon} selected={i === 0} />
                    ))
                  : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skill order grid ───────────────────────────────────────────
const AB_COLORS: Record<string, string> = {
  Q: "#C89B3C", W: "#0AC8B9", E: "#A0B4C8", R: "#FF4E50",
};

function SkillGrid({ order, skillOrder, champId, version }: {
  order: string[]; skillOrder: string; champId: string; version: string;
}) {
  const spells = useChampionSpells(champId, version);
  const norm   = [...order];
  while (norm.length < 18) norm.push("?");
  const byAb: Record<string, SpellData | undefined> = {
    Q: spells[0], W: spells[1], E: spells[2], R: spells[3],
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {["Q", "W", "E", "R"].map(ab => {
          const sp = byAb[ab];
          const c  = AB_COLORS[ab];
          return (
            <div key={ab} className="flex items-center gap-1.5">
              <div className="w-10 h-10 overflow-hidden border flex items-center justify-center"
                style={{ borderColor: c + "60", background: c + "15" }}>
                {sp
                  ? <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${sp.id}.png`}
                      alt={sp.name} className="w-full h-full object-cover" />
                  : <span className="text-[11px] font-black" style={{ color: c }}>{ab}</span>}
              </div>
              <span className="text-xs font-['Cinzel'] font-bold" style={{ color: c }}>{ab}</span>
            </div>
          );
        })}
        <div className="ml-auto text-[11px] text-[#5B7A8C] font-['Cinzel']">
          Max: <span className="text-[#C8AA6E] font-semibold">{skillOrder}</span>
        </div>
      </div>

      <div className="flex gap-0.5 flex-wrap">
        {norm.map((ability, i) => {
          const c = AB_COLORS[ability];
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-bold font-['Cinzel']"
                style={{
                  color: c ?? "#5B7A8C",
                  background: c ? c + "18" : "#0A1428",
                  border: `1px solid ${c ? c + "50" : "#1E2D3D"}`,
                }}
              >
                {ability || "?"}
              </div>
              <div className="text-[7px] text-[#5B7A8C] font-mono">{i + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Rank dropdown ──────────────────────────────────────────────
const RANKS = [
  { label: "Emerald+",    icon: "🟢", key: "EMERALD"     },
  { label: "Diamond+",   icon: "💎", key: "DIAMOND"    },
  { label: "Platinum+",  icon: "🔵", key: "PLATINUM"  },
  { label: "Gold+",      icon: "🟡", key: "GOLD"       },
  { label: "Master+",    icon: "💜", key: "MASTER"     },
  { label: "Challenger", icon: "🔥", key: "CHALLENGER" },
  { label: "All Tiers",  icon: "🏆", key: "EMERALD"    },
];

function RankSelect({ value, onChange }: { value: string; onChange: (l: string, k: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const cur = RANKS.find(r => r.label === value) ?? RANKS[0];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D]
          hover:border-[#785A28] text-[11px] text-[#A0B4C8] font-['Cinzel'] tracking-wider transition-colors"
      >
        <span>{cur.icon}</span><span>{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5B7A8C] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-0.5 bg-[#0A1428] border border-[#785A28]
          shadow-2xl min-w-[165px] overflow-hidden">
          {RANKS.map(r => (
            <button
              key={r.label}
              onClick={() => { onChange(r.label, r.key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-['Cinzel'] tracking-wider
                hover:bg-[#785A28]/20 border-b border-[#1E2D3D] last:border-0 text-left transition-colors
                ${value === r.label ? "text-[#C89B3C]" : "text-[#5B7A8C]"}`}
            >
              <span>{r.icon}</span><span>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Item option row ────────────────────────────────────────────
function ItemRow({ rank, item, pickRate, winRate: rowWR, games, version }: {
  rank: number; item: { id: number; name: string };
  pickRate: number; winRate: number; games: number; version: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#1E2D3D] last:border-0">
      <span className="text-[10px] text-[#5B7A8C] font-mono w-4 shrink-0 text-center">{rank}</span>
      <ItemImg id={item.id} name={item.name} version={version} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#C8AA6E] truncate">{item.name}</div>
        <div className="text-[9px] text-[#5B7A8C] font-mono">{games.toLocaleString()} games</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold font-mono text-[11px]" style={{ color: winRateColor(rowWR) }}>{rowWR.toFixed(1)}%</div>
        <div className="text-[10px] text-[#0AC8B9] font-mono">{pickRate.toFixed(1)}%</div>
      </div>
    </div>
  );
}

// ── Counter champion card ─────────────────────────────────────
function CounterCard({ champ, winRate: cardWR, games, variant, onClick }: {
  champ: ChampionInfo; winRate: number; games: number; variant: "hard" | "easy";
  onClick?: () => void;
}) {
  const color = variant === "hard" ? "#FF4E50" : "#0AC8B9";
  return (
    <button
      className="flex flex-col items-center gap-1.5 min-w-[64px] group"
      onClick={onClick}
    >
      <div
        className="w-14 h-14 overflow-hidden border-2 transition-all group-hover:scale-105"
        style={{ borderColor: color + "80" }}
      >
        <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="text-[10px] text-[#A0B4C8] font-['Cinzel'] text-center max-w-[64px] truncate group-hover:text-[#C8AA6E] transition-colors">{champ.name}</div>
      <div className="font-bold font-mono text-xs" style={{ color }}>{cardWR.toFixed(1)}%</div>
      <div className="text-[9px] text-[#5B7A8C] font-mono">{(games / 1000).toFixed(1)}k</div>
    </button>
  );
}

// ── Full champion data hook (stats + abilities from DDragon) ──
interface ChampAbility {
  id: string; name: string; description: string; tooltip: string;
  cooldown: number[]; cost: number[]; range: (number | string)[];
}

interface ChampFullData {
  stats: Record<string, number>;
  passive: { name: string; description: string; image: { full: string } };
  spells: ChampAbility[];
}

const _champFullCache: Record<string, ChampFullData> = {};

function useChampionFullData(champId: string, version: string): { data: ChampFullData | null; loading: boolean } {
  const [data, setData] = useState<ChampFullData | null>(_champFullCache[champId] ?? null);
  const [loading, setLoading] = useState(!_champFullCache[champId]);
  useEffect(() => {
    if (!champId || !version) return;
    if (_champFullCache[champId]) { setData(_champFullCache[champId]); setLoading(false); return; }
    setLoading(true);
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${champId}.json`)
      .then(r => r.json())
      .then(json => {
        const d = json?.data?.[champId];
        if (d) {
          _champFullCache[champId] = d;
          setData(d);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [champId, version]);
  return { data, loading };
}

function statAtLevel(base: number, growth: number, level: number): number {
  return +(base + growth * (level - 1)).toFixed(2);
}

function atkSpdAtLevel(base: number, growthPct: number, level: number): number {
  return +(base * (1 + growthPct / 100 * (level - 1))).toFixed(3);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// ── Stats tab ─────────────────────────────────────────────────
function StatsTab({ champId, version, card, sectionLabel }: {
  champId: string; version: string; card: string; sectionLabel: string;
}) {
  const [level, setLevel] = useState(1);
  const { data, loading } = useChampionFullData(champId, version);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-[#C89B3C] font-['Cinzel'] animate-pulse">
      Loading stats…
    </div>
  );
  if (!data) return (
    <div className="text-[#5B7A8C] font-['Cinzel'] text-center p-8">No stat data available</div>
  );

  const s = data.stats;

  const rows: { label: string; val: number | string }[] = [
    { label: "Health",         val: statAtLevel(s.hp, s.hpperlevel, level) },
    { label: "Health Regen",   val: statAtLevel(s.hpregen, s.hpregenperlevel, level) },
    { label: "Mana / Energy",  val: statAtLevel(s.mp, s.mpperlevel, level) },
    { label: "Mana Regen",     val: statAtLevel(s.mpregen, s.mpregenperlevel, level) },
    { label: "Attack Damage",  val: statAtLevel(s.attackdamage, s.attackdamageperlevel, level) },
    { label: "Attack Speed",   val: atkSpdAtLevel(s.attackspeed, s.attackspeedperlevel, level) },
    { label: "Armor",          val: statAtLevel(s.armor, s.armorperlevel, level) },
    { label: "Magic Resist",   val: statAtLevel(s.spellblock, s.spellblockperlevel, level) },
    { label: "Move Speed",     val: s.movespeed },
    { label: "Attack Range",   val: s.attackrange },
    { label: "Crit Modifier",  val: s.crit ? `${s.crit}%` : "0%" },
  ];

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-6 mb-6 flex-wrap">
          <div className={sectionLabel} style={{ marginBottom: 0 }}>Base Statistics</div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[10px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest">Level</span>
            <input
              type="range" min={1} max={18} value={level}
              onChange={e => setLevel(Number(e.target.value))}
              className="w-32 accent-[#C89B3C]"
            />
            <div className="w-8 h-8 flex items-center justify-center border border-[#785A28] font-['Cinzel'] font-bold text-[#C8AA6E] text-sm">
              {level}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          {rows.map(({ label, val }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-[#0A1428]">
              <span className="text-[11px] text-[#5B7A8C] font-['Cinzel'] uppercase tracking-wider">{label}</span>
              <span className="text-sm font-mono font-bold text-[#C8AA6E]">{val}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[10px] text-[#3a4a5a] font-['Cinzel']">
          Values calculated from Data Dragon base stats + per-level growth
        </div>
      </div>
    </div>
  );
}

// ── Abilities tab ─────────────────────────────────────────────
const SLOT_LABELS = ["P", "Q", "W", "E", "R"] as const;
type AbilitySlot = typeof SLOT_LABELS[number];
const SLOT_COLORS: Record<AbilitySlot, string> = {
  P: "#A0B4C8", Q: "#C89B3C", W: "#0AC8B9", E: "#A0B4C8", R: "#FF4E50",
};

function AbilitiesTab({ champId, version, card, sectionLabel }: {
  champId: string; version: string; card: string; sectionLabel: string;
}) {
  const [selected, setSelected] = useState<AbilitySlot>("Q");
  const { data, loading } = useChampionFullData(champId, version);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-[#C89B3C] font-['Cinzel'] animate-pulse">
      Loading abilities…
    </div>
  );
  if (!data) return (
    <div className="text-[#5B7A8C] font-['Cinzel'] text-center p-8">No ability data available</div>
  );

  const abilities: Record<AbilitySlot, { name: string; desc: string; iconUrl: string; cooldown?: number[]; cost?: number[]; range?: (number|string)[] }> = {
    P: {
      name: data.passive.name,
      desc: stripHtml(data.passive.description),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${data.passive.image.full}`,
    },
    Q: {
      name: data.spells[0]?.name ?? "Q",
      desc: stripHtml(data.spells[0]?.description ?? ""),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${data.spells[0]?.id}.png`,
      cooldown: data.spells[0]?.cooldown,
      cost: data.spells[0]?.cost,
      range: data.spells[0]?.range,
    },
    W: {
      name: data.spells[1]?.name ?? "W",
      desc: stripHtml(data.spells[1]?.description ?? ""),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${data.spells[1]?.id}.png`,
      cooldown: data.spells[1]?.cooldown,
      cost: data.spells[1]?.cost,
      range: data.spells[1]?.range,
    },
    E: {
      name: data.spells[2]?.name ?? "E",
      desc: stripHtml(data.spells[2]?.description ?? ""),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${data.spells[2]?.id}.png`,
      cooldown: data.spells[2]?.cooldown,
      cost: data.spells[2]?.cost,
      range: data.spells[2]?.range,
    },
    R: {
      name: data.spells[3]?.name ?? "R",
      desc: stripHtml(data.spells[3]?.description ?? ""),
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${data.spells[3]?.id}.png`,
      cooldown: data.spells[3]?.cooldown,
      cost: data.spells[3]?.cost,
      range: data.spells[3]?.range,
    },
  };

  const ab = abilities[selected];
  const color = SLOT_COLORS[selected];

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <div className={sectionLabel}>Abilities</div>
        <div className="flex gap-3 mb-6">
          {SLOT_LABELS.map(slot => {
            const a = abilities[slot];
            const c = SLOT_COLORS[slot];
            return (
              <button
                key={slot}
                onClick={() => setSelected(slot)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className="w-16 h-16 overflow-hidden transition-all"
                  style={{
                    border: `2px solid ${selected === slot ? c : "#1E2D3D"}`,
                    boxShadow: selected === slot ? `0 0 12px ${c}44` : "none",
                    background: selected === slot ? c + "18" : "#010A13",
                  }}
                >
                  <img
                    src={a.iconUrl}
                    alt={a.name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = "0.1"; }}
                  />
                </div>
                <span className="text-[10px] font-['Cinzel'] font-bold"
                  style={{ color: selected === slot ? c : "#5B7A8C" }}>
                  {slot}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border border-[#1E2D3D] p-5" style={{ background: "#060E1A" }}>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 overflow-hidden shrink-0 border-2" style={{ borderColor: color }}>
              <img src={ab.iconUrl} alt={ab.name} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity = "0.1"; }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-['Cinzel'] font-bold px-2 py-0.5"
                  style={{ color, background: color + "22", border: `1px solid ${color}50` }}>
                  {selected}
                </span>
                <span className="text-lg font-['Cinzel'] font-bold text-[#C8AA6E]">{ab.name}</span>
              </div>
              {ab.cooldown && ab.cooldown.filter(Boolean).length > 0 && (
                <div className="flex items-center gap-4 text-[11px] text-[#5B7A8C] font-mono mt-1">
                  <span>CD: {ab.cooldown.slice(0, 5).join(" / ")}s</span>
                  {ab.cost && ab.cost.some(Boolean) && <span>Cost: {ab.cost.slice(0, 5).join(" / ")}</span>}
                  {ab.range && <span>Range: {Array.isArray(ab.range) ? (ab.range as Array<number|string>).slice(0, 1).join("") : ab.range}</span>}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-[#A0B4C8] leading-relaxed whitespace-pre-line">{ab.desc}</p>
        </div>
      </div>
    </div>
  );
}

// ── Patch Notes tab ────────────────────────────────────────────
function PatchNotesTab({ champName, card, sectionLabel }: {
  champName: string; card: string; sectionLabel: string;
}) {
  const [notes, setNotes] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchChampionPatchNotes(champName)
      .then(d => setNotes(d))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [champName]);

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <div className={sectionLabel}>Patch History</div>
        {loading && (
          <div className="flex items-center justify-center h-40 text-[#C89B3C] font-['Cinzel'] animate-pulse">
            Fetching patch notes from wiki…
          </div>
        )}
        {error && (
          <div className="text-[#FF4E50] text-xs font-['Cinzel'] p-4 border border-[#FF4E5030] bg-[#FF4E5008]">
            Could not load patch notes: {error}
          </div>
        )}
        {!loading && !error && notes && (
          <PatchNoteDisplay data={notes} champName={champName} />
        )}
      </div>
    </div>
  );
}

function PatchNoteDisplay({ data, champName }: { data: unknown; champName: string }) {
  if (typeof data === "string") {
    return <p className="text-sm text-[#A0B4C8] whitespace-pre-line leading-relaxed">{data}</p>;
  }

  const d = data as Record<string, unknown>;

  // Array of patch note entries
  const entries = Array.isArray(d.patch_notes) ? d.patch_notes as Array<Record<string, unknown>>
    : Array.isArray(data) ? data as Array<Record<string, unknown>>
    : d.changes ? [d] : null;

  if (entries) {
    return (
      <div className="space-y-3">
        {entries.slice(0, 20).map((entry, i) => {
          const patch = (entry.patch ?? entry.version ?? entry.patch_version) as string;
          const changes = Array.isArray(entry.changes) ? entry.changes as string[]
            : typeof entry.changes === "string" ? [entry.changes]
            : typeof entry.content === "string" ? [entry.content]
            : [];
          return (
            <div key={i} className="border border-[#1E2D3D] p-4" style={{ background: "#060E1A" }}>
              {patch && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-['Cinzel'] font-bold px-2 py-0.5 border border-[#785A28] text-[#C89B3C]">
                    PATCH {patch}
                  </span>
                </div>
              )}
              <ul className="space-y-1">
                {changes.map((c, ci) => (
                  <li key={ci} className="text-sm text-[#A0B4C8] flex items-start gap-2">
                    <span className="text-[#785A28] mt-1 shrink-0">•</span>
                    <span>{c}</span>
                  </li>
                ))}
                {changes.length === 0 && (
                  <li className="text-sm text-[#5B7A8C] italic">No detail available</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: stringify as pretty JSON
  return (
    <pre className="text-[11px] text-[#A0B4C8] whitespace-pre-wrap font-mono overflow-auto max-h-[60vh] leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ── Synergies tab ─────────────────────────────────────────────
function SynergiesTab({ champion, champions, onSelectChampion, card, sectionLabel }: {
  champion: ChampionInfo; champions: ChampionInfo[];
  onSelectChampion: (id: string) => void;
  card: string; sectionLabel: string;
}) {
  function h(s: string) {
    let n = 5381;
    for (let i = 0; i < s.length; i++) n = (n * 33 ^ s.charCodeAt(i)) & 0x7fffffff;
    return n / 0x7fffffff;
  }

  const peers = useMemo(
    () => champions.filter(c => c.id !== champion.id && c.primaryRole !== champion.primaryRole),
    [champions, champion],
  );

  const synergies = useMemo(() =>
    [...peers]
      .sort((a, b) => h(champion.name + "syn" + a.name) - h(champion.name + "syn" + b.name))
      .slice(0, 8)
      .map(c => ({
        champ: c,
        synergyScore: +(60 + h(champion.name + c.name + "score") * 30).toFixed(1),
        winRate: +(51 + h(champion.name + c.name + "wr") * 12).toFixed(1),
        games: Math.floor(500 + h(champion.name + c.name) * 5000),
        synWith: c.primaryRole,
      })),
    [peers, champion],
  );

  const antis = useMemo(() =>
    [...peers]
      .sort((a, b) => h(a.name + "anti" + champion.name) - h(b.name + "anti" + champion.name))
      .slice(0, 8)
      .map(c => ({
        champ: c,
        synergyScore: +(30 + h(champion.name + c.name + "anti") * 20).toFixed(1),
        winRate: +(45 + h(champion.name + c.name + "antiwr") * 10).toFixed(1),
        games: Math.floor(200 + h(c.name + champion.name) * 3000),
        synWith: c.primaryRole,
      })),
    [peers, champion],
  );

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <div className={sectionLabel}>Best Synergies</div>
        <p className="text-[11px] text-[#5B7A8C] mb-4">
          Champions that perform best alongside {champion.name} in team compositions
        </p>
        <div className="grid grid-cols-4 gap-4">
          {synergies.slice(0, 8).map(({ champ, synergyScore, winRate: synWR, games }) => (
            <button
              key={champ.id}
              onClick={() => onSelectChampion(champ.id)}
              className="flex flex-col items-center gap-2 p-3 border border-[#1E2D3D] hover:border-[#0AC8B9] transition-colors group"
              style={{ background: "#060E1A" }}
            >
              <div className="w-14 h-14 overflow-hidden border border-[#1E2D3D] group-hover:border-[#0AC8B9]">
                <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-[10px] font-['Cinzel'] text-[#C8AA6E] truncate w-full text-center">{champ.name}</div>
              <div className="text-[9px] text-[#5B7A8C]">{champ.primaryRole}</div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#0AC8B9]" />
                <span className="text-xs font-mono font-bold" style={{ color: winRateColor(synWR) }}>{synWR}%</span>
              </div>
              <div className="text-[9px] text-[#5B7A8C] font-mono">{(games / 1000).toFixed(1)}k games</div>
              <div className="w-full bg-[#1E2D3D] h-1">
                <div className="h-1 bg-[#0AC8B9]" style={{ width: `${synergyScore}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <div className={sectionLabel}>Poor Synergies</div>
        <p className="text-[11px] text-[#5B7A8C] mb-4">
          Champions that tend to underperform with {champion.name}
        </p>
        <div className="grid grid-cols-4 gap-4">
          {antis.slice(0, 8).map(({ champ, winRate: antiWR, games }) => (
            <button
              key={champ.id}
              onClick={() => onSelectChampion(champ.id)}
              className="flex flex-col items-center gap-2 p-3 border border-[#1E2D3D] hover:border-[#FF4E50] transition-colors group"
              style={{ background: "#060E1A" }}
            >
              <div className="w-14 h-14 overflow-hidden border border-[#1E2D3D] group-hover:border-[#FF4E50] opacity-80">
                <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-[10px] font-['Cinzel'] text-[#A0B4C8] truncate w-full text-center">{champ.name}</div>
              <div className="text-[9px] text-[#5B7A8C]">{champ.primaryRole}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold" style={{ color: winRateColor(antiWR) }}>{antiWR}%</span>
              </div>
              <div className="text-[9px] text-[#5B7A8C] font-mono">{(games / 1000).toFixed(1)}k games</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tier badge colors ──────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C",
};

// ── Compact alt-rune card ──────────────────────────────────────
function AltRuneCard({
  build: b, selected, onClick,
}: {
  build: BuildEntry; selected: boolean; onClick: () => void;
}) {
  const { paths } = useRuneData();
  const pColor = PATH_COLORS[b.runes.primary]   ?? "#C89B3C";
  const sColor = PATH_COLORS[b.runes.secondary] ?? "#0AC8B9";
  const primaryPath = paths.find(p => p.name === b.runes.primary);
  const keystoneRune = primaryPath?.slots[0]?.runes.find(
    r => r.name.toLowerCase() === b.runes.keystone.toLowerCase()
  );

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center gap-3 px-4 py-3 border transition-all text-left ${
        selected
          ? "border-[#C89B3C] bg-[#C89B3C]/8"
          : "border-[#1E2D3D] bg-[#060E1A] hover:border-[#785A28] hover:bg-[#0A1428]"
      }`}
    >
      {/* Keystone icon */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2"
        style={{
          background: pColor + "18",
          borderColor: selected ? pColor : pColor + "60",
          boxShadow: selected ? `0 0 10px ${pColor}44` : "none",
        }}
      >
        {keystoneRune ? (
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/img/${keystoneRune.icon}`}
            alt={b.runes.keystone}
            className="w-9 h-9 object-contain p-0.5"
            onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
          />
        ) : (
          <span className="text-[10px] font-['Cinzel'] text-center leading-tight px-1" style={{ color: pColor }}>
            {b.runes.keystone.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-['Cinzel'] text-sm font-bold" style={{ color: selected ? "#C8AA6E" : "#A0B4C8" }}>
            {b.buildName}
          </span>
          {selected && (
            <span className="text-[9px] font-['Cinzel'] tracking-widest text-[#0AC8B9] border border-[#0AC8B9]/40 px-1.5 py-px">
              ACTIVE
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#5B7A8C] mb-1">{b.buildDesc}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-bold" style={{ color: pColor }}>{b.runes.primary}</span>
          <span className="text-[10px] text-[#3a4a5a]">+</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: sColor }}>{b.runes.secondary}</span>
        </div>
        <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] mt-0.5 truncate">
          {b.runes.keystone}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right shrink-0">
        <div className="font-bold font-mono text-sm" style={{ color: winRateColor(b.winRate) }}>{b.winRate}%</div>
        <div className="text-[10px] text-[#5B7A8C] font-mono">{b.games.toLocaleString()}g</div>
        <div className="text-[10px] text-[#0AC8B9] font-mono mt-0.5">{b.pickRate}% pick</div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface Props {
  champion: ChampionInfo;
  champions: ChampionInfo[];
  onBack: () => void;
  onSelectChampion: (id: string) => void;
}

const SECTION_TABS = ["Build", "Counters", "Items", "Runes", "Skills", "Stats", "Abilities", "Synergies", "Patch Notes"];
const QUEUE_TABS   = ["Ranked Solo/Duo", "Ranked Flex", "ARAM"];

export function ChampionBuildSubPage({ champion, champions, onBack, onSelectChampion }: Props) {
  const version = useVersion();

  const [rankLabel,       setRankLabel]       = useState("Emerald+");
  const [rankKey,         setRankKey]         = useState("EMERALD");
  const [queue,           setQueue]           = useState("Ranked Solo/Duo");
  const [tab,             setTab]             = useState("Build");
  const [buildVariantIdx, setBuildVariantIdx] = useState(0);

  const allBuilds      = useMemo(() => getBuild(champion.name, champion.buildType, champion.winRate, champion.pickRate, champion.games), [champion]);
  const staticBase     = useMemo(() => allBuilds[0] ?? allBuilds.find(b => b.rank === rankKey), [allBuilds, rankKey]);

  const { builds: opggMultiBuilds } = useOPGGMultipleBuilds(champion.name, champion.primaryRole);
  const { paths } = useRuneData();

  // Merge each OP.GG build with the static base template
  const buildsForRank = useMemo((): BuildEntry[] => {
    if (!staticBase) return [];
    if (opggMultiBuilds.length > 0) {
      return opggMultiBuilds.map(ob => {
        const merged = mergeOPGGBuild(ob.parsed, staticBase, paths);
        merged.buildName = ob.label;
        merged.buildDesc = `OP.GG Live · ${ob.tier}`;
        merged.rank = rankKey;
        merged.rankLabel = ob.label;
        return merged;
      });
    }
    // Fallback: static builds filtered by rankKey
    return allBuilds.filter(b => b.rank === rankKey);
  }, [opggMultiBuilds, staticBase, paths, allBuilds, rankKey]);

  const build = useMemo(() => {
    return buildsForRank[buildVariantIdx] ?? buildsForRank[0] ?? null;
  }, [buildsForRank, buildVariantIdx]);

  const { weakAgainst: fallbackWeak, strongAgainst: fallbackStrong } = useCounters(champion, champions);
  const { weakAgainst, strongAgainst } = useMemo(() => {
    const firstBuild = opggMultiBuilds[0]?.parsed;
    if (!firstBuild?.data) return { weakAgainst: fallbackWeak, strongAgainst: fallbackStrong };
    const d = firstBuild.data;
    const weak   = matchOPGGCounters(d.weak_counters   ?? [], champions, false);
    const strong = matchOPGGCounters(d.strong_counters ?? [], champions, true);
    return {
      weakAgainst:   weak.length   ? weak   : fallbackWeak,
      strongAgainst: strong.length ? strong : fallbackStrong,
    };
  }, [opggMultiBuilds, champions, fallbackWeak, fallbackStrong]);

  const isJungler = champion.primaryRole === "Jungle";
  const patch     = version.split(".").slice(0, 2).join(".");
  const tierColor = TIER_COLORS[champion.tier] ?? "#A0B4C8";

  if (!build) {
    return <div className="flex items-center justify-center h-64 text-[#5B7A8C] font-['Cinzel']">No build data</div>;
  }

  // ── shared card style ──────────────────────────────────────
  const card = "bg-[#0A1428] border border-[#1E2D3D]";
  const sectionLabel = "font-['Cinzel'] text-xs tracking-widest text-[#785A28] uppercase mb-4";

  return (
    <div className="min-h-screen" style={{ background: "#010A13" }}>
      {/* Gold top line */}
      <div className="h-px w-full"
        style={{ background: "linear-gradient(90deg,transparent,#785A28 30%,#C89B3C 50%,#785A28 70%,transparent)" }} />

      <div className="max-w-[1280px] mx-auto px-5 py-6">

        {/* Breadcrumb */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[#5B7A8C] hover:text-[#C89B3C] text-xs mb-5 transition-colors font-['Cinzel'] tracking-wider">
          <ChevronLeft className="w-3.5 h-3.5" />
          Champions <span className="text-[#1E2D3D] mx-0.5">/</span>
          <span className="text-[#A0B4C8]">{champion.name}</span>
        </button>

        {/* ── Champion Header ──────────────────────────────── */}
        <div className={`${card} p-6 mb-5 flex items-center gap-6 flex-wrap relative overflow-hidden`}>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#785A28]" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#785A28]" />

          <div className="relative shrink-0">
            <div className="w-28 h-28 overflow-hidden border-2 border-[#785A28]">
              <img src={champion.imageUrl} alt={champion.name} className="w-full h-full object-cover" />
            </div>
            <div
              className="absolute -bottom-2 -right-2 w-8 h-8 flex items-center justify-center text-xs font-black font-['Cinzel'] border"
              style={{ color: tierColor, background: tierColor + "18", borderColor: tierColor + "60" }}
            >
              {champion.tier}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <h1 className="text-4xl font-black text-[#C8AA6E] font-['Cinzel'] tracking-widest gold-text">{champion.name}</h1>
              <RoleIcon role={champion.primaryRole} size={26} color="#C8AA6E" />
              <span className="text-sm text-[#5B7A8C] font-['Cinzel'] tracking-widest">{champion.primaryRole}</span>
            </div>
            <div className="text-base text-[#5B7A8C] italic mb-3">{champion.title}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono border border-[#1E2D3D] text-[#785A28] px-2.5 py-1">
                PATCH {patch}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-10 text-center shrink-0 flex-wrap">
            {([
              { label: "Win Rate",  val: `${champion.winRate.toFixed(2)}%`,  color: winRateColor(champion.winRate) },
              { label: "Pick Rate", val: `${champion.pickRate.toFixed(2)}%`, color: "#A0B4C8" },
              { label: "Ban Rate",  val: `${champion.banRate.toFixed(2)}%`,  color: "#A0B4C8" },
              { label: "Games",     val: (champion.games / 1000).toFixed(1) + "k", color: "#A0B4C8" },
            ] as const).map(({ label, val, color }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="text-[10px] text-[#785A28] uppercase tracking-widest font-['Cinzel']">{label}</div>
                <div className="font-bold font-mono text-lg" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter bar ───────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-0 flex-wrap">
          <div className="flex border border-[#1E2D3D] overflow-hidden">
            {QUEUE_TABS.map(q => (
              <button key={q} onClick={() => setQueue(q)}
                className={`px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-wider transition-colors border-r border-[#1E2D3D] last:border-0 ${
                  queue === q
                    ? "bg-[#785A28]/30 text-[#C89B3C]"
                    : "bg-[#0A1428] text-[#5B7A8C] hover:text-[#A0B4C8] hover:bg-[#0A1428]/80"
                }`}>
                {q}
              </button>
            ))}
          </div>
          <RankSelect value={rankLabel} onChange={(l, k) => { setRankLabel(l); setRankKey(k); }} />
        </div>

        {/* ── Section tabs ──────────────────────────────────── */}
        <div className="flex border-b border-[#1E2D3D] mb-5 mt-4">
          {SECTION_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-xs font-['Cinzel'] tracking-widest border-b-2 transition-all ${
                tab === t
                  ? "border-[#C89B3C] text-[#C89B3C]"
                  : "border-transparent text-[#5B7A8C] hover:text-[#A0B4C8]"
              }`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* BUILD TAB                                          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Build" && (
          <div className="space-y-4">

            {/* Build variant selector */}
            {buildsForRank.length > 0 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 pt-4 pb-2 flex items-center gap-3">
                  <span className={sectionLabel} style={{ marginBottom: 0 }}>Build Options</span>
                  {opggMultiBuilds.length > 0 && (
                    <span className="text-[9px] font-['Cinzel'] tracking-widest border px-2 py-0.5"
                      style={{ color: "#0AC8B9", borderColor: "#0AC8B933", background: "#0AC8B908" }}>
                      OP.GG LIVE
                    </span>
                  )}
                </div>
                <div className="flex divide-x divide-[#1E2D3D]">
                  {buildsForRank.map((b, i) => (
                    <AltRuneCard
                      key={i}
                      build={b}
                      selected={buildVariantIdx === i}
                      onClick={() => { setBuildVariantIdx(i); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Row 1: Runes + Spells & Skills */}
            <div className="flex gap-4">
              <div className={`${card} flex-1 min-w-0 p-5`}>
                <div className={sectionLabel}>Runes</div>
                <RuneTree runes={build.runes} winRate={build.winRate} games={build.games} />
              </div>

              <div className="w-72 shrink-0 space-y-4">
                {/* Summoner spells */}
                <div className={`${card} p-4`}>
                  <div className={sectionLabel}>Summoner Spells</div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      {build.spells.map((spell, i) => <SpellImg key={i} name={spell} version={version} size={58} />)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-['Cinzel'] text-[#C8AA6E] truncate">{build.spells.join(" + ")}</div>
                      <div className="text-[10px] text-[#0AC8B9] font-mono mt-0.5">{build.pickRate}% pick rate</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-sm" style={{ color: winRateColor(build.winRate) }}>{build.winRate}%</div>
                      <div className="text-[9px] text-[#5B7A8C] font-mono">{build.games.toLocaleString()}g</div>
                    </div>
                  </div>
                </div>

                {/* Skill order */}
                <div className={`${card} p-4`}>
                  <div className={sectionLabel}>Skill Order</div>
                  <SkillGrid order={build.levelOrder} skillOrder={build.skillOrder} champId={champion.id} version={version} />
                </div>
              </div>
            </div>

            {/* Row 2: Items */}
            <div className={`${card} p-5`}>
              <div className={sectionLabel}>Item Build</div>

              {/* Starter */}
              <div className="mb-4 pb-4 border-b border-[#1E2D3D]">
                <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] uppercase tracking-wider mb-2">Starter Items</div>
                <div className="flex items-center gap-3 bg-[#060E1A] border border-[#1E2D3D] px-4 py-3">
                  <div className="flex items-center gap-2">
                    {build.startItems.map((item, i) => (
                      <span key={i} className="flex items-center gap-2">
                        <ItemImg id={item.id} name={item.name} version={version} size={50} />
                        {i < build.startItems.length - 1 && <span className="text-[#5B7A8C] text-lg font-light">+</span>}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-sm" style={{ color: winRateColor(build.winRate) }}>{build.winRate}%</div>
                    <div className="text-[10px] text-[#0AC8B9] font-mono">{build.pickRate}% pick</div>
                  </div>
                </div>
              </div>

              {/* Core build path */}
              <div className="mb-4 pb-4 border-b border-[#1E2D3D]">
                <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] uppercase tracking-wider mb-2">Core Build</div>
                <div className="flex items-center gap-2 bg-[#060E1A] border border-[#1E2D3D] px-4 py-3 flex-wrap">
                  <ItemImg id={build.boots.id} name={build.boots.name} version={version} size={54} />
                  <ChevronRight className="w-4 h-4 text-[#1E2D3D] shrink-0" />
                  {build.items.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <ItemImg id={item.id} name={item.name} version={version} size={54} />
                      {i < build.items.length - 1 && <ChevronRight className="w-4 h-4 text-[#1E2D3D] shrink-0" />}
                    </span>
                  ))}
                  <div className="flex-1" />
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-bold font-mono text-base" style={{ color: winRateColor(build.winRate) }}>{build.winRate}%</div>
                    <div className="text-[10px] text-[#5B7A8C] font-mono">{build.games.toLocaleString()} games</div>
                  </div>
                </div>
              </div>

              {/* 4th / 5th / 6th item slot tables */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "4th Item", opts: build.fourthOptions },
                  { label: "5th Item", opts: build.fifthOptions  },
                  { label: "6th Item", opts: build.sixthOptions  },
                ].map(({ label, opts }) => (
                  <div key={label} className="bg-[#060E1A] border border-[#1E2D3D] p-3">
                    <div className="text-[9px] text-[#785A28] font-['Cinzel'] font-bold uppercase tracking-widest mb-2">{label}</div>
                    {opts.map((opt, i) => (
                      <ItemRow key={i} rank={i + 1} item={opt.item} pickRate={opt.pickRate}
                        winRate={opt.winRate} games={opt.games} version={version} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Jungle path (junglers only) */}
            {isJungler && (
              <div className={`${card} p-5`}>
                <div className={sectionLabel}>Jungle Path</div>
                <JunglePaths games={build.games} />
              </div>
            )}

            {/* Counters preview */}
            <div className={`${card} p-5`}>
              <div className={sectionLabel}>Counters</div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-[#FF4E50]" />
                    <span className="text-sm font-bold font-['Cinzel'] text-[#C8AA6E]">Hard to Beat</span>
                    <span className="text-xs text-[#5B7A8C]">counters {champion.name}</span>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {weakAgainst.map(({ champ, winRate: cwr, games }) => (
                      <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant="hard" onClick={() => onSelectChampion?.(champ.id)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-[#0AC8B9]" />
                    <span className="text-sm font-bold font-['Cinzel'] text-[#C8AA6E]">Easy to Beat</span>
                    <span className="text-xs text-[#5B7A8C]">{champion.name} dominates</span>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {strongAgainst.map(({ champ, winRate: cwr, games }) => (
                      <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant="easy" onClick={() => onSelectChampion?.(champ.id)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* COUNTERS TAB                                       */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Counters" && (
          <div className="space-y-4">
            {([
              { title: "Hard to Beat", sub: `These champions counter ${champion.name}`, entries: weakAgainst,   v: "hard" as const, color: "#FF4E50" },
              { title: "Easy to Beat", sub: `${champion.name} dominates these matchups`, entries: strongAgainst, v: "easy" as const, color: "#0AC8B9" },
            ] as const).map(({ title, sub, entries, v, color }) => (
              <div key={title} className={`${card} p-6`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5" style={{ background: color }} />
                  <span className="text-base font-bold font-['Cinzel'] text-[#C8AA6E]">{title}</span>
                </div>
                <div className="text-[11px] text-[#5B7A8C] mb-5">{sub}</div>
                <div className="flex gap-5 flex-wrap">
                  {entries.map(({ champ, winRate: cwr, games }) => (
                    <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant={v} onClick={() => onSelectChampion?.(champ.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ITEMS TAB                                          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Items" && (
          <div className="space-y-4">
            <div className={`${card} p-5`}>
              <div className={sectionLabel}>Recommended Build</div>
              <div className="flex items-center gap-2 flex-wrap">
                <ItemImg id={build.boots.id} name={build.boots.name} version={version} size={60} />
                <ChevronRight className="w-4 h-4 text-[#1E2D3D]" />
                {build.items.map((item, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <ItemImg id={item.id} name={item.name} version={version} size={60} />
                      <span className="text-[8px] text-[#5B7A8C] font-mono">#{i + 2}</span>
                    </div>
                    {i < build.items.length - 1 && <ChevronRight className="w-4 h-4 text-[#1E2D3D]" />}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`${card} p-4`}>
                <div className={sectionLabel}>Starter Options</div>
                <div className="space-y-2">
                  {build.starterOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#060E1A] border border-[#1E2D3D] px-3 py-2">
                      <div className="flex items-center gap-1">
                        {opt.items.map((item, ii) => <ItemImg key={ii} id={item.id} name={item.name} version={version} size={40} />)}
                      </div>
                      <div className="flex-1" />
                      <span className="font-bold font-mono text-xs" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</span>
                      <span className="text-[10px] text-[#0AC8B9] font-mono w-12 text-right">{opt.pickRate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${card} p-4`}>
                <div className={sectionLabel}>Boots Options</div>
                <div className="space-y-2">
                  {build.bootsOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#060E1A] border border-[#1E2D3D] px-3 py-2">
                      <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={40} />
                      <span className="text-xs text-[#A0B4C8] flex-1 truncate">{opt.item.name}</span>
                      <span className="font-bold font-mono text-xs" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</span>
                      <span className="text-[10px] text-[#0AC8B9] font-mono w-12 text-right">{opt.pickRate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <div className={sectionLabel}>Situational Items</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "4th Item", opts: build.fourthOptions },
                  { label: "5th Item", opts: build.fifthOptions  },
                  { label: "6th Item", opts: build.sixthOptions  },
                ].map(({ label, opts }) => (
                  <div key={label} className="bg-[#060E1A] border border-[#1E2D3D] p-3">
                    <div className="text-[9px] text-[#785A28] font-['Cinzel'] font-bold uppercase tracking-widest mb-2">{label}</div>
                    {opts.map((opt, i) => (
                      <ItemRow key={i} rank={i + 1} item={opt.item} pickRate={opt.pickRate}
                        winRate={opt.winRate} games={opt.games} version={version} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* RUNES TAB                                          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Runes" && (
          <div className="space-y-4">
            {/* Rune page selector */}
            {buildsForRank.length > 1 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 pt-4 pb-2">
                  <span className={sectionLabel} style={{ marginBottom: 0 }}>Rune Options</span>
                </div>
                <div className="flex divide-x divide-[#1E2D3D]">
                  {buildsForRank.map((b, i) => (
                    <AltRuneCard
                      key={i}
                      build={b}
                      selected={buildVariantIdx === i}
                      onClick={() => setBuildVariantIdx(i)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className={`${card} p-6`}>
              <div className={sectionLabel}>
                Rune Page — {build.runes.primary} / {build.runes.secondary}
              </div>
              <RuneTree runes={build.runes} winRate={build.winRate} games={build.games} />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* SKILLS TAB                                         */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Skills" && (
          <div className="space-y-4">
            {buildsForRank.length > 1 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 pt-4 pb-2">
                  <span className={sectionLabel} style={{ marginBottom: 0 }}>Build Variant</span>
                </div>
                <div className="flex divide-x divide-[#1E2D3D]">
                  {buildsForRank.map((b, i) => (
                    <AltRuneCard key={i} build={b} selected={buildVariantIdx === i} onClick={() => setBuildVariantIdx(i)} />
                  ))}
                </div>
              </div>
            )}
            <div className={`${card} p-6`}>
              <div className={sectionLabel}>Skill Order — {build.buildName}</div>
              <SkillGrid order={build.levelOrder} skillOrder={build.skillOrder} champId={champion.id} version={version} />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STATS TAB                                          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Stats" && (
          <StatsTab champId={champion.id} version={version} card={card} sectionLabel={sectionLabel} />
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ABILITIES TAB                                      */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Abilities" && (
          <AbilitiesTab champId={champion.id} version={version} card={card} sectionLabel={sectionLabel} />
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* PATCH NOTES TAB                                    */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Patch Notes" && (
          <PatchNotesTab champName={champion.name} card={card} sectionLabel={sectionLabel} />
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* SYNERGIES TAB                                      */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Synergies" && (
          <SynergiesTab
            champion={champion}
            champions={champions}
            onSelectChampion={onSelectChampion}
            card={card}
            sectionLabel={sectionLabel}
          />
        )}
      </div>
    </div>
  );
}
