"use client";

import { useState } from "react";
import { createJob, updateJob } from "@/actions/jobs";
import { todayInput } from "@/lib/format";
import { Field, FormGrid, JOB_TYPES } from "../ui";
import { useSubmit } from "./useSubmit";

export type JobDefaults = {
  id?: string;
  clientId?: string | null;
  propertyId?: string | null;
  title?: string;
  jobType?: string | null;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string | null;
  status?: string;
  workerId?: string | null;
  laborCost?: number;
  laborHours?: number | null;
  chargeAmount?: number | null;
  durationMin?: number | null;
  notes?: string | null;
  gcalEventId?: string | null;
};

export default function JobForm({
  defaults = {},
  clients,
  workers,
  properties,
  fixedClientId,
  onDone,
}: {
  defaults?: JobDefaults;
  clients: { id: string; name: string }[];
  workers: { id: string; name: string }[];
  properties: { id: string; clientId: string; address: string }[];
  fixedClientId?: string;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const [clientId, setClientId] = useState(fixedClientId ?? defaults.clientId ?? "");
  const [allDay, setAllDay] = useState(defaults.allDay ?? false);
  const clientProps = properties.filter((p) => p.clientId === clientId);
  const { pending, onSubmit } = useSubmit(isEdit ? updateJob : createJob, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}
      {fixedClientId && <input type="hidden" name="clientId" value={fixedClientId} />}

      <FormGrid>
        <Field label="What is the job?" className="sm:col-span-2">
          <input name="title" required autoFocus defaultValue={defaults.title ?? ""} className="input" placeholder="Weekly walkthrough at 94 Roundwood" />
        </Field>
        <Field label="Type">
          <select name="jobType" defaultValue={defaults.jobType ?? "Home watch visit"} className="select">
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input name="date" type="date" required defaultValue={defaults.date ?? todayInput()} className="input" />
        </Field>

        <Field label="All day">
          <label className="flex items-center gap-2 h-[38px] text-[13px] text-[var(--sec)]">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 accent-[var(--teal)]"
            />
            No specific time
          </label>
        </Field>
        {!allDay && (
          <Field label="Start and end time">
            <div className="flex items-center gap-2">
              <input name="startTime" type="time" defaultValue={defaults.startTime ?? ""} className="input" />
              <span className="text-[var(--mut)] text-[13px]">to</span>
              <input name="endTime" type="time" defaultValue={defaults.endTime ?? ""} className="input" />
            </div>
          </Field>
        )}

        {!fixedClientId && (
          <Field label="Client">
            <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="select">
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {clientProps.length > 1 && (
          <Field label="Property">
            <select name="propertyId" defaultValue={defaults.propertyId ?? ""} className="select">
              <option value="">Pick one</option>
              {clientProps.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
          </Field>
        )}
        <Field label="Address or place">
          <input name="location" defaultValue={defaults.location ?? ""} className="input" placeholder="94 Roundwood Way" />
        </Field>
        <Field label="Who is doing it?">
          <select name="workerId" defaultValue={defaults.workerId ?? ""} className="select">
            <option value="">Me (Ryder)</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={defaults.status ?? "SCHEDULED"} className="select">
            <option value="SCHEDULED">Scheduled</option>
            <option value="DONE">Done</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </Field>
        <Field label="Time on the job (hours)">
          <input name="laborHours" type="number" step="0.25" min="0" defaultValue={defaults.laborHours ?? ""} className="input" placeholder="0.75" />
        </Field>
        <Field label="Paid out ($, only if someone else did it)">
          <input name="laborCost" type="number" step="0.01" min="0" defaultValue={defaults.laborCost ?? ""} className="input" placeholder="0" />
        </Field>
        <Field label="One-off charge ($)" className="sm:col-span-2">
          <input name="chargeAmount" type="number" step="0.01" min="0" defaultValue={defaults.chargeAmount ?? ""} className="input" placeholder="Leave blank when the plan covers it" />
        </Field>
      </FormGrid>

      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ""} className="textarea" placeholder="Gate code changed, AC filter due..." />
      </Field>

      <p className="text-[11.5px] text-[var(--mut)]">
        {defaults.gcalEventId
          ? "Saving updates this event on your Google Calendar."
          : "Saving also puts this on your Google Calendar, so it shows on your phone."}
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add job"}
        </button>
      </div>
    </form>
  );
}
