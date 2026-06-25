import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import App from "@/App";
import { getDragonVersion } from "@/api/client";
import { preloadRuneData } from "@/hooks/useRuneData";
import { preloadAllSPBuilds } from "@/views/ChampionBuildSubPage";

// Pre-warm caches so champion builds/runes show instantly on first click
getDragonVersion();
preloadRuneData();
preloadAllSPBuilds();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
