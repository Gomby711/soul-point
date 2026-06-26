import { useState, useEffect } from "react";
import { Sword, Target, Crown, BarChart2, Map, Zap } from "lucide-react";
import type { View } from "@/App";
import { getDragonVersion } from "@/api/client";

interface NavBarProps {
  view: View;
  setView: (v: View) => void;
}

const LINKS: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: "home",        label: "Home",        Icon: Sword },
  { id: "champions",   label: "Champions",   Icon: Target },
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
      // DDragon uses internal season numbering (e.g. 16.13.1) while the game
      // shows year-based patch numbers (26.13). For DDragon major >= 15, add 10.
      const parts = v.split(".");
      const ddragonMajor = parseInt(parts[0], 10);
      const displayMajor = ddragonMajor >= 15 ? ddragonMajor + 10 : ddragonMajor;
      const year = 2010 + ddragonMajor;
      setPatch(`${displayMajor}.${parts[1]}`);
      setSeason(`S${ddragonMajor} ${year}`);
    }).catch(() => { setPatch("26.13"); setSeason("S16 2026"); });
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
      <div className="w-full px-6 flex items-center" style={{ height: "60px" }}>
        {/* Logo — absolute far left */}
        <button onClick={() => setView("home")} className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-8 h-8">
            <div
              className="hex-clip w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#C89B3C,#785A28)" }}
            >
              <Zap className="w-4 h-4 text-[#010A13]" />
            </div>
          </div>
          <span className="font-['Cinzel'] font-black text-xl gold-text tracking-widest">
            SOUL<span className="text-white">POINT</span>
          </span>
        </button>

        {/* Nav links + badges pushed to far right */}
        <div className="ml-auto flex items-center gap-0">
          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center">
            {LINKS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`group flex items-center gap-1.5 px-5 py-2.5 text-sm font-['Cinzel'] tracking-widest transition-all relative ${
                  view === id ? "text-[#C89B3C]" : "text-[#5B7A8C] hover:text-[#A0B4C8]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {view === id && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: "linear-gradient(90deg,transparent,#C89B3C,transparent)" }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-[#1E2D3D] mx-4" />

          {/* Patch + Season badges — far top right */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#C89B3C] border border-[#785A28]/70 bg-[#785A28]/10 px-3 py-1 tracking-widest">
              {patch}
            </span>
            <span className="text-xs font-mono font-bold text-[#0AC8B9] border border-[#0AC8B9]/40 bg-[#0AC8B9]/8 px-3 py-1 tracking-widest">
              {season}
            </span>
          </div>

          {/* Mobile menu */}
          <button
            className="md:hidden text-[#5B7A8C] hover:text-[#C89B3C] transition-colors ml-4"
            onClick={() => setMenuOpen(p => !p)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
