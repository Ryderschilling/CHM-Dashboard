"use client";

import { useState } from "react";
import { parseDuration, fmtDur } from "@/lib/duration";

/**
 * One box for time. Type it however it comes out of your head:
 * 45, 5, 1h30, 1:15, 90m, 2h, 1.5.
 *
 * The raw text is what gets submitted. The server parses it with the same
 * parseDuration, so there is one parser and no hidden field to fall out of
 * sync. The line underneath shows what it read, so a typo is obvious before
 * you save. Chips are there for the times that repeat all week.
 */
const CHIPS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function DurationInput({
  name,
  defaultMinutes,
  suggestedMinutes,
  autoFocus,
  chips = true,
  placeholder = "45, 1h30, 1:15",
  hint,
}: {
  name: string;
  /** What is already on the record. */
  defaultMinutes?: number | null;
  /** A standard time to open with when nothing is recorded yet. */
  suggestedMinutes?: number | null;
  autoFocus?: boolean;
  chips?: boolean;
  placeholder?: string;
  /** Extra line under the box, e.g. where a suggested time came from. */
  hint?: string;
}) {
  const opening = defaultMinutes ?? suggestedMinutes ?? null;
  const [text, setText] = useState(opening ? fmtDur(opening) : "");
  const parsed = parseDuration(text);
  const bad = text.trim().length > 0 && (parsed == null || parsed <= 0);

  return (
    <>
      <input
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input"
        placeholder={placeholder}
      />

      {chips && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {CHIPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setText(fmtDur(m))}
              className={`btn btn-sm ${parsed === m ? "btn-primary" : ""}`}
            >
              {fmtDur(m)}
            </button>
          ))}
        </div>
      )}

      <p
        className={`text-[11.5px] mt-1 ${bad ? "text-[var(--bad)]" : "text-[var(--mut)]"}`}
      >
        {bad
          ? "Could not read that. Try 45, 1h30, or 1:15."
          : parsed
            ? `Reads as ${fmtDur(parsed)}`
            : (hint ?? "Minutes unless you say otherwise. 5 is five minutes, 1h30 is an hour and a half.")}
      </p>
      {parsed != null && parsed > 0 && hint && (
        <p className="text-[11.5px] text-[var(--mut)] mt-0.5">{hint}</p>
      )}
    </>
  );
}
