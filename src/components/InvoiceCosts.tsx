"use client";

/**
 * Per-invoice profit: attach expenses (materials, supplies, subcontract
 * costs) to a payment and see what you actually kept.
 */

import { useRef, useState } from "react";
import Modal from "./Modal";
import ConfirmDelete from "./forms/ConfirmDelete";
import { useSubmit } from "./forms/useSubmit";
import { createExpense, deleteExpense } from "@/actions/money";
import { Field } from "./ui";
import { todayInput } from "@/lib/format";

export type LinkedExpense = {
  id: string;
  amount: number;
  description: string | null;
  category: string;
  dateLabel: string;
};

function usd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.abs(n % 1) >= 0.005 ? 2 : 0,
    maximumFractionDigits: Math.abs(n % 1) >= 0.005 ? 2 : 0,
  });
}

export default function InvoiceCosts({
  payment,
  expenses,
}: {
  payment: { id: string; amount: number; label: string };
  expenses: LinkedExpense[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, onSubmit } = useSubmit(createExpense, () => formRef.current?.reset());

  const costs = expenses.reduce((s, e) => s + e.amount, 0);
  const net = payment.amount - costs;

  return (
    <>
      <button
        className="btn btn-sm"
        onClick={() => setOpen(true)}
        title="Costs and profit on this invoice"
        type="button"
      >
        {expenses.length ? (
          <span className={net >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}>
            net {usd(net)}
          </span>
        ) : (
          "Costs"
        )}
      </button>

      <Modal title="Profit on this invoice" open={open} onClose={() => setOpen(false)}>
        <p className="text-[13px] text-[var(--sec)] -mt-1 mb-4">{payment.label}</p>

        {/* The math */}
        <div className="card p-4 mb-4 space-y-1.5">
          <p className="flex justify-between text-[13.5px]">
            <span className="text-[var(--sec)]">Invoice</span>
            <span className="font-semibold tabular-nums">{usd(payment.amount)}</span>
          </p>
          {expenses.map((e) => (
            <p key={e.id} className="flex justify-between items-center text-[13px] group">
              <span className="text-[var(--mut)] truncate pr-3">
                {e.description ?? e.category.toLowerCase()}
                <span className="text-[11px]"> · {e.dateLabel}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="tabular-nums text-[var(--warn)]">-{usd(e.amount)}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ConfirmDelete action={deleteExpense} id={e.id} />
                </span>
              </span>
            </p>
          ))}
          <p className="flex justify-between text-[15px] border-t border-[var(--border)] pt-2 mt-2">
            <span className="font-semibold">Your profit</span>
            <span className={`stat-num ${net >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
              {usd(net)}
            </span>
          </p>
        </div>

        {/* Quick add */}
        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="paymentId" value={payment.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost ($)">
              <input name="amount" type="number" step="0.01" min="0" required className="input" placeholder="150" />
            </Field>
            <Field label="Category">
              <select name="category" defaultValue="SUPPLIES" className="select">
                <option value="SUPPLIES">Supplies / materials</option>
                <option value="LABOR">Labor payout</option>
                <option value="GAS">Gas</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="What was it?">
              <input name="description" className="input" placeholder="Artificial rock cover" />
            </Field>
            <Field label="Date">
              <input name="date" type="date" defaultValue={todayInput()} className="input" />
            </Field>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Adding..." : "Add cost"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
