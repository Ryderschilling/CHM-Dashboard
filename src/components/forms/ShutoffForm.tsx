"use client";

import { useState } from "react";
import { createShutoffDevice, updateShutoffDevice } from "@/actions/protection";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type ShutoffDefaults = {
  id?: string;
  clientId?: string;
  propertyId?: string | null;
  status?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: string;
  installedBy?: string | null;
  installPrice?: number | null;
  installCost?: number | null;
  monitored?: boolean;
  monitoringFee?: number | null;
  lastCheckedAt?: string;
  warrantyEnd?: string;
  notes?: string | null;
};

type Opt = { id: string; name: string };
type PropOpt = { id: string; clientId: string; address: string };

/** Devices worth stocking. Free text is still allowed, this is just a shortcut. */
const BRANDS = ["Phyn Plus", "Flo by Moen", "FloLogic", "Water Hero", "Leak Defense", "Moen Smart Water", "Other"];

const STATUSES: [string, string][] = [
  ["QUOTED", "Quoted"],
  ["SCHEDULED", "Install scheduled"],
  ["INSTALLED", "Installed"],
  ["REMOVED", "Removed"],
];

export default function ShutoffForm({
  defaults = {},
  clients,
  properties,
  onDone,
}: {
  defaults?: ShutoffDefaults;
  clients: Opt[];
  properties: PropOpt[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateShutoffDevice : createShutoffDevice, onDone);
  const [clientId, setClientId] = useState(defaults.clientId ?? "");

  const clientProps = properties.filter((p) => p.clientId === clientId);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Client">
          <select
            name="clientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input"
          >
            <option value="">Pick a client</option>
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

        <Field label="Status">
          <select name="status" defaultValue={defaults.status ?? "QUOTED"} className="input">
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="Device">
          <input
            name="brand"
            list="shutoff-brands"
            defaultValue={defaults.brand ?? ""}
            className="input"
            placeholder="Phyn Plus"
          />
          <datalist id="shutoff-brands">
            {BRANDS.map((b) => <option key={b} value={b} />)}
          </datalist>
        </Field>

        <Field label="Model">
          <input name="model" defaultValue={defaults.model ?? ""} className="input" />
        </Field>

        <Field label="Serial number">
          <input name="serialNumber" defaultValue={defaults.serialNumber ?? ""} className="input" />
        </Field>

        <Field label="Install date">
          <input name="installDate" type="date" defaultValue={defaults.installDate ?? ""} className="input" />
        </Field>

        <Field label="Installed by">
          <input name="installedBy" defaultValue={defaults.installedBy ?? ""} className="input" placeholder="Plumber name" />
        </Field>

        <Field label="Client paid ($)">
          <input name="installPrice" type="number" step="0.01" min="0" defaultValue={defaults.installPrice ?? ""} className="input" placeholder="1295" />
        </Field>

        <Field label="Your cost ($)">
          <input name="installCost" type="number" step="0.01" min="0" defaultValue={defaults.installCost ?? ""} className="input" placeholder="800" />
        </Field>

        <Field label="Monitoring ($/mo)">
          <input name="monitoringFee" type="number" step="0.01" min="0" defaultValue={defaults.monitoringFee ?? ""} className="input" placeholder="35" />
        </Field>

        <Field label="Last health check">
          <input name="lastCheckedAt" type="date" defaultValue={defaults.lastCheckedAt ?? ""} className="input" />
        </Field>

        <Field label="Warranty ends">
          <input name="warrantyEnd" type="date" defaultValue={defaults.warrantyEnd ?? ""} className="input" />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ""} className="input" placeholder="Valve is in the garage behind the water heater" />
        </Field>
      </FormGrid>

      <Field label="Monitoring">
        <label className="flex items-center gap-2.5 text-[13.5px] text-[var(--sec)]">
          <input type="checkbox" name="monitored" defaultChecked={defaults.monitored ?? false} className="accent-[var(--teal)] w-4 h-4" />
          We hold the alerts and respond
        </label>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add device"}
        </button>
      </div>
    </form>
  );
}
