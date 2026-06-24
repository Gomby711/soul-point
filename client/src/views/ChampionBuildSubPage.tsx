import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronDown, Search, ChevronRight } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { winRateColor } from "@/lib/utils";
import { type ChampionInfo } from "@/hooks/useChampionData";
import { getBuild, type BuildEntry } from "@/data/builds";
import { useRuneData, PATH_COLORS, type RunePath } from "@/hooks/useRuneData";
import { getDragonVersion, fetchOPGGChampionAnalysis } from "@/api/client";

// ── DDragon version ────────────────────────────────────────────
function useVersion() {
  const [v, setV] = useState("14.24.1");
  useEffect(() => { getDragonVersion().then(setV).catch(() => {}); }, []);
  return v;
}

// ── Champion spell data (Q/W/E/R icons) ───────────────────────
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
        const s: SpellData[] = (data?.data?.[champId]?.spells ?? []).map((sp: { id: string; name: string }) => ({ id: sp.id, name: sp.name }));
        _spellCache[champId] = s;
        setSpells(s);
      })
      .catch(() => {});
  }, [champId, version]);

  return spells;
}

// ── OP.GG real data integration ───────────────────────────────
// Server parses the MCP class-notation and returns clean JSON.
// Parsed shape mirrors the OP.GG class schema.

interface OPGGCoreItems { ids: number[]; ids_names: string[]; play?: number; win?: number; pick_rate?: number }
interface OPGGCounter   { champion_id: number; champion_name: string; play: number; win: number; win_rate: number }
interface OPGGRunes {
  primary_page_name:    string; primary_rune_names:    string[];
  secondary_page_name:  string; secondary_rune_names:  string[];
  primary_rune_ids?:   number[]; secondary_rune_ids?: number[];
}
interface OPGGSkills { order: string[]; play: number; win: number; pick_rate: number }
interface OPGGData {
  summary?: {
    average_stats?: { play: number; win_rate: number; pick_rate: number; ban_rate: number }
  };
  strong_counters?: OPGGCounter[]; weak_counters?: OPGGCounter[];
  core_items?:    OPGGCoreItems;
  boots?:         OPGGCoreItems;
  starter_items?: OPGGCoreItems;
  last_items?:    OPGGCoreItems[];  // 4th-item slot options
  fourth_items?:  OPGGCoreItems[];  // 5th-item slot options
  fifth_items?:   OPGGCoreItems[];  // 6th-item slot options
  summoner_spells?: OPGGCoreItems;
  runes?:  OPGGRunes;
  skills?: OPGGSkills;
}
interface OPGGParsed { champion: string; position: string; data: OPGGData }

const SPELL_ID_MAP: Record<number, string> = {
  1: "Cleanse", 3: "Exhaust", 4: "Flash", 6: "Ghost",
  7: "Heal", 11: "Smite", 12: "Teleport", 14: "Ignite", 21: "Barrier",
};

function toItemOption(ci: OPGGCoreItems, idx = 0): { item: { id: number; name: string }; pickRate: number; games: number; winRate: number } {
  const id   = ci.ids?.[idx] ?? 0;
  const name = ci.ids_names?.[idx] ?? String(id);
  const wr   = ci.play && ci.win ? +((ci.win / ci.play) * 100).toFixed(1) : 50;
  return { item: { id, name }, pickRate: +((ci.pick_rate ?? 0) * 100).toFixed(1), games: ci.play ?? 0, winRate: wr };
}

function padLevelOrder(order: string[]): string[] {
  const result = [...order];
  const c = { Q: 0, W: 0, E: 0, R: 0 };
  result.forEach(a => { if (a in c) c[a as keyof typeof c]++; });
  while (result.length < 18) {
    const level = result.length + 1;
    if (level === 16) { result.push('R'); c.R++; continue; }
    if (c.Q < 5) { result.push('Q'); c.Q++; }
    else if (c.W < 5) { result.push('W'); c.W++; }
    else if (c.E < 5) { result.push('E'); c.E++; }
    else { result.push('R'); c.R++; }
  }
  return result;
}

