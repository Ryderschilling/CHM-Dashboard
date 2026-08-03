"use client";

import { createWorker, updateWorker } from "@/actions/workers";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type WorkerDefaults = {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  defaultPay?: number | null;
  payNote?: string | null;
  active?: boolean;
  hasPin?: boolean;
};

export default function WorkerForm({
  defaults = {},
  onDone,
}: {
  defaults?: WorkerDefaults;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateWorker : createWorker, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Name" className="sm:col-span-2">
          <input name="name" required autoFocus defaultValue={defaults.name ?? ""} className="input" placeholder="Creighton" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={defaults.phone ?? ""} className="input" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={defaults.email ?? ""} className="input" />
        </Field>
        <Field label="Usual pay per job ($)">
          <input name="defaultPay" type="number" step="0.01" min="0" defaultValue={defaults.defaultPay ?? ""} className="input" placeholder="25" />
        </Field>
        <Field label="Pay notes">
          <input name="payNote" defaultValue={defaults.payNote ?? ""} className="input" placeholder="Paid weekly via Venmo" />
        </Field>
      </FormGrid>

      <Field label={defaults.hasPin ? "Crew PIN (set — enter a new one to change it)" : "Crew PIN (4 to 8 digits)"}>
        <input
          name="pin"
          inputMode="numeric"
          pattern="\d{4,8}"
          autoComplete="off"
          className="input"
          placeholder={defaults.hasPin ? "Leave blank to keep the current PIN" : "e.g. 4821"}
        />
        <p className="text-[12px] text-[var(--mut)] mt-1.5">
          With a PIN they log in at the same page you do and see only their own jobs. No money, ever.
        </p>
      </Field>

      {isEdit && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Field label="Active">
            <label className="flex items-center gap-2.5 text-[13.5px] text-[var(--sec)]">
              <input type="checkbox" name="active" defaultChecked={defaults.active ?? true} className="accent-[var(--teal)] w-4 h-4" />
              Currently working for you
            </label>
          </Field>
          {defaults.hasPin && (
            <Field label="Crew login">
              <label className="flex items-center gap-2.5 text-[13.5px] text-[var(--sec)]">
                <input type="checkbox" name="clearPin" className="accent-[var(--teal)] w-4 h-4" />
                Remove crew login
              </label>
            </Field>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add worker"}
        </button>
      </div>
    </form>
  );
}
