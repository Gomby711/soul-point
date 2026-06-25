import { useState, useEffect, useCallback } from "react";
import { Zap, Play, RefreshCw, Search, Trophy, Shield, Flame, ChevronDown } from "lucide-react";
import { OrnatePanel } from "@/components/common/OrnatePanel";
import { ItemSlot } from "@/components/common/ItemSlot";
import { ChampPortrait } from "@/components/common/ChampPortrait";
import {
  fetchCrawlStatus, startCrawl,
  fetchSPChampions, fetchSPChampionBuilds,
  type CrawlStatus, type ChampionSoulPoint, type SoulPointBuild,
} from "@/api/client";

// ── Rune path icon color ──────────────────────────────────────
const PATH_COLOR: Record<number, string> = {
  8000: "#C89B3C",
  8100: "#E74C3C",
  8200: "#9B59B6",
  8300: "#2ECC71",
  8400: "#1ABC9C",
};

function RuneBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="text-[9px] font-['Cinzel'] tracking-widest px-1.5 py-0.5 font-bold"
      style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}
    >
      {name.toUpperCase()}
    </span>
  );
}

function SoulScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const col = score >= 0.6 ? "#0AC8B9" : score >= 0.45 ? "#C89B3C" : "#FF4E50";
  return (
    <div>
      <div className="flex justify-between text-[9px] font-['Cinzel'] mb-0.5">
        <span className="text-[#5B7A8C] tracking-widest">SOUL POINT</span>
        <span className="font-mono font-bold" style={{ color: col }}>{pct}</span>
      </div>
      <div className="h-1 bg-[#1E2D3D] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
      </div>
    </div>
  );
}

const RANK_CONFIG = {
  1: { icon: Trophy, glow: "#C89B3C", label: "gold" },
  2: { icon: Shield, glow: "#A0B4C8", label: "silver" },
  3: { icon: Flame,  glow: "#CD7F32", label: "bronze" },
} as const;

function BuildCard({ build }: { build: SoulPointBuild }) {
  const { icon: RankIcon, glow } = RANK_CONFIG[build.rank as 1 | 2 | 3];
  const wr = Math.round(build.winRate * 100);
  const pr = Math.round(build.pickRate * 100);

  return (
    <OrnatePanel className="p-4 relative overflow-hidden" accent={build.rank === 1}>
      {/* Rank badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <RankIcon className="w-3.5 h-3.5" style={{ color: glow }} />
        <span className="text-[9px] font-['Cinzel'] font-bold" style={{ color: glow }}>#{build.rank}</span>
      </div>

      {/* Label */}
      <div
        className="text-[10px] font-['Cinzel'] tracking-widest font-bold mb-3 pr-10"
        style={{ color: build.rank === 1 ? "#C89B3C" : "#A0B4C8" }}
      >
        {build.label.toUpperCase()}
      </div>

      {/* Items */}
      <div className="mb-3">
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] mb-1.5">CORE BUILD</div>
        <div className="flex gap-1.5 flex-wrap">
          {build.coreItems.map((id, i) => (
            <ItemSlot key={i} itemId={id} size={36} />
          ))}
          {build.coreItems.length === 0 && (
            <span className="text-[10px] text-[#5B7A8C] font-['Cinzel']">No items</span>
          )}
        </div>
      </div>

      {/* Runes */}
      <div className="mb-3">
        <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] mb-1.5">RUNE PAGE</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-['Cinzel'] font-bold"
            style={{ color: PATH_COLOR[build.primaryPath] ?? "#C8AA6E" }}
          >
            {build.keystoneName}
          </span>
          <span className="text-[#1E2D3D]">·</span>
          <RuneBadge name={build.primaryPathName} color={PATH_COLOR[build.primaryPath] ?? "#C8AA6E"} />
          <span className="text-[9px] text-[#5B7A8C] font-['Cinzel']">+</span>
          <RuneBadge name={build.secondaryPathName} color={PATH_COLOR[build.secondaryPath] ?? "#A0B4C8"} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C]">WIN RATE</div>
          <div className="font-mono font-bold text-sm" style={{ color: wr >= 54 ? "#0AC8B9" : wr >= 50 ? "#C89B3C" : "#FF4E50" }}>
            {wr}%
          </div>
          <div className="text-[10px] text-[#5B7A8C] font-mono">{build.wins}W {build.losses}L</div>
        </div>
        <div>
          <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C]">PICK RATE</div>
          <div className="font-mono font-bold text-sm text-[#A0B4C8]">{pr}%</div>
          <div className="text-[10px] text-[#5B7A8C] font-mono">{build.games} games</div>
        </div>
      </div>

      <SoulScoreBar score={build.soulPointScore} />
    </OrnatePanel>
  );
}

