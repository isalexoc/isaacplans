/** @jsxRuntime automatic */
/**
 * Vector pieces shared by the two summary pages: the jigsaw circle, a single jigsaw piece, the
 * slanted color boxes NLG puts behind its big numbers, and the carrier logo.
 *
 * Text inside an <Svg> is placed by measured width rather than `textAnchor`, so centering doesn't
 * depend on renderer support for SVG text alignment.
 */

import { Image, Path, Polygon, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { estimateHelveticaWidth } from "@/lib/mailing-labels/metrics";
import type { PillarColors } from "../carriers";
import { PIECES, PILLAR_LABELS, polar, piecePath, sidePiecePath, type PillarKey } from "./puzzle";
import { FONT_BOLD, NEUTRAL, type Style } from "./theme";

const PILLAR_ORDER: PillarKey[] = ["dieTooSoon", "becomeIll", "liveTooLong"];

/** Lines of bold SVG text centered on (cx, cy). */
function CenteredLines({ lines, cx, cy, size, color }: { lines: string[]; cx: number; cy: number; size: number; color: string }) {
  const leading = size * 1.1;
  const top = cy - ((lines.length - 1) * leading) / 2 + size * 0.35;
  return (
    <>
      {lines.map((line, i) => (
        <Text
          key={line}
          x={cx - estimateHelveticaWidth(line, size, { bold: true }) / 2}
          y={top + i * leading}
          fill={color}
          style={{ fontSize: size, fontFamily: FONT_BOLD }}
        >
          {line}
        </Text>
      ))}
    </>
  );
}

/** The cover's three-piece circle, white jigsaw cuts between the pieces. */
export function PuzzleCircle({ size, colors, onColors }: { size: number; colors: PillarColors; onColors: PillarColors }) {
  const pad = size * 0.04;
  const radius = size / 2 - pad;
  const c = size / 2;
  return (
    <Svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {PILLAR_ORDER.map((key) => {
        const piece = PIECES[key];
        return (
          <Path
            key={key}
            d={piecePath(c, c, radius, piece.from, piece.to)}
            fill={colors[key]}
            stroke={NEUTRAL.white}
            strokeWidth={size * 0.018}
          />
        );
      })}
      {PILLAR_ORDER.map((key) => {
        const [x, y] = polar(c, c, radius * 0.6, PIECES[key].labelAngle);
        return <CenteredLines key={key} lines={PILLAR_LABELS[key]} cx={x} cy={y} size={size * 0.075} color={onColors[key]} />;
      })}
    </Svg>
  );
}

/**
 * One jigsaw piece, rim facing left, for the left edge of an offers panel. `size` is the height;
 * the piece is about 0.62 × as wide.
 */
export function SidePuzzlePiece({ pillar, size, color, onColor }: { pillar: PillarKey; size: number; color: string; onColor: string }) {
  const radius = size / 2 / 0.92;
  const width = size * 0.66;
  const cx = width - size * 0.02;
  const cy = size / 2;
  return (
    <Svg viewBox={`0 0 ${width} ${size}`} style={{ width, height: size }}>
      <Path d={sidePiecePath(cx, cy, radius)} fill={color} />
      {/* Two lines at ~0.1 × height fit between the rim and where the wedge narrows. */}
      <CenteredLines lines={PILLAR_LABELS[pillar]} cx={cx - radius * 0.53} cy={cy} size={size * 0.095} color={onColor} />
    </Svg>
  );
}

/**
 * A box whose left edge leans in by `slant`, drawn as a polygon (never a skewed View, which would
 * skew its text too) with upright content laid over it.
 */
export function SlantedBox({
  width,
  height,
  slant,
  color,
  style,
  children,
}: {
  width: number;
  height: number;
  slant: number;
  color: string;
  style?: Style;
  children: ReactNode;
}) {
  return (
    <View style={{ width, height, position: "relative", ...style }}>
      <Svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", top: 0, left: 0, width, height }}>
        <Polygon points={`${slant},0 ${width},0 ${width},${height} 0,${height}`} fill={color} />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: slant * 0.6,
          width: width - slant * 0.6,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** The carrier logo inside a box, scaled to fit whichever side runs out first. */
export function LogoImage({ data, aspect, maxWidth, maxHeight }: { data: Buffer; aspect: number; maxWidth: number; maxHeight: number }) {
  const width = Math.min(maxWidth, maxHeight * aspect);
  return <Image src={{ data, format: "png" }} style={{ width, height: width / aspect }} />;
}
