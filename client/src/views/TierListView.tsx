import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { ChampPortrait } from "@/components/common/ChampPortrait";

const TIERS_DISPLAY = ["S+", "S", "A+", "A", "B", "C"] as const;
const ROLES = ["All", "Top", "Jungle", "Mid", "ADC", "Support"] as const;
type Role = typeof ROLES[number];

const TIER_BG: Record<string, string> = {
  "S+": "rgba(244,224,112,0.05)", S: "rgba(200,155,60,0.05)",
  "A+": "rgba(10,200,185,0.05)", A: "rgba(160,180,200,0.05)",
  B:   "rgba(91,122,140,0.05)",  C: "rgba(58,74,90,0.05)",
};
const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};
const TIER_BORDER: Record<string, string> = {
  "S+": "#F4E07040", S: "#C89B3C40", "A+": "#0AC8B940", A: "#A0B4C840", B: "#5B7A8C40", C: "#3a4a5a40",
};

const TIER_DATA: Record<string, Array<{ name: string; role: string }>> = {
  "S+": [
    { name: "Ahri",     role: "Mid"     },
    { name: "Vi",       role: "Jungle"  },
    { name: "Darius",   role: "Top"     },
    { name: "Thresh",   role: "Support" },
    { name: "Jinx",     role: "ADC"     },
  ],
  S: [
    { name: "Graves",   role: "Jungle"  },
    { name: "Lux",      role: "Support" },
    { name: "Caitlyn",  role: "ADC"     },
    { name: "Katarina", role: "Mid"     },
  ],
  "A+": [
    { name: "Lee Sin",  role: "Jungle"  },
    { name: "Yasuo",    role: "Mid"     },
    { name: "Irelia",   role: "Top"     },
    { name: "Morgana",  role: "Support" },
  ],
  A: [
    { name: "Ezreal",   role: "ADC"     },
    { name: "Zed",      role: "Mid"     },
  ],
  B: [],
  C: [],
};

export function TierListView() {
  const [role, setRole] = useState<Role>("All");

  const filtered = (tier: string) =>
    TIER_DATA[tier]?.filter(c => role === "All" || c.role === role) ?? [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-5 h-5 text-[#C89B3C]" />
        <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">Tier List — Patch 14.24</h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
              role === r
                ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {TIERS_DISPLAY.map(tier => {
          const champs = filtered(tier);
          return (
            <div
              key={tier}
              className="flex items-start gap-4 rounded-sm border"
              style={{ background: TIER_BG[tier], borderColor: TIER_BORDER[tier] }}
            >
              {/* Tier label */}
              <div
                className="w-14 h-14 flex items-center justify-center font-['Cinzel'] font-black text-2xl shrink-0"
                style={{ color: TIER_COLORS[tier], background: TIER_COLORS[tier] + "10", borderRight: `1px solid ${TIER_BORDER[tier]}` }}
              >
                {tier}
              </div>

              {/* Champions */}
              <div className="flex flex-wrap gap-3 p-3 flex-1 min-h-[56px]">
                {champs.map(c => (
                  <div key={c.name} className="flex flex-col items-center gap-1 group">
                    <ChampPortrait championName={c.name} size={44} ring />
                    <div className="text-[9px] font-['Cinzel'] text-[#5B7A8C] group-hover:text-[#C89B3C] transition-colors">{c.name}</div>
                  </div>
                ))}
                {champs.length === 0 && (
                  <div className="text-[10px] text-[#2E4A5C] font-['Cinzel'] self-center">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
