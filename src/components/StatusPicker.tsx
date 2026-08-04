"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const MENU_W = 190;
const MENU_H = OPTIONS.length * 44 + 8; // rough, only used to decide flip
const GAP = 6;
const EDGE = 8; // keep this far off the window edge

/**
 * The status badge, but clickable. Pick a status and it saves straight away.
 *
 * The menu renders into document.body as a FIXED element, not as an absolute
 * child. Two reasons, both of which bit the first version:
 *   1. The clients table sits in a `.card.overflow-x-auto`. A horizontal
 *      overflow rule makes the browser clip vertically too, so an absolute
 *      menu got cut off at the edge of the card.
 *   2. The last rows of a long list are near the bottom of the window, so a
 *      menu that always opens downward opens off screen.
 * Fixed positioning escapes the clip, and the menu flips above the badge when
 * there is not enough room below. It repositions on scroll and resize so it
 * stays glued to its badge instead of drifting.
 */
export default function StatusPicker({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { pending, fire } = useFire(setClientStatus);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const flip = below < MENU_H + GAP + EDGE && r.top > below;

    const top = flip ? Math.max(EDGE, r.top - MENU_H - GAP) : r.bottom + GAP;
    const left = Math.min(
      Math.max(EDGE, r.left),
      Math.max(EDGE, window.innerWidth - MENU_W - EDGE),
    );
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Capture, so scrolling any container (the table, the page) is caught.
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btn}
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

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menu}
            role="listbox"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_W, zIndex: 90 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden"
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
          </div>,
          document.body,
        )}
    </>
  );
}
