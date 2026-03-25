/**
 * Lightweight SVG illustration — no chart libraries (performance).
 * Depicts the federal STLDI total-duration cap (illustrative; not legal advice).
 */
export type AllstateStldiChartProps = {
  title: string;
  subtitle: string;
  ariaLabel: string;
  footnote: string;
  monthLabels: [string, string, string, string];
  yAxisLabel: string;
};

export default function AllstateStldiChart({
  title,
  subtitle,
  ariaLabel,
  footnote,
  monthLabels,
  yAxisLabel,
}: AllstateStldiChartProps) {
  const barHeights = [72, 72, 72, 48];
  const barX = [56, 136, 216, 296];
  const w = 400;
  const h = 240;

  return (
    <figure
      className="motion-safe:animate-fadeUp-d2 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-inner ring-1 ring-black/5 [content-visibility:auto] sm:p-6"
    >
      <figcaption className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </figcaption>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full max-w-md text-foreground"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id="allstate-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(214 84% 38%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(199 89% 42%)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        <text
          x="8"
          y="128"
          className="fill-muted-foreground text-[11px]"
          transform="rotate(-90 8 128)"
          textAnchor="middle"
        >
          {yAxisLabel}
        </text>

        {barHeights.map((bh, i) => (
          <g key={i}>
            <rect
              x={barX[i]}
              y={180 - bh}
              width="44"
              height={bh}
              rx="6"
              fill="url(#allstate-bar)"
            />
            <text
              x={barX[i] + 22}
              y="206"
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {monthLabels[i]}
            </text>
          </g>
        ))}

        <line
          x1="44"
          y1="180"
          x2="372"
          y2="180"
          className="stroke-border"
          strokeWidth="1"
        />
      </svg>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {footnote}
      </p>
    </figure>
  );
}
