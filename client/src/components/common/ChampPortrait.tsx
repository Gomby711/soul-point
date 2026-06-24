import { useState, useEffect } from "react";
import { getDragonVersion } from "@/api/client";

interface ChampPortraitProps {
  championName: string;
  size?: number;
  ring?: boolean;
  ringColor?: string;
}

const colorMap: Record<string, string> = {
  Ahri: "#f178b6", Jinx: "#e04070", Yasuo: "#6eb5ff", Thresh: "#2ed8b4",
  "Lee Sin": "#e8892a", Lux: "#f9d648", Zed: "#a0a0c0", Vi: "#d06090",
  Caitlyn: "#80c8e0", Darius: "#e03c4a", Ezreal: "#80c0ff", Morgana: "#9070d0",
  Irelia: "#60b0ff", Graves: "#8a6040", Katarina: "#e05060",
};

export function ChampPortrait({ championName, size = 40, ring = false, ringColor }: ChampPortraitProps) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const col = ringColor ?? colorMap[championName] ?? "#C89B3C";
  const r = Math.max(2, size * 0.05);

  useEffect(() => {
    if (!championName) return;
    const normalized = championName.replace(/\s/g, "").replace(/'/g, "").replace(/\./g, "");
    getDragonVersion().then(v => {
      setImgSrc(`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${normalized}.png`);
    });
  }, [championName]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0" style={{ background: col + "33", borderRadius: r }} />
      {imgSrc && (
        <img
          src={imgSrc}
          alt={championName}
          width={size}
          height={size}
          className="relative z-10 object-cover"
          style={{ borderRadius: r, border: ring ? `2px solid ${col}88` : "none" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {!imgSrc && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground"
          style={{ borderRadius: r }}
        >
          {championName?.[0] ?? "?"}
        </div>
      )}
    </div>
  );
}
