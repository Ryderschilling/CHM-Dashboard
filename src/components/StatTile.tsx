"use client";

import { useEffect, useRef, useState } from "react";

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function CountUp({ value, money: isMoney }: { value: number; money?: boolean }) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || started.current) return;
      started.current = true;
      const t0 = performance.now();
      const dur = 850;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setDisplay(value * easeOut(p));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.disconnect();
    });
    obs.observe(el);
    return () => obs.disconnect();
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

export default function StatTile({
  label,
  value,
  money,
  sub,
  subTone = "mut",
  accent,
}: {
  label: string;
  value: number;
  money?: boolean;
  sub?: string;
  subTone?: "mut" | "good" | "warn" | "bad";
  accent?: boolean;
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
      <p className="stat-num text-[27px] leading-none">
        <CountUp value={value} money={money} />
      </p>
      {sub && <p className={`text-[12px] mt-2.5 ${toneClass}`}>{sub}</p>}
    </div>
  );
}
