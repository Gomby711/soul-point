import { cn } from "@/lib/utils";

interface OrnatePanelProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
}

export function OrnatePanel({ children, className, accent = false, style }: OrnatePanelProps) {
  return (
    <div
      className={cn("lol-panel lol-panel-tr relative", className)}
      style={{ borderColor: accent ? "#785A28" : "#1E2D3D", ...style }}
    >
      {children}
    </div>
  );
}
