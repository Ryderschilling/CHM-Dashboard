"use client";

import { useState } from "react";
import Modal from "./Modal";
import PropertyForm, { type PropertyDefaults } from "./forms/PropertyForm";
import ConfirmDelete from "./forms/ConfirmDelete";
import { deleteProperty } from "@/actions/clients";
import { IconEdit, IconEye, IconEyeOff, IconHome, IconPlus } from "./icons";

function Secret({ value }: { value: string | null | undefined }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="text-[var(--mut)]">Not set</span>;
  return (
    <button
      type="button"
      onClick={() => setShow(!show)}
      className="inline-flex items-center gap-1.5 font-mono text-[13px] hover:text-[var(--teal)] transition-colors"
      title={show ? "Hide" : "Reveal"}
    >
      {show ? value : "••••••"}
      {show ? <IconEyeOff size={12} /> : <IconEye size={12} />}
    </button>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-[12.5px] text-[var(--mut)]">{k}</span>
      <span className="text-[13px] text-right">{children}</span>
    </div>
  );
}

export function PropertyCard({
  property,
  clientId,
}: {
  property: PropertyDefaults & { id: string; address: string };
  clientId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface-2)] text-[var(--teal)]">
            <IconHome size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[14px] truncate">{property.address}</p>
            {property.label && <p className="text-[12px] text-[var(--mut)]">{property.label}</p>}
          </div>
        </div>
        <span className="inline-flex gap-1.5 shrink-0">
          <button className="btn btn-sm" onClick={() => setOpen(true)}>
            <IconEdit size={13} />
          </button>
          <ConfirmDelete action={deleteProperty} id={property.id} />
        </span>
      </div>

      <Row k="Gate code"><Secret value={property.gateCode} /></Row>
      <Row k="Door code"><Secret value={property.doorCode} /></Row>
      <Row k="Alarm"><Secret value={property.alarmCode} /></Row>
      <Row k="WiFi">
        {property.wifiName ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-[12.5px]">{property.wifiName}</span>
            <Secret value={property.wifiPassword} />
          </span>
        ) : (
          <span className="text-[var(--mut)]">Not set</span>
        )}
      </Row>
      <Row k="Key location">{property.keyLocation ?? <span className="text-[var(--mut)]">Not set</span>}</Row>
      {property.trashDay && <Row k="Trash day">{property.trashDay}</Row>}
      {property.hvacNotes && <Row k="HVAC">{property.hvacNotes}</Row>}
      {property.notes && <p className="text-[12.5px] text-[var(--sec)] mt-2">{property.notes}</p>}

      <Modal title="Edit property" open={open} onClose={() => setOpen(false)} wide>
        <PropertyForm clientId={clientId} defaults={property} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

export function AddPropertyButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <IconPlus size={13} /> Add property
      </button>
      <Modal title="Add property" open={open} onClose={() => setOpen(false)} wide>
        <PropertyForm clientId={clientId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
