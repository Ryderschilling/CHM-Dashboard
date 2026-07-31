"use client";

import { useState } from "react";
import { createPayment, updatePayment } from "@/actions/money";
import { todayInput } from "@/lib/format";
import { Field, FormGrid } from "../ui";
import { useSubmit } from "./useSubmit";

export type PaymentDefaults = {
  id?: string;
  clientId?: string | null;
  amount?: number;
  status?: string;
  dueDate?: string;
  paidDate?: string;
  method?: string | null;
  category?: string;
  description?: string | null;
  invoiceNumber?: string | null;
};

export default function PaymentForm({
  defaults = {},
  clients,
  fixedClientId,
  onDone,
}: {
  defaults?: PaymentDefaults;
  clients: { id: string; name: string }[];
  fixedClientId?: string;
  onDone: () => void;
}) {
  const isEdit = Boolean(defaults.id);
  const [status, setStatus] = useState(defaults.status ?? "PAID");
  const { pending, onSubmit } = useSubmit(isEdit ? updatePayment : createPayment, onDone);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}
      {fixedClientId && <input type="hidden" name="clientId" value={fixedClientId} />}

      <FormGrid>
        {!fixedClientId && (
          <Field label="Client">
            <select name="clientId" defaultValue={defaults.clientId ?? ""} className="select">
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Amount ($)">
          <input name="amount" type="number" step="0.01" min="0" required autoFocus defaultValue={defaults.amount ?? ""} className="input" placeholder="150" />
        </Field>
        <Field label="Status">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="select">
            <option value="PAID">Paid (money received)</option>
            <option value="DUE">Due (sent, waiting on it)</option>
            <option value="UPCOMING">Upcoming (scheduled, not sent yet)</option>
          </select>
        </Field>
        {status === "PAID" ? (
          <Field label="Date received">
            <input name="paidDate" type="date" defaultValue={defaults.paidDate ?? todayInput()} className="input" />
          </Field>
        ) : (
          <Field label={status === "UPCOMING" ? "Sends / due date" : "Due date"}>
            <input name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} className="input" />
          </Field>
        )}
        <Field label="Category">
          <select name="category" defaultValue={defaults.category ?? "RETAINER"} className="select">
            <option value="RETAINER">Retainer</option>
            <option value="A_LA_CARTE">A la carte</option>
            <option value="PROJECT">Project</option>
            <option value="ADD_ON">Add-on</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Method">
          <select name="method" defaultValue={defaults.method ?? "SQUARE"} className="select">
            <option value="SQUARE">Square</option>
            <option value="CASH">Cash</option>
            <option value="CHECK">Check</option>
            <option value="VENMO">Venmo</option>
            <option value="ZELLE">Zelle</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Invoice #">
          <input name="invoiceNumber" defaultValue={defaults.invoiceNumber ?? ""} className="input" placeholder="000058" />
        </Field>
      </FormGrid>

      <Field label="Description">
        <input name="description" defaultValue={defaults.description ?? ""} className="input" placeholder="July home watch, package bring-in x4..." />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add payment"}
        </button>
      </div>
    </form>
  );
}
