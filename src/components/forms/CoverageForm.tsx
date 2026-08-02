"use client";

import { useState } from "react";
import { createCoverageRecord, updateCoverageRecord } from "@/actions/protection";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type CoverageDefaults = {
  id?: string;
  clientId?: string;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  status?: string;
  sentDate?: string;
  fee?: number | null;
  fileUrl?: string | null;
  visitCount?: number | null;
  photoCount?: number | null;
  notes?: string | null;
};

const STATUSES: [string, string][] = [
  ["ENROLLED", "Enrolled"],
  ["DUE", "Due now"],
  ["DRAFTED", "Drafted"],
  ["SENT", "Sent"],
];

/** yyyy-mm-dd helpers that stay on the intended calendar day. */
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export default function CoverageForm({
  defaults = {},
  clients,
  onDone,
}: {
  defaults?: CoverageDefaults;
  clients: { id: string; name: string }[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateCoverageRecord : createCoverageRecord, onDone);

  const thisYear = new Date().getFullYear();
  const [start, setStart] = useState(defaults.periodStart ?? iso(thisYear, 1, 1));
  const [end, setEnd] = useState(defaults.periodEnd ?? iso(thisYear, 12, 31));
  const [due, setDue] = useState(defaults.dueDate ?? addDays(iso(thisYear, 12, 31), 14));

  // Moving the period end drags the due date with it unless it was edited.
  const onEndChange = (v: string) => {
    const wasDefault = due === addDays(end, 14);
    setEnd(v);
    if (wasDefault) setDue(addDays(v, 14));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Client" className="sm:col-span-2">
          <select name="clientId" required defaultValue={defaults.clientId ?? ""} className="input">
            <option value="">Pick a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Period start">
          <input name="periodStart" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </Field>

        <Field label="Period end">
          <input name="periodEnd" type="date" required value={end} onChange={(e) => onEndChange(e.target.value)} className="input" />
        </Field>

        <Field label="Send it by">
          <input name="dueDate" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
        </Field>

        <Field label="Status">
          <select name="status" defaultValue={defaults.status ?? "ENROLLED"} className="input">
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>

        <Field label="Fee ($/yr)">
          <input name="fee" type="number" step="0.01" min="0" defaultValue={defaults.fee ?? ""} className="input" placeholder="195, blank if Coastal Elite" />
        </Field>

        <Field label="Sent on">
          <input name="sentDate" type="date" defaultValue={defaults.sentDate ?? ""} className="input" />
        </Field>

        <Field label="Visits in the record">
          <input name="visitCount" type="number" min="0" defaultValue={defaults.visitCount ?? ""} className="input" />
        </Field>

        <Field label="Photos in the record">
          <input name="photoCount" type="number" min="0" defaultValue={defaults.photoCount ?? ""} className="input" />
        </Field>

        <Field label="Link to the PDF" className="sm:col-span-2">
          <input name="fileUrl" defaultValue={defaults.fileUrl ?? ""} className="input" placeholder="Drive link or file path" />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ""} className="input" />
        </Field>
      </FormGrid>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Enroll client"}
        </button>
      </div>
    </form>
  );
}
