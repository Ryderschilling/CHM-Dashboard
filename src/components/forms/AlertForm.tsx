"use client";

import { createShutoffAlert, updateShutoffAlert } from "@/actions/protection";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";
import { todayInput } from "@/lib/format";

export type AlertDefaults = {
  id?: string;
  deviceId?: string;
  occurredAt?: string;
  kind?: string;
  severity?: string;
  summary?: string;
  action?: string | null;
  resolvedAt?: string;
  notes?: string | null;
};

const KINDS: [string, string][] = [
  ["LEAK", "Leak detected"],
  ["HIGH_FLOW", "High flow"],
  ["SHUTOFF_TRIGGERED", "Valve closed itself"],
  ["LOW_TEMP", "Low temperature"],
  ["FREEZE_RISK", "Freeze risk"],
  ["OFFLINE", "Device offline"],
  ["BATTERY", "Battery"],
  ["TEST", "Test"],
  ["OTHER", "Other"],
];

const SEVERITIES: [string, string][] = [
  ["INFO", "Info"],
  ["WARNING", "Warning"],
  ["CRITICAL", "Critical"],
];

export default function AlertForm({
  defaults = {},
  devices,
  onDone,
}: {
  defaults?: AlertDefaults;
  devices: { id: string; label: string }[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateShutoffAlert : createShutoffAlert, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Device" className="sm:col-span-2">
          <select name="deviceId" required defaultValue={defaults.deviceId ?? ""} className="input">
            <option value="">Pick a device</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </Field>

        <Field label="When">
          <input name="occurredAt" type="date" defaultValue={defaults.occurredAt ?? todayInput()} className="input" />
        </Field>

        <Field label="What happened">
          <select name="kind" defaultValue={defaults.kind ?? "LEAK"} className="input">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>

        <Field label="Severity">
          <select name="severity" defaultValue={defaults.severity ?? "WARNING"} className="input">
            {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>

        <Field label="Resolved on">
          <input name="resolvedAt" type="date" defaultValue={defaults.resolvedAt ?? ""} className="input" />
        </Field>

        <Field label="Summary" className="sm:col-span-2">
          <input name="summary" required defaultValue={defaults.summary ?? ""} className="input" placeholder="Continuous flow on the main, 40 minutes" />
        </Field>

        <Field label="What you did" className="sm:col-span-2">
          <textarea name="action" rows={2} defaultValue={defaults.action ?? ""} className="input" placeholder="Drove over, valve had already closed, found a failed toilet supply line, called the plumber" />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ""} className="input" />
        </Field>
      </FormGrid>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Log alert"}
        </button>
      </div>
    </form>
  );
}
