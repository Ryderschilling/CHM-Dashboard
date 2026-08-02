"use client";

/**
 * Modal launcher buttons and row actions for every entity.
 * Each wraps a form component in the shared Modal.
 */

import { useState } from "react";
import Modal from "./Modal";
import { IconEdit, IconPlus } from "./icons";
import ClientForm, { type ClientDefaults } from "./forms/ClientForm";
import PaymentForm, { type PaymentDefaults } from "./forms/PaymentForm";
import JobForm, { type JobDefaults } from "./forms/JobForm";
import TaskForm, { type TaskDefaults } from "./forms/TaskForm";
import ExpenseForm, { type ExpenseDefaults } from "./forms/ExpenseForm";
import WorkerForm, { type WorkerDefaults } from "./forms/WorkerForm";
import ConfirmDelete from "./forms/ConfirmDelete";
import { useFire, useSubmit } from "./forms/useSubmit";
import { deleteClient } from "@/actions/clients";
import { deletePayment, markPaymentPaid, deleteExpense } from "@/actions/money";
import { deleteJob, completeJob } from "@/actions/jobs";
import { deleteWorker } from "@/actions/workers";
import ShutoffForm, { type ShutoffDefaults } from "./forms/ShutoffForm";
import AlertForm, { type AlertDefaults } from "./forms/AlertForm";
import CoverageForm, { type CoverageDefaults } from "./forms/CoverageForm";
import VisitReportForm, { type VisitDefaults, type AreaOpt } from "./forms/VisitReportForm";
import { deleteVisitReport, finalizeVisitReport } from "@/actions/visits";
import {
  deleteShutoffDevice,
  deleteShutoffAlert,
  deleteCoverageRecord,
  markDeviceChecked,
  resolveShutoffAlert,
  markCoverageSent,
  renewCoverageRecord,
} from "@/actions/protection";
import { Field, FormGrid } from "./ui";

type Opt = { id: string; name: string };
type PropOpt = { id: string; clientId: string; address: string };

/* ---------------- Clients ---------------- */

