"use client";

import { useState } from "react";

type Point = { label: string; a: number; b?: number };
type Tip = { x: number; y: number; title: string; lines: string[] };

function fmt(n: number, isMoney: boolean) {
  return isMoney
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : n.toLocaleString("en-US");
}

function niceMax(n: number) {
  if (n <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const unit = n / pow;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Div-based grouped bar chart. One or two series.
 * Two series get a legend + 2px gaps; single series gets direct label on the peak.
 */
export default function BarChart({
  data,
  seriesA,
  seriesB,
  isMoney = true,
  height = 210,
}: {
  data: Point[];
  seriesA: string;
  seriesB?: string;
  isMoney?: boolean;
  height?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const allZero = data.every((d) => d.a === 0 && (d.b ?? 0) === 0);
  const hasB = data.some((d) => (d.b ?? 0) !== 0) || Boolean(seriesB);
  const rawMax = Math.max(...data.map((d) => Math.max(d.a, d.b ?? 0)), 1);
  const max = niceMax(rawMax);
  const peakIdx = data.reduce((best, d, i) => (Math.max(d.a, d.b ?? 0) > Math.max(data[best].a, data[best].b ?? 0) ? i : best), 0);
  const showEvery = data.length > 9 ? 2 : 1;

  const onEnter = (e: React.MouseEvent, d: Point) => {
    const host = (e.currentTarget as HTMLElement).closest("[data-chart]") as HTMLElement;
    const hostRect = host.getBoundingClientRect();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const lines = hasB && seriesB
      ? [`${seriesA}: ${fmt(d.a, isMoney)}`, `${seriesB}: ${fmt(d.b ?? 0, isMoney)}`]
      : [fmt(d.a, isMoney)];
    setTip({
      x: r.left - hostRect.left + r.width / 2,
      y: r.top - hostRect.top,
      title: d.label,
      lines,
    });
  };

  return (
    <div>
      {hasB && seriesB && (
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--sec)]">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--s1)" }} />
            {seriesA}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--sec)]">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--s2)" }} />
            {seriesB}
          </span>
        </div>
      )}

      <div className="relative" data-chart style={{ height }}>
        {allZero && (
          <p className="absolute inset-0 flex items-center justify-center text-[12.5px] text-[var(--mut)]">
            Bars fill in as payments get logged.
          </p>
        )}
        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 border-t border-[var(--border)] flex justify-end"
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="text-[10px] text-[var(--mut)] -translate-y-4 pr-0.5">
              {fmt(max * f, isMoney)}
            </span>
          </div>
        ))}

        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setTip(null)}>
          {data.map((d, i) => (
            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
              {!hasB && i === peakIdx && d.a > 0 && (
                <span className="text-[10.5px] text-[var(--sec)] mb-1 whitespace-nowrap">
                  {fmt(d.a, isMoney)}
                </span>
              )}
              <div
                className="w-full h-full flex items-end justify-center gap-[2px] cursor-default"
                onMouseEnter={(e) => onEnter(e, d)}
              >
                <div
                  className="spark-bar rounded-t-[4px] w-full"
                  style={{
                    maxWidth: hasB ? 13 : 26,
                    height: `${Math.max(d.a > 0 ? 2.5 : 0.8, (d.a / max) * 100)}%`,
                    background: d.a > 0 ? "var(--s1)" : "var(--surface-3)",
                  }}
                />
                {hasB && (
                  <div
                    className="spark-bar rounded-t-[4px] w-full"
                    style={{
                      maxWidth: 13,
                      height: `${Math.max((d.b ?? 0) > 0 ? 2.5 : 0.8, ((d.b ?? 0) / max) * 100)}%`,
                      background: (d.b ?? 0) > 0 ? "var(--s2)" : "var(--surface-3)",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {tip && (
          <div
            className="chart-tip"
            style={{ left: tip.x, top: Math.max(tip.y - 8, 0), transform: "translate(-50%, -100%)" }}
          >
            <p className="text-[var(--mut)] text-[11px] mb-0.5">{tip.title}</p>
            {tip.lines.map((l, i) => (
              <p key={i} className="font-semibold">{l}</p>
            ))}
          </div>
        )}
      </div>

      {/* x labels */}
      <div className="flex gap-[2px] mt-2">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10.5px] text-[var(--mut)] truncate">
            {i % showEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
