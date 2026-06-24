import { rankColor } from "@/lib/utils";

interface TierBadgeProps {
  tier: string;
  rank?: string;
  small?: boolean;
}

export function TierBadge({ tier, rank, small = false }: TierBadgeProps) {
  const col = rankColor(tier);
  const label = rank ? `${tier} ${rank}` : tier;
  return (
    <span
      className={`font-['Cinzel'] font-bold tracking-widest ${small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"} rounded-sm`}
      style={{ color: col, background: col + "18", border: `1px solid ${col}44`, letterSpacing: "0.12em" }}
    >
      {label}
    </span>
  );
}
