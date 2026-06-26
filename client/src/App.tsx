import { useState, useEffect, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { HomeView } from "@/views/HomeView";
import { ProfileView } from "@/views/ProfileView";
import { ChampionsView } from "@/views/ChampionsView";
import { LeaderboardView } from "@/views/LeaderboardView";
import { TierListView } from "@/views/TierListView";
import { PatchView } from "@/views/PatchView";
import { fetchCrawlStatus } from "@/api/client";
import type { Region } from "@/api/types";

export type View = "home" | "profile" | "champions" | "leaderboard" | "tierlist" | "patch";

interface ProfileParams {
  gameName: string;
  tagLine: string;
  region: Region;
}

// ── Error Boundary ────────────────────────────────────────────

interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack?.split("\n")[1]);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-screen-xl mx-auto px-4 py-16 text-center">
          <div className="inline-block border border-[#FF4E5044] bg-[#FF4E5008] p-8 max-w-md">
            <div className="text-[#FF4E50] font-['Cinzel'] font-bold text-sm mb-2 uppercase tracking-widest">
              Render Error
            </div>
            <div className="text-[#5B7A8C] text-xs mb-4 font-mono">
              {this.state.error?.message ?? "Unknown error"}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-[10px] font-['Cinzel'] tracking-widest uppercase border border-[#C89B3C] text-[#C89B3C] hover:bg-[#C89B3C]/10 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Crawl Notification ────────────────────────────────────────

interface CrawlNotif {
  id: number;
  message: string;
  detail: string;
}

function CrawlNotifications() {
  const [notifs, setNotifs] = useState<CrawlNotif[]>([]);
  const prevState = useRef<string>("idle");
  const prevChamps = useRef<number>(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await fetchCrawlStatus();

        if (prevState.current === "running" && s.state === "done") {
          setNotifs(n => [...n, {
            id: Date.now(),
            message: `Crawl Complete — ${s.champsCovered} Champions Updated`,
            detail: `${s.matchesInDB.toLocaleString()} matches in database across all regions`,
          }]);
        }

        if (s.state === "running" && s.champsCovered > prevChamps.current && s.champsCovered > 0 && prevChamps.current === 0) {
          setNotifs(n => [...n, {
            id: Date.now(),
            message: `Crawl Running — ${s.region} in Progress`,
            detail: `${s.processedMatches}/${s.totalMatches} matches · ${s.champsCovered} champs so far`,
          }]);
        }

        prevState.current = s.state;
        prevChamps.current = s.champsCovered;
      } catch { /* server not reachable */ }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (id: number) => setNotifs(n => n.filter(x => x.id !== id));

  if (notifs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifs.map(n => (
        <div
          key={n.id}
          className="border border-[#C89B3C44] bg-[#040D18] px-4 py-3 shadow-xl flex gap-3 items-start"
          style={{ animation: "fadeInUp 0.3s ease" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-['Cinzel'] font-bold text-[#C89B3C] tracking-wider">
              {n.message}
            </div>
            <div className="text-[10px] text-[#5B7A8C] mt-0.5">{n.detail}</div>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            className="text-[#3A4A5A] hover:text-[#C89B3C] transition-colors text-lg leading-none shrink-0 mt-0.5"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  const [view, setView]                     = useState<View>("home");
  const [profileParams, setProfile]         = useState<ProfileParams | null>(null);
  const [selectedChampionId, setChampionId] = useState<string | null>(null);

  const handleSearch = (gameName: string, tagLine: string, region: Region) => {
    setProfile({ gameName, tagLine, region });
    setView("profile");
  };

  const handleSetView = (v: View) => {
    if (v !== "champions") setChampionId(null);
    setView(v);
  };

  const handleSelectChampion = (id: string) => {
    setChampionId(id);
    setView("champions");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar view={view} setView={handleSetView} />
      <main className="flex-1">
        <ErrorBoundary key={view + (profileParams?.gameName ?? "")}>
          {view === "home" && (
            <HomeView onSearch={handleSearch} onSelectChampion={handleSelectChampion} />
          )}
          {view === "profile" && profileParams && (
            <ProfileView
              gameName={profileParams.gameName}
              tagLine={profileParams.tagLine}
              region={profileParams.region}
              onSearch={handleSearch}
            />
          )}
          {view === "champions" && (
            <ChampionsView
              initialChampionId={selectedChampionId}
              onNavigateToChampion={handleSelectChampion}
            />
          )}
          {view === "leaderboard" && <LeaderboardView onSearch={handleSearch} />}
          {view === "tierlist" && <TierListView onSelectChampion={handleSelectChampion} />}
          {view === "patch" && <PatchView />}
        </ErrorBoundary>
      </main>
      <Footer />
      <CrawlNotifications />
    </div>
  );
}
