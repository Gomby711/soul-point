import { useState, useEffect } from "react";
import { Map, ArrowUp, ArrowDown, Minus, Loader } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";

type ChangeType = "buff" | "nerf" | "adjust";

interface StatChange {
  stat: string;
  label: string;
  old: number;
  new: number;
  type: ChangeType;
}

interface ChampionDiff {
  id: string;
  name: string;
  imageUrl: string;
  changes: StatChange[];
  type: ChangeType;
}

interface ItemDiff {
  id: string;
  name: string;
  imageUrl: string;
  changes: StatChange[];
  type: ChangeType;
}

const STAT_LABELS: Record<string, string> = {
  hp: "Base HP",
  hpperlevel: "HP per Level",
  mp: "Base Mana",
  mpperlevel: "Mana per Level",
  movespeed: "Move Speed",
  armor: "Base Armor",
  spellblock: "Base MR",
  attackrange: "Attack Range",
  hpregen: "HP Regen",
  hpregenperlevel: "HP Regen/Level",
  mpregen: "Mana Regen",
  mpregenperlevel: "Mana Regen/Level",
  attackdamage: "Base AD",
  attackdamageperlevel: "AD/Level",
  attackspeedperlevel: "AS/Level",
  attackspeed: "Base AS",
};

const ITEM_STAT_LABELS: Record<string, string> = {
  FlatHPPoolMod: "HP",
  FlatMPPoolMod: "Mana",
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "Magic Resist",
  FlatPhysicalDamageMod: "AD",
  FlatMagicDamageMod: "AP",
  FlatCritChanceMod: "Crit Chance",
  PercentAttackSpeedMod: "Attack Speed",
  FlatMovementSpeedMod: "Move Speed",
  PercentLifeStealMod: "Lifesteal",
};

const CHANGE_CONFIG: Record<ChangeType, { color: string; bg: string; border: string; Icon: React.ElementType; label: string }> = {
  buff:   { color: "#0AC8B9", bg: "#0AC8B910", border: "#0AC8B930", Icon: ArrowUp,   label: "BUFF"   },
  nerf:   { color: "#FF4E50", bg: "#FF4E5010", border: "#FF4E5030", Icon: ArrowDown, label: "NERF"   },
  adjust: { color: "#C89B3C", bg: "#C89B3C10", border: "#C89B3C30", Icon: Minus,     label: "ADJUST" },
};

function statChangeType(old: number, newVal: number, stat: string): ChangeType {
  // Stats where higher = better for the champion
  const higherIsBetter = ["hp","hpperlevel","mp","mpperlevel","movespeed","hpregen","hpregenperlevel",
    "mpregen","mpregenperlevel","attackdamage","attackdamageperlevel","attackspeedperlevel","attackspeed",
    "FlatHPPoolMod","FlatMPPoolMod","FlatPhysicalDamageMod","FlatMagicDamageMod","FlatCritChanceMod",
    "PercentAttackSpeedMod","FlatMovementSpeedMod","PercentLifeStealMod","attackrange"];
  const lowerIsBetter = ["armor","spellblock","FlatArmorMod","FlatSpellBlockMod"]; // defensive = buff when increased
  if (lowerIsBetter.includes(stat)) {
    return newVal > old ? "buff" : "nerf";
  }
  if (higherIsBetter.includes(stat)) {
    return newVal > old ? "buff" : "nerf";
  }
  return "adjust";
}

function classifyOverall(changes: StatChange[]): ChangeType {
  const buffs = changes.filter(c => c.type === "buff").length;
  const nerfs = changes.filter(c => c.type === "nerf").length;
  if (buffs > 0 && nerfs > 0) return "adjust";
  if (buffs > 0) return "buff";
  if (nerfs > 0) return "nerf";
  return "adjust";
}