function CrawlPanel({
  status,
  onStart,
}: {
  status: CrawlStatus | null;
  onStart: (opts: { region: string; playerCount: number; matchesPerPlayer: number }) => void;
}) {
  const [region, setRegion]   = useState("NA");
  const [players, setPlayers] = useState(50);
  const [matches, setMatches] = useState(10);
  const [showCfg, setShowCfg] = useState(false);

  const running = status?.state === "running";

  const estimateMins = Math.ceil(
    (3 + players + players * matches) * 1.8 / 60
  );

  return (
    <OrnatePanel className="p-5 mb-6" accent>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Title */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#C89B3C]" />
            <h2 className="font-['Cinzel'] font-bold text-base text-[#C8AA6E] tracking-widest">
              SOUL POINT CRAWLER
            </h2>
          </div>
          <p className="text-[11px] text-[#5B7A8C] font-['Cinzel']">
            Seeds from Challenger / Grandmaster / Master players, crawls Match-v5 history,
            then runs the Soul Point Formula to rank the top 3 builds per champion.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCfg(p => !p)}
            className="flex items-center gap-1 text-[10px] font-['Cinzel'] tracking-widest text-[#5B7A8C] border border-[#1E2D3D] px-3 py-2 hover:border-[#785A28] hover:text-[#A0B4C8] transition-colors"
          >
            CONFIG <ChevronDown className={`w-3 h-3 transition-transform ${showCfg ? "rotate-180" : ""}`} />
          </button>
          <button
            disabled={running}
            onClick={() => onStart({ region, playerCount: players, matchesPerPlayer: matches })}
            className="flex items-center gap-2 px-5 py-2 text-[10px] font-['Cinzel'] font-bold tracking-widest text-[#010A13] transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: running ? "#785A28" : "linear-gradient(135deg,#C89B3C,#785A28)" }}
          >
            {running ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />CRAWLING...</>
            ) : (
              <><Play className="w-3.5 h-3.5" />RUN CRAWLER</>
            )}
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showCfg && (
        <div className="mt-4 pt-4 border-t border-[#1E2D3D] grid grid-cols-3 gap-4">
          <div>
            <label className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] block mb-1">REGION</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full bg-[#0A1428] border border-[#785A28] text-[#C8AA6E] text-xs font-['Cinzel'] px-2 py-1.5 focus:outline-none focus:border-[#C89B3C]"
            >
              {["NA", "EUW", "EUNE", "KR", "BR"].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] block mb-1">
              PLAYERS (max 300)
            </label>
            <input
              type="number"
              min={10} max={300}
              value={players}
              onChange={e => setPlayers(Math.min(300, Math.max(10, Number(e.target.value))))}
              className="w-full bg-[#0A1428] border border-[#785A28] text-[#C8AA6E] text-xs font-['Cinzel'] px-2 py-1.5 focus:outline-none focus:border-[#C89B3C]"
            />
          </div>
          <div>
            <label className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] block mb-1">
              MATCHES / PLAYER (max 20)
            </label>
            <input
              type="number"
              min={5} max={20}
              value={matches}
              onChange={e => setMatches(Math.min(20, Math.max(5, Number(e.target.value))))}
              className="w-full bg-[#0A1428] border border-[#785A28] text-[#C8AA6E] text-xs font-['Cinzel'] px-2 py-1.5 focus:outline-none focus:border-[#C89B3C]"
            />
          </div>
          <div className="col-span-3 text-[9px] text-[#5B7A8C] font-mono">
            Est. ~{estimateMins} min · ~{players + players * matches} API calls · rate-limited to ~{Math.floor(60/1.8)} req/min
          </div>
        </div>
      )}

      {/* Progress */}
      {status && status.state !== "idle" && (
        <div className="mt-4 pt-4 border-t border-[#1E2D3D]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-['Cinzel'] text-[#A0B4C8]">{status.message}</span>
            <span className="text-[10px] font-mono text-[#C89B3C]">{status.progress}%</span>
          </div>
          <div className="h-1.5 bg-[#1E2D3D] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${status.progress}%`,
                background: status.state === "error"
                  ? "#FF4E50"
                  : "linear-gradient(90deg,#785A28,#C89B3C)",
              }}
            />
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            {[
              { label: "Players",  val: `${status.processedPlayers}/${status.totalPlayers}` },
              { label: "New matches", val: `${status.processedMatches}/${status.totalMatches}` },
              { label: "DB total", val: status.matchesInDB.toLocaleString() },
              { label: "Champions", val: status.champsCovered },
            ].map(({ label, val }) => (
              <div key={label}>
                <span className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C]">{label.toUpperCase()} </span>
                <span className="text-[10px] font-mono text-[#C8AA6E]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </OrnatePanel>
  );
}

