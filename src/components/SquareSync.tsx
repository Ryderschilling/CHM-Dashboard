"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncSquareAction } from "@/actions/square";

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Read-only Square sync button. Pulls invoices and customers in,
 * never sends anything out.
 */
export default function SquareSync({
  configured,
  lastSync,
}: {
  configured: boolean;
  lastSync: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <span
        className="badge badge-mut"
        title="Add SQUARE_ACCESS_TOKEN to .env to enable read-only sync"
      >
        Square not connected
      </span>
    );
  }

  const run = () =>
    start(async () => {
      setMessage(null);
      const res = await syncSquareAction();
      if (res.ok) {
        const r = res.result;
        setMessage(
          `Pulled ${r.total} invoices (${r.created} new, ${r.updated} updated${r.clientsCreated ? `, ${r.clientsCreated} new clients` : ""}${r.removed ? `, ${r.removed} removed` : ""})`
        );
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });

  return (
    <span className="inline-flex items-center gap-2.5 flex-wrap">
      {message ? (
        <span className="text-[12px] text-[var(--sec)]">{message}</span>
      ) : (
        lastSync && (
          <span className="text-[12px] text-[var(--mut)]">Synced {ago(lastSync)}</span>
        )
      )}
      <button className="btn" onClick={run} disabled={pending} type="button">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={pending ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        {pending ? "Syncing..." : "Sync Square"}
      </button>
    </span>
  );
}
