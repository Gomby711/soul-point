// Inline SVG role icons sourced from CommunityDragon
// Paths extracted from rcp-fe-lol-champ-select position SVGs

interface RoleIconProps {
  role: string;
  size?: number;
  // primary fill color; secondary is the same at 30% opacity
  color?: string;
}

const ICONS: Record<string, (color: string) => React.ReactNode> = {
  All: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Six-armed asterisk — fill / all-positions icon */}
      <g fill={color}>
        <rect x="15.5" y="3"  width="3" height="28" rx="1.5" />
        <rect x="15.5" y="3"  width="3" height="28" rx="1.5" transform="rotate(60  17 17)" />
        <rect x="15.5" y="3"  width="3" height="28" rx="1.5" transform="rotate(120 17 17)" />
        <circle cx="17" cy="17" r="3" />
      </g>
    </svg>
  ),
  Top: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillOpacity="0.35" fill={color} fillRule="evenodd"
        d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z" />
      <polygon fill={color}
        points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4" />
    </svg>
  ),
  Jungle: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill={color} fillRule="evenodd"
        d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z" />
    </svg>
  ),
  Mid: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillOpacity="0.35" fill={color} fillRule="evenodd"
        d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z" />
      <polygon fill={color}
        points="25 4 4 25 4 30 9 30 30 9 30 4 25 4" />
    </svg>
  ),
  ADC: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillOpacity="0.35" fill={color} fillRule="evenodd"
        d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z" />
      <polygon fill={color}
        points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955" />
    </svg>
  ),
  Support: color => (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill={color} fillRule="evenodd"
        d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z" />
    </svg>
  ),
};

export function RoleIcon({ role, size = 24, color = "#C8AA6E" }: RoleIconProps) {
  const render = ICONS[role];
  if (!render) return null;
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      aria-label={role}
    >
      {render(color)}
    </span>
  );
}

// Pill badge: icon on a role-tinted circle
const ROLE_COLORS: Record<string, string> = {
  All:     "#C89B3C",
  Top:     "#C89B3C",
  Jungle:  "#0AC8B9",
  Mid:     "#9AA4DB",
  ADC:     "#FF4E50",
  Support: "#F178B6",
};

export function RoleBadge({ role, size = 22 }: { role: string; size?: number }) {
  const accent = ROLE_COLORS[role] ?? "#5B7A8C";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 select-none"
      style={{
        width: size, height: size,
        background: accent + "2a",
        border: `1.5px solid ${accent}88`,
        boxShadow: `0 0 6px ${accent}44`,
      }}
      aria-label={role}
    >
      <RoleIcon role={role} size={Math.round(size * 0.6)} color={accent} />
    </span>
  );
}

export { ROLE_COLORS };
