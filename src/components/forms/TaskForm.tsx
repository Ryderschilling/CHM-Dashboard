"use client";

import { createTask, updateTask } from "@/actions/tasks";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type TaskDefaults = {
  id?: string;
  title?: string;
  dueDate?: string;
  priority?: string;
  clientId?: string | null;
  notes?: string | null;
};

export default function TaskForm({
  defaults = {},
  clients,
  fixedClientId,
  onDone,
}: {
  defaults?: TaskDefaults;
  clients: { id: string; name: string }[];
  fixedClientId?: string;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateTask : createTask, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}
      {fixedClientId && <input type="hidden" name="clientId" value={fixedClientId} />}

      <Field label="What needs doing?">
        <input name="title" required autoFocus defaultValue={defaults.title ?? ""} className="input" placeholder="Send Rocky month-2 invoice" />
      </Field>

      <FormGrid>
        <Field label="Due date">
          <input name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} className="input" />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={defaults.priority ?? "NORMAL"} className="select">
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </Field>
        {!fixedClientId && (
          <Field label="Client" className="sm:col-span-2">
            <select name="clientId" defaultValue={defaults.clientId ?? ""} className="select">
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
      </FormGrid>

      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={defaults.notes ?? ""} className="textarea" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add task"}
        </button>
      </div>
    </form>
  );
}
