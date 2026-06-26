import { useState } from "react";
import { Search, Globe, ChevronDown } from "lucide-react";
import type { Region } from "@/api/types";

const REGIONS: Region[] = ["NA", "EUW", "EUNE", "KR", "BR", "LAN", "LAS", "OCE", "TR", "RU", "JP"];

interface SearchBarProps {
  onSearch: (name: string, tag: string, region: Region) => void;
  compact?: boolean;
  initialRegion?: Region;
}

export function SearchBar({ onSearch, compact = false, initialRegion = "NA" }: SearchBarProps) {
  const [query, setQuery]             = useState("");
  const [region, setRegion]           = useState<Region>(initialRegion);
  const [showRegions, setShowRegions] = useState(false);

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const [name, tag = "NA1"] = trimmed.split("#");
    onSearch(name.trim(), tag.trim(), region);
  };

  return (
    <div
      className={`flex items-stretch ${compact ? "h-9" : "h-11"} w-full`}
      style={{ maxWidth: compact ? 480 : 680 }}
    >
      {/* Region picker */}
      <div className="relative">
        <button
          onClick={() => setShowRegions(p => !p)}
          className="h-full px-3 flex items-center gap-1.5 border border-r-0 border-[#785A28] bg-[#0A1428] text-[#C8AA6E] text-xs font-['Cinzel'] tracking-wider hover:bg-[#1E2D3D] transition-colors whitespace-nowrap focus:outline-none"
        >
          <Globe className="w-3 h-3" />
          {region}
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </button>
        {showRegions && (
          <div className="absolute top-full left-0 mt-1 bg-[#0A1428] border border-[#785A28] z-50 shadow-xl min-w-[140px] grid grid-cols-2">
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => { setRegion(r); setShowRegions(false); }}
                className={`px-3 py-2 text-xs font-['Cinzel'] tracking-wider text-left hover:bg-[#1E2D3D] transition-colors ${
                  r === region ? "text-[#C89B3C]" : "text-[#A0B4C8]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Game Name#TAG"
        className="flex-1 px-4 bg-[#0A1428] border border-x-0 border-[#785A28] text-[#C8AA6E] placeholder-[#2E4A5C] text-xs font-['Cinzel'] tracking-wider focus:outline-none focus:border-[#C89B3C] transition-colors"
      />

      {/* Search button */}
      <button
        onClick={submit}
        className="px-5 flex items-center gap-2 text-xs font-['Cinzel'] font-bold tracking-widest text-[#010A13] transition-all hover:brightness-110 focus:outline-none"
        style={{ background: "linear-gradient(135deg,#C89B3C,#785A28)" }}
      >
        <Search className="w-3.5 h-3.5" />
        {!compact && "SEARCH"}
      </button>
    </div>
  );
}
