"use client";

import { useEffect } from "react";
import { IconX } from "./icons";

export default function Modal({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" style={wide ? { width: "min(720px, calc(100vw - 32px))" } : undefined}>
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="display font-semibold text-[17px]" style={{ fontStretch: "112%" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--mut)] hover:text-[var(--ink)] transition-colors p-1"
            aria-label="Close"
            type="button"
          >
            <IconX size={17} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}
