import { cn } from "@/lib/utils";

interface OrnatePanelProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function OrnatePanel({ children, className, accent = false, style, onClick }: OrnatePanelProps) {
  return (
    <div
      className={cn("lol-panel lol-panel-tr relative", className)}
      style={{ borderColor: accent ? "#785A28" : "#1E2D3D", ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
