"use client";

import { useEffect, useRef, useState } from "react";

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates to `value`. Re-runs whenever `value` changes so the tile stays
 * correct across soft navigations (switching months keeps this component
 * mounted, so a one-shot animation would freeze on the first month's number).
 */
function CountUp({ value, money: isMoney }: { value: number; money?: boolean }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0); // where the next animation starts
  const seenRef = useRef(false); // has the tile ever scrolled into view
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;

    const run = () => {
      const from = fromRef.current;
      const t0 = performance.now();
      const dur = 850;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const v = from + (value - from) * easeOut(p);
        fromRef.current = v;
        setDisplay(v);
        if (p < 1) raf = requestAnimationFrame(tick);
        else fromRef.current = value;
      };
      raf = requestAnimationFrame(tick);
    };

    // Already seen once: animate straight from the old number to the new one.
    if (seenRef.current) {
      run();
      return () => cancelAnimationFrame(raf);
    }

    const obs = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seenRef.current = true;
      obs.disconnect();
      run();
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  const hasCents = Math.abs(value % 1) >= 0.005;
  const text = isMoney
    ? display.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
      })
    : Math.round(display).toLocaleString("en-US");

  return <span ref={ref}>{text}</span>;
}

function DeltaChip({ pct, title }: { pct: number; title?: string }) {
  const flat = Math.abs(pct) < 0.5;
  const up = !flat && pct > 0;
  const tone = flat
    ? "text-[var(--mut)] bg-[rgba(255,255,255,0.05)]"
    : up
      ? "text-[var(--good)] bg-[rgba(61,214,140,0.10)]"
      : "text-[var(--bad)] bg-[rgba(229,72,77,0.10)]";
  const abs = Math.abs(pct);
  const shown = abs >= 10 ? Math.round(abs) : abs.toFixed(1);

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-[3px] shrink-0 rounded-md px-1.5 py-[3px] text-[11px] font-semibold leading-none tabular-nums ${tone}`}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        {flat ? (
          <rect x="0.5" y="3.25" width="7" height="1.5" rx="0.75" fill="currentColor" />
        ) : (
          <path d={up ? "M4 0.5 L8 7.5 L0 7.5 Z" : "M4 7.5 L0 0.5 L8 0.5 Z"} fill="currentColor" />
        )}
      </svg>
      {flat ? "flat" : `${shown}%`}
    </span>
  );
}

export default function StatTile({
  label,
  value,
  money,
  sub,
  subTone = "mut",
  accent,
  delta,
}: {
  label: string;
  value: number;
  money?: boolean;
  sub?: string;
  subTone?: "mut" | "good" | "warn" | "bad";
  accent?: boolean;
  /** Small percent chip to the right of the number. `title` shows on hover. */
  delta?: { pct: number; title?: string } | null;
}) {
  const toneClass =
    subTone === "good"
      ? "text-[var(--good)]"
      : subTone === "warn"
        ? "text-[var(--warn)]"
        : subTone === "bad"
          ? "text-[var(--bad)]"
          : "text-[var(--mut)]";

  return (
    <div className="card card-hover p-5 relative overflow-hidden">
      {accent && (
        <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--teal)] to-transparent opacity-70" />
      )}
      <p className="eyebrow mb-2.5">{label}</p>
      <p className="stat-num text-[27px] leading-none flex items-center gap-2 flex-wrap">
        <CountUp value={value} money={money} />
        {delta && <DeltaChip pct={delta.pct} title={delta.title} />}
      </p>
      {sub && <p className={`text-[12px] mt-2.5 ${toneClass}`}>{sub}</p>}
    </div>
  );
}