function useOPGGBuild(
  champName: string,
  position: string,
  rankKey: string,
): { parsed: OPGGParsed | null; loading: boolean } {
  const [parsed, setParsed] = useState<OPGGParsed | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setParsed(null);
    setLoading(true);
    fetchOPGGChampionAnalysis(champName, position, rankKey)
      .then(raw => {
        if (!cancelled) {
          const r = raw as OPGGParsed;
          setParsed(r?.data ? r : null);
        }
      })
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

  // Items — ids/ids_names arrays
  const coreItems = (d.core_items?.ids ?? []).map((id, i) => ({
    id, name: d.core_items?.ids_names?.[i] ?? String(id),
  }));
  const starters = (d.starter_items?.ids ?? []).map((id, i) => ({
    id, name: d.starter_items?.ids_names?.[i] ?? String(id),
  }));
  const boots = d.boots?.ids?.[0]
    ? { id: d.boots.ids[0], name: d.boots.ids_names?.[0] ?? String(d.boots.ids[0]) }
    : staticBuild.boots;

  // Runes — names come directly from the parsed data
  const runes = d.runes ? {
    keystone:       d.runes.primary_rune_names?.[0]   ?? staticBuild.runes.keystone,
    primary:        d.runes.primary_page_name          ?? staticBuild.runes.primary,
    secondary:      d.runes.secondary_page_name        ?? staticBuild.runes.secondary,
    primaryRunes:   d.runes.primary_rune_names         ?? undefined,
    secondaryRunes: d.runes.secondary_rune_names       ?? undefined,
  } : staticBuild.runes;

  // Summoner spells — ids are the numeric spell IDs
  const spellIds = (d.summoner_spells?.ids ?? staticBuild.spellIds).map(Number);
  const spells   = spellIds.map(id => SPELL_ID_MAP[id] ?? String(id));

  // Skill order — array of "Q"/"W"/"E"/"R", pad to 18 levels
  const rawOrder  = d.skills?.order ?? [];
  const levelOrder = rawOrder.length > 0 ? padLevelOrder(rawOrder) : staticBuild.levelOrder;
  const nonR = levelOrder.filter(a => a !== 'R');
  const countFor = (a: string) => nonR.filter(x => x === a).length;
  const skillOrder = ['Q','W','E']
    .sort((a, b) => countFor(b) - countFor(a))
    .join(' → ');

  // Slot options (4th / 5th / 6th items)
  const fourthOptions = (d.last_items   ?? []).slice(0, 5).map(ci => toItemOption(ci));
  const fifthOptions  = (d.fourth_items ?? []).slice(0, 5).map(ci => toItemOption(ci));
  const sixthOptions  = (d.fifth_items  ?? []).slice(0, 5).map(ci => toItemOption(ci));

  // Stats
  const avg      = d.summary?.average_stats;
  const winRate  = avg ? +(avg.win_rate  * 100).toFixed(1) : staticBuild.winRate;
  const pickRate = avg ? +(avg.pick_rate * 100).toFixed(1) : staticBuild.pickRate;
  const games    = avg?.play ?? staticBuild.games;

  return {
    ...staticBuild,
    winRate, pickRate, games,
    boots,
    items:      coreItems.length > 0 ? coreItems : staticBuild.items,
    startItems: starters.length  > 0 ? starters  : staticBuild.startItems,
    runes, spells, spellIds, skillOrder, levelOrder,
    fourthOptions: fourthOptions.length > 0 ? fourthOptions : staticBuild.fourthOptions,
    fifthOptions:  fifthOptions.length  > 0 ? fifthOptions  : staticBuild.fifthOptions,
    sixthOptions:  sixthOptions.length  > 0 ? sixthOptions  : staticBuild.sixthOptions,
  };
}

// Match OP.GG counter entries to our ChampionInfo list by name
function matchOPGGCounters(
  entries: OPGGCounter[],
  champions: ChampionInfo[],
  winRateIsOurs: boolean,
): { champ: ChampionInfo; winRate: number; games: number }[] {
  return entries
    .slice(0, 5)
    .map(e => {
      const champ = champions.find(c => c.name.toLowerCase() === e.champion_name?.toLowerCase());
      if (!champ) return null;
      const wr = winRateIsOurs
        ? +(e.win_rate * 100).toFixed(1)
        : +((1 - e.win_rate) * 100).toFixed(1);  // weak_counters: their win rate → invert for ours
      return { champ, winRate: wr, games: e.play };
    })
    .filter(Boolean) as { champ: ChampionInfo; winRate: number; games: number }[];
}

// ── CDragon role icon URLs ─────────────────────────────────────
const ROLE_ICON_URLS: Record<string, string> = {
  Top:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-top.png",
  Jungle:  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-jungle.png",
  Mid:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-middle.png",
  ADC:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-bottom.png",
  Support: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/position-icons/position-utility.png",
};

// ── Item image ─────────────────────────────────────────────────
function ItemImg({ id, name, version, size = 44 }: { id: number; name: string; version: string; size?: number }) {
  return (
    <div className="group relative shrink-0">
      <div className="rounded-sm border border-[#1E2D3D] bg-[#0A1428] overflow-hidden" style={{ width: size, height: size }}>
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`}
          alt={name} className="w-full h-full object-cover" loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.15"; }}
        />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 pointer-events-none z-40">
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

function SpellIcon({ name, version, size = 44 }: { name: string; version: string; size?: number }) {
  const key = SPELL_KEYS[name] ?? "SummonerFlash";
  return (
    <div className="group relative shrink-0">
      <div className="rounded-sm border border-[#785A28] overflow-hidden bg-[#0A1428]" style={{ width: size, height: size }}>
        <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${key}.png`}
          alt={name} className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 pointer-events-none z-40">
        {name}
      </div>
    </div>
  );
}

// ── Rune icon — grayscale+dim when not selected ────────────────
function RuneIcon({ iconPath, name, size = 32, selected = false, dimmed = false }: {
  iconPath: string; name: string; size?: number; selected?: boolean; dimmed?: boolean;
}) {
  return (
    <div className="group relative shrink-0" style={{ opacity: dimmed ? 0.22 : 1 }}>
      <div className="rounded-full overflow-hidden flex items-center justify-center transition-all"
        style={{
          width: size, height: size,
          background: selected ? "rgba(200,155,60,0.18)" : "rgba(10,20,40,0.5)",
          border: selected ? "2px solid #C89B3C" : "1px solid #1E2D3D",
          filter: dimmed ? "grayscale(100%)" : "none",
        }}>
        <img src={`https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`}
          alt={name} className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
      </div>
      {!dimmed && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 pointer-events-none z-40">
          {name}
        </div>
      )}
    </div>
  );
}

