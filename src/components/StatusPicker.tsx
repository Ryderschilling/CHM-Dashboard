"use client";

import { useEffect, useRef, useState } from "react";
import { setClientStatus } from "@/actions/clients";
import { useFire } from "./forms/useSubmit";
import { StatusBadge } from "./ui";

const OPTIONS = [
  { value: "ACTIVE", label: "Active", hint: "Paying or working with you now" },
  { value: "LEAD", label: "Lead", hint: "Talking, not closed yet" },
  { value: "ONE_TIME", label: "One time", hint: "Bought once, no plan" },
  { value: "PAUSED", label: "Paused", hint: "On hold, coming back" },
  { value: "FORMER", label: "Former", hint: "Done working together" },
];

/**
 * The status badge on the clients list, but clickable. Pick a status and it
 * saves straight away. No modal, no form, no save button, because changing
 * one word should not cost four clicks.
 */
export default function StatusPicker({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  const { pending, fire } = useFire(setClientStatus);
  const box = useRef<HTMLDivElement>(null);

  // Click anywhere else, or hit escape, and it closes.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title="Click to change status"
        className="inline-flex items-center gap-1 rounded-md transition-opacity hover:opacity-70 disabled:opacity-40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <StatusBadge status={status} />
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="text-[var(--mut)]">
          <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 top-[calc(100%+6px)] w-[190px] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === status}
              onClick={() => {
                setOpen(false);
                if (o.value !== status) fire({ id, status: o.value });
              }}
              className={`w-full text-left px-3 py-2 transition-colors hover:bg-[var(--surface-2)] ${
                o.value === status ? "bg-[var(--surface-2)]" : ""
              }`}
            >
              <span className="block text-[13px] font-medium">{o.label}</span>
              <span className="block text-[11.5px] text-[var(--mut)]">{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
