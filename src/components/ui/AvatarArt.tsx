import type { AvatarStyle } from "@/game/avatar";

/** Glyphs on a 24x24 grid, drawn with the foreground colour. */
function Glyph({ id, fg, bg }: { id: AvatarStyle["template"]; fg: string; bg: string }) {
  const s = { fill: fg } as const, st = { fill: "none", stroke: fg, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (id) {
    case "helmet": return <g><path {...s} d="M12 3.5a8 8 0 0 0-8 8v3.5a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 15v-3.5a8 8 0 0 0-8-8z" /><rect x="6.6" y="8.6" width="10.8" height="6.2" rx="3.1" fill={bg} /><path d="M8.6 10.2a2.2 1.2 0 0 1 3-.3" stroke={fg} strokeWidth="1" fill="none" opacity=".7" /></g>;
    case "rocket": return <g><path {...s} d="M12 2.5c3 2 4.6 5.2 4.6 9.2l-1.6 3.3H9L7.4 11.7c0-4 1.6-7.2 4.6-9.2z" /><circle cx="12" cy="9.6" r="1.9" fill={bg} /><path {...s} d="M7.6 12.2 4.8 15.6l3.4-.6zM16.4 12.2l2.8 3.4-3.4-.6z" /><path d="M10.2 16.2c.2 2.2.9 3.6 1.8 4.6.9-1 1.6-2.4 1.8-4.6z" fill="#FF8C42" /></g>;
    case "planet": return <g><circle cx="12" cy="12" r="5.2" {...s} /><ellipse cx="12" cy="12" rx="9.4" ry="3" {...st} transform="rotate(-22 12 12)" /><path d="M7.6 10.2c2.6.8 5.6.4 8.4-1" stroke={bg} strokeWidth="1.1" fill="none" opacity=".55" /></g>;
    case "moon": return <g><path {...s} d="M17.6 15.4A7.6 7.6 0 1 1 10.1 4.6a6 6 0 0 0 7.5 10.8z" /><circle cx="9" cy="11" r="1.2" fill={bg} opacity=".5" /><circle cx="11.4" cy="15.4" r=".9" fill={bg} opacity=".5" /></g>;
    case "star": return <path {...s} d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />;
    case "satellite": return <g><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" {...s} transform="rotate(45 12 12)" /><path {...s} d="M3 6.5l5 5-2.2 2.2-5-5zM21 17.5l-5-5 2.2-2.2 5 5z" /><path d="M13.6 14.2l3.2 3.2" stroke={fg} strokeWidth="1.2" /></g>;
    case "comet": return <g><circle cx="16.6" cy="7.4" r="3.4" {...s} /><path d="M14.4 9.6 4 20M13 8.4 3.6 14.2M15.8 11 10 20.4" stroke={fg} strokeWidth="1.5" strokeLinecap="round" opacity=".75" /></g>;
    case "alien": return <g><path {...s} d="M12 3.6c4.6 0 7.4 3.4 7.4 7.4 0 3.8-3 8-7.4 9.4C7.6 19 4.6 14.8 4.6 11c0-4 2.8-7.4 7.4-7.4z" /><ellipse cx="9" cy="11.2" rx="1.9" ry="2.6" fill={bg} transform="rotate(-18 9 11.2)" /><ellipse cx="15" cy="11.2" rx="1.9" ry="2.6" fill={bg} transform="rotate(18 15 11.2)" /></g>;
    default: return null;
  }
}

const HEX = "50,3 93,26 93,74 50,97 7,74 7,26";
/** Renders a (customised) profile picture. `initial` shows the first letter of the name. */
export function AvatarArt({ style, name, size = 64 }: { style: AvatarStyle; name: string; size?: number }) {
  const { template, bg, fg, frame, shape } = style;
  const clip = shape === "circle" ? <circle cx="50" cy="50" r="40" /> : shape === "rounded" ? <rect x="10" y="10" width="80" height="80" rx="22" /> : <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" />;
  const id = `av-${shape}-${template}-${bg.slice(1)}`;
  return (
    <svg role="img" aria-label={`${name} profile picture`} width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs><clipPath id={id}>{clip}</clipPath><linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg} /><stop offset="1" stopColor={bg} stopOpacity=".72" /></linearGradient></defs>
      <g clipPath={`url(#${id})`}><rect width="100" height="100" fill={`url(#${id}-g)`} />
        <ellipse cx="38" cy="26" rx="34" ry="20" fill="#fff" opacity=".14" />
        {template === "initial" ? <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="44" fontWeight="700" fill={fg} fontFamily="inherit">{name[0]}</text>
          : <g transform="translate(22 22) scale(2.33)"><Glyph id={template} fg={fg} bg={bg} /></g>}
      </g>
      {frame !== "none" && (shape === "circle" ? <circle cx="50" cy="50" r="43" fill="none" stroke={fg} strokeWidth="3" opacity=".9" /> : shape === "rounded" ? <rect x="7" y="7" width="86" height="86" rx="25" fill="none" stroke={fg} strokeWidth="3" opacity=".9" /> : <polygon points={HEX} fill="none" stroke={fg} strokeWidth="3" opacity=".9" />)}
      {frame === "double" && <circle cx="50" cy="50" r="48" fill="none" stroke={bg} strokeWidth="2" opacity=".9" />}
      {frame === "orbit" && <g><ellipse cx="50" cy="50" rx="48" ry="16" fill="none" stroke={fg} strokeWidth="1.8" opacity=".75" transform="rotate(-24 50 50)" /><circle cx="86" cy="36" r="4" fill="#FFC857" /></g>}
    </svg>
  );
}
