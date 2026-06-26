import { Flame, Users, BarChart2, Globe, Sword, ArrowUp, ArrowDown } from "lucide-react";
import { SearchBar } from "@/components/layout/SearchBar";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { ChampPortrait } from "@/components/common/ChampPortrait";
import { winRateColor } from "@/lib/utils";
import type { Region } from "@/api/types";

interface HomeViewProps {
  onSearch: (name: string, tag: string, region: Region) => void;
  onSelectChampion: (id: string) => void;
}


const HOT_PICKS = [
  { name: "Ahri",    id: "Ahri",    role: "Mid",     winRate: 53.4, pickRate: 18.2, tier: "S+", trend: "up"   },
  { name: "Jinx",    id: "Jinx",    role: "ADC",     winRate: 52.1, pickRate: 14.7, tier: "S",  trend: "up"   },
  { name: "Thresh",  id: "Thresh",  role: "Support", winRate: 51.8, pickRate: 22.4, tier: "S",  trend: "up"   },
  { name: "Yasuo",   id: "Yasuo",   role: "Mid",     winRate: 49.2, pickRate: 11.3, tier: "A+", trend: "down" },
  { name: "Lee Sin", id: "LeeSin",  role: "Jungle",  winRate: 48.9, pickRate: 16.8, tier: "A",  trend: "down" },
  { name: "Darius",  id: "Darius",  role: "Top",     winRate: 52.7, pickRate: 13.1, tier: "S",  trend: "up"   },
];

const TIER_COLORS: Record<string, string> = {
  SP: "#FFD700", "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C",
};

export function HomeView({ onSearch, onSelectChampion }: HomeViewProps) {
  return (
    <div className="min-h-[calc(100vh-49px)]">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 420, background: "#010A13" }}>
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,50 28,64 2,50 2,16' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: "56px 100px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-16" style={{ background: "linear-gradient(90deg,transparent,#785A28)" }} />
            <Flame className="w-3 h-3 text-[#C89B3C]" />
            <span className="text-[10px] font-['Cinzel'] tracking-[0.3em] text-[#785A28] uppercase">Season 16 · 2026</span>
            <Flame className="w-3 h-3 text-[#C89B3C]" />
            <div className="h-px w-16" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
          </div>

          <h1 className="font-['Cinzel'] font-black text-6xl md:text-8xl mb-2" style={{ letterSpacing: "0.08em" }}>
            <span className="gold-text">SOUL</span>
            <span className="text-[#A0B4C8]">POINT</span>
          </h1>
          <p className="text-[#5B7A8C] text-sm font-['Cinzel'] tracking-[0.2em] mb-10 uppercase">
            Analytics · Champion Builds · Rankings
          </p>

          <SearchBar onSearch={onSearch} />

        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="border-y border-[#1E2D3D]" style={{ background: "#071523" }}>
        <div className="max-w-screen-xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { Icon: Users,    label: "Summoners Tracked", value: "48.2M" },
            { Icon: BarChart2, label: "Matches Analyzed",  value: "1.2B"  },
            { Icon: Globe,    label: "Regions Covered",   value: "11"    },
            { Icon: Sword,    label: "Champions",         value: "173"   },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center shrink-0"
                style={{ background: "rgba(200,155,60,0.08)", border: "1px solid #785A2844" }}
              >
                <Icon className="w-3.5 h-3.5 text-[#C89B3C]" />
              </div>
              <div>
                <div className="font-['Cinzel'] font-bold text-lg text-[#C8AA6E] leading-tight">{value}</div>
                <div className="text-[10px] text-[#5B7A8C] tracking-wider">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hot picks ── */}
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-5">
          <Flame className="w-4 h-4 text-[#C89B3C]" />
          <h2 className="font-['Cinzel'] font-bold text-sm tracking-widest text-[#C8AA6E] uppercase">Patch Hottest Picks</h2>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#785A28,transparent)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HOT_PICKS.map(c => (
            <OrnatePanel key={c.name} className="p-4 hover:border-[#785A28] transition-colors cursor-pointer" onClick={() => onSelectChampion(c.id)}>
              <div className="flex items-center gap-4">
                <ChampPortrait championName={c.name} size={60} ring />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-['Cinzel'] font-bold text-base text-[#C8AA6E]">{c.name}</span>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ color: TIER_COLORS[c.tier], background: TIER_COLORS[c.tier] + "18" }}
                    >
                      {c.tier}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B7A8C] mb-2">{c.role}</div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="font-mono font-bold" style={{ color: winRateColor(c.winRate) }}>
                      {c.winRate.toFixed(1)}% WR
                    </span>
                    <span className="text-[#5B7A8C]">PR {c.pickRate.toFixed(1)}%</span>
                    {c.trend === "up"
                      ? <ArrowUp className="w-3.5 h-3.5 text-[#0AC8B9]" />
                      : <ArrowDown className="w-3.5 h-3.5 text-[#FF4E50]" />}
                  </div>
                </div>
              </div>
            </OrnatePanel>
          ))}
        </div>
      </div>
    </div>
  );
}
