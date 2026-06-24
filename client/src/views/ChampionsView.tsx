import { useState, useMemo } from "react";
import { Search, ArrowUp, ArrowDown, BookOpen } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { winRateColor } from "@/lib/utils";
import { useChampionData, type PrimaryRole } from "@/hooks/useChampionData";

const ROLES: (PrimaryRole | "All")[] = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];
type Sort = "winRate" | "pickRate" | "banRate" | "tier" | "name";

const TIER_ORDER: Record<string, number> = { "S+": 0, S: 1, "A+": 2, A: 3, B: 4, C: 5 };
const TIER_COLORS: Record<string, string> = {
  "S+": "#F4E070", S: "#C89B3C", "A+": "#0AC8B9", A: "#A0B4C8", B: "#5B7A8C", C: "#3a4a5a",
};

interface ChampionsViewProps {
  onSelectChampion: (id: string) => void;
}

export function ChampionsView({ onSelectChampion }: ChampionsViewProps) {
  const { champions, loading } = useChampionData();
  const [role, setRole]   = useState<PrimaryRole | "All">("All");
  const [sort, setSort]   = useState<Sort>("winRate");
  const [query, setQuery] = useState("");
  const [page, setPage]   = useState(0);
  const PER_PAGE = 50;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return champions
      .filter(c =>
        (role === "All" || c.primaryRole === role) &&
        c.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "tier") return (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
        return (b[sort] as number) - (a[sort] as number);
      });
  }, [champions, role, sort, query]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible    = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleFilter = (r: PrimaryRole | "All") => { setRole(r); setPage(0); };
  const handleQuery  = (q: string)               => { setQuery(q); setPage(0); };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-px w-8" style={{ background: "#C89B3C" }} />
          <h2 className="font-['Cinzel'] font-black text-lg tracking-widest gold-text uppercase">
            Champion Tier List
          </h2>
          <div className="h-px w-8" style={{ background: "#C89B3C" }} />
        </div>
        {!loading && (
          <span className="text-[10px] font-mono text-[#5B7A8C] border border-[#1E2D3D] px-2 py-0.5">
            {champions.length} champions
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B7A8C]" />
            <input
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder="Search champion..."
              className="pl-7 pr-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] placeholder-[#2E4A5C] focus:outline-none focus:border-[#785A28] w-44"
            />
          </div>
          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            className="px-3 py-1.5 bg-[#0A1428] border border-[#1E2D3D] text-xs text-[#C8AA6E] font-['Cinzel'] focus:outline-none focus:border-[#785A28]"
          >
            <option value="winRate">Win Rate</option>
            <option value="pickRate">Pick Rate</option>
            <option value="banRate">Ban Rate</option>
            <option value="tier">Tier</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Role filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r}
            onClick={() => handleFilter(r)}
            className={`px-3 py-1 text-[10px] font-['Cinzel'] tracking-widest uppercase border transition-all ${
              role === r
                ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
            }`}
          >
            {r}
            {r !== "All" && !loading && (
              <span className="ml-1 opacity-50">
                ({champions.filter(c => c.primaryRole === r).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <OrnatePanel className="p-12 text-center">
          <div className="text-[#C89B3C] font-['Cinzel'] text-sm animate-pulse mb-3">
            Loading all champions...
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#C89B3C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </OrnatePanel>
      )}

      {/* Table */}
      {!loading && (
        <>
          <OrnatePanel className="overflow-hidden" accent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#785A28]/40">
                  {["#", "Champion", "Role", "Tier", "Win Rate", "Pick %", "Ban %", "KDA", "Trend", ""].map(h => (
                    <th
                      key={h}
                      className={`px-3 py-3 font-['Cinzel'] tracking-wider text-[#785A28] uppercase ${
                        ["#", "Champion"].includes(h) ? "text-left" : "text-center"
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#1E2D3D] hover:bg-[#0A1428] transition-colors group cursor-pointer"
                    onClick={() => onSelectChampion(c.id)}
                  >
                    <td className="px-3 py-2.5 font-mono text-[#5B7A8C] text-[10px]">
                      {page * PER_PAGE + i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden border border-[#1E2D3D]">
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <div>
                          <div className="font-['Cinzel'] text-[#C8AA6E] group-hover:text-[#F0E6BE] transition-colors leading-tight">
                            {c.name}
                          </div>
                          <div className="text-[9px] text-[#5B7A8C]">{c.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] text-[#5B7A8C] font-['Cinzel']">{c.primaryRole}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="font-['Cinzel'] font-bold text-[10px] px-2 py-0.5"
                        style={{
                          color: TIER_COLORS[c.tier],
                          background: TIER_COLORS[c.tier] + "18",
                          border: `1px solid ${TIER_COLORS[c.tier]}44`,
                        }}
                      >
                        {c.tier}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="font-mono font-bold" style={{ color: winRateColor(c.winRate) }}>
                        {c.winRate.toFixed(1)}%
                      </div>
                      <div className="h-0.5 bg-[#1E2D3D] mt-1 w-12 mx-auto">
                        <div
                          className="h-full"
                          style={{ width: `${(c.winRate - 40) * 10}%`, background: winRateColor(c.winRate) }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[#A0B4C8] text-[11px]">
                      {c.pickRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[#A0B4C8] text-[11px]">
                      {c.banRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-[#C89B3C] text-[11px]">
                      {c.kda}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.trend === "up"
                        ? <ArrowUp className="w-3.5 h-3.5 text-[#0AC8B9] mx-auto" />
                        : <ArrowDown className="w-3.5 h-3.5 text-[#FF4E50] mx-auto" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectChampion(c.id); }}
                        className="flex items-center gap-1 text-[9px] font-['Cinzel'] px-2 py-1 border border-[#1E2D3D] text-[#5B7A8C] hover:border-[#C89B3C] hover:text-[#C89B3C] transition-all opacity-0 group-hover:opacity-100"
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        BUILDS
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[#5B7A8C] font-['Cinzel'] text-xs">
                      No champions match your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </OrnatePanel>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-widest border border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#C89B3C] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ← PREV
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 text-[10px] font-mono border transition-all ${
                      page === i
                        ? "border-[#C89B3C] text-[#C89B3C] bg-[#C89B3C]/10"
                        : "border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 text-[10px] font-['Cinzel'] tracking-widest border border-[#1E2D3D] text-[#5B7A8C] hover:border-[#785A28] hover:text-[#C89B3C] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                NEXT →
              </button>
            </div>
          )}

          <div className="mt-3 text-center text-[10px] text-[#3a4a5a] font-mono">
            Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length} champions
          </div>
        </>
      )}
    </div>
  );
}
