import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RANK_META: Record<string, { color: string; glow: string; gradient: string }> = {
  IRON:        { color: "#6B5A4E", glow: "#6B5A4E44", gradient: "from-[#3a2e28] to-[#1a1410]" },
  BRONZE:      { color: "#A0522D", glow: "#A0522D44", gradient: "from-[#3d2010] to-[#1a0a04]" },
  SILVER:      { color: "#8DA5B4", glow: "#8DA5B444", gradient: "from-[#1e3040] to-[#0a1820]" },
  GOLD:        { color: "#C89B3C", glow: "#C89B3C44", gradient: "from-[#2a1f08] to-[#0f0a02]" },
  PLATINUM:    { color: "#00B98D", glow: "#00B98D44", gradient: "from-[#0a2820] to-[#021008]" },
  EMERALD:     { color: "#00D68F", glow: "#00D68F44", gradient: "from-[#0a2818] to-[#021008]" },
  DIAMOND:     { color: "#9AA4DB", glow: "#9AA4DB44", gradient: "from-[#1a1e40] to-[#080a1a]" },
  MASTER:      { color: "#F178B6", glow: "#F178B644", gradient: "from-[#2a1025] to-[#10040f]" },
  GRANDMASTER: { color: "#E84057", glow: "#E8405744", gradient: "from-[#2a0a10] to-[#100204]" },
  CHALLENGER:  { color: "#F4E070", glow: "#F4E07044", gradient: "from-[#1e1a00] to-[#080600]" },
};

export const QUEUE_NAMES: Record<number, string> = {
  420: "Ranked Solo",
  440: "Ranked Flex",
  450: "ARAM",
  400: "Normal Draft",
  430: "Normal Blind",
  900: "URF",
  1700: "Arena",
  1900: "ARAM Mayhem",
  83: "Co-op vs AI",
  700: "Clash",
};

export const REGION_TO_PLATFORM: Record<string, string> = {
  NA:  "na1",
  EUW: "euw1",
  EUNE: "eune1",
  KR:  "kr",
  BR:  "br1",
  LAN: "la1",
  LAS: "la2",
  OCE: "oc1",
  TR:  "tr1",
  RU:  "ru",
  JP:  "jp1",
};

export function rankColor(tier: string): string {
  return RANK_META[tier?.toUpperCase()]?.color ?? "#aaa";
}

export function winRateColor(wr: number): string {
  if (wr >= 55) return "#0AC8B9";
  if (wr >= 50) return "#C89B3C";
  if (wr >= 47) return "#A0B4C8";
  return "#FF4E50";
}

export function kdaRatio(k: number, d: number, a: number): string {
  if (d === 0) return "Perfect";
  return ((k + a) / d).toFixed(2);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  return `${day} days ago`;
}

export function getMultiKillLabel(participant: { doubleKills: number; tripleKills: number; quadraKills: number; pentaKills: number }): string {
  if (participant.pentaKills > 0) return "Penta Kill";
  if (participant.quadraKills > 0) return "Quadra Kill";
  if (participant.tripleKills > 0) return "Triple Kill";
  if (participant.doubleKills > 0) return "Double Kill";
  return "";
}
