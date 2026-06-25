import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import App from "@/App";
import { getDragonVersion } from "@/api/client";
import { preloadRuneData } from "@/hooks/useRuneData";

// Pre-warm caches so champion builds/runes show instantly on first click
getDragonVersion();
preloadRuneData();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
