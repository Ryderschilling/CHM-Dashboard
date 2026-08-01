"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runCalendarSync, setCalendar, disconnectCalendar } from "@/actions/jobs";

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

/**
 * Google Calendar connection strip for the Jobs page.
 * Three states: no app credentials, credentials but not authorized, connected.
 */
export default function CalendarSync({
  configured,
  connected,
  lastSync,
  lastNote,
  calendars,
  currentCalendarId,
}: {
  configured: boolean;
  connected: boolean;
  lastSync: string | null;
  lastNote: string | null;
  calendars: { id: string; summary: string }[];
  currentCalendarId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <span className="badge badge-mut" title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then reload">
        Calendar not set up
      </span>
    );
  }

  if (!connected) {
    return (
      <a href="/api/google/start" className="btn btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Connect Google Calendar
      </a>
    );
  }

  const sync = () =>
    start(async () => {
      setMessage(null);
      const res = await runCalendarSync();
      setMessage(res.message);
      router.refresh();
    });

  const pickCalendar = (id: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("calendarId", id);
      await setCalendar(fd);
      router.refresh();
    });

  const disconnect = () =>
    start(async () => {
      await disconnectCalendar();
      router.refresh();
    });

  return (
    <span className="inline-flex items-center gap-2.5 flex-wrap">
      {message ? (
        <span className="text-[12px] text-[var(--sec)]">{message}</span>
      ) : lastSync ? (
        <span className="text-[12px] text-[var(--mut)]" title={lastNote ?? undefined}>
          Calendar synced {ago(lastSync)}
        </span>
      ) : (
        <span className="text-[12px] text-[var(--mut)]">Never synced</span>
      )}

      {calendars.length > 1 && (
        <select
          className="select !py-1 !text-[12px] !w-auto"
          value={currentCalendarId}
          onChange={(e) => pickCalendar(e.target.value)}
          disabled={pending}
        >
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>{c.summary}</option>
          ))}
        </select>
      )}

      <button className="btn" onClick={sync} disabled={pending} type="button">
        <SyncIcon spinning={pending} />
        {pending ? "Syncing..." : "Sync calendar"}
      </button>

      <button
        className="btn btn-sm"
        onClick={disconnect}
        disabled={pending}
        type="button"
        title="Forget the Google authorization. Jobs stay, they just stop syncing."
      >
        Disconnect
      </button>
    </span>
  );
}
