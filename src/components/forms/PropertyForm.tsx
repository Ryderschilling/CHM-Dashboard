"use client";

import { createProperty, updateProperty } from "@/actions/clients";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type PropertyDefaults = {
  id?: string;
  label?: string | null;
  address?: string;
  gateCode?: string | null;
  doorCode?: string | null;
  alarmCode?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  keyLocation?: string | null;
  trashDay?: string | null;
  hvacNotes?: string | null;
  notes?: string | null;
};

export default function PropertyForm({
  clientId,
  defaults = {},
  onDone,
}: {
  clientId: string;
  defaults?: PropertyDefaults;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateProperty : createProperty, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : (
        <input type="hidden" name="clientId" value={clientId} />
      )}

      <FormGrid>
        <Field label="Address" className="sm:col-span-2">
          <input name="address" required autoFocus defaultValue={defaults.address ?? ""} className="input" placeholder="94 Roundwood Dr, Inlet Beach" />
        </Field>
        <Field label="Label">
          <input name="label" defaultValue={defaults.label ?? ""} className="input" placeholder="Main home" />
        </Field>
        <Field label="Trash day">
          <input name="trashDay" defaultValue={defaults.trashDay ?? ""} className="input" placeholder="Tuesday" />
        </Field>
      </FormGrid>

      <div className="border-t border-[var(--border)] pt-4">
        <p className="eyebrow mb-3">Access (kept behind the password)</p>
        <FormGrid>
          <Field label="Gate code">
            <input name="gateCode" defaultValue={defaults.gateCode ?? ""} className="input" />
          </Field>
          <Field label="Door code">
            <input name="doorCode" defaultValue={defaults.doorCode ?? ""} className="input" />
          </Field>
          <Field label="Alarm code">
            <input name="alarmCode" defaultValue={defaults.alarmCode ?? ""} className="input" />
          </Field>
          <Field label="Key location">
            <input name="keyLocation" defaultValue={defaults.keyLocation ?? ""} className="input" placeholder="Lockbox on side door" />
          </Field>
          <Field label="WiFi network">
            <input name="wifiName" defaultValue={defaults.wifiName ?? ""} className="input" />
          </Field>
          <Field label="WiFi password">
            <input name="wifiPassword" defaultValue={defaults.wifiPassword ?? ""} className="input" />
          </Field>
        </FormGrid>
      </div>

      <FormGrid>
        <Field label="HVAC notes">
          <input name="hvacNotes" defaultValue={defaults.hvacNotes ?? ""} className="input" placeholder="Filter size 20x25x1, preset 72" />
        </Field>
        <Field label="Other notes">
          <input name="notes" defaultValue={defaults.notes ?? ""} className="input" />
        </Field>
      </FormGrid>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add property"}
        </button>
      </div>
    </form>
  );
}
