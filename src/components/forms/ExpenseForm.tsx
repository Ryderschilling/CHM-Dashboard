"use client";

import { createExpense, updateExpense } from "@/actions/money";
import { todayInput } from "@/lib/format";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type ExpenseDefaults = {
  id?: string;
  date?: string;
  amount?: number;
  category?: string;
  vendor?: string | null;
  description?: string | null;
  workerId?: string | null;
  clientId?: string | null;
  paymentId?: string | null;
};

export default function ExpenseForm({
  defaults = {},
  workers,
  clients = [],
  payments = [],
  onDone,
}: {
  defaults?: ExpenseDefaults;
  workers: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
  payments?: { id: string; label: string }[];
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const { pending, onSubmit } = useSubmit(isEdit ? updateExpense : createExpense, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <FormGrid>
        <Field label="Amount ($)">
          <input name="amount" type="number" step="0.01" min="0" required autoFocus defaultValue={defaults.amount ?? ""} className="input" placeholder="45" />
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={defaults.date ?? todayInput()} className="input" />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={defaults.category ?? "OTHER"} className="select">
            <option value="LABOR">Labor payout</option>
            <option value="SUPPLIES">Supplies</option>
            <option value="GAS">Gas</option>
            <option value="SOFTWARE">Software</option>
            <option value="INSURANCE">Insurance</option>
            <option value="MARKETING">Marketing</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Worker (for labor payouts)">
          <select name="workerId" defaultValue={defaults.workerId ?? ""} className="select">
            <option value="">Not worker related</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Vendor">
          <input name="vendor" defaultValue={defaults.vendor ?? ""} className="input" placeholder="Home Depot, Shell..." />
        </Field>
        {clients.length > 0 && (
          <Field label="Client (for job cost tracking)">
            <select name="clientId" defaultValue={defaults.clientId ?? ""} className="select">
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {payments.length > 0 && (
          <Field label="Invoice (for per-invoice profit)" className="sm:col-span-2">
            <select name="paymentId" defaultValue={defaults.paymentId ?? ""} className="select">
              <option value="">Not tied to an invoice</option>
              {payments.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        )}
      </FormGrid>

      <Field label="Description">
        <input name="description" defaultValue={defaults.description ?? ""} className="input" placeholder="What was it for" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
