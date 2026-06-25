import { useState, useEffect } from "react";
import { Sword, Target, Crown, Zap, BarChart2, Map, TrendingUp } from "lucide-react";
import type { View } from "@/App";
import { getDragonVersion } from "@/api/client";

interface NavBarProps {
  view: View;
  setView: (v: View) => void;
}

const LINKS: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: "home",        label: "Home",        Icon: Sword },
  { id: "champions",   label: "Champions",   Icon: Target },
  { id: "analytics",   label: "Analytics",   Icon: TrendingUp },
  { id: "leaderboard", label: "Leaderboard", Icon: Crown },
  { id: "tierlist",    label: "Tier List",   Icon: BarChart2 },
  { id: "patch",       label: "Patch",       Icon: Map },
];

export function NavBar({ view, setView }: NavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [patch, setPatch] = useState("...");
  const [season, setSeason] = useState("...");
  useEffect(() => {
    getDragonVersion().then(v => {
      // v is like "16.13.1" — major = season number
      const parts = v.split(".");
      const patchStr = parts.slice(0, 2).join(".");
      const seasonNum = parseInt(parts[0], 10);
      // Season year: S1=2011, so year = 2010 + seasonNum
      const year = 2010 + seasonNum;
      setPatch(patchStr);
      setSeason(`S${seasonNum} · ${year}`);
    }).catch(() => { setPatch("16.13"); setSeason("S16 · 2026"); });
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b border-[#1E2D3D]"
      style={{ background: "rgba(1,10,19,0.97)", backdropFilter: "blur(16px)" }}
    >
      {/* Top gold accent line */}
      <div
        className="h-px w-full"
        style={{ background: "linear-gradient(90deg,transparent,#785A28 30%,#C89B3C 50%,#785A28 70%,transparent)" }}
      />
      <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center gap-6">
        {/* Logo */}
        <button onClick={() => setView("home")} className="flex items-center gap-2 shrink-0">
          <div className="relative w-7 h-7">
            <div
              className="hex-clip w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#C89B3C,#785A28)" }}
            >
              <Zap className="w-3.5 h-3.5 text-[#010A13]" />
            </div>
          </div>
          <span className="font-['Cinzel'] font-bold text-base gold-text tracking-widest">
            SOUL<span className="text-[#A0B4C8]">POINT</span>
          </span>
        </button>

        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-0.5">
          {LINKS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`group flex items-center gap-1.5 px-3 py-1 text-xs font-['Cinzel'] tracking-widest transition-all relative ${
                view === id ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {view === id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg,transparent,#C89B3C,transparent)" }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* Right badges */}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:block text-[10px] font-mono text-[#785A28] border border-[#1E2D3D] px-2 py-0.5 rounded-sm">
            PATCH {patch}
          </span>
          <span className="hidden sm:block text-[10px] font-mono text-[#0AC8B9] border border-[#0AC8B9]/20 px-2 py-0.5 rounded-sm">
            {season}
          </span>
          {/* Mobile menu */}
          <button
            className="md:hidden text-[#5B7A8C] hover:text-[#C89B3C] transition-colors"
            onClick={() => setMenuOpen(p => !p)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#1E2D3D] bg-[#010A13]">
          {LINKS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setView(id); setMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-5 py-3 text-xs font-['Cinzel'] tracking-widest transition-colors ${
                view === id ? "text-[#C89B3C] bg-[#0A1428]" : "text-[#5B7A8C]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