// ── Formula explainer ─────────────────────────────────────────

function FormulaPanel() {
  return (
    <OrnatePanel className="p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="hex-clip w-6 h-6 flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#C89B3C,#785A28)" }}
        >
          <Zap className="w-3 h-3 text-[#010A13]" />
        </div>
        <h3 className="font-['Cinzel'] font-bold text-xs tracking-widest text-[#C8AA6E]">
          SOUL POINT FORMULA™
        </h3>
      </div>
      <div
        className="font-mono text-sm text-center py-3 px-4 border border-[#785A28]/30 mb-3"
        style={{ background: "rgba(200,155,60,0.04)" }}
      >
        <span style={{ color: "#C89B3C" }}>SPF</span>
        <span className="text-[#A0B4C8]">(build) = </span>
        <span style={{ color: "#0AC8B9" }}>0.60</span>
        <span className="text-[#A0B4C8]">·WR + </span>
        <span style={{ color: "#9B59B6" }}>0.25</span>
        <span className="text-[#A0B4C8]">·nPR + </span>
        <span style={{ color: "#1ABC9C" }}>0.15</span>
        <span className="text-[#A0B4C8]">·CF</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-['Cinzel']">
        {[
          { sym: "WR", col: "#0AC8B9",  label: "Win Rate",       desc: "Primary signal — wins ÷ total games" },
          { sym: "nPR", col: "#9B59B6", label: "Pick Rate",       desc: "Normalized popularity vs other builds" },
          { sym: "CF",  col: "#1ABC9C", label: "Confidence",      desc: "log(games+1)/log(16) — rewards data depth" },
        ].map(({ sym, col, label, desc }) => (
          <div key={sym} className="border border-[#1E2D3D] p-2.5">
            <div className="font-mono font-bold text-sm mb-0.5" style={{ color: col }}>{sym}</div>
            <div className="tracking-widest text-[#C8AA6E] mb-0.5">{label}</div>
            <div className="text-[#5B7A8C] text-[9px]">{desc}</div>
          </div>
        ))}
      </div>
    </OrnatePanel>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function SoulPointView() {
  const [status, setStatus]           = useState<CrawlStatus | null>(null);
  const [champions, setChampions]     = useState<string[]>([]);
  const [selected, setSelected]       = useState<string>("");
  const [search, setSearch]           = useState("");
  const [builds, setBuilds]           = useState<ChampionSoulPoint | null>(null);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [buildsError, setBuildsError] = useState<string | null>(null);

  // Poll crawler status
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const poll = () => {
      fetchCrawlStatus()
        .then(s => {
          setStatus(s);
          if (s.champsCovered > 0 && champions.length === 0) {
            fetchSPChampions().then(setChampions).catch(() => {});
          }
        })
        .catch(() => {});
    };
    poll();
    id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [champions.length]);

  // When champion is selected, load builds
  const selectChampion = useCallback(async (name: string) => {
    setSelected(name);
    setBuilds(null);
    setBuildsError(null);
    if (!name) return;
    setLoadingBuilds(true);
    try {
      const data = await fetchSPChampionBuilds(name);
      setBuilds(data);
    } catch (e) {
      setBuildsError((e as Error).message);
    } finally {
      setLoadingBuilds(false);
    }
  }, []);

  const handleStart = async (opts: { region: string; playerCount: number; matchesPerPlayer: number }) => {
    try {
      await startCrawl(opts);
    } catch (e) {
      console.error("Failed to start crawl:", e);
    }
  };

  const filtered = champions.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const hasData = (status?.champsCovered ?? 0) > 0 || champions.length > 0;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="hex-clip w-8 h-8 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#C89B3C,#785A28)" }}
          >
            <Zap className="w-4 h-4 text-[#010A13]" />
          </div>
          <h1 className="font-['Cinzel'] font-black text-2xl gold-text tracking-widest">
            SOUL POINT ALGORITHM
          </h1>
        </div>
        <p className="text-[11px] text-[#5B7A8C] font-['Cinzel'] tracking-wider pl-11">
          Proprietary build-ranking engine powered by high-elo match crawling · Master → Grandmaster → Challenger
        </p>
      </div>

      <CrawlPanel status={status} onStart={handleStart} />
      <FormulaPanel />

      {/* Champion picker + build display */}
      {!hasData && (
        <OrnatePanel className="p-10 text-center">
          <Zap className="w-8 h-8 text-[#785A28] mx-auto mb-3" />
          <div className="font-['Cinzel'] text-sm text-[#5B7A8C] tracking-wider">
            No data yet — run the crawler to seed the Soul Point database.
          </div>
          <div className="font-['Cinzel'] text-[10px] text-[#2E4A5C] mt-2">
            Start with 50 players × 10 matches for a quick preview (~12 min with dev key)
          </div>
        </OrnatePanel>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Champion list */}
          <div className="lg:col-span-1">
            <OrnatePanel className="p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5B7A8C]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search champion..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0A1428] border border-[#785A28] text-[#C8AA6E] text-xs font-['Cinzel'] tracking-wider focus:outline-none focus:border-[#C89B3C] transition-colors"
                />
              </div>
              <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C] mb-2">
                {filtered.length} CHAMPIONS WITH DATA
              </div>
              <div className="max-h-[520px] overflow-y-auto space-y-px">
                {filtered.map(c => (
                  <button
                    key={c}
                    onClick={() => selectChampion(c)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-all ${
                      selected === c
                        ? "bg-[#C89B3C]/10 text-[#C89B3C]"
                        : "text-[#5B7A8C] hover:bg-[#0A1428] hover:text-[#A0B4C8]"
                    }`}
                  >
                    <ChampPortrait championName={c} size={28} ring={selected === c} />
                    <span className="font-['Cinzel'] text-[11px] tracking-wide">{c}</span>
                  </button>
                ))}
              </div>
            </OrnatePanel>
          </div>

          {/* Build cards */}
          <div className="lg:col-span-3">
            {!selected && (
              <OrnatePanel className="p-10 text-center h-full flex flex-col items-center justify-center">
                <Trophy className="w-8 h-8 text-[#785A28] mb-3" />
                <div className="font-['Cinzel'] text-sm text-[#5B7A8C] tracking-wider">
                  Select a champion to see their Soul Point build rankings.
                </div>
              </OrnatePanel>
            )}

            {loadingBuilds && (
              <OrnatePanel className="p-10 text-center">
                <div className="text-[#C89B3C] font-['Cinzel'] text-sm animate-pulse">
                  Computing Soul Point rankings...
                </div>
              </OrnatePanel>
            )}

            {buildsError && (
              <OrnatePanel className="p-8 text-center">
                <div className="text-[#FF4E50] font-['Cinzel'] text-sm">{buildsError}</div>
              </OrnatePanel>
            )}

            {builds && !loadingBuilds && (
              <>
                {/* Champion header */}
                <div className="flex items-center gap-3 mb-4">
                  <ChampPortrait championName={builds.champion} size={52} ring />
                  <div>
                    <h2 className="font-['Cinzel'] font-black text-xl text-[#C8AA6E]">
                      {builds.champion}
                    </h2>
                    <div className="text-[10px] text-[#5B7A8C] font-['Cinzel'] tracking-wider">
                      {builds.totalGames.toLocaleString()} RANKED SOLO GAMES ANALYZED ·{" "}
                      {builds.builds.length} BUILDS RANKED
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[9px] font-['Cinzel'] tracking-widest text-[#5B7A8C]">DATA SOURCE</div>
                    <div className="text-[10px] font-['Cinzel'] text-[#C89B3C]">M/GM/CHALLENGER</div>
                    <div className="text-[9px] font-mono text-[#2E4A5C]">
                      {new Date(builds.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {builds.builds.length === 0 ? (
                  <OrnatePanel className="p-8 text-center">
                    <div className="text-[#5B7A8C] font-['Cinzel'] text-xs">
                      Not enough data yet for this champion. Run a larger crawl.
                    </div>
                  </OrnatePanel>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {builds.builds.map(b => (
                      <BuildCard key={b.rank} build={b} />
                    ))}
                  </div>
                )}

                {/* Methodology note */}
                <div className="mt-4 border border-[#1E2D3D] px-4 py-2.5">
                  <div className="text-[9px] text-[#2E4A5C] font-['Cinzel'] tracking-wide">
                    Soul Point rankings use only builds with ≥5 games. Build paths are normalized by keystone + core 3 items (boots excluded).
                    Confidence factor prevents small samples from gaming the ranking.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
