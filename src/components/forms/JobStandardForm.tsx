"use client";

import { useState } from "react";
import { createJobStandard, updateJobStandard } from "@/actions/jobTime";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type JobStandardDefaults = {
  id?: string;
  label?: string;
  minutes?: number | null;
  clientId?: string | null;
  propertyId?: string | null;
  gcalSeriesId?: string | null;
  titleMatch?: string | null;
  active?: boolean;
  notes?: string | null;
};

type Opt = { id: string; name: string };
type PropOpt = { id: string; clientId: string; address: string };

/** One tap instead of typing the number. These cover almost every visit. */
const QUICK = [10, 15, 20, 30, 45, 60, 90];

export default function JobStandardForm({
  defaults = {},
  clients,
  properties,
  onDone,
}: {
  defaults?: JobStandardDefaults;
  clients: Opt[];
  properties: PropOpt[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateJobStandard : createJobStandard, onDone);
  const [clientId, setClientId] = useState(defaults.clientId ?? "");
  const [minutes, setMinutes] = useState(String(defaults.minutes ?? ""));

  const clientProps = properties.filter((p) => p.clientId === clientId);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.gcalSeriesId && (
        <input type="hidden" name="gcalSeriesId" value={defaults.gcalSeriesId} />
      )}

      <FormGrid>
        <Field label="Job name">
          <input
            name="label"
            required
            autoFocus
            defaultValue={defaults.label ?? ""}
            className="input"
            placeholder="Beth Tedesco Mail"
          />
        </Field>

        <Field label="Minutes it takes">
          <input
            name="minutes"
            type="number"
            step="1"
            min="1"
            required
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="input"
            placeholder="15"
          />
        </Field>
      </FormGrid>

      <div className="flex flex-wrap gap-1.5 -mt-1">
        {QUICK.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(String(m))}
            className={`btn btn-sm ${Number(minutes) === m ? "btn-primary" : ""}`}
          >
            {m}m
          </button>
        ))}
      </div>

      <FormGrid>
        <Field label="Client">
          <select
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input"
          >
            <option value="">Not set</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Property">
          <select name="propertyId" defaultValue={defaults.propertyId ?? ""} className="input">
            <option value="">Not set</option>
            {clientProps.map((p) => (
              <option key={p.id} value={p.id}>{p.address}</option>
            ))}
          </select>
        </Field>

        <Field label="Match jobs whose title contains" className="sm:col-span-2">
          <input
            name="titleMatch"
            defaultValue={defaults.titleMatch ?? ""}
            className="input"
            placeholder="Leave blank to use the job name above"
          />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <textarea
            name="notes"
            rows={2}
            defaultValue={defaults.notes ?? ""}
            className="input"
            placeholder="Drive time included, mailbox is at the back of the neighborhood"
          />
        </Field>
      </FormGrid>

      {defaults.gcalSeriesId && (
        <p className="text-[12px] text-[var(--mut)] -mt-1">
          Locked to this recurring calendar series, so every future occurrence picks it up
          automatically.
        </p>
      )}

      {isEdit && (
        <label className="flex items-center gap-2.5 text-[13.5px] text-[var(--sec)]">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaults.active ?? true}
            className="accent-[var(--teal)] w-4 h-4"
          />
          Still in use
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Save standard"}
        </button>
      </div>
    </form>
  );
}
