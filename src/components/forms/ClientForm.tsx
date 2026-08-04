"use client";

import { useState } from "react";
import { createClient, updateClient } from "@/actions/clients";
import { money } from "@/lib/format";
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
  visitsPerMonth?: number | null;
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

  // The money fields change meaning with the cadence, so the labels and the
  // preview line follow it live instead of making Ryder remember the rule.
  const [cadence, setCadence] = useState(defaults.cadence ?? "MONTHLY");
  const [amount, setAmount] = useState(String(defaults.planAmount ?? ""));
  const [visits, setVisits] = useState(String(defaults.visitsPerMonth ?? ""));
  const monthly = cadence === "MONTHLY";
  const amt = Number(amount);
  const vis = Number(visits);
  const perVisit = monthly && amt > 0 && vis > 0 ? amt / vis : null;

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
          <Field label="Billing cadence">
            <select
              name="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="select"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="PER_VISIT">Per visit</option>
              <option value="AD_HOC">Ad hoc</option>
            </select>
          </Field>
          <Field label={monthly ? "Amount a month ($)" : "Rate per visit ($)"}>
            <input
              name="planAmount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder={monthly ? "150" : "20"}
            />
          </Field>
          {monthly && (
            <Field label="Visits a month">
              <input
                name="visitsPerMonth"
                type="number"
                step="1"
                min="1"
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
                className="input"
                placeholder="4"
              />
            </Field>
          )}
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

        <p className="text-[11.5px] text-[var(--mut)] mt-3 leading-relaxed">
          {monthly ? (
            perVisit != null ? (
              <>
                <span className="text-[var(--teal)] font-medium">
                  {money(amt)} over {vis} visit{vis === 1 ? "" : "s"} = {money(perVisit)} a visit.
                </span>{" "}
                Every visit this month is worth that, whatever the calendar looks
                like. Visit {vis + 1} and beyond shows $0 and gets tagged over plan,
                because the plan does not pay twice. Put a one-off charge on it if
                you billed for it separately.
              </>
            ) : (
              "Set visits a month and every visit gets a real dollar value: the monthly amount divided by that number. Leave it blank and it falls back to counting whatever is on the calendar that month, which moves around."
            )
          ) : (
            "Off plan, so the amount is a flat rate per visit. Set it once and every job for this client is worth that much without typing a charge. A one-off charge on a job still overrides it."
          )}
        </p>
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