export function AddClientButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <IconPlus size={14} /> Add client
      </button>
      <Modal title="Add client" open={open} onClose={() => setOpen(false)} wide>
        <ClientForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EditClientButton({ defaults }: { defaults: ClientDefaults }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <IconEdit size={13} /> Edit
      </button>
      <Modal title={`Edit ${defaults.name ?? "client"}`} open={open} onClose={() => setOpen(false)} wide>
        <ClientForm defaults={defaults} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function DeleteClientButton({ id }: { id: string }) {
  return <ConfirmDelete action={deleteClient} id={id} small={false} />;
}

/* ---------------- Payments ---------------- */

export function AddPaymentButton({
  clients,
  fixedClientId,
  autoOpen = false,
  label = "Add payment",
  primary = true,
}: {
  clients: Opt[];
  fixedClientId?: string;
  autoOpen?: boolean;
  label?: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> {label}
      </button>
      <Modal title="Add payment" open={open} onClose={() => setOpen(false)}>
        <PaymentForm clients={clients} fixedClientId={fixedClientId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function PaymentActions({
  payment,
  clients,
}: {
  payment: PaymentDefaults & { id: string; status: string };
  clients: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const { pending, fire } = useFire(markPaymentPaid);
  return (
    <span className="inline-flex items-center gap-1.5">
      {payment.status !== "PAID" && (
        <button className="btn btn-sm" disabled={pending} onClick={() => fire({ id: payment.id })}>
          {pending ? "..." : "Mark paid"}
        </button>
      )}
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deletePayment} id={payment.id} />
      <Modal title="Edit payment" open={open} onClose={() => setOpen(false)}>
        <PaymentForm defaults={payment} clients={clients} onDone={() => setOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Jobs ---------------- */

export function AddJobButton({
  clients,
  workers,
  properties,
  fixedClientId,
  autoOpen = false,
  primary = true,
}: {
  clients: Opt[];
  workers: Opt[];
  properties: PropOpt[];
  fixedClientId?: string;
  autoOpen?: boolean;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> Add job
      </button>
      <Modal title="Add job" open={open} onClose={() => setOpen(false)} wide>
        <JobForm clients={clients} workers={workers} properties={properties} fixedClientId={fixedClientId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function CompleteJobModal({
  job,
  open,
  onClose,
}: {
  job: JobDefaults & { id: string; title?: string };
  open: boolean;
  onClose: () => void;
}) {
  const { pending, onSubmit } = useSubmit(completeJob, onClose);
  return (
    <Modal title="Mark job done" open={open} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="id" value={job.id} />
        <p className="text-[13.5px] text-[var(--sec)] -mt-1">{job.title}</p>
        <FormGrid>
          <Field label="Time on the job (hours)">
            <input name="laborHours" type="number" step="0.25" min="0" autoFocus defaultValue={job.laborHours ?? ""} className="input" placeholder="0.75" />
          </Field>
          <Field label="Paid out ($)">
            <input name="laborCost" type="number" step="0.01" min="0" defaultValue={job.laborCost || ""} className="input" placeholder="0 if you did it" />
          </Field>
          <Field label="One-off charge ($)" className="sm:col-span-2">
            <input name="chargeAmount" type="number" step="0.01" min="0" defaultValue={job.chargeAmount ?? ""} className="input" placeholder="Leave blank when the plan covers it" />
          </Field>
        </FormGrid>
        <label className="flex items-center gap-2.5 text-[13.5px] text-[var(--sec)]">
          <input type="checkbox" name="billClient" className="accent-[var(--teal)] w-4 h-4" />
          Also put this charge on the client tab as due
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Saving..." : "Mark done"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function JobActions({
  job,
  clients,
  workers,
  properties,
}: {
  job: JobDefaults & { id: string; status: string };
  clients: Opt[];
  workers: Opt[];
  properties: PropOpt[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      {job.status === "SCHEDULED" && (
        <button className="btn btn-sm" onClick={() => setDoneOpen(true)}>
          Done
        </button>
      )}
      <button className="btn btn-sm" onClick={() => setEditOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteJob} id={job.id} />
      <Modal title="Edit job" open={editOpen} onClose={() => setEditOpen(false)} wide>
        <JobForm defaults={job} clients={clients} workers={workers} properties={properties} onDone={() => setEditOpen(false)} />
      </Modal>
      <CompleteJobModal job={job} open={doneOpen} onClose={() => setDoneOpen(false)} />
    </span>
  );
}

/* ---------------- Tasks ---------------- */

export function AddTaskButton({
  clients,
  fixedClientId,
  autoOpen = false,
  primary = true,
}: {
  clients: Opt[];
  fixedClientId?: string;
  autoOpen?: boolean;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> Add task
      </button>
      <Modal title="Add task" open={open} onClose={() => setOpen(false)}>
        <TaskForm clients={clients} fixedClientId={fixedClientId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EditTaskButton({
  task,
  clients,
}: {
  task: TaskDefaults & { id: string };
  clients: Opt[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <Modal title="Edit task" open={open} onClose={() => setOpen(false)}>
        <TaskForm defaults={task} clients={clients} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

/* ---------------- Expenses ---------------- */

export function AddExpenseButton({
  workers,
  clients = [],
  payments = [],
  defaults,
  label = "Add expense",
  autoOpen = false,
  primary = true,
}: {
  workers: Opt[];
  clients?: Opt[];
  payments?: { id: string; label: string }[];
  defaults?: ExpenseDefaults;
  label?: string;
  autoOpen?: boolean;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> {label}
      </button>
      <Modal title={label} open={open} onClose={() => setOpen(false)}>
        <ExpenseForm defaults={defaults} workers={workers} clients={clients} payments={payments} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function ExpenseActions({
  expense,
  workers,
  clients = [],
  payments = [],
}: {
  expense: ExpenseDefaults & { id: string };
  workers: Opt[];
  clients?: Opt[];
  payments?: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteExpense} id={expense.id} />
      <Modal title="Edit expense" open={open} onClose={() => setOpen(false)}>
        <ExpenseForm defaults={expense} workers={workers} clients={clients} payments={payments} onDone={() => setOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Workers ---------------- */

export function AddWorkerButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <IconPlus size={14} /> Add worker
      </button>
      <Modal title="Add worker" open={open} onClose={() => setOpen(false)}>
        <WorkerForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function WorkerActions({ worker }: { worker: WorkerDefaults & { id: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <IconEdit size={13} /> Edit
      </button>
      <ConfirmDelete action={deleteWorker} id={worker.id} />
      <Modal title={`Edit ${worker.name}`} open={open} onClose={() => setOpen(false)}>
        <WorkerForm defaults={worker} onDone={() => setOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Protection: shutoff devices ---------------- */

export function AddShutoffButton({
  clients,
  properties,
  autoOpen = false,
  label = "Add device",
  primary = true,
}: {
  clients: Opt[];
  properties: PropOpt[];
  autoOpen?: boolean;
  label?: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> {label}
      </button>
      <Modal title="Add water shutoff device" open={open} onClose={() => setOpen(false)} wide>
        <ShutoffForm clients={clients} properties={properties} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function ShutoffActions({
  device,
  clients,
  properties,
  devices,
}: {
  device: ShutoffDefaults & { id: string };
  clients: Opt[];
  properties: PropOpt[];
  devices: { id: string; label: string }[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const { pending, fire } = useFire(markDeviceChecked);

  return (
    <span className="inline-flex items-center gap-1.5">
      <button className="btn btn-sm" disabled={pending} onClick={() => fire({ id: device.id })} title="Stamp today as the last health check">
        {pending ? "..." : "Checked"}
      </button>
      <button className="btn btn-sm" onClick={() => setAlertOpen(true)}>
        Alert
      </button>
      <button className="btn btn-sm" onClick={() => setEditOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteShutoffDevice} id={device.id} />
      <Modal title="Edit device" open={editOpen} onClose={() => setEditOpen(false)} wide>
        <ShutoffForm defaults={device} clients={clients} properties={properties} onDone={() => setEditOpen(false)} />
      </Modal>
      <Modal title="Log an alert" open={alertOpen} onClose={() => setAlertOpen(false)} wide>
        <AlertForm defaults={{ deviceId: device.id }} devices={devices} onDone={() => setAlertOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Protection: alerts ---------------- */

export function AddAlertButton({
  devices,
  primary = false,
}: {
  devices: { id: string; label: string }[];
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> Log alert
      </button>
      <Modal title="Log an alert" open={open} onClose={() => setOpen(false)} wide>
        <AlertForm devices={devices} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function AlertActions({
  alert,
  devices,
}: {
  alert: AlertDefaults & { id: string; resolved: boolean };
  devices: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const { pending, fire } = useFire(resolveShutoffAlert);
  return (
    <span className="inline-flex items-center gap-1.5">
      {!alert.resolved && (
        <button className="btn btn-sm" disabled={pending} onClick={() => fire({ id: alert.id })}>
          {pending ? "..." : "Resolve"}
        </button>
      )}
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteShutoffAlert} id={alert.id} />
      <Modal title="Edit alert" open={open} onClose={() => setOpen(false)} wide>
        <AlertForm defaults={alert} devices={devices} onDone={() => setOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Protection: coverage records ---------------- */

export function AddCoverageButton({
  clients,
  autoOpen = false,
  label = "Enroll client",
  primary = true,
}: {
  clients: Opt[];
  autoOpen?: boolean;
  label?: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> {label}
      </button>
      <Modal title="Annual Coverage Record" open={open} onClose={() => setOpen(false)} wide>
        <CoverageForm clients={clients} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function CoverageActions({
  record,
  clients,
}: {
  record: CoverageDefaults & { id: string; status: string };
  clients: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const sent = useFire(markCoverageSent);
  const renew = useFire(renewCoverageRecord);
  const isSent = record.status === "SENT";

  return (
    <span className="inline-flex items-center gap-1.5">
      {!isSent && (
        <button className="btn btn-sm" disabled={sent.pending} onClick={() => sent.fire({ id: record.id })}>
          {sent.pending ? "..." : "Mark sent"}
        </button>
      )}
      {isSent && (
        <button className="btn btn-sm" disabled={renew.pending} onClick={() => renew.fire({ id: record.id })} title="Start the next 12-month period">
          {renew.pending ? "..." : "Renew"}
        </button>
      )}
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteCoverageRecord} id={record.id} />
      <Modal title="Edit coverage record" open={open} onClose={() => setOpen(false)} wide>
        <CoverageForm defaults={record} clients={clients} onDone={() => setOpen(false)} />
      </Modal>
    </span>
  );
}

/* ---------------- Visit reports ---------------- */

export function ReportVisitButton({
  clients,
  properties,
  areas,
  defaults,
  label = "Report a visit",
  primary = true,
  small = false,
  autoOpen = false,
}: {
  clients: Opt[];
  properties: PropOpt[];
  areas: AreaOpt[];
  defaults?: VisitDefaults;
  label?: string;
  primary?: boolean;
  small?: boolean;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button
        className={`btn ${primary ? "btn-primary" : ""} ${small ? "btn-sm" : ""}`}
        onClick={() => setOpen(true)}
      >
        {!small && <IconPlus size={14} />} {label}
      </button>
      <Modal title="Home watch visit report" open={open} onClose={() => setOpen(false)} wide>
        <VisitReportForm
          defaults={defaults}
          clients={clients}
          properties={properties}
          areas={areas}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

export function VisitReportActions({
  report,
  clients,
  properties,
  areas,
}: {
  report: VisitDefaults & { id: string; status: string };
  clients: Opt[];
  properties: PropOpt[];
  areas: AreaOpt[];
}) {
  const [open, setOpen] = useState(false);
  const { pending, fire } = useFire(finalizeVisitReport);
  return (
    <span className="inline-flex items-center gap-1.5">
      {report.status === "DRAFT" && (
        <button className="btn btn-sm" disabled={pending} onClick={() => fire({ id: report.id })}>
          {pending ? "..." : "Finalize"}
        </button>
      )}
      <button className="btn btn-sm" onClick={() => setOpen(true)} title="Edit">
        <IconEdit size={13} />
      </button>
      <ConfirmDelete action={deleteVisitReport} id={report.id} />
      <Modal title="Edit visit report" open={open} onClose={() => setOpen(false)} wide>
        <VisitReportForm
          defaults={report}
          clients={clients}
          properties={properties}
          areas={areas}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </span>
  );
}
