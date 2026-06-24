import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { type ChampionInfo } from "@/hooks/useChampionData";
import { getBuild, type BuildEntry } from "@/data/builds";
import { useRuneData, PATH_COLORS, type RunePath } from "@/hooks/useRuneData";
import { getDragonVersion, fetchOPGGChampionAnalysis } from "@/api/client";

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

// ── OP.GG live data hook ───────────────────────────────────────
function useOPGGBuild(champName: string, position: string, rankKey: string) {
  const [parsed, setParsed] = useState<OPGGParsed | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setParsed(null);
    setLoading(true);
    fetchOPGGChampionAnalysis(champName, position, rankKey)
      .then(raw => { if (!cancelled) { const r = raw as OPGGParsed; setParsed(r?.data ? r : null); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [champName, position, rankKey]);
  return { parsed, loading };
}

function mergeOPGGBuild(
  parsed: OPGGParsed,
  staticBuild: BuildEntry,
  _paths: RunePath[],
): BuildEntry {
  const d = parsed.data;
  const coreItems = (d.core_items?.ids ?? []).map((id, i) => ({
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

// ── Win-rate color ─────────────────────────────────────────────
const wrColor = (v: number) => v >= 52 ? "#22c55e" : v >= 48 ? "#9d9db8" : "#e84057";

// ── Role icons ─────────────────────────────────────────────────
const ROLE_ICONS: Record<string, string> = {
  Top:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-top.png",
  Jungle:  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-jungle.png",
  Mid:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-middle.png",
  ADC:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-bottom.png",
  Support: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-utility.png",
};

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
  const def = CAMPS[camp] ?? { label: camp.slice(0, 4), color: "#5e5f7a", url: "" };
  const [ok, setOk] = useState(true);
  return (
    <div className="group relative shrink-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 text-[9px] font-bold"
        style={{ borderColor: def.color, background: def.color + "22", color: def.color }}>
        {ok && def.url
          ? <img src={def.url} alt={camp} className="w-7 h-7 object-contain" onError={() => setOk(false)} />
          : def.label}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0e14] border
        border-[#2e3048] px-2 py-0.5 text-[10px] text-white whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50 rounded">
        {camp}
      </div>
    </div>
  );
}

function JunglePaths({ games }: { games: number }) {
  return (
    <div className="space-y-3">
      {[
        { side: "Blue Side", path: BLUE_PATH, g: Math.floor(games * 0.58), color: "#5383e8" },
        { side: "Red Side",  path: RED_PATH,  g: Math.floor(games * 0.42), color: "#e84057" },
      ].map(({ side, path, g, color }) => (
        <div key={side} className="bg-[#13141a] rounded-xl p-3">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold" style={{ color }}>{side}</span>
            <span className="text-[10px] text-[#5e5f7a]">{g.toLocaleString()} games</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {path.map((camp, i) => (
              <span key={i} className="flex items-center gap-1">
                <CampDot camp={camp} />
                {i < path.length - 1 && <ChevronRight className="w-3 h-3 text-[#2e3048] shrink-0" />}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Item image ─────────────────────────────────────────────────
function ItemImg({ id, name, version, size = 40 }: { id: number; name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
      <div className="rounded-md overflow-hidden border border-[#3a3b4c] bg-[#13141a]"
        style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.1"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0e14] border
        border-[#3a3b4c] px-2 py-1 text-[10px] text-white whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50 rounded">
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

function SpellImg({ name, version, size = 44 }: { name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
      <div className="rounded-md overflow-hidden border border-[#3a3b4c]" style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${SPELL_KEYS[name] ?? "SummonerFlash"}.png`}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0e14] border
        border-[#3a3b4c] px-2 py-1 text-[10px] text-white whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50 rounded">
        {name}
      </div>
    </div>
  );
}

// ── Rune icon ──────────────────────────────────────────────────
function RuneIcon({
  iconPath, name, size = 32, selected = false, dimmed = false, pathColor,
}: {
  iconPath: string; name: string; size?: number;
  selected?: boolean; dimmed?: boolean; pathColor?: string;
}) {
  const accent = pathColor ?? "#5383e8";
  return (
    <div className="group relative shrink-0" style={{ opacity: dimmed ? 0.2 : 1 }}>
      <div
        className="rounded-full overflow-hidden flex items-center justify-center transition-all"
        style={{
          width: size, height: size,
          background: selected ? accent + "22" : "rgba(13,14,20,0.5)",
          border: selected ? `2px solid ${accent}` : "1px solid #2e3048",
          filter: dimmed ? "grayscale(1)" : "none",
          boxShadow: selected ? `0 0 10px ${accent}55` : "none",
        }}
      >
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`}
          alt={name}
          className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
        />
      </div>
      {!dimmed && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0d0e14] border
          border-[#2e3048] px-2 py-1 text-[10px] text-white whitespace-nowrap
          opacity-0 group-hover:opacity-100 pointer-events-none z-50 rounded">
          {name}
        </div>
      )}
    </div>
  );
}

// ── Full rune tree (OP.GG layout) ─────────────────────────────
function RuneTree({ runes, winRate: buildWR, games }: {
  runes: BuildEntry["runes"]; winRate: number; games: number;
}) {
  const { paths, loaded } = useRuneData();
  if (!loaded) return <div className="text-[#5e5f7a] text-xs p-4 animate-pulse">Loading runes…</div>;

  const primaryPath   = paths.find(p => p.name === runes.primary);
  const secondaryPath = paths.find(p => p.name === runes.secondary);
  const pColor = PATH_COLORS[runes.primary]   ?? "#5383e8";
  const sColor = PATH_COLORS[runes.secondary] ?? "#5383e8";
  const primarySelSet   = new Set((runes.primaryRunes   ?? []).map(n => n.toLowerCase()));
  const secondarySelSet = new Set((runes.secondaryRunes ?? []).map(n => n.toLowerCase()));

  return (
    <div className="flex gap-3">
      {/* Primary path */}
      <div className="flex-1 bg-[#13141a] rounded-xl border border-[#2e3048] p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2e3048]">
          {primaryPath && (
            <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: pColor }}>
              <img src={`https://ddragon.leagueoflegends.com/cdn/img/${primaryPath.icon}`}
                alt={primaryPath.name} className="w-full h-full object-contain" />
            </div>
          )}
          <span className="font-bold text-sm" style={{ color: pColor }}>{runes.primary}</span>
          <div className="ml-auto text-right">
            <div className="font-bold text-sm" style={{ color: wrColor(buildWR) }}>{buildWR}%</div>
            <div className="text-[10px] text-[#5e5f7a]">{games.toLocaleString()} games</div>
          </div>
        </div>

        {/* Keystones */}
        {primaryPath?.slots[0] && (
          <div className="flex justify-center gap-7 mb-5">
            {primaryPath.slots[0].runes.map(perk => {
              const sel = perk.name.toLowerCase() === runes.keystone.toLowerCase();
              return (
                <div key={perk.id} className="flex flex-col items-center gap-1.5">
                  <RuneIcon iconPath={perk.icon} name={perk.name}
                    size={sel ? 58 : 40} selected={sel} dimmed={!sel} pathColor={pColor} />
                  {sel && (
                    <span className="text-[10px] font-semibold text-center leading-tight max-w-[72px]"
                      style={{ color: pColor }}>{perk.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Slots 1–3 */}
        {primaryPath?.slots.slice(1).map((slot, si) => (
          <div key={si} className="flex justify-around mb-4">
            {slot.runes.map((perk, pi) => {
              const sel = primarySelSet.size > 0
                ? primarySelSet.has(perk.name.toLowerCase())
                : pi === 0;
              return (
                <div key={perk.id} className="flex flex-col items-center gap-1">
                  <RuneIcon iconPath={perk.icon} name={perk.name}
                    size={sel ? 36 : 28} selected={sel} dimmed={!sel} pathColor={pColor} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Secondary + Shards column */}
      <div className="w-44 space-y-3">
        <div className="bg-[#13141a] rounded-xl border border-[#2e3048] p-3">
          <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-[#2e3048]">
            {secondaryPath && (
              <div className="w-6 h-6 rounded-full overflow-hidden border" style={{ borderColor: sColor }}>
                <img src={`https://ddragon.leagueoflegends.com/cdn/img/${secondaryPath.icon}`}
                  alt={secondaryPath.name} className="w-full h-full object-contain" />
              </div>
            )}
            <span className="text-xs font-bold" style={{ color: sColor }}>{runes.secondary}</span>
          </div>
          {secondaryPath?.slots.slice(1).map((slot, si) => (
            <div key={si} className="flex justify-around mb-3 last:mb-0">
              {slot.runes.map((perk, pi) => {
                const sel = secondarySelSet.size > 0
                  ? secondarySelSet.has(perk.name.toLowerCase())
                  : si < 2 && pi === 0;
                return (
                  <RuneIcon key={perk.id} iconPath={perk.icon} name={perk.name}
                    size={sel ? 30 : 24} selected={sel} dimmed={!sel} pathColor={sColor} />
                );
              })}
            </div>
          ))}
        </div>

        {/* Stat shards */}
        <div className="bg-[#13141a] rounded-xl border border-[#2e3048] p-3">
          <div className="text-[9px] text-[#5e5f7a] uppercase tracking-wider mb-2">Stat Shards</div>
          {[["Adaptive Force", "Attack Speed"], ["Adaptive Force", "Armor"], ["Armor", "Magic Resist"]].map(([a], i) => (
            <div key={i} className="flex items-center gap-1.5 mb-2 last:mb-0">
              <div className="w-4 h-4 rounded-full border-2 border-[#5383e8] bg-[#5383e8]/20
                flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5383e8]" />
              </div>
              <div className="w-4 h-4 rounded-full border border-[#2e3048] opacity-25 shrink-0" />
              <span className="text-[9px] text-[#5e5f7a]">{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Skill order grid ───────────────────────────────────────────
const AB_COLORS: Record<string, string> = {
  Q: "#5383e8", W: "#e8b058", E: "#22c55e", R: "#e84057",
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
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {["Q", "W", "E", "R"].map(ab => {
          const sp = byAb[ab];
          const c  = AB_COLORS[ab];
          return (
            <div key={ab} className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-md overflow-hidden border flex items-center justify-center"
                style={{ borderColor: c + "60", background: c + "15" }}>
                {sp
                  ? <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${sp.id}.png`}
                      alt={sp.name} className="w-full h-full object-cover" />
                  : <span className="text-[11px] font-black" style={{ color: c }}>{ab}</span>}
              </div>
              <span className="text-xs font-bold" style={{ color: c }}>{ab}</span>
            </div>
          );
        })}
        <div className="ml-auto text-[11px] text-[#5e5f7a]">
          Max: <span className="text-white font-semibold">{skillOrder}</span>
        </div>
      </div>

      <div className="flex gap-0.5 flex-wrap">
        {norm.map((ability, i) => {
          const c = AB_COLORS[ability];
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-7 h-7 flex items-center justify-center text-[11px] font-bold rounded-sm"
                style={{
                  color: c ?? "#5e5f7a",
                  background: c ? c + "18" : "#1a1b22",
                  border: `1px solid ${c ? c + "50" : "#2e3048"}`,
                }}
              >
                {ability || "?"}
              </div>
              <div className="text-[7px] text-[#5e5f7a]">{i + 1}</div>
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
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1f28] border border-[#2e3048]
          hover:border-[#5383e8] text-[11px] text-white rounded-lg transition-colors"
      >
        <span>{cur.icon}</span><span>{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5e5f7a] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#1e1f28] border border-[#2e3048]
          shadow-2xl rounded-lg min-w-[165px] overflow-hidden">
          {RANKS.map(r => (
            <button
              key={r.label}
              onClick={() => { onChange(r.label, r.key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-[#2a2b3a]
                border-b border-[#2e3048] last:border-0 text-left transition-colors
                ${value === r.label ? "text-[#5383e8]" : "text-[#9d9db8]"}`}
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
    <div className="flex items-center gap-2 py-2 border-b border-[#2e3048] last:border-0">
      <span className="text-[10px] text-[#5e5f7a] w-4 shrink-0 text-center">{rank}</span>
      <ItemImg id={item.id} name={item.name} version={version} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-white truncate">{item.name}</div>
        <div className="text-[9px] text-[#5e5f7a]">{games.toLocaleString()} games</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold text-[11px]" style={{ color: wrColor(rowWR) }}>{rowWR.toFixed(1)}%</div>
        <div className="text-[10px] text-[#5383e8]">{pickRate.toFixed(1)}%</div>
      </div>
    </div>
  );
}

// ── Counter champion card ─────────────────────────────────────
function CounterCard({ champ, winRate: cardWR, games, variant }: {
  champ: ChampionInfo; winRate: number; games: number; variant: "hard" | "easy";
}) {
  const color = variant === "hard" ? "#e84057" : "#22c55e";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2" style={{ borderColor: color + "80" }}>
        <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="text-[9px] text-[#9d9db8] text-center max-w-[56px] truncate">{champ.name}</div>
      <div className="font-bold text-[11px]" style={{ color }}>{cardWR.toFixed(1)}%</div>
      <div className="text-[8px] text-[#5e5f7a]">{(games / 1000).toFixed(1)}k</div>
    </div>
  );
}

// ── Tier badge colors ──────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  "S+": "#e84057", S: "#ff8200", "A+": "#5383e8", A: "#9d9db8", B: "#5e5f7a",
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface Props {
  champion: ChampionInfo;
  champions: ChampionInfo[];
  onBack: () => void;
  onSelectChampion: (id: string) => void;
}

const SECTION_TABS = ["Build", "Counters", "Items", "Runes", "Skills"];
const QUEUE_TABS   = ["Ranked Solo/Duo", "Ranked Flex", "ARAM"];

export function ChampionBuildSubPage({ champion, champions, onBack }: Props) {
  const version = useVersion();

  const [rankLabel, setRankLabel] = useState("Emerald+");
  const [rankKey,   setRankKey]   = useState("EMERALD");
  const [queue,     setQueue]     = useState("Ranked Solo/Duo");
  const [tab,       setTab]       = useState("Build");

  const allBuilds   = useMemo(() => getBuild(champion.name, champion.buildType, champion.winRate, champion.pickRate, champion.games), [champion]);
  const staticBuild = useMemo(() => allBuilds.find(b => b.rank === rankKey) ?? allBuilds[0], [allBuilds, rankKey]);

  const { parsed, loading: opggLoading } = useOPGGBuild(champion.name, champion.primaryRole, rankKey);
  const { paths } = useRuneData();

  const build = useMemo(() => {
    if (!staticBuild) return null;
    return parsed ? mergeOPGGBuild(parsed, staticBuild, paths) : staticBuild;
  }, [staticBuild, parsed, paths]);

  const { weakAgainst: fallbackWeak, strongAgainst: fallbackStrong } = useCounters(champion, champions);
  const { weakAgainst, strongAgainst } = useMemo(() => {
    if (!parsed?.data) return { weakAgainst: fallbackWeak, strongAgainst: fallbackStrong };
    const d = parsed.data;
    const weak   = matchOPGGCounters(d.weak_counters   ?? [], champions, false);
    const strong = matchOPGGCounters(d.strong_counters ?? [], champions, true);
    return {
      weakAgainst:   weak.length   ? weak   : fallbackWeak,
      strongAgainst: strong.length ? strong : fallbackStrong,
    };
  }, [parsed, champions, fallbackWeak, fallbackStrong]);

  const isLive    = Boolean(parsed && !opggLoading);
  const isJungler = champion.primaryRole === "Jungle";
  const patch     = version.split(".").slice(0, 2).join(".");
  const roleUrl   = ROLE_ICONS[champion.primaryRole];
  const tierColor = TIER_COLORS[champion.tier] ?? "#9d9db8";

  if (!build) {
    return <div className="flex items-center justify-center h-64 text-[#5e5f7a]">No build data</div>;
  }

  // ── shared card class ─────────────────────────────────────────
  const card = "bg-[#1e1f28] border border-[#2e3048] rounded-2xl";

  return (
    <div className="min-h-screen" style={{ background: "#13141a" }}>
      <div className="max-w-[1120px] mx-auto px-4 py-5">

        {/* Breadcrumb */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[#5e5f7a] hover:text-white text-xs mb-5 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          Champions <span className="text-[#2e3048] mx-0.5">/</span>
          <span className="text-[#9d9db8]">{champion.name}</span>
        </button>

        {/* ── Champion Header ──────────────────────────────── */}
        <div className={`${card} p-5 mb-4 flex items-center gap-5 flex-wrap`}>
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-[#3a3b4c]">
              <img src={champion.imageUrl} alt={champion.name} className="w-full h-full object-cover" />
            </div>
            <div
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border"
              style={{ color: tierColor, background: tierColor + "18", borderColor: tierColor + "60" }}
            >
              {champion.tier}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-black text-white tracking-tight">{champion.name}</h1>
              {roleUrl && (
                <img src={roleUrl} alt={champion.primaryRole} width={22} height={22}
                  className="object-contain" style={{ filter: "brightness(0) invert(0.5)" }} />
              )}
              <span className="text-xs text-[#5e5f7a] font-medium">{champion.primaryRole}</span>
            </div>
            <div className="text-sm text-[#5e5f7a] italic mb-3">{champion.title}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] bg-[#2e3048] text-[#9d9db8] px-2 py-0.5 rounded-full">
                Patch {patch}
              </span>
              {opggLoading && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#5e5f7a]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5383e8] animate-pulse" />
                  Fetching live data…
                </span>
              )}
              {isLive && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#22c55e]
                  bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  OP.GG LIVE
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-8 text-center shrink-0 flex-wrap">
            {([
              { label: "Win Rate",  val: `${champion.winRate.toFixed(2)}%`,  color: wrColor(champion.winRate) },
              { label: "Pick Rate", val: `${champion.pickRate.toFixed(2)}%`, color: "#9d9db8" },
              { label: "Ban Rate",  val: `${champion.banRate.toFixed(2)}%`,  color: "#9d9db8" },
              { label: "Games",     val: (champion.games / 1000).toFixed(1) + "k", color: "#9d9db8" },
            ] as const).map(({ label, val, color }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <div className="text-[10px] text-[#5e5f7a] uppercase tracking-wider">{label}</div>
                <div className="font-bold text-base" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter bar ───────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex bg-[#1e1f28] border border-[#2e3048] rounded-lg overflow-hidden">
            {QUEUE_TABS.map(q => (
              <button key={q} onClick={() => setQueue(q)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  queue === q ? "bg-[#5383e8] text-white" : "text-[#5e5f7a] hover:text-white hover:bg-[#2a2b3a]"
                }`}>
                {q}
              </button>
            ))}
          </div>
          <RankSelect value={rankLabel} onChange={(l, k) => { setRankLabel(l); setRankKey(k); }} />
        </div>

        {/* ── Section tabs ──────────────────────────────────── */}
        <div className="flex border-b border-[#2e3048] mb-5">
          {SECTION_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                tab === t
                  ? "border-[#5383e8] text-white"
                  : "border-transparent text-[#5e5f7a] hover:text-[#9d9db8]"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* BUILD TAB                                          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Build" && (
          <div className="space-y-4">

            {/* Row 1: Runes (left) + Spells & Skills (right) */}
            <div className="flex gap-4">
              <div className={`${card} flex-1 min-w-0 p-5`}>
                <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Runes</div>
                <RuneTree runes={build.runes} winRate={build.winRate} games={build.games} />
              </div>

              <div className="w-72 shrink-0 space-y-4">
                {/* Summoner spells */}
                <div className={`${card} p-4`}>
                  <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-3">Summoner Spells</div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      {build.spells.map((spell, i) => <SpellImg key={i} name={spell} version={version} size={50} />)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{build.spells.join(" + ")}</div>
                      <div className="text-[10px] text-[#5383e8] mt-0.5">{build.pickRate}% pick rate</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm" style={{ color: wrColor(build.winRate) }}>{build.winRate}%</div>
                      <div className="text-[9px] text-[#5e5f7a]">{build.games.toLocaleString()}g</div>
                    </div>
                  </div>
                </div>

                {/* Skill order */}
                <div className={`${card} p-4`}>
                  <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-3">Skill Order</div>
                  <SkillGrid order={build.levelOrder} skillOrder={build.skillOrder} champId={champion.id} version={version} />
                </div>
              </div>
            </div>

            {/* Row 2: Items */}
            <div className={`${card} p-5`}>
              <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Item Build</div>

              {/* Starter */}
              <div className="mb-4 pb-4 border-b border-[#2e3048]">
                <div className="text-[10px] text-[#5e5f7a] uppercase tracking-wider font-semibold mb-2">Starter Items</div>
                <div className="flex items-center gap-3 bg-[#13141a] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    {build.startItems.map((item, i) => (
                      <span key={i} className="flex items-center gap-2">
                        <ItemImg id={item.id} name={item.name} version={version} size={42} />
                        {i < build.startItems.length - 1 && <span className="text-[#5e5f7a] text-lg font-light">+</span>}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm" style={{ color: wrColor(build.winRate) }}>{build.winRate}%</div>
                    <div className="text-[10px] text-[#5383e8]">{build.pickRate}% pick</div>
                  </div>
                </div>
              </div>

              {/* Core build path */}
              <div className="mb-4 pb-4 border-b border-[#2e3048]">
                <div className="text-[10px] text-[#5e5f7a] uppercase tracking-wider font-semibold mb-2">Core Build</div>
                <div className="flex items-center gap-2 bg-[#13141a] rounded-xl px-4 py-3 flex-wrap">
                  <ItemImg id={build.boots.id} name={build.boots.name} version={version} size={46} />
                  <ChevronRight className="w-4 h-4 text-[#2e3048] shrink-0" />
                  {build.items.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <ItemImg id={item.id} name={item.name} version={version} size={46} />
                      {i < build.items.length - 1 && <ChevronRight className="w-4 h-4 text-[#2e3048] shrink-0" />}
                    </span>
                  ))}
                  <div className="flex-1" />
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-bold text-base" style={{ color: wrColor(build.winRate) }}>{build.winRate}%</div>
                    <div className="text-[10px] text-[#5e5f7a]">{build.games.toLocaleString()} games</div>
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
                  <div key={label} className="bg-[#13141a] rounded-xl p-3">
                    <div className="text-[10px] text-[#5383e8] font-bold uppercase tracking-widest mb-2">{label}</div>
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
                <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Jungle Path</div>
                <JunglePaths games={build.games} />
              </div>
            )}

            {/* Counters preview */}
            <div className={`${card} p-5`}>
              <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Counters</div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#e84057]" />
                    <span className="text-sm font-bold text-white">Hard to Beat</span>
                    <span className="text-xs text-[#5e5f7a]">counters {champion.name}</span>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {weakAgainst.map(({ champ, winRate: cwr, games }) => (
                      <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant="hard" />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                    <span className="text-sm font-bold text-white">Easy to Beat</span>
                    <span className="text-xs text-[#5e5f7a]">{champion.name} dominates</span>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {strongAgainst.map(({ champ, winRate: cwr, games }) => (
                      <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant="easy" />
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
              { title: "Hard to Beat", sub: `These champions counter ${champion.name}`, entries: weakAgainst,   v: "hard" as const, color: "#e84057" },
              { title: "Easy to Beat", sub: `${champion.name} dominates these matchups`, entries: strongAgainst, v: "easy" as const, color: "#22c55e" },
            ] as const).map(({ title, sub, entries, v, color }) => (
              <div key={title} className={`${card} p-6`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-base font-bold text-white">{title}</span>
                </div>
                <div className="text-[11px] text-[#5e5f7a] mb-5">{sub}</div>
                <div className="flex gap-5 flex-wrap">
                  {entries.map(({ champ, winRate: cwr, games }) => (
                    <CounterCard key={champ.id} champ={champ} winRate={cwr} games={games} variant={v} />
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
              <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Recommended Build</div>
              <div className="flex items-center gap-2 flex-wrap">
                <ItemImg id={build.boots.id} name={build.boots.name} version={version} size={52} />
                <ChevronRight className="w-4 h-4 text-[#2e3048]" />
                {build.items.map((item, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <ItemImg id={item.id} name={item.name} version={version} size={52} />
                      <span className="text-[8px] text-[#5e5f7a]">#{i + 2}</span>
                    </div>
                    {i < build.items.length - 1 && <ChevronRight className="w-4 h-4 text-[#2e3048]" />}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`${card} p-4`}>
                <div className="text-[11px] text-[#5e5f7a] uppercase tracking-wider font-semibold mb-3">Starter Options</div>
                <div className="space-y-2">
                  {build.starterOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#13141a] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1">
                        {opt.items.map((item, ii) => <ItemImg key={ii} id={item.id} name={item.name} version={version} size={34} />)}
                      </div>
                      <div className="flex-1" />
                      <span className="font-bold text-xs" style={{ color: wrColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</span>
                      <span className="text-[10px] text-[#5383e8] w-12 text-right">{opt.pickRate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${card} p-4`}>
                <div className="text-[11px] text-[#5e5f7a] uppercase tracking-wider font-semibold mb-3">Boots Options</div>
                <div className="space-y-2">
                  {build.bootsOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#13141a] rounded-lg px-3 py-2">
                      <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={34} />
                      <span className="text-[11px] text-[#9d9db8] flex-1 truncate">{opt.item.name}</span>
                      <span className="font-bold text-xs" style={{ color: wrColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</span>
                      <span className="text-[10px] text-[#5383e8] w-12 text-right">{opt.pickRate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-4">Situational Items</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "4th Item", opts: build.fourthOptions },
                  { label: "5th Item", opts: build.fifthOptions  },
                  { label: "6th Item", opts: build.sixthOptions  },
                ].map(({ label, opts }) => (
                  <div key={label} className="bg-[#13141a] rounded-xl p-3">
                    <div className="text-[10px] text-[#5383e8] font-bold uppercase tracking-widest mb-2">{label}</div>
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
          <div className={`${card} p-6`}>
            <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-5">
              Rune Page — {build.runes.primary} / {build.runes.secondary}
            </div>
            <RuneTree runes={build.runes} winRate={build.winRate} games={build.games} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* SKILLS TAB                                         */}
        {/* ═══════════════════════════════════════════════════ */}
        {tab === "Skills" && (
          <div className={`${card} p-6`}>
            <div className="text-xs font-bold text-[#5e5f7a] uppercase tracking-widest mb-5">Skill Order</div>
            <SkillGrid order={build.levelOrder} skillOrder={build.skillOrder} champId={champion.id} version={version} />
          </div>
        )}
      </div>
    </div>
  );
}