function patchDate(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  // Season 1 = 2011, so year = 2010 + major
  const year = 2010 + major;
  // Patches are ~biweekly. Patch 1 ≈ Jan 8 of that year, each +14 days
  const base = new Date(year, 0, 8); // Jan 8
  base.setDate(base.getDate() + (minor - 1) * 14);
  return base.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function PatchView() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [currentVer, setCurrentVer]   = useState("");
  const [previousVer, setPreviousVer] = useState("");
  const [champDiffs, setChampDiffs]   = useState<ChampionDiff[]>([]);
  const [itemDiffs, setItemDiffs]     = useState<ItemDiff[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch version list
        const versions: string[] = await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
          .then(r => r.json());
        const cur  = versions[0];
        const prev = versions[1] ?? versions[0];
        setCurrentVer(cur);
        setPreviousVer(prev);

        // 2. Fetch champion summary for both versions
        const [curData, prevData] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${cur}/data/en_US/champion.json`).then(r => r.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${prev}/data/en_US/champion.json`).then(r => r.json()),
        ]);

        const curChamps:  Record<string, { name: string; id: string; image: { full: string }; stats: Record<string, number> }> = curData.data;
        const prevChamps: Record<string, { name: string; id: string; image: { full: string }; stats: Record<string, number> }> = prevData.data;

        const diffs: ChampionDiff[] = [];
        for (const [key, cur] of Object.entries(curChamps)) {
          const prev = prevChamps[key];
          if (!prev) continue;
          const changes: StatChange[] = [];
          for (const [stat, newVal] of Object.entries(cur.stats)) {
            const oldVal = prev.stats[stat];
            if (oldVal === undefined) continue;
            const diff = Math.abs(newVal - oldVal);
            if (diff < 0.001) continue;
            changes.push({
              stat,
              label: STAT_LABELS[stat] ?? stat,
              old: oldVal,
              new: newVal,
              type: statChangeType(oldVal, newVal, stat),
            });
          }
          if (changes.length > 0) {
            diffs.push({
              id: key,
              name: cur.name,
              imageUrl: `https://ddragon.leagueoflegends.com/cdn/${cur}/img/champion/${cur.image.full}`,
              changes,
              type: classifyOverall(changes),
            });
          }
        }
        setChampDiffs(diffs);

        // 3. Fetch item data for both versions
        const [curItems, prevItems] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${cur}/data/en_US/item.json`).then(r => r.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${prev}/data/en_US/item.json`).then(r => r.json()),
        ]);

        interface DDItem {
          name: string;
          image: { full: string };
          gold?: { total: number };
          stats?: Record<string, number>;
          purchasable?: boolean;
        }

        const curItemMap:  Record<string, DDItem> = curItems.data;
        const prevItemMap: Record<string, DDItem> = prevItems.data;

        const idiffs: ItemDiff[] = [];
        for (const [id, item] of Object.entries(curItemMap)) {
          const prevItem = prevItemMap[id];
          if (!prevItem) continue;
          if (!item.purchasable && !prevItem.purchasable) continue;

          const changes: StatChange[] = [];

          // Compare gold costs
          const curGold  = item.gold?.total ?? 0;
          const prevGold = prevItem.gold?.total ?? 0;
          if (Math.abs(curGold - prevGold) >= 50) {
            changes.push({
              stat: "gold",
              label: "Cost",
              old: prevGold,
              new: curGold,
              type: curGold < prevGold ? "buff" : "nerf",
            });
          }

          // Compare item stats
          const curStats  = item.stats  ?? {};
          const prevStats = prevItem.stats ?? {};
          for (const [stat, newVal] of Object.entries(curStats)) {
            const oldVal = prevStats[stat];
            if (oldVal === undefined) continue;
            const diff = Math.abs(newVal - oldVal);
            if (diff < 0.001) continue;
            changes.push({
              stat,
              label: ITEM_STAT_LABELS[stat] ?? stat,
              old: oldVal,
              new: newVal,
              type: statChangeType(oldVal, newVal, stat),
            });
          }

          if (changes.length > 0) {
            idiffs.push({
              id,
              name: item.name,
              imageUrl: `https://ddragon.leagueoflegends.com/cdn/${cur}/img/item/${item.image.full}`,
              changes,
              type: classifyOverall(changes),
            });
          }
        }
        setItemDiffs(idiffs.slice(0, 20));

      } catch (e) {
        setError("Could not load patch data. Check your connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const patchLabel = currentVer.split(".").slice(0, 2).join(".");

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12 flex flex-col items-center justify-center gap-4">
        <Loader className="w-8 h-8 text-[#C89B3C] animate-spin" />
        <div className="font-['Cinzel'] text-[#C89B3C] text-sm animate-pulse">Fetching latest patch data...</div>
        <div className="text-[10px] text-[#5B7A8C]">Comparing current patch vs previous patch from DDragon</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12 text-center">
        <div className="font-['Cinzel'] text-[#FF4E50] text-sm mb-2">Failed to load patch data</div>
        <div className="text-[#5B7A8C] text-xs">{error}</div>
      </div>
    );
  }

  const noChanges = champDiffs.length === 0 && itemDiffs.length === 0;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Map className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">
          Patch {patchLabel} Notes
        </h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
        <span className="text-[10px] font-mono text-[#5B7A8C]">{patchDate(currentVer)}</span>
      </div>

      {/* Version banner */}
      <OrnatePanel className="p-4 mb-6" accent>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Current Patch</div>
            <div className="font-['Cinzel'] font-bold text-2xl gold-text">{patchLabel}</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Compared To</div>
            <div className="font-['Cinzel'] font-bold text-xl text-[#5B7A8C]">{previousVer.split(".").slice(0,2).join(".")}</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Champion Changes</div>
            <div className="font-['Cinzel'] font-bold text-xl text-[#C8AA6E]">{champDiffs.length}</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Item Changes</div>
            <div className="font-['Cinzel'] font-bold text-xl text-[#C8AA6E]">{itemDiffs.length}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[9px] text-[#5B7A8C] font-['Cinzel']">Data source: DDragon CDN</div>
            <div className="text-[9px] text-[#5B7A8C]">Live stat comparison</div>
          </div>
        </div>
      </OrnatePanel>

      {noChanges ? (
        <OrnatePanel className="p-12 text-center">
          <div className="font-['Cinzel'] text-[#C8AA6E] text-sm mb-2">No Base Stat Changes Detected</div>
          <div className="text-[#5B7A8C] text-xs max-w-md mx-auto">
            Patches {previousVer.split(".").slice(0,2).join(".")} and {patchLabel} have identical
            base champion and item stats in DDragon. Riot may have only made ability-level or
            system changes not reflected in the data files.
          </div>
        </OrnatePanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Champion changes */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">
                Champion Base Stat Changes
              </h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
              <span className="text-[9px] font-mono text-[#5B7A8C]">{champDiffs.length} champions</span>
            </div>

            {champDiffs.length === 0 && (
              <OrnatePanel className="p-6 text-center">
                <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">No champion base stat changes this patch</div>
              </OrnatePanel>
            )}

            {champDiffs.map(champ => {
              const cfg = CHANGE_CONFIG[champ.type];
              const Icon = cfg.Icon;
              return (
                <OrnatePanel key={champ.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
                      <img src={champ.imageUrl} alt={champ.name} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-['Cinzel'] font-bold text-sm text-[#C8AA6E]">{champ.name}</div>
                      <div className="text-[9px] text-[#5B7A8C]">{champ.changes.length} stat{champ.changes.length !== 1 ? "s" : ""} changed</div>
                    </div>
                    <span
                      className="flex items-center gap-1 text-[10px] font-['Cinzel'] font-bold px-2 py-1"
                      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {champ.changes.map(ch => {
                      const chCfg = CHANGE_CONFIG[ch.type];
                      return (
                        <div key={ch.stat} className="flex items-center gap-2 text-[11px]">
                          <span style={{ color: chCfg.color }} className="w-2 shrink-0">▸</span>
                          <span className="text-[#A0B4C8] w-28 shrink-0">{ch.label}</span>
                          <span className="font-mono text-[#5B7A8C]">{ch.old.toFixed(1)}</span>
                          <span className="text-[#3a4a5a]">→</span>
                          <span className="font-mono font-bold" style={{ color: chCfg.color }}>{ch.new.toFixed(1)}</span>
                          <span className="text-[9px] ml-1" style={{ color: chCfg.color }}>
                            ({ch.new > ch.old ? "+" : ""}{(ch.new - ch.old).toFixed(2)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </OrnatePanel>
              );
            })}
          </div>

          {/* Item changes + legend */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Item Changes</h3>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
              </div>

              {itemDiffs.length === 0 ? (
                <OrnatePanel className="p-6 text-center">
                  <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">No item stat changes this patch</div>
                </OrnatePanel>
              ) : (
                <div className="space-y-2">
                  {itemDiffs.map(item => {
                    const cfg = CHANGE_CONFIG[item.type];
                    const Icon = cfg.Icon;
                    return (
                      <OrnatePanel key={item.id} className="p-3">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                            <span className="font-['Cinzel'] text-[11px] text-[#C8AA6E]">{item.name}</span>
                          </div>
                          <span
                            className="flex items-center gap-1 text-[9px] font-['Cinzel'] font-bold px-1.5 py-0.5 shrink-0"
                            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                          >
                            <Icon className="w-2.5 h-2.5" />{cfg.label}
                          </span>
                        </div>
                        {item.changes.map(ch => {
                          const chCfg = CHANGE_CONFIG[ch.type];
                          return (
                            <div key={ch.stat} className="flex items-center gap-2 text-[10px]">
                              <span style={{ color: chCfg.color }}>▸</span>
                              <span className="text-[#A0B4C8]">{ch.label}:</span>
                              <span className="font-mono text-[#5B7A8C]">{ch.stat === "gold" ? ch.old + "g" : ch.old.toFixed(0)}</span>
                              <span className="text-[#3a4a5a]">→</span>
                              <span className="font-mono font-bold" style={{ color: chCfg.color }}>
                                {ch.stat === "gold" ? ch.new + "g" : ch.new.toFixed(0)}
                              </span>
                            </div>
                          );
                        })}
                      </OrnatePanel>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <OrnatePanel className="p-4" accent>
              <div className="text-[10px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-3">Legend</div>
              {(["buff","nerf","adjust"] as ChangeType[]).map(t => {
                const cfg = CHANGE_CONFIG[t];
                const Icon = cfg.Icon;
                return (
                  <div key={t} className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[9px] font-['Cinzel'] font-bold px-1.5 py-0.5"
                      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon className="w-2.5 h-2.5" />{cfg.label}
                    </span>
                    <span className="text-[10px] text-[#5B7A8C]">
                      {t === "buff" ? "Increased power" : t === "nerf" ? "Reduced power" : "Mixed changes"}
                    </span>
                  </div>
                );
              })}
            </OrnatePanel>
          </div>
        </div>
      )}
    </div>
  );
}