// ── Full rune tree — ALL options visible, non-selected dimmed ──
function RuneTreeFull({ runes, winRate, games }: { runes: BuildEntry["runes"]; winRate: number; games: number }) {
  const { paths, loaded } = useRuneData();

  if (!loaded) return <div className="animate-pulse text-[10px] text-[#5B7A8C] font-['Cinzel'] p-6">Loading rune data…</div>;

  const primaryPath   = paths.find(p => p.name === runes.primary);
  const secondaryPath = paths.find(p => p.name === runes.secondary);
  const primaryColor  = PATH_COLORS[runes.primary]   ?? "#C89B3C";
  const secondColor   = PATH_COLORS[runes.secondary] ?? "#5B7A8C";

  // Build sets for fast lookup — match by lowercase name
  const primarySelectedSet   = new Set((runes.primaryRunes   ?? []).map(n => n.toLowerCase()));
  const secondarySelectedSet = new Set((runes.secondaryRunes ?? []).map(n => n.toLowerCase()));

  return (
    <div className="border border-[#1E2D3D] bg-[#050D18] rounded-sm overflow-hidden">
      <div className="flex divide-x divide-[#1E2D3D]">

        {/* ── Primary path ──── */}
        <div className="flex-1 p-5">
          {/* Path header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1E2D3D]">
            {primaryPath && (
              <div className="w-7 h-7 rounded-full overflow-hidden border border-[#785A28] bg-[#0A1428]">
                <img src={`https://ddragon.leagueoflegends.com/cdn/img/${primaryPath.icon}`} alt={primaryPath.name} className="w-full h-full object-contain p-0.5" />
              </div>
            )}
            <span className="text-sm font-['Cinzel'] font-bold" style={{ color: primaryColor }}>{runes.primary}</span>
            <div className="ml-auto text-right">
              <div className="font-mono font-bold text-base" style={{ color: winRateColor(winRate) }}>{winRate}%</div>
              <div className="text-[9px] text-[#5B7A8C]">{games.toLocaleString()} Games</div>
            </div>
          </div>

          {/* Keystone row — all keystones visible */}
          {primaryPath?.slots[0] && (
            <div className="flex justify-center gap-6 mb-5">
              {primaryPath.slots[0].runes.map(perk => {
                const isSel = perk.name.toLowerCase() === runes.keystone.toLowerCase();
                return (
                  <div key={perk.id} className="flex flex-col items-center gap-1.5">
                    <RuneIcon iconPath={perk.icon} name={perk.name} size={isSel ? 58 : 40} selected={isSel} dimmed={!isSel} />
                    <div className="text-[9px] font-mono text-center" style={{ color: isSel ? winRateColor(winRate) : "transparent" }}>
                      {isSel ? `${winRate}%` : "·"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Slots 1–3: match selected rune by name from OP.GG data */}
          {primaryPath?.slots.slice(1).map((slot, si) => (
            <div key={si} className="flex justify-around mb-4">
              {slot.runes.map((perk) => {
                const isSel = primarySelectedSet.size > 0
                  ? primarySelectedSet.has(perk.name.toLowerCase())
                  : slot.runes.indexOf(perk) === 0;
                return (
                  <div key={perk.id} className="flex flex-col items-center gap-1">
                    <RuneIcon iconPath={perk.icon} name={perk.name} size={isSel ? 36 : 30} selected={isSel} dimmed={!isSel} />
                    <div className="text-[9px] font-mono" style={{ color: isSel ? "#A0B4C8" : "transparent" }}>
                      {isSel ? `${+(winRate - si * 0.4).toFixed(1)}%` : "·"}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Secondary path ── */}
        <div className="w-44 p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1E2D3D]">
            {secondaryPath && (
              <div className="w-5 h-5 rounded-full overflow-hidden border border-[#1E2D3D] bg-[#0A1428]">
                <img src={`https://ddragon.leagueoflegends.com/cdn/img/${secondaryPath.icon}`} alt={secondaryPath.name} className="w-full h-full object-contain p-0.5" />
              </div>
            )}
            <span className="text-[11px] font-['Cinzel'] font-bold" style={{ color: secondColor }}>{runes.secondary}</span>
          </div>

          {/* Secondary: match by name from OP.GG, any slot can be active */}
          {secondaryPath?.slots.slice(1).map((slot, si) => {
            return (
              <div key={si} className="flex justify-around mb-3">
                {slot.runes.map((perk) => {
                  const isSel = secondarySelectedSet.size > 0
                    ? secondarySelectedSet.has(perk.name.toLowerCase())
                    : si < 2 && slot.runes.indexOf(perk) === 0;
                  return (
                    <div key={perk.id} className="flex flex-col items-center gap-0.5">
                      <RuneIcon iconPath={perk.icon} name={perk.name} size={isSel ? 30 : 24} selected={isSel} dimmed={!isSel} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Stat shards ───── */}
        <div className="w-28 p-5">
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-4 pb-3 border-b border-[#1E2D3D]">Shards</div>
          {[["Adaptive Force", "Attack Speed"], ["Adaptive Force", "Attack Speed"], ["Armor", "Magic Resist"]].map(([sel, other], i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full border-2 border-[#C89B3C] bg-[#C89B3C]/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#C89B3C]" />
              </div>
              <div className="w-5 h-5 rounded-full border border-[#1E2D3D] opacity-25 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#5B7A8C]" />
              </div>
              <span className="text-[8px] text-[#5B7A8C] leading-tight">{sel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ability icons (QWER) ───────────────────────────────────────
const ABILITY_LABELS = ["Q", "W", "E", "R"] as const;
const ABILITY_COLORS: Record<string, string> = {
  Q: "#0AC8B9", W: "#C89B3C", E: "#A0B4C8", R: "#F4E070",
};

function AbilityIcons({ champId, version }: { champId: string; version: string }) {
  const spells = useChampionSpells(champId, version);
  return (
    <div className="flex items-center gap-2">
      {ABILITY_LABELS.map((ab, i) => {
        const spell = spells[i];
        const color = ABILITY_COLORS[ab];
        return (
          <div key={ab} className="group relative flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-sm overflow-hidden border-2 flex items-center justify-center"
              style={{ borderColor: color + "80", background: color + "18" }}>
              {spell ? (
                <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.id}.png`}
                  alt={spell.name} className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-[11px] font-['Cinzel'] font-black" style={{ color }}>{ab}</span>
              )}
            </div>
            <span className="text-[8px] font-['Cinzel'] font-bold" style={{ color }}>{ab}</span>
            {spell && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 pointer-events-none z-40">
                {spell.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Jungle camp icons ──────────────────────────────────────────
const CAMP_DEFS: Record<string, { label: string; color: string; cdUrl: string }> = {
  Blue:    { label: "Blue", color: "#3A7BD5", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_bluebuff.png" },
  Gromp:   { label: "Gromp", color: "#3E7A3B", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_gromp.png" },
  Wolves:  { label: "Wolf",  color: "#7A8EA0", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_wolf.png" },
  Raptors: { label: "Raps",  color: "#C47820", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_razorbeak.png" },
  Red:     { label: "Red",   color: "#C83030", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_redbuff.png" },
  Krugs:   { label: "Krug",  color: "#8B5E3C", cdUrl: "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/minimap_icon_krug.png" },
};

function CampIcon({ camp }: { camp: string }) {
  const def = CAMP_DEFS[camp] ?? { label: camp.slice(0, 4), color: "#5B7A8C", cdUrl: "" };
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="group relative shrink-0">
      <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden border-2 text-[9px] font-bold"
        style={{ borderColor: def.color, background: def.color + "22", color: def.color }}>
        {imgOk && def.cdUrl ? (
          <img src={def.cdUrl} alt={camp} className="w-8 h-8 object-contain"
            onError={() => setImgOk(false)} />
        ) : def.label}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#010A13] border border-[#785A28] px-2 py-0.5 text-[9px] text-[#C8AA6E] whitespace-nowrap font-['Cinzel'] opacity-0 group-hover:opacity-100 pointer-events-none z-40">
        {camp}
      </div>
    </div>
  );
}

const BLUE_PATH = ["Blue", "Gromp", "Wolves", "Raptors", "Red", "Krugs"];
const RED_PATH  = ["Red", "Krugs", "Raptors", "Wolves", "Blue", "Gromp"];

function JunglePaths({ games }: { games: number }) {
  return (
    <div className="space-y-4">
      {[
        { side: "Blue Side", path: BLUE_PATH, g: Math.floor(games * 0.59), color: "#4B8BDD" },
        { side: "Red Side",  path: RED_PATH,  g: Math.floor(games * 0.41), color: "#C83C3C" },
      ].map(({ side, path, g, color }) => (
        <div key={side} className="border border-[#1E2D3D] bg-[#060E1A] p-3">
          <div className="flex justify-between mb-3">
            <span className="text-[11px] font-['Cinzel'] font-bold" style={{ color }}>{side}</span>
            <span className="text-[9px] font-mono text-[#5B7A8C]">{g.toLocaleString()} Games</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {path.map((camp, i) => (
              <span key={i} className="flex items-center gap-1">
                <CampIcon camp={camp} />
                {i < path.length - 1 && <ChevronRight className="w-3 h-3 text-[#2E4A5C] shrink-0" />}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ability order grid ─────────────────────────────────────────
function LevelOrderGrid({ order, skillOrder, champId, version }: {
  order: string[]; skillOrder: string; champId: string; version: string;
}) {
  const spells = useChampionSpells(champId, version);
  const normalized = [...order];
  while (normalized.length < 18) normalized.push("?");
  const spellByAbility: Record<string, SpellData | undefined> = { Q: spells[0], W: spells[1], E: spells[2], R: spells[3] };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {ABILITY_LABELS.map(ab => {
          const spell = spellByAbility[ab];
          const color = ABILITY_COLORS[ab];
          return (
            <div key={ab} className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-sm overflow-hidden border flex items-center justify-center"
                style={{ borderColor: color + "80", background: color + "18" }}>
                {spell ? (
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.id}.png`}
                    alt={spell.name} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : <span className="text-[9px] font-['Cinzel'] font-black" style={{ color }}>{ab}</span>}
              </div>
              <span className="text-[10px] font-['Cinzel'] font-bold" style={{ color }}>{ab}</span>
            </div>
          );
        })}
        <span className="ml-2 text-[10px] text-[#5B7A8C] font-['Cinzel']">Max: {skillOrder}</span>
      </div>

      <div className="flex gap-0.5 flex-wrap">
        {normalized.map((ability, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="w-7 h-7 flex items-center justify-center text-[10px] font-['Cinzel'] font-black border"
              style={{ color: ABILITY_COLORS[ability] ?? "#5B7A8C", borderColor: (ABILITY_COLORS[ability] ?? "#1E2D3D") + "80", background: (ABILITY_COLORS[ability] ?? "#1E2D3D") + "18" }}>
              {ability || "?"}
            </div>
            <div className="text-[7px] font-mono text-[#3a4a5a] leading-none">{i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Counter row — horizontal layout ───────────────────────────
function CounterRow({ label, entries, color }: {
  label: string;
  entries: { champ: ChampionInfo; winRate: number; games: number }[];
  color: string;
}) {
  return (
    <div>
      <div className="text-[9px] font-['Cinzel'] tracking-widest uppercase mb-2 text-[#785A28]">{label}</div>
      <div className="flex gap-3 flex-wrap">
        {entries.map(({ champ, winRate, games }) => (
          <div key={champ.id} className="flex flex-col items-center gap-0.5 min-w-[44px]">
            <div className="w-11 h-11 rounded-sm overflow-hidden border border-[#1E2D3D] hover:border-[#785A28] transition-colors">
              <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="text-[8px] font-['Cinzel'] text-[#A0B4C8] truncate max-w-[44px] text-center">{champ.name.split(/[\s']/)[0]}</div>
            <div className="font-mono text-[10px] font-bold" style={{ color }}>{winRate}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function useCounters(champion: ChampionInfo, champions: ChampionInfo[]) {
  function h(s: string) {
    let n = 5381;
    for (let i = 0; i < s.length; i++) n = (n * 33 ^ s.charCodeAt(i)) & 0x7fffffff;
    return n / 0x7fffffff;
  }
  const peers = useMemo(
    () => champions.filter(c => c.id !== champion.id && c.primaryRole === champion.primaryRole),
    [champions, champion]
  );
  const weakAgainst = useMemo(() =>
    [...peers].sort((a, b) => h(champion.name + a.name) - h(champion.name + b.name)).slice(0, 5)
      .map(c => ({ champ: c, winRate: +(29 + h(champion.name + c.name + "w") * 22).toFixed(1), games: Math.floor(30 + h(champion.name + c.name) * 270) })),
    [peers, champion]
  );
  const strongAgainst = useMemo(() =>
    [...peers].sort((a, b) => h(a.name + champion.name) - h(b.name + champion.name)).slice(0, 5)
      .map(c => ({ champ: c, winRate: +(60 + h(c.name + champion.name + "s") * 22).toFixed(1), games: Math.floor(30 + h(c.name + champion.name) * 270) })),
    [peers, champion]
  );
  return { weakAgainst, strongAgainst };
}

// ── Counter pick dropdown ──────────────────────────────────────
function CounterPickDropdown({ champions }: { champions: ChampionInfo[] }) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<ChampionInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const filtered = useMemo(
    () => query ? champions.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12) : [],
    [champions, query]
  );
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] hover:border-[#785A28] text-[10px] font-['Cinzel'] text-[#5B7A8C] transition-colors">
        {selected ? (
          <><div className="w-5 h-5 rounded-sm overflow-hidden border border-[#1E2D3D] shrink-0"><img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" /></div><span>{selected.name}</span></>
        ) : "vs. Counter"}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl w-64">
          <div className="p-3 border-b border-[#1E2D3D]">
            <div className="font-['Cinzel'] text-xs font-bold text-[#C8AA6E] mb-1">Counter pick</div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a champion"
                className="w-full pl-7 pr-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28]" />
            </div>
          </div>
          {filtered.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.id} onClick={() => { setSelected(c); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A1428] border-b border-[#1E2D3D] text-left">
                  <div className="w-7 h-7 rounded-sm overflow-hidden border border-[#1E2D3D] shrink-0"><img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /></div>
                  <span className="text-[11px] font-['Cinzel'] text-[#A0B4C8]">{c.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 flex gap-1.5 flex-wrap">
              {champions.slice(0, 10).map(c => (
                <button key={c.id} onClick={() => { setSelected(c); setOpen(false); }}
                  className="w-9 h-9 rounded-sm overflow-hidden border border-[#1E2D3D] hover:border-[#C89B3C] transition-colors shrink-0">
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {selected && (
            <button onClick={() => { setSelected(null); setOpen(false); }}
              className="w-full px-3 py-2 text-[9px] font-['Cinzel'] text-[#FF4E50] border-t border-[#1E2D3D] hover:bg-[#0A1428] text-center">Clear ✕</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rank dropdown ──────────────────────────────────────────────
const RANK_OPTIONS = [
  { label: "All Tiers",   icon: "🏆", key: "EMERALD"    },
  { label: "Challenger",  icon: "🔥", key: "CHALLENGER" },
  { label: "Grandmaster", icon: "🔶", key: "MASTER"     },
  { label: "Master+",     icon: "💜", key: "MASTER"     },
  { label: "Diamond+",    icon: "💎", key: "DIAMOND"    },
  { label: "Diamond",     icon: "💎", key: "DIAMOND"    },
  { label: "Emerald+",    icon: "🟢", key: "EMERALD"    },
  { label: "Emerald",     icon: "🟢", key: "EMERALD"    },
  { label: "Platinum+",   icon: "🔵", key: "PLATINUM"   },
  { label: "Gold+",       icon: "🟡", key: "GOLD"       },
  { label: "Gold",        icon: "🟡", key: "GOLD"       },
  { label: "Silver",      icon: "⚪", key: "GOLD"       },
  { label: "Iron",        icon: "⬛", key: "GOLD"       },
];

function RankDropdown({ value, onChange }: { value: string; onChange: (l: string, k: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const cur = RANK_OPTIONS.find(r => r.label === value) ?? RANK_OPTIONS[0];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0AC8B9]/10 border border-[#0AC8B9]/40 hover:border-[#0AC8B9] text-[10px] font-['Cinzel'] text-[#0AC8B9] transition-colors">
        <span>{cur.icon}</span><span>{value}</span><ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl min-w-[170px]">
          {RANK_OPTIONS.map(r => (
            <button key={r.label} onClick={() => { onChange(r.label, r.key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-['Cinzel'] hover:bg-[#0A1428] border-b border-[#1E2D3D] text-left ${value === r.label ? "text-[#0AC8B9] bg-[#0AC8B9]/5" : "text-[#A0B4C8]"}`}>
              <span>{r.icon}</span><span>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Class dropdown ─────────────────────────────────────────────
function ClassDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] hover:border-[#785A28] text-[10px] font-['Cinzel'] text-[#5B7A8C] transition-colors">
        ✦ {value}<ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-[#010A13] border border-[#785A28] shadow-2xl min-w-[150px]">
          {["Class","Fighter","Slayer","Tank","Mage","Controller","Specialist"].map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-['Cinzel'] hover:bg-[#0A1428] border-b border-[#1E2D3D] text-left ${value === o ? "text-[#C89B3C]" : "text-[#A0B4C8]"}`}>
              ✦ {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[11px] font-['Cinzel'] font-bold text-[#C8AA6E] uppercase tracking-widest">{children}</span>
      <ChevronRight className="w-3.5 h-3.5 text-[#785A28]" />
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};

const TABS_NORMAL = ["Build", "Counters", "Items", "Runes", "Skills"];
const TABS_JUNGLE = ["Build", "Counters", "Items", "Jungle Paths", "Runes", "Skills"];

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
interface Props {
  champion: ChampionInfo;
  champions: ChampionInfo[];
  onBack: () => void;
  onSelectChampion: (id: string) => void;
}

export function ChampionBuildSubPage({ champion, champions, onBack }: Props) {
  const version   = useVersion();
  const isJungler = champion.primaryRole === "Jungle";
  const tabs      = isJungler ? TABS_JUNGLE : TABS_NORMAL;

  // All hooks unconditionally
  const [rankLabel,     setRankLabel]     = useState("Emerald+");
  const [rankKey,       setRankKey]       = useState("EMERALD");
  const [selectedClass, setSelectedClass] = useState("Class");
  const [activeTab,     setActiveTab]     = useState("Build");
  const [gameMode,      setGameMode]      = useState("Ranked Solo/Duo");

  // Static fallback build data
  const allBuilds = useMemo(
    () => getBuild(champion.name, champion.buildType, champion.winRate, champion.pickRate, champion.games),
    [champion]
  );
  const staticBuild = useMemo(
    () => allBuilds.find(b => b.rank === rankKey) ?? allBuilds[0],
    [allBuilds, rankKey]
  );

  // OP.GG live data — fetched via MCP proxy
  const { parsed, loading: opggLoading } = useOPGGBuild(
    champion.name,
    champion.primaryRole,
    rankKey,
  );
  const { paths } = useRuneData();

  // Merge: prefer OP.GG fields, fall back to static
  const primaryBuild = useMemo(() => {
    if (!staticBuild) return null;
    if (!parsed) return staticBuild;
    return mergeOPGGBuild(parsed, staticBuild, paths);
  }, [staticBuild, parsed, paths]);

  // Counters — real OP.GG data when available, hash-based fallback
  const { weakAgainst: staticWeak, strongAgainst: staticStrong } = useCounters(champion, champions);
  const { weakAgainst, strongAgainst } = useMemo(() => {
    if (!parsed?.data) return { weakAgainst: staticWeak, strongAgainst: staticStrong };
    const d = parsed.data;
    const weak   = matchOPGGCounters(d.weak_counters   ?? [], champions, false);
    const strong = matchOPGGCounters(d.strong_counters ?? [], champions, true);
    return {
      weakAgainst:   weak.length   > 0 ? weak   : staticWeak,
      strongAgainst: strong.length > 0 ? strong : staticStrong,
    };
  }, [parsed, champions, staticWeak, staticStrong]);

  const isLive = Boolean(parsed && !opggLoading);

  if (!primaryBuild) {
    return <div className="flex items-center justify-center h-64 text-[#5B7A8C] font-['Cinzel'] text-sm">No build data available</div>;
  }

  const tierColor  = TIER_COLORS[champion.tier] ?? "#A0B4C8";
  const roleIconUrl = ROLE_ICON_URLS[champion.primaryRole];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-4">

      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] font-['Cinzel'] text-[#5B7A8C] hover:text-[#C89B3C] transition-colors mb-4 uppercase tracking-widest">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Champions
      </button>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <RankDropdown value={rankLabel} onChange={(l, k) => { setRankLabel(l); setRankKey(k); }} />
        <ClassDropdown value={selectedClass} onChange={setSelectedClass} />
        <CounterPickDropdown champions={champions} />
        <div className="ml-auto flex items-center gap-2">
          {opggLoading && (
            <div className="flex items-center gap-1.5 text-[9px] font-['Cinzel'] text-[#5B7A8C]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0AC8B9] animate-pulse" />
              Fetching live data…
            </div>
          )}
          {isLive && !opggLoading && (
            <div className="flex items-center gap-1 text-[9px] font-['Cinzel'] text-[#0AC8B9] border border-[#0AC8B9]/40 px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0AC8B9]" />
              OP.GG LIVE
            </div>
          )}
          <div className="text-[9px] font-mono text-[#785A28] border border-[#1E2D3D] px-2 py-1">
            Ver: {version.split(".").slice(0, 2).join(".")}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Main content ─── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Champion header */}
          <OrnatePanel className="p-4" accent>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-sm overflow-hidden border-2 border-[#785A28]">
                  <img src={champion.imageUrl} alt={champion.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center text-[9px] font-['Cinzel'] font-black border"
                  style={{ color: tierColor, background: tierColor + "20", borderColor: tierColor + "60" }}>
                  {champion.tier}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h1 className="font-['Cinzel'] font-black text-2xl text-[#C8AA6E]">{champion.name}</h1>
                  {roleIconUrl && (
                    <img src={roleIconUrl} alt={champion.primaryRole} width={20} height={20} className="object-contain"
                      style={{ filter: "brightness(0) saturate(100%) invert(75%) sepia(60%) saturate(600%) hue-rotate(5deg) brightness(1.1)" }} />
                  )}
                  <span className="text-[11px] text-[#5B7A8C] font-['Cinzel']">{champion.primaryRole} · Patch {version.split(".").slice(0, 2).join(".")}</span>
                </div>
                <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] italic mb-2">{champion.title}</div>
                <AbilityIcons champId={champion.id} version={version} />
              </div>

              <div className="flex flex-col gap-1.5 text-right shrink-0">
                {[
                  { label: "Win rate",  val: `${champion.winRate.toFixed(1)}%`,  color: winRateColor(champion.winRate) },
                  { label: "Pick rate", val: `${champion.pickRate.toFixed(1)}%`, color: "#A0B4C8" },
                  { label: "Ban rate",  val: `${champion.banRate.toFixed(1)}%`,  color: "#A0B4C8" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-2 justify-end">
                    <span className="text-[9px] text-[#5B7A8C] font-['Cinzel']">{label}</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </OrnatePanel>

          {/* Game mode tabs */}
          <div className="flex gap-0 border-b border-[#1E2D3D]">
            {["Ranked Solo/Duo", "Ranked Flex", "ARAM"].map(mode => (
              <button key={mode} onClick={() => setGameMode(mode)}
                className={`px-4 py-2 text-[10px] font-['Cinzel'] tracking-widest border-b-2 transition-all ${gameMode === mode ? "text-[#C89B3C] border-[#C89B3C]" : "text-[#5B7A8C] border-transparent hover:text-[#A0B4C8]"}`}>
                {mode}
              </button>
            ))}
          </div>

          {/* Section tabs */}
          <div className="flex gap-0 border-b border-[#1E2D3D] flex-wrap">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] font-['Cinzel'] tracking-widest border-b-2 transition-all ${activeTab === tab ? "text-[#C8AA6E] border-[#C89B3C] bg-[#C89B3C]/5" : "text-[#5B7A8C] border-transparent hover:text-[#A0B4C8]"}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── BUILD TAB ── */}
          {activeTab === "Build" && (
            <div className="space-y-4">
              {isJungler && (
                <OrnatePanel className="p-4">
                  <SectionHeader>Jungle Paths</SectionHeader>
                  <JunglePaths games={primaryBuild.games} />
                </OrnatePanel>
              )}

              <OrnatePanel className="p-4">
                <SectionHeader>Runes</SectionHeader>
                <RuneTreeFull runes={primaryBuild.runes} winRate={primaryBuild.winRate} games={primaryBuild.games} />
              </OrnatePanel>

              <OrnatePanel className="p-4">
                <SectionHeader>Summoner Spells</SectionHeader>
                <div className="flex items-center gap-4 border border-[#1E2D3D] bg-[#060E1A] p-3">
                  {primaryBuild.spells.map((spell, i) => <SpellIcon key={`${spell}-${i}`} name={spell} version={version} size={44} />)}
                  <div className="flex-1 ml-2">
                    <div className="font-['Cinzel'] text-sm text-[#C8AA6E]">{primaryBuild.spells.join(" + ")}</div>
                    <div className="text-[9px] text-[#5B7A8C] mt-0.5">
                      {primaryBuild.spells.includes("Smite") ? "Required for jungle" : primaryBuild.spells.includes("Teleport") ? "Split-push pressure" : "Standard setup"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-lg" style={{ color: winRateColor(primaryBuild.winRate) }}>{primaryBuild.winRate}%</div>
                    <div className="text-[9px] text-[#5B7A8C]">{primaryBuild.games.toLocaleString()} Games</div>
                  </div>
                </div>
              </OrnatePanel>

              <OrnatePanel className="p-4">
                <SectionHeader>Skill Order</SectionHeader>
                <LevelOrderGrid order={primaryBuild.levelOrder} skillOrder={primaryBuild.skillOrder} champId={champion.id} version={version} />
              </OrnatePanel>

              <OrnatePanel className="p-4">
                <SectionHeader>Item Build</SectionHeader>

                {/* Starters + boots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Starter Items</div>
                    <div className="space-y-2">
                      {primaryBuild.starterOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2 bg-[#060E1A]">
                          <div className="flex gap-1">{opt.items.map((item, ii) => <ItemImg key={ii} id={item.id} name={item.name} version={version} size={36} />)}</div>
                          <div className="flex-1" />
                          <div className="text-right mr-2"><div className="text-[10px] font-mono text-[#A0B4C8]">{opt.pickRate.toFixed(1)}%</div><div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()}g</div></div>
                          <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Boots</div>
                    <div className="space-y-2">
                      {primaryBuild.bootsOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2 bg-[#060E1A]">
                          <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={36} />
                          <div className="flex-1 min-w-0"><div className="text-[10px] font-['Cinzel'] text-[#A0B4C8] truncate">{opt.item.name}</div></div>
                          <div className="text-right mr-2"><div className="text-[10px] font-mono text-[#A0B4C8]">{opt.pickRate.toFixed(1)}%</div><div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()}g</div></div>
                          <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Core builds */}
                <div className="mb-5">
                  <div className="text-[9px] font-['Cinzel'] text-[#785A28] uppercase tracking-widest mb-2">Core Builds</div>
                  <div className="space-y-2">
                    {primaryBuild.coreOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-2.5 bg-[#060E1A] flex-wrap">
                        <div className="flex items-center gap-1">
                          {opt.items.map((item, ii) => (
                            <span key={ii} className="flex items-center gap-1">
                              <ItemImg id={item.id} name={item.name} version={version} size={42} />
                              {ii < opt.items.length - 1 && <ChevronRight className="w-3 h-3 text-[#785A28]" />}
                            </span>
                          ))}
                        </div>
                        <div className="flex-1" />
                        <div className="text-right mr-2"><div className="text-[10px] font-mono text-[#A0B4C8]">{opt.pickRate.toFixed(1)}%</div><div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()}g</div></div>
                        <div className="font-mono text-sm font-bold" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4th / 5th / 6th */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "4th Item", opts: primaryBuild.fourthOptions },
                    { label: "5th Item", opts: primaryBuild.fifthOptions },
                    { label: "6th Item", opts: primaryBuild.sixthOptions },
                  ].map(({ label, opts }) => (
                    <div key={label}>
                      <div className="text-[9px] font-['Cinzel'] uppercase tracking-widest mb-2 text-[#0AC8B9]">{label}</div>
                      <div className="space-y-1.5">
                        {opts.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 border border-[#1E2D3D] p-1.5 bg-[#060E1A]">
                            <ItemImg id={opt.item.id} name={opt.item.name} version={version} size={34} />
                            <div className="flex-1 min-w-0"><div className="font-mono text-[11px] font-bold" style={{ color: winRateColor(opt.winRate) }}>{opt.winRate.toFixed(1)}%</div><div className="text-[8px] text-[#5B7A8C]">{opt.games.toLocaleString()}g</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </OrnatePanel>
            </div>
          )}

          {/* ── JUNGLE PATHS ── */}
          {activeTab === "Jungle Paths" && isJungler && (
            <OrnatePanel className="p-4">
              <SectionHeader>Jungle Paths</SectionHeader>
              <JunglePaths games={primaryBuild.games} />
            </OrnatePanel>
          )}

          {/* ── COUNTERS ── */}
          {activeTab === "Counters" && (
            <OrnatePanel className="p-4">
              <SectionHeader>{champion.name} Counters</SectionHeader>
              <div className="space-y-6">
                <CounterRow label="Weak against (you lose)" entries={weakAgainst} color="#FF4E50" />
                <CounterRow label="Strong against (you win)" entries={strongAgainst} color="#0AC8B9" />
              </div>
            </OrnatePanel>
          )}

          {/* ── RUNES ── */}
          {activeTab === "Runes" && (
            <OrnatePanel className="p-4">
              <SectionHeader>Runes</SectionHeader>
              <RuneTreeFull runes={primaryBuild.runes} winRate={primaryBuild.winRate} games={primaryBuild.games} />
            </OrnatePanel>
          )}

          {/* ── SKILLS ── */}
          {activeTab === "Skills" && (
            <OrnatePanel className="p-4">
              <SectionHeader>Skill Order</SectionHeader>
              <LevelOrderGrid order={primaryBuild.levelOrder} skillOrder={primaryBuild.skillOrder} champId={champion.id} version={version} />
            </OrnatePanel>
          )}

          {/* ── ITEMS ── */}
          {activeTab === "Items" && (
            <OrnatePanel className="p-4">
              <SectionHeader>Full Item Build</SectionHeader>
              <div className="flex gap-2 flex-wrap mb-4">
                {primaryBuild.items.map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <ItemImg id={item.id} name={item.name} version={version} size={48} />
                    <div className="text-[8px] font-mono text-[#5B7A8C]">#{i + 1}</div>
                  </div>
                ))}
              </div>
            </OrnatePanel>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-52 shrink-0 hidden lg:block">
          <OrnatePanel className="p-3 sticky top-4 space-y-5">
            <div className="font-['Cinzel'] text-sm font-bold text-[#C8AA6E]">{champion.name} Counter</div>
            <CounterRow label="Weak against" entries={weakAgainst.slice(0, 3)} color="#FF4E50" />
            <CounterRow label="Strong against" entries={strongAgainst.slice(0, 3)} color="#0AC8B9" />
          </OrnatePanel>
        </div>
      </div>
    </div>
  );
}
