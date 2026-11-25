import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Txt } from "@/components/ui";
import { font, space, useTheme } from "@/lib/theme";

/**
 * Small single-series charts drawn with react-native-svg.
 * Marks follow the house rules: 2px line, 8px markers with a surface ring,
 * bars <= 24px with a 4px rounded data end, recessive grid, text in text
 * tokens (never the series colour), tap a mark to read its exact value.
 */

const AXIS_W = 44;
const BOTTOM = 22;
const TOP = 26; // room for the selected value label

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width) };
}

export function LineChart({
  points,
  height = 190,
  formatY,
  formatTick = formatY,
  formatX,
  accessibilityLabel,
}: {
  points: Array<{ x: number; y: number }>;
  height?: number;
  formatY: (v: number) => string;
  /** Short form for the axis (e.g. "85 k"); the selected value uses formatY. */
  formatTick?: (v: number) => string;
  formatX: (v: number) => string;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(points.length > 0 ? points.length - 1 : null);

  const ticks = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]!;
  const xMin = Math.min(...points.map((p) => p.x));
  const xMax = Math.max(...points.map((p) => p.x));
  const plotW = Math.max(0, width - AXIS_W - space.md);
  const plotH = height - BOTTOM - TOP;
  const sx = (x: number) => AXIS_W + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => TOP + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

  function onPress(e: GestureResponderEvent) {
    const x = e.nativeEvent.locationX;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best]!.x) - x)) best = i;
    });
    void Haptics.selectionAsync().catch(() => {});
    setSelected(best);
  }

  const sel = selected !== null ? points[selected] : undefined;
  return (
    <Pressable onLayout={onLayout} onPress={onPress} accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((v) => (
            <Line key={v} x1={AXIS_W} x2={AXIS_W + plotW} y1={sy(v)} y2={sy(v)} stroke={t.grid} strokeWidth={1} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={AXIS_W - 6} y={sy(v) + 4} fontSize={10} fill={t.muted} textAnchor="end" fontFamily={font.regular}>
              {formatTick(v)}
            </SvgText>
          ))}
          <SvgText x={AXIS_W} y={height - 6} fontSize={10} fill={t.muted} fontFamily={font.regular}>
            {formatX(xMin)}
          </SvgText>
          {xMax !== xMin && (
            <SvgText x={AXIS_W + plotW} y={height - 6} fontSize={10} fill={t.muted} textAnchor="end" fontFamily={font.regular}>
              {formatX(xMax)}
            </SvgText>
          )}
          <Path d={d} stroke={t.chart} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={i === selected ? 6 : 4} fill={t.chart} stroke={t.card} strokeWidth={2} />
          ))}
          {sel && (
            <>
              <Line x1={sx(sel.x)} x2={sx(sel.x)} y1={TOP} y2={TOP + plotH} stroke={t.muted} strokeWidth={1} strokeDasharray="3 3" />
              <SvgText
                x={Math.min(Math.max(sx(sel.x), AXIS_W + 40), AXIS_W + plotW - 40)}
                y={14}
                fontSize={12}
                fill={t.text}
                textAnchor="middle"
                fontFamily={font.semibold}
              >
                {`${formatY(sel.y)} · ${formatX(sel.x)}`}
              </SvgText>
            </>
          )}
        </Svg>
      )}
    </Pressable>
  );
}

export function BarChart({
  bars,
  height = 190,
  formatValue,
  formatTick = formatValue,
  accessibilityLabel,
}: {
  bars: Array<{ key: string; label: string; longLabel: string; value: number }>;
  height?: number;
  formatValue: (v: number) => string;
  formatTick?: (v: number) => string;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const lastNonZero = [...bars].reverse().findIndex((b) => b.value > 0);
  const [selected, setSelected] = useState<number | null>(lastNonZero >= 0 ? bars.length - 1 - lastNonZero : null);

  const ticks = niceTicks(0, Math.max(1, ...bars.map((b) => b.value)));
  const yMax = ticks[ticks.length - 1]!;
  const plotW = Math.max(0, width - AXIS_W - space.md);
  const plotH = height - BOTTOM - TOP;
  const slot = bars.length > 0 ? plotW / bars.length : 0;
  const barW = Math.min(24, slot * 0.6);
  const sy = (v: number) => TOP + plotH - (v / yMax) * plotH;
  const base = TOP + plotH;

  // 4px rounded data end (top), square at the baseline.
  const barPath = (x: number, top: number) => {
    const r = Math.min(4, (base - top) / 2, barW / 2);
    return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${base} Z`;
  };

  const sel = selected !== null ? bars[selected] : undefined;
  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={{ position: "absolute" }}>
            {ticks.map((v) => (
              <Line key={v} x1={AXIS_W} x2={AXIS_W + plotW} y1={sy(v)} y2={sy(v)} stroke={t.grid} strokeWidth={1} />
            ))}
            {ticks.map((v) => (
              <SvgText key={`l${v}`} x={AXIS_W - 6} y={sy(v) + 4} fontSize={10} fill={t.muted} textAnchor="end" fontFamily={font.regular}>
                {formatTick(v)}
              </SvgText>
            ))}
            {bars.map((b, i) => {
              const x = AXIS_W + i * slot + (slot - barW) / 2;
              return (
                <SvgText
                  key={`x${b.key}`}
                  x={x + barW / 2}
                  y={height - 6}
                  fontSize={10}
                  fill={i === selected ? t.text : t.muted}
                  textAnchor="middle"
                  fontFamily={i === selected ? font.semibold : font.regular}
                >
                  {b.label}
                </SvgText>
              );
            })}
            {bars.map((b, i) =>
              b.value > 0 ? (
                <Path
                  key={b.key}
                  d={barPath(AXIS_W + i * slot + (slot - barW) / 2, sy(b.value))}
                  fill={t.chart}
                  opacity={selected === null || i === selected ? 1 : 0.55}
                />
              ) : null,
            )}
            {sel && (
              <SvgText x={Math.min(Math.max(AXIS_W + selected! * slot + slot / 2, AXIS_W + 50), AXIS_W + plotW - 50)} y={14} fontSize={12} fill={t.text} textAnchor="middle" fontFamily={font.semibold}>
                {`${sel.longLabel} : ${formatValue(sel.value)}`}
              </SvgText>
            )}
          </Svg>
          {/* Tap targets: the whole slot, bigger than the bar. */}
          <View style={{ position: "absolute", left: AXIS_W, top: 0, bottom: 0, width: plotW, flexDirection: "row" }}>
            {bars.map((b, i) => (
              <Pressable
                key={b.key}
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityLabel={`${b.longLabel} : ${formatValue(b.value)}`}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  setSelected(i);
                }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** Horizontal magnitude bars for a short ranked list (e.g. spend per category). */
export function RankBars({ rows, formatValue }: { rows: Array<{ key: string; label: string; value: number; sub?: string }>; formatValue: (v: number) => string }) {
  const t = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6 }} accessible accessibilityLabel={`${r.label} : ${formatValue(r.value)}${r.sub ? `, ${r.sub}` : ""}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
            <Txt variant="caption" style={{ flex: 1 }}>
              {r.label}
              {r.sub ? <Txt variant="caption" tone="muted">{`  ${r.sub}`}</Txt> : null}
            </Txt>
            <Txt variant="caption" style={{ fontFamily: font.semibold, fontVariant: ["tabular-nums"] }}>
              {formatValue(r.value)}
            </Txt>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surface2 }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: t.chart }} />
          </View>
        </View>
      ))}
    </View>
  );
}
