import { useState } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { HomeView } from "@/views/HomeView";
import { ProfileView } from "@/views/ProfileView";
import { ChampionsView } from "@/views/ChampionsView";
import { LeaderboardView } from "@/views/LeaderboardView";
import { TierListView } from "@/views/TierListView";
import { PatchView } from "@/views/PatchView";
import type { Region } from "@/api/types";

export type View = "home" | "profile" | "champions" | "leaderboard" | "tierlist" | "patch";

interface ProfileParams {
  gameName: string;
  tagLine: string;
  region: Region;
}

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
        {view === "tierlist" && <TierListView />}
        {view === "patch" && <PatchView />}
      </main>
      <Footer />
    </div>
  );
}
