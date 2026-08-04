"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVisitReport, updateVisitReport } from "@/actions/visits";
import { CHECK_CATEGORIES, categoryRank } from "@/lib/checkAreas";
import { shrinkImage, fmtBytes, type Shrunk } from "@/lib/photo";
import { Field, FormGrid } from "../ui";
import DurationInput from "./DurationInput";
import { IconX } from "../icons";
import { todayInput } from "@/lib/format";

export type AreaOpt = {
  id: string;
  propertyId: string;
  label: string;
  category: string;
  sortOrder: number;
};

export type ExistingFinding = {
  areaId: string | null;
  label: string;
  category: string;
  state: string;
  note: string | null;
};

export type ExistingPhoto = { id: string; caption: string | null; bytes: number };

export type VisitDefaults = {
  id?: string;
  clientId?: string;
  propertyId?: string | null;
  jobId?: string | null;
  visitDate?: string;
  minutesOnSite?: number | null;
  weather?: string | null;
  summary?: string | null;
  internalNotes?: string | null;
  chargeAmount?: number | null;
  laborCost?: number | null;
  materialCost?: number | null;
  materialNote?: string | null;
  status?: string;
  findings?: ExistingFinding[];
  photos?: ExistingPhoto[];
};

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

export default function VisitReportForm({
  defaults = {},
  clients,
  properties,
  areas,
  onDone,
}: {
  defaults?: VisitDefaults;
  clients: { id: string; name: string }[];
  properties: { id: string; clientId: string; address: string }[];
  areas: AreaOpt[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(defaults.clientId ?? "");
  const [propertyId, setPropertyId] = useState(defaults.propertyId ?? "");

  const clientProps = properties.filter((p) => p.clientId === clientId);

  // On an edit we replay the saved findings. On a new report we build the list
  // from the property's own area list, every one defaulted to Dry / good.
  const [rows, setRows] = useState<Row[]>(() =>
    (defaults.findings ?? []).map((f, i) => ({
      key: `f${i}`,
      areaId: f.areaId,
      label: f.label,
      category: f.category,
      state: f.state,
      note: f.note ?? "",
    })),
  );
  const [loadedFor, setLoadedFor] = useState(defaults.propertyId ?? "");

  const buildRows = (pid: string) =>
    areas
      .filter((a) => a.propertyId === pid)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({
        key: a.id,
        areaId: a.id,
        label: a.label,
        category: a.category,
        state: "OK",
        note: "",
      }));

  const onPropertyChange = (pid: string) => {
    setPropertyId(pid);
    // Do not silently wipe work in progress.
    const dirty = rows.some((r) => r.state !== "OK" || r.note.trim());
    if (dirty && !confirm("Load this property's checklist? Anything you've already marked will be cleared.")) return;
    setRows(buildRows(pid));
    setLoadedFor(pid);
  };

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addCustomRow = () =>
    setRows((rs) => [
      ...rs,
      { key: `custom-${rs.length}-${rs.length + Math.floor(rs.length * 7)}`, areaId: null, label: "", category: "Interior", state: "OK", note: "" },
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

    if (!clientId) return setError("Pick a client.");
    if (rows.some((r) => !r.label.trim())) return setError("Every checklist line needs a name.");

    const fd = new FormData(e.currentTarget);
    // The raw picker input is never submitted; only the shrunk copies go up.
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
        await (isEdit ? updateVisitReport(fd) : createVisitReport(fd));
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that report.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.jobId && <input type="hidden" name="jobId" value={defaults.jobId} />}

      {/* Who and when */}
      <FormGrid>
        <Field label="Client">
          <select
            name="clientId"
            required
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPropertyId("");
            }}
            className="input"
          >
            <option value="">Pick a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Property">
          <select
            name="propertyId"
            value={propertyId}
            onChange={(e) => onPropertyChange(e.target.value)}
            className="input"
          >
            <option value="">Not set</option>
            {clientProps.map((p) => (
              <option key={p.id} value={p.id}>{p.address}</option>
            ))}
          </select>
        </Field>

        <Field label="Visit date">
          <input name="visitDate" type="date" required defaultValue={defaults.visitDate ?? todayInput()} className="input" />
        </Field>

        <Field label="Minutes on site">
          <DurationInput name="minutesOnSite" defaultMinutes={defaults.minutesOnSite ?? null} />
        </Field>

        <Field label="Weather" className="sm:col-span-2">
          <input name="weather" defaultValue={defaults.weather ?? ""} className="input" placeholder="Clear, 88F, no storms since last visit" />
        </Field>
      </FormGrid>

      {/* Checklist */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[13.5px] font-semibold">Walkthrough</p>
            <p className="text-[12px] text-[var(--mut)]">
              Everything starts at dry and good. Only tap what is not.
              {issues > 0 && <span className="text-[var(--warn)]"> {issues} flagged.</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {propertyId && loadedFor !== propertyId && (
              <button type="button" className="btn btn-sm" onClick={() => { setRows(buildRows(propertyId)); setLoadedFor(propertyId); }}>
                Load checklist
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={addCustomRow}>
              Add a line
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--mut)]">
            {propertyId
              ? "This property has no checklist yet. Add the standard areas from the property card, or add lines here."
              : "Pick a property to load its checklist."}
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
                          <span className="flex-1 min-w-[180px] text-[13px]">{r.label}</span>
                        ) : (
                          <input
                            value={r.label}
                            onChange={(e) => setRow(r.key, { label: e.target.value })}
                            className="input flex-1 min-w-[180px] !py-1.5 !text-[13px]"
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
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[13.5px] font-semibold">Photos</p>
            <p className="text-[12px] text-[var(--mut)]">
              Resized in your browser before upload.
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

        {defaults.photos && defaults.photos.length > 0 && (
          <p className="mb-3 text-[12px] text-[var(--mut)]">
            {defaults.photos.length} already saved on this report. Manage them on the report page.
          </p>
        )}

        {shots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
      <FormGrid>
        <Field label="Summary for the client" className="sm:col-span-2">
          <textarea name="summary" rows={3} defaultValue={defaults.summary ?? ""} className="input" placeholder="House is dry and secure. A/C running at 74. Nothing needs a decision from you." />
        </Field>
        <Field label="Internal notes, never shown to the client" className="sm:col-span-2">
          <textarea name="internalNotes" rows={2} defaultValue={defaults.internalNotes ?? ""} className="input" />
        </Field>
      </FormGrid>

      {/* Money */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-[13.5px] font-semibold mb-1">Money on this visit</p>
        <p className="text-[12px] text-[var(--mut)] mb-3">
          Leave the charge blank when the plan covers it. These feed the Jobs list and your monthly profit automatically.
        </p>
        <FormGrid>
          <Field label="Extra charge ($)">
            <input name="chargeAmount" type="number" step="0.01" min="0" defaultValue={defaults.chargeAmount ?? ""} className="input" placeholder="Blank = covered by plan" />
          </Field>
          <Field label="Paid to a helper ($)">
            <input name="laborCost" type="number" step="0.01" min="0" defaultValue={defaults.laborCost ?? ""} className="input" placeholder="0" />
          </Field>
          <Field label="Materials you bought ($)">
            <input name="materialCost" type="number" step="0.01" min="0" defaultValue={defaults.materialCost ?? ""} className="input" placeholder="0" />
          </Field>
          <Field label="What the materials were">
            <input name="materialNote" defaultValue={defaults.materialNote ?? ""} className="input" placeholder="Two 16x25 HVAC filters" />
          </Field>
        </FormGrid>
      </div>

      <Field label="Status">
        <select name="status" defaultValue={defaults.status ?? "FINAL"} className="input">
          <option value="FINAL">Final, include it in the annual record</option>
          <option value="DRAFT">Draft, still finishing it</option>
        </select>
      </Field>

      {error && (
        <p className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "rgba(229,72,77,0.10)", color: "var(--bad)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending || shrinking}>
          {pending ? "Saving..." : isEdit ? "Save report" : "Save visit report"}
        </button>
      </div>
    </form>
  );
}
