// Hand-drawn line-art motorcycle (side view, facing right). Pure SVG: no image files.
// `highlight` outlines one part in the brand yellow, like a technical close-up.
// `viewBox` crops it, so the same drawing works as a full shot or a close-up.

const PARTS = {
  engine: { cx: 455, cy: 270, r: 92 },
  tank: { cx: 470, cy: 160, r: 88 },
  wheel: { cx: 620, cy: 330, r: 128 },
};

function Wheel({ cx, cy, front, hl, tone }) {
  const spokes = Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2);
  const rimStroke = hl ? "var(--brand)" : "currentColor";
  return (
    <g>
      <circle cx={cx} cy={cy} r={104} fill="none" stroke="currentColor" strokeWidth={16} opacity={tone === "dark" ? 0.55 : 0.9} />
      <circle cx={cx} cy={cy} r={84} fill="none" stroke={rimStroke} strokeWidth={hl ? 3 : 2.5} />
      <circle cx={cx} cy={cy} r={78} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />
      {spokes.map((a, i) => (
        <line
          key={i}
          x1={cx + Math.cos(a) * 14}
          y1={cy + Math.sin(a) * 14}
          x2={cx + Math.cos(a + (i % 2 ? 0.25 : -0.25)) * 78}
          y2={cy + Math.sin(a + (i % 2 ? 0.25 : -0.25)) * 78}
          stroke={hl ? "var(--brand)" : "currentColor"}
          strokeWidth={1}
          opacity={hl ? 0.9 : 0.55}
        />
      ))}
      <circle cx={cx} cy={cy} r={14} fill="var(--art-fill)" stroke="currentColor" strokeWidth={2} />
      {front && <circle cx={cx} cy={cy} r={40} fill="none" stroke={hl ? "var(--brand)" : "currentColor"} strokeWidth={hl ? 2.5 : 2} strokeDasharray="3 5" />}
    </g>
  );
}

export function BikeArt({ highlight = null, tone = "light", viewBox = "60 60 700 400", className, title = "Motorcycle illustration" }) {
  const hl = (part) => highlight === part;
  const line = (part) => (hl(part) ? "var(--brand)" : "currentColor");
  const focus = highlight && PARTS[highlight];

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      className={className}
      style={{
        "--art-fill": tone === "dark" ? "oklch(0.2 0 0)" : "var(--background)",
        color: tone === "dark" ? "oklch(0.55 0 0)" : "var(--foreground)",
      }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Focus rings behind the highlighted part */}
      {focus && (
        <g className="motion-safe:animate-[pulse_3s_ease-in-out_infinite]">
          <circle cx={focus.cx} cy={focus.cy} r={focus.r} stroke="var(--brand)" strokeOpacity={0.35} strokeWidth={1} />
          <circle cx={focus.cx} cy={focus.cy} r={focus.r * 0.78} stroke="var(--brand)" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 6" />
          <circle cx={focus.cx} cy={focus.cy} r={focus.r * 1.25} stroke="var(--brand)" strokeOpacity={0.15} strokeWidth={1} />
        </g>
      )}

      <Wheel cx={190} cy={330} hl={false} tone={tone} />
      <Wheel cx={620} cy={330} front hl={hl("wheel")} tone={tone} />

      {/* Mudguards */}
      <path d="M 92 286 A 112 112 0 0 1 250 222" stroke="currentColor" strokeWidth={5} />
      <path d="M 540 240 A 118 118 0 0 1 700 250" stroke={line("wheel")} strokeWidth={5} />

      {/* Swingarm and rear shock */}
      <path d="M 340 300 L 190 330" stroke="currentColor" strokeWidth={7} />
      <path d="M 262 306 L 322 196" stroke="currentColor" strokeWidth={5} />
      <path d="M 272 290 L 312 214" stroke="currentColor" strokeWidth={1} strokeDasharray="2 3" />

      {/* Frame */}
      <path d="M 560 158 L 330 190 L 340 300 L 420 334 L 566 196" stroke="currentColor" strokeWidth={6} />

      {/* Forks */}
      <path d="M 620 330 L 548 118" stroke={line("wheel")} strokeWidth={7} />
      <path d="M 610 300 L 572 188" stroke="currentColor" strokeWidth={11} opacity={0.35} />

      {/* Handlebar, mirror */}
      <path d="M 548 118 L 498 100 L 474 104" stroke="currentColor" strokeWidth={5} />
      <path d="M 528 110 L 518 64" stroke="currentColor" strokeWidth={2} />
      <ellipse cx={516} cy={58} rx={14} ry={8} stroke="currentColor" strokeWidth={2} fill="var(--art-fill)" />

      {/* Headlight */}
      <circle cx={604} cy={176} r={24} stroke="currentColor" strokeWidth={3} fill="var(--art-fill)" />
      <circle cx={604} cy={176} r={13} stroke="currentColor" strokeWidth={1.5} />

      {/* Exhaust */}
      <path d="M 492 300 Q 470 346 420 346 L 310 338" stroke="currentColor" strokeWidth={6} />
      <path d="M 318 330 L 226 314 Q 214 321 224 330 L 318 346 Z" stroke="currentColor" strokeWidth={2.5} fill="var(--art-fill)" />

      {/* Engine */}
      <g stroke={line("engine")}>
        <rect x={398} y={214} width={124} height={96} rx={14} strokeWidth={hl("engine") ? 3 : 3} fill="var(--art-fill)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={470} y1={226 + i * 9} x2={512} y2={218 + i * 9} strokeWidth={hl("engine") ? 2 : 1.5} />
        ))}
        <circle cx={440} cy={284} r={22} strokeWidth={hl("engine") ? 2.5 : 2} fill="var(--art-fill)" />
        <circle cx={440} cy={284} r={8} strokeWidth={1.5} />
      </g>

      {/* Tank */}
      <path
        d="M 392 196 C 392 150 430 124 478 122 C 520 120 552 136 558 160 L 540 198 Z"
        stroke={line("tank")}
        strokeWidth={hl("tank") ? 3.5 : 3}
        fill="var(--art-fill)"
      />
      <path d="M 420 168 C 446 150 498 146 530 158" stroke={line("tank")} strokeWidth={1.5} opacity={0.7} />

      {/* Seat and tail */}
      <path d="M 252 172 C 300 160 360 158 398 168 L 394 190 C 350 184 300 186 258 194 Z" stroke="currentColor" strokeWidth={3} fill="var(--art-fill)" />
      <path d="M 196 170 L 256 166 L 262 196 L 214 198 Z" stroke="currentColor" strokeWidth={3} fill="var(--art-fill)" />
      <rect x={186} y={172} width={12} height={10} rx={2} fill="var(--brand)" stroke="none" opacity={highlight ? 0.4 : 0.9} />

      {/* Side cover */}
      <path d="M 336 198 L 392 198 L 386 250 L 346 250 Z" stroke="currentColor" strokeWidth={2.5} fill="var(--art-fill)" />
    </svg>
  );
}
