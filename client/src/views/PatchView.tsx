import { useState, useEffect } from "react";
import { Map, ArrowUp, ArrowDown, Minus, Loader, Star, Shield, Zap, Package } from "lucide-react";
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
  const higherIsBetter = ["hp","hpperlevel","mp","mpperlevel","movespeed","hpregen","hpregenperlevel",
    "mpregen","mpregenperlevel","attackdamage","attackdamageperlevel","attackspeedperlevel","attackspeed",
    "FlatHPPoolMod","FlatMPPoolMod","FlatPhysicalDamageMod","FlatMagicDamageMod","FlatCritChanceMod",
    "PercentAttackSpeedMod","FlatMovementSpeedMod","PercentLifeStealMod","attackrange"];
  const lowerIsBetter = ["armor","spellblock","FlatArmorMod","FlatSpellBlockMod"];
  if (lowerIsBetter.includes(stat)) return newVal > old ? "buff" : "nerf";
  if (higherIsBetter.includes(stat)) return newVal > old ? "buff" : "nerf";
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

function ddragonToDisplayMajor(ddragonMajor: number): number {
  return ddragonMajor >= 15 ? ddragonMajor + 10 : ddragonMajor;
}

function patchDate(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  const year = 2010 + major;
  const base = new Date(year, 0, 8);
  base.setDate(base.getDate() + (minor - 1) * 14);
  return base.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Static Patch 26.13 Notes ─────────────────────────────────────────────────

interface PatchChampChange {
  name: string;
  type: ChangeType;
  changes: string[];
}

interface PatchItemChange {
  name: string;
  type: ChangeType;
  changes: string[];
}

const PATCH_2613_CHAMP_BUFFS: PatchChampChange[] = [
  {
    name: "Aphelios",
    type: "buff",
    changes: [
      "Calibrum mark damage: 10% bonus AD → 15% bonus AD",
      "Severum Q damage: 19–40% total AD → 20–41% total AD",
      "Infernum Q damage: 10–16% bonus AD → 15–21% bonus AD",
      "Crescendum Q damage: 30–48% bonus AD → 34–52% bonus AD",
    ],
  },
  {
    name: "Draven",
    type: "buff",
    changes: [
      "E cooldown: 18–14s → 16–12s",
      "R damage reduction: −8% per hit (min 40%) → −5% per hit (min 50%)",
    ],
  },
  {
    name: "Kai'Sa",
    type: "buff",
    changes: [
      "W cooldown: 22–14s → 20–14s",
      "R shield: 70–110 (+90–180% AD, +120% AP) → 100–200 (+90–180% AD, +120% AP)",
    ],
  },
  {
    name: "LeBlanc",
    type: "buff",
    changes: [
      "RQ / RE damage: 70–210 → 70–230",
      "Mark/root damage: 140–420 → 140–460",
      "RW damage: 150–450 → 150–480",
    ],
  },
  {
    name: "Olaf",
    type: "buff",
    changes: ["Q monster bonus damage: 20–80 → 20–120"],
  },
  {
    name: "Poppy",
    type: "buff",
    changes: ["Q monster damage cap: 50–170 → 75–195"],
  },
  {
    name: "Qiyana",
    type: "buff",
    changes: ["Q monster damage: 155% → 175%"],
  },
  {
    name: "Vex",
    type: "buff",
    changes: [
      "E cooldown: 13s → 12s",
      "R reset window: 6s → 8s",
    ],
  },
];

const PATCH_2613_CHAMP_NERFS: PatchChampChange[] = [
  {
    name: "Bard",
    type: "nerf",
    changes: [
      "Passive damage per meep: 35 (+10 per 5 chimes) → 30 (+6 per 5 chimes)",
    ],
  },
  {
    name: "Brand",
    type: "nerf",
    changes: [
      "Passive detonation damage: 8–12% → 6–12% (scales past level 18)",
      "E mana cost: 70–90 → 90 flat",
    ],
  },
  {
    name: "Cassiopeia",
    type: "nerf",
    changes: ["Health per level: 104 → 98"],
  },
  {
    name: "K'Sante",
    type: "nerf",
    changes: [
      "E shield: 80–240 (+15% bonus health) → 70–240 (+13.5% bonus health)",
    ],
  },
  {
    name: "Rek'Sai",
    type: "nerf",
    changes: [
      "E physical damage: 80–192 (64% bonus AD) → 70–170 (60% bonus AD)",
      "E bonus true damage: 125% → 120%",
    ],
  },
  {
    name: "Rumble",
    type: "nerf",
    changes: [
      "Q damage: 60–160 (100% AP) → 50–150 (105% AP)",
    ],
  },
  {
    name: "Senna",
    type: "nerf",
    changes: [
      "Soul drop chance on own kill: 10% → 5%",
      "Soul drop chance on ally kill: 28% → 32%",
      "Critical damage: −10% → −15%",
      "Q cooldown refund: on-hit → on-attack",
    ],
  },
  {
    name: "Sion",
    type: "nerf",
    changes: [
      "Q minimum damage: 40–120 → 30–90",
      "W mana cost: 65–85 → 75–95",
    ],
  },
];

const PATCH_2613_ITEM_CHANGES: PatchItemChange[] = [
  {
    name: "Doran's Helm",
    type: "adjust",
    changes: [
      "Armor and magic resistance: 10 → 8",
      "Health: 140 → 150",
    ],
  },
  {
    name: "Imperial Mandate",
    type: "adjust",
    changes: [
      "Ability power: 65 → 60",
      "Control AH (immobilizing abilities): 15 → 20",
      "Command damage amplification: 6% → 7%",
      "Build path reworked (total cost unchanged)",
    ],
  },
];

const PATCH_2613_SYSTEMS: { title: string; desc: string }[] = [
  {
    title: "Last Hit Indicators",
    desc: "Visual indicators now appear in Ranked and Normal Draft to help players practice last-hitting. Disabled by default in Ranked pending further testing.",
  },
  {
    title: "Ranked 5s Return",
    desc: "Limited run begins June 26. Tournament Draft format with double stakes and no role restrictions — five-stack competitive play is back.",
  },
  {
    title: "Direct Message Reporting",
    desc: "Report and block options are now available directly within the chat interface. Blocking stops future DMs while preserving current session history.",
  },
  {
    title: "Discord Integration",
    desc: "Players in supported regions can link accounts for faster party invitations and cross-platform friend visibility.",
  },
];

// ─── Champion portrait helper ─────────────────────────────────────────────────

function ChampImg({ name, version }: { name: string; version: string }) {
  const id = name.replace(/[\s']/g, "").replace(/&/, "");
  const src = version
    ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`
    : "";
  return (
    <div className="w-10 h-10 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
      {src && (
        <img src={src} alt={name} className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
      )}
    </div>
  );
}

function ChampChangeCard({ champ, version }: { champ: PatchChampChange; version: string }) {
  const cfg = CHANGE_CONFIG[champ.type];
  const Icon = cfg.Icon;
  return (
    <OrnatePanel className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <ChampImg name={champ.name} version={version} />
        <div className="flex-1">
          <div className="font-['Cinzel'] font-bold text-sm text-[#C8AA6E]">{champ.name}</div>
          <div className="text-[9px] text-[#5B7A8C]">{champ.changes.length} change{champ.changes.length !== 1 ? "s" : ""}</div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-['Cinzel'] font-bold px-2 py-1"
          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <Icon className="w-3 h-3" />{cfg.label}
        </span>
      </div>
      <div className="space-y-1">
        {champ.changes.map((ch, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span style={{ color: cfg.color }} className="mt-0.5 shrink-0">▸</span>
            <span className="text-[#A0B4C8]">{ch}</span>
          </div>
        ))}
      </div>
    </OrnatePanel>
  );
}

export function PatchView() {
  const [activeSection, setActiveSection] = useState<"notes" | "diff">("notes");
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

        const versions: string[] = await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
          .then(r => r.json());
        const cur  = versions[0];
        const prev = versions[1] ?? versions[0];
        setCurrentVer(cur);
        setPreviousVer(prev);

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
              stat, label: STAT_LABELS[stat] ?? stat,
              old: oldVal, new: newVal,
              type: statChangeType(oldVal, newVal, stat),
            });
          }
          if (changes.length > 0) {
            diffs.push({
              id: key, name: cur.name,
              imageUrl: `https://ddragon.leagueoflegends.com/cdn/${cur}/img/champion/${cur.image.full}`,
              changes, type: classifyOverall(changes),
            });
          }
        }
        setChampDiffs(diffs);

        interface DDItem {
          name: string; image: { full: string };
          gold?: { total: number }; stats?: Record<string, number>; purchasable?: boolean;
        }
        const [curItems, prevItems] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${cur}/data/en_US/item.json`).then(r => r.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${prev}/data/en_US/item.json`).then(r => r.json()),
        ]);
        const curItemMap:  Record<string, DDItem> = curItems.data;
        const prevItemMap: Record<string, DDItem> = prevItems.data;

        const idiffs: ItemDiff[] = [];
        for (const [id, item] of Object.entries(curItemMap)) {
          const prevItem = prevItemMap[id];
          if (!prevItem || (!item.purchasable && !prevItem.purchasable)) continue;
          const changes: StatChange[] = [];
          const curGold  = item.gold?.total ?? 0;
          const prevGold = prevItem.gold?.total ?? 0;
          if (Math.abs(curGold - prevGold) >= 50) {
            changes.push({ stat: "gold", label: "Cost", old: prevGold, new: curGold, type: curGold < prevGold ? "buff" : "nerf" });
          }
          const curStats = item.stats ?? {};
          const prevStats = prevItem.stats ?? {};
          for (const [stat, newVal] of Object.entries(curStats)) {
            const oldVal = prevStats[stat];
            if (oldVal === undefined) continue;
            if (Math.abs(newVal - oldVal) < 0.001) continue;
            changes.push({ stat, label: ITEM_STAT_LABELS[stat] ?? stat, old: oldVal, new: newVal, type: statChangeType(oldVal, newVal, stat) });
          }
          if (changes.length > 0) {
            idiffs.push({ id, name: item.name, imageUrl: `https://ddragon.leagueoflegends.com/cdn/${cur}/img/item/${item.image.full}`, changes, type: classifyOverall(changes) });
          }
        }
        setItemDiffs(idiffs.slice(0, 20));
      } catch {
        setError("Could not load patch data. Check your connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const ddragonMajor  = parseInt(currentVer.split(".")[0] || "16", 10);
  const displayMajor  = ddragonToDisplayMajor(ddragonMajor);
  const patchLabel    = `${displayMajor}.${currentVer.split(".")[1] ?? "13"}`;

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12 flex flex-col items-center justify-center gap-4">
        <Loader className="w-8 h-8 text-[#C89B3C] animate-spin" />
        <div className="font-['Cinzel'] text-[#C89B3C] text-sm animate-pulse">Fetching patch data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Map className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">
          Patch 26.13 Notes
        </h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
        <span className="text-[10px] font-mono text-[#5B7A8C]">{currentVer ? patchDate(currentVer) : "June 25, 2026"}</span>
      </div>

      {/* Version banner */}
      <OrnatePanel className="p-4 mb-6" accent>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Current Patch</div>
            <div className="font-['Cinzel'] font-bold text-2xl gold-text">26.13</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">New Champion</div>
            <div className="font-['Cinzel'] font-bold text-lg text-[#0AC8B9]">Locke</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Champion Buffs</div>
            <div className="font-['Cinzel'] font-bold text-xl" style={{ color: "#0AC8B9" }}>{PATCH_2613_CHAMP_BUFFS.length}</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Champion Nerfs</div>
            <div className="font-['Cinzel'] font-bold text-xl" style={{ color: "#FF4E50" }}>{PATCH_2613_CHAMP_NERFS.length}</div>
          </div>
          <div className="w-px h-10 bg-[#1E2D3D]" />
          <div>
            <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">System Changes</div>
            <div className="font-['Cinzel'] font-bold text-xl text-[#C8AA6E]">{PATCH_2613_SYSTEMS.length}</div>
          </div>
        </div>
      </OrnatePanel>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1E2D3D]">
        {([
          { id: "notes" as const, label: "Patch 26.13 Notes", Icon: Star },
          { id: "diff"  as const, label: "Base Stat Diff", Icon: Map },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-['Cinzel'] tracking-widest uppercase transition-all relative ${
              activeSection === id ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {activeSection === id && (
              <div className="absolute bottom-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg,transparent,#C89B3C,transparent)" }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Patch Notes section ──────────────────────────────────── */}
      {activeSection === "notes" && (
        <div className="space-y-8">

          {/* New Champion */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-4 h-4 text-[#0AC8B9]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">New Champion — Locke</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
              <span className="text-[9px] font-['Cinzel'] px-2 py-0.5 border" style={{ color: "#0AC8B9", borderColor: "#0AC8B930", background: "#0AC8B910" }}>JUNE 24</span>
            </div>
            <OrnatePanel className="p-5" accent>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="font-['Cinzel'] font-black text-xl text-[#C8AA6E] mb-1">Locke — The Ashen Exorcist</div>
                  <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] mb-4">A relentless hunter who turns an enemy's missing health into power.</div>
                  <div className="space-y-2">
                    {[
                      { key: "Passive", name: "Silver Stake", desc: "Attacks deal bonus magic damage based on enemy missing health." },
                      { key: "Q",       name: "Ritual Nails",  desc: "Throws soul nails that damage and mark enemies; consuming marks grants bonus attack damage." },
                      { key: "W",       name: "Soul Ignition", desc: "Gains attack and movement speed while taking damage; heals a portion back when the duration ends." },
                      { key: "E",       name: "Ashen Pursuit", desc: "Teleports then dashes to the target, damaging enemies passed through." },
                      { key: "R",       name: "Purgatory",     desc: "Hurls a binding artifact that can execute; gains power by sealing champions within." },
                    ].map(({ key, name, desc }) => (
                      <div key={key} className="flex items-start gap-3">
                        <span className="shrink-0 w-12 text-center text-[10px] font-['Cinzel'] font-bold px-1.5 py-0.5 rounded-sm"
                          style={{ color: "#0AC8B9", background: "#0AC8B910", border: "1px solid #0AC8B930" }}>
                          {key}
                        </span>
                        <div>
                          <span className="font-['Cinzel'] text-[11px] text-[#C8AA6E] font-bold">{name} — </span>
                          <span className="text-[11px] text-[#A0B4C8]">{desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </OrnatePanel>
          </div>

          {/* Champion Buffs */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <ArrowUp className="w-4 h-4 text-[#0AC8B9]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Champion Buffs</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
              <span className="text-[9px] text-[#0AC8B9] font-mono">{PATCH_2613_CHAMP_BUFFS.length} champions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PATCH_2613_CHAMP_BUFFS.map(champ => (
                <ChampChangeCard key={champ.name} champ={champ} version={currentVer} />
              ))}
            </div>
          </div>

          {/* Champion Nerfs */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <ArrowDown className="w-4 h-4 text-[#FF4E50]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Champion Nerfs</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
              <span className="text-[9px] text-[#FF4E50] font-mono">{PATCH_2613_CHAMP_NERFS.length} champions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PATCH_2613_CHAMP_NERFS.map(champ => (
                <ChampChangeCard key={champ.name} champ={champ} version={currentVer} />
              ))}
            </div>
          </div>

          {/* Item Changes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-4 h-4 text-[#C89B3C]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Item Changes</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PATCH_2613_ITEM_CHANGES.map(item => {
                const cfg = CHANGE_CONFIG[item.type];
                const Icon = cfg.Icon;
                return (
                  <OrnatePanel key={item.name} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <div className="font-['Cinzel'] font-bold text-sm text-[#C8AA6E]">{item.name}</div>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-['Cinzel'] font-bold px-2 py-1"
                        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {item.changes.map((ch, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px]">
                          <span style={{ color: cfg.color }} className="mt-0.5 shrink-0">▸</span>
                          <span className="text-[#A0B4C8]">{ch}</span>
                        </div>
                      ))}
                    </div>
                  </OrnatePanel>
                );
              })}
            </div>
          </div>

          {/* System / Feature Changes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-4 h-4 text-[#C89B3C]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">System & Feature Updates</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PATCH_2613_SYSTEMS.map(sys => (
                <OrnatePanel key={sys.title} className="p-4">
                  <div className="font-['Cinzel'] font-bold text-sm text-[#C8AA6E] mb-2">{sys.title}</div>
                  <div className="text-[11px] text-[#A0B4C8] leading-relaxed">{sys.desc}</div>
                </OrnatePanel>
              ))}
            </div>
          </div>

          {/* ARAM Mayhem */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-4 h-4 text-[#C89B3C]" />
              <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">ARAM: Mayhem Augment Adjustments</h3>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#1E2D3D,transparent)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <OrnatePanel className="p-4">
                <div className="font-['Cinzel'] font-bold text-xs text-[#785A28] uppercase mb-3">Tier Adjustments</div>
                <div className="space-y-1 text-[11px] text-[#A0B4C8]">
                  <div><span className="text-[#0AC8B9]">▸</span> Archmage: Gold → Prismatic</div>
                  <div><span className="text-[#FF4E50]">▸</span> Quickstep: Prismatic → Gold</div>
                </div>
              </OrnatePanel>
              <OrnatePanel className="p-4">
                <div className="font-['Cinzel'] font-bold text-xs text-[#785A28] uppercase mb-3">Augment Rebalancing</div>
                <div className="space-y-1 text-[11px] text-[#A0B4C8]">
                  <div><span className="text-[#C89B3C]">▸</span> Tooth Fairy burst threshold: 20% → 25%; lethality/pen: 5 → 4</div>
                  <div><span className="text-[#C89B3C]">▸</span> Pressure Cooker burn: 2% → 1.5% max health</div>
                  <div><span className="text-[#0AC8B9]">▸</span> Glass Cannon true damage: 15% → 25%</div>
                  <div><span className="text-[#0AC8B9]">▸</span> Twinfire crit chance: 15% → 25%</div>
                  <div><span className="text-[#FF4E50]">▸</span> Youch My Coins drops: 16 → 9</div>
                </div>
              </OrnatePanel>
            </div>
          </div>

        </div>
      )}

      {/* ── Base Stat Diff section (DDragon) ─────────────────────── */}
      {activeSection === "diff" && (
        <div>
          <OrnatePanel className="p-4 mb-6" accent>
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Current</div>
                <div className="font-['Cinzel'] font-bold text-2xl gold-text">{patchLabel}</div>
              </div>
              <div className="w-px h-10 bg-[#1E2D3D]" />
              <div>
                <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Previous</div>
                <div className="font-['Cinzel'] font-bold text-xl text-[#5B7A8C]">
                  {`${ddragonToDisplayMajor(parseInt(previousVer.split(".")[0]||"16",10))}.${previousVer.split(".")[1]??""}`}
                </div>
              </div>
              <div className="w-px h-10 bg-[#1E2D3D]" />
              <div>
                <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Base Stat Changes</div>
                <div className="font-['Cinzel'] font-bold text-xl text-[#C8AA6E]">{champDiffs.length}</div>
              </div>
              <div className="w-px h-10 bg-[#1E2D3D]" />
              <div>
                <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#785A28] uppercase mb-1">Item Stat Changes</div>
                <div className="font-['Cinzel'] font-bold text-xl text-[#C8AA6E]">{itemDiffs.length}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[9px] text-[#5B7A8C] font-['Cinzel']">Source: DDragon CDN</div>
                <div className="text-[9px] text-[#5B7A8C]">Live base stat comparison</div>
              </div>
            </div>
          </OrnatePanel>

          {error && (
            <OrnatePanel className="p-6 text-center mb-4">
              <div className="text-[#FF4E50] font-['Cinzel'] text-sm">{error}</div>
            </OrnatePanel>
          )}

          {champDiffs.length === 0 && itemDiffs.length === 0 ? (
            <OrnatePanel className="p-12 text-center">
              <div className="font-['Cinzel'] text-[#C8AA6E] text-sm mb-2">No Base Stat Changes Detected</div>
              <div className="text-[#5B7A8C] text-xs max-w-md mx-auto">
                These two patch versions have identical base champion and item stats in the data files.
                Ability-level and system changes are covered in the Patch 26.13 Notes tab above.
              </div>
            </OrnatePanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Champion Base Stat Changes</h3>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
                  <span className="text-[9px] font-mono text-[#5B7A8C]">{champDiffs.length} champions</span>
                </div>
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
                        <span className="flex items-center gap-1 text-[10px] font-['Cinzel'] font-bold px-2 py-1"
                          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <Icon className="w-3 h-3" />{cfg.label}
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
                              <span className="flex items-center gap-1 text-[9px] font-['Cinzel'] font-bold px-1.5 py-0.5 shrink-0"
                                style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
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
      )}
    </div>
  );
}
