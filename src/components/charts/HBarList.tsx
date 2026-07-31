import { money } from "@/lib/format";

/** Horizontal magnitude bars, server-rendered. Single hue, labels carry identity. */
export default function HBarList({
  rows,
}: {
  rows: { label: string; value: number; href?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[13px] text-[var(--sec)] truncate pr-3">{r.label}</span>
            <span className="text-[13px] font-semibold tabular-nums">{money(r.value)}</span>
          </div>
          <div className="h-[7px] rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: "var(--s1)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
