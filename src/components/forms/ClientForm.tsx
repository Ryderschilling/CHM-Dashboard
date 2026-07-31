"use client";

import { createClient, updateClient } from "@/actions/clients";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type ClientDefaults = {
  id?: string;
  name?: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
  altContact?: string | null;
  community?: string | null;
  planName?: string | null;
  planAmount?: number | null;
  cadence?: string;
  lockedRate?: boolean;
  lockedUntil?: string;
  startDate?: string;
  source?: string | null;
  notes?: string | null;
};

const COMMUNITIES = ["Watersound Origins", "Naturewalk", "Inlet Beach", "Seacrest", "Seagrove", "WaterColor", "Other 30A"];
const PLAN_NAMES = ["Essential", "Home Watch", "Coastal Elite", "Basic (1 visit/mo)", "A la carte", "Custom"];

export default function ClientForm({
  defaults = {},
  onDone,
}: {
  defaults?: ClientDefaults;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateClient : createClient, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Name" className="sm:col-span-2">
          <input name="name" required defaultValue={defaults.name ?? ""} className="input" placeholder="Client name" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={defaults.status ?? "ACTIVE"} className="select">
            <option value="ACTIVE">Active</option>
            <option value="LEAD">Lead</option>
            <option value="PAUSED">Paused</option>
            <option value="FORMER">Former</option>
          </select>
        </Field>
        <Field label="Community">
          <input name="community" list="communities" defaultValue={defaults.community ?? ""} className="input" placeholder="Watersound Origins" />
          <datalist id="communities">
            {COMMUNITIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={defaults.email ?? ""} className="input" placeholder="name@email.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={defaults.phone ?? ""} className="input" placeholder="(850) 555-0100" />
        </Field>
        <Field label="Alt contact" className="sm:col-span-2">
          <input name="altContact" defaultValue={defaults.altContact ?? ""} className="input" placeholder="Spouse, assistant, realtor..." />
        </Field>
      </FormGrid>

      {!isEdit && (
        <Field label="Property address (creates their first property)">
          <input name="address" className="input" placeholder="94 Roundwood Dr, Inlet Beach" />
        </Field>
      )}

      <div className="border-t border-[var(--border)] pt-4">
        <p className="eyebrow mb-3">Plan and billing</p>
        <FormGrid>
          <Field label="Plan">
            <input name="planName" list="plans" defaultValue={defaults.planName ?? ""} className="input" placeholder="Essential" />
            <datalist id="plans">
              {PLAN_NAMES.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label="Amount ($)">
            <input name="planAmount" type="number" step="0.01" min="0" defaultValue={defaults.planAmount ?? ""} className="input" placeholder="150" />
          </Field>
          <Field label="Billing cadence">
            <select name="cadence" defaultValue={defaults.cadence ?? "MONTHLY"} className="select">
              <option value="MONTHLY">Monthly</option>
              <option value="PER_VISIT">Per visit</option>
              <option value="AD_HOC">Ad hoc</option>
            </select>
          </Field>
          <Field label="Client since">
            <input name="startDate" type="date" defaultValue={defaults.startDate ?? ""} className="input" />
          </Field>
          <Field label="Locked rate until">
            <input name="lockedUntil" type="date" defaultValue={defaults.lockedUntil ?? ""} className="input" />
          </Field>
          <Field label="Locked rate">
            <label className="flex items-center gap-2.5 h-[38px] text-[13.5px] text-[var(--sec)]">
              <input type="checkbox" name="lockedRate" defaultChecked={defaults.lockedRate ?? false} className="accent-[var(--teal)] w-4 h-4" />
              Rate is locked in
            </label>
          </Field>
        </FormGrid>
      </div>

      <FormGrid>
        <Field label="Source">
          <input name="source" defaultValue={defaults.source ?? ""} className="input" placeholder="Referral, Facebook, neighbor..." />
        </Field>
      </FormGrid>

      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={defaults.notes ?? ""} className="textarea" placeholder="Anything worth remembering" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add client"}
        </button>
      </div>
    </form>
  );
}
