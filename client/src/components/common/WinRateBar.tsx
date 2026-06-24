import { winRateColor } from "@/lib/utils";

interface WinRateBarProps {
  wins: number;
  losses: number;
  small?: boolean;
}

export function WinRateBar({ wins, losses, small = false }: WinRateBarProps) {
  const total = wins + losses;
  const wr = total === 0 ? 0 : Math.round((wins / total) * 100);
  const color = winRateColor(wr);
  return (
    <div>
      <div className={`flex justify-between mb-1 ${small ? "text-[10px]" : "text-xs"}`}>
        <span className="text-muted-foreground">{wins}W {losses}L</span>
        <span className="font-mono font-bold" style={{ color }}>{wr}%</span>
      </div>
      <div className={`${small ? "h-0.5" : "h-1"} bg-[#1E2D3D] rounded-full overflow-hidden`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${wr}%`, background: color }} />
      </div>
    </div>
  );
}
