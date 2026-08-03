"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crewSubmitVisitReport } from "@/actions/crew";
import { categoryRank } from "@/lib/checkAreas";
import { shrinkImage, fmtBytes, type Shrunk } from "@/lib/photo";
import { Field } from "../ui";
import { IconX } from "../icons";

export type CrewArea = { id: string; label: string; category: string; sortOrder: number };

type Row = {
  key: string;
  areaId: string | null;
  label: string;
  category: string;
  state: string;
  note: string;
};

const STATES: { value: string; label: string; tone: string }[] = [
  { value: "OK", label: "Dry / good", tone: "good" },
  { value: "ISSUE", label: "Needs attention", tone: "bad" },
  { value: "NA", label: "N/A", tone: "mut" },
];

/**
 * The field version of the visit report. Same walkthrough, photos, and
 * write-up as the admin form, but: client/property/date are locked to the
 * job, there are no money fields, and it saves as a DRAFT for Ryder to
 * review. One report per job.
 */
export default function CrewVisitReportForm({
  jobId,
  areas,
}: {
  jobId: string;
  areas: CrewArea[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>(() =>
    [...areas]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({
        key: a.id,
        areaId: a.id,
        label: a.label,
        category: a.category,
        state: "OK",
        note: "",
      })),
  );

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addCustomRow = () =>
    setRows((rs) => [
      ...rs,
      { key: `custom-${rs.length}-${rs.length * 7 + 1}`, areaId: null, label: "", category: "Interior", state: "OK", note: "" },
    ]);

  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return [...map.entries()].sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]));
  }, [rows]);

  const issues = rows.filter((r) => r.state === "ISSUE").length;

  /* ── Photos ─────────────────────────────────────────────────────────── */

  const [shots, setShots] = useState<(Shrunk & { caption: string })[]>([]);
  const [shrinking, setShrinking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setShrinking(true);
    setError(null);
    try {
      const next: (Shrunk & { caption: string })[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const s = await shrinkImage(f);
        next.push({ ...s, caption: "" });
      }
      setShots((p) => [...p, ...next]);
    } catch {
      setError("One of those images could not be read. Try a JPEG or PNG.");
    } finally {
      setShrinking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addedBytes = shots.reduce((s, p) => s + p.file.size, 0);

  /* ── Submit ─────────────────────────────────────────────────────────── */

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (rows.some((r) => !r.label.trim())) return setError("Every checklist line needs a name.");

    const fd = new FormData(e.currentTarget);
    fd.delete("photos");
    fd.delete("photo_caption");
    for (const s of shots) {
      fd.append("photos", s.file);
      fd.append("photo_caption", s.caption);
    }
    for (const r of rows) {
      fd.append("finding_areaId", r.areaId ?? "");
      fd.append("finding_label", r.label.trim());
      fd.append("finding_category", r.category);
      fd.append("finding_state", r.state);
      fd.append("finding_note", r.note);
    }

    start(async () => {
      try {
        await crewSubmitVisitReport(fd);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the report.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes on site">
          <input name="minutesOnSite" type="number" min="0" step="5" inputMode="numeric" className="input" placeholder="45" />
        </Field>
        <Field label="Weather">
          <input name="weather" className="input" placeholder="Clear, 88F" />
        </Field>
      </div>

      {/* Walkthrough */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[13.5px] font-semibold">Walkthrough</p>
            <p className="text-[12px] text-[var(--mut)]">
              Everything starts at dry and good. Only tap what is not.
              {issues > 0 && <span className="text-[var(--warn)]"> {issues} flagged.</span>}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={addCustomRow}>
            Add a line
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="py-5 text-center text-[13px] text-[var(--mut)]">
            No checklist set up for this house yet. Add lines for what you checked.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([category, list]) => (
              <div key={category}>
                <p className="eyebrow mb-2">{category}</p>
                <div className="space-y-1.5">
                  {list.map((r) => (
                    <div key={r.key} className="rounded-xl bg-[var(--surface)] px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.areaId ? (
                          <span className="flex-1 min-w-[140px] text-[13px]">{r.label}</span>
                        ) : (
                          <input
                            value={r.label}
                            onChange={(e) => setRow(r.key, { label: e.target.value })}
                            className="input flex-1 min-w-[140px] !py-1.5 !text-[13px]"
                            placeholder="What did you check?"
                          />
                        )}
                        <div className="flex gap-1">
                          {STATES.map((s) => {
                            const on = r.state === s.value;
                            return (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => setRow(r.key, { state: s.value })}
                                className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors"
                                style={{
                                  background: on
                                    ? s.tone === "good"
                                      ? "rgba(61,214,140,0.16)"
                                      : s.tone === "bad"
                                        ? "rgba(229,72,77,0.16)"
                                        : "var(--surface-3)"
                                    : "transparent",
                                  color: on
                                    ? s.tone === "good"
                                      ? "var(--good)"
                                      : s.tone === "bad"
                                        ? "var(--bad)"
                                        : "var(--sec)"
                                    : "var(--mut)",
                                  border: `1px solid ${on ? "transparent" : "var(--border)"}`,
                                }}
                              >
                                {s.label}
                              </button>
                            );
                          })}
                          {!r.areaId && (
                            <button type="button" onClick={() => removeRow(r.key)} className="px-1.5 text-[var(--mut)] hover:text-[var(--bad)]" title="Remove line">
                              <IconX size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {r.state === "ISSUE" && (
                        <input
                          value={r.note}
                          onChange={(e) => setRow(r.key, { note: e.target.value })}
                          className="input mt-2 !py-1.5 !text-[13px]"
                          placeholder="What did you find, and what did you do about it?"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-[13.5px] font-semibold">Photos</p>
            <p className="text-[12px] text-[var(--mut)]">
              Snap anything worth documenting.
              {shots.length > 0 && ` ${shots.length} added, ${fmtBytes(addedBytes)}.`}
            </p>
          </div>
          <label className="btn btn-sm cursor-pointer">
            {shrinking ? "Processing..." : "Add photos"}
            <input
              ref={fileRef}
              type="file"
              name="photos"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
        </div>

        {shots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {shots.map((s, i) => (
              <div key={s.url} className="rounded-xl overflow-hidden bg-[var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="h-28 w-full object-cover" />
                <div className="p-2">
                  <input
                    value={s.caption}
                    onChange={(e) =>
                      setShots((p) => p.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))
                    }
                    className="input !py-1 !text-[12px]"
                    placeholder="Caption"
                  />
                  <button
                    type="button"
                    onClick={() => setShots((p) => p.filter((_, j) => j !== i))}
                    className="mt-1.5 text-[11.5px] text-[var(--mut)] hover:text-[var(--bad)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write-up */}
      <Field label="How the house looked, in plain words">
        <textarea name="summary" rows={3} className="input" placeholder="House is dry and secure. A/C running at 74. Nothing needs a decision." />
      </Field>
      <Field label="Anything just for Ryder (never shown to the client)">
        <textarea name="internalNotes" rows={2} className="input" />
      </Field>

      {error && (
        <p className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "rgba(229,72,77,0.10)", color: "var(--bad)" }}>
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full !py-3 !text-[15px]" disabled={pending || shrinking}>
        {pending ? "Sending report..." : "Submit report"}
      </button>
      <p className="text-[11.5px] text-[var(--mut)] text-center">
        Submitting marks the job done. Ryder reviews the report before it goes to the client.
      </p>
    </form>
  );
}
