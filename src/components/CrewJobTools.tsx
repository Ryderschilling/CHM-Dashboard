"use client";

import { useState } from "react";
import { crewToggleTask, crewSetJobDone, crewAddNote } from "@/actions/crew";
import { useFire, useSubmit } from "./forms/useSubmit";

export type CrewTask = { id: string; title: string; done: boolean };

/** Read-and-check checklist. Crew can tick steps, not add or delete them. */
export function CrewChecklist({ tasks }: { tasks: CrewTask[] }) {
  const toggle = useFire(crewToggleTask);
  const doneCount = tasks.filter((t) => t.done).length;

  if (tasks.length === 0) {
    return <p className="text-[13px] text-[var(--mut)]">No checklist on this job.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="eyebrow mb-2">
        Checklist {doneCount}/{tasks.length}
      </p>
      {tasks.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle.fire({ id: t.id })}
          disabled={toggle.pending}
          className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left"
        >
          <span
            className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              t.done
                ? "bg-[var(--good)] border-[var(--good)] text-[#0a0a0b]"
                : "border-[var(--border)]"
            }`}
          >
            {t.done && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span className={`text-[14px] ${t.done ? "line-through text-[var(--mut)]" : ""}`}>
            {t.title}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The tap-to-complete circle on each schedule row. Toggles done in place. */
export function CrewCheckCircle({ jobId, done }: { jobId: string; done: boolean }) {
  const fire = useFire(crewSetJobDone);
  return (
    <button
      type="button"
      onClick={() => fire.fire({ id: jobId, done: done ? "false" : "true" })}
      disabled={fire.pending}
      aria-label={done ? "Mark not done" : "Mark done"}
      title={done ? "Done · tap to undo" : "Mark done"}
      className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
        done
          ? "bg-[var(--good)] border-[var(--good)] text-[#0a0a0b]"
          : "border-[var(--border)] hover:border-[var(--good)] text-transparent hover:text-[var(--border)]"
      } ${fire.pending ? "opacity-50" : ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

/** One big obvious button: mark the visit done, or undo a mis-tap. */
export function CrewDoneButton({ jobId, done }: { jobId: string; done: boolean }) {
  const fire = useFire(crewSetJobDone);
  return (
    <button
      type="button"
      onClick={() => fire.fire({ id: jobId, done: done ? "false" : "true" })}
      disabled={fire.pending}
      className={`btn w-full !py-3 !text-[15px] ${done ? "" : "btn-primary"}`}
    >
      {fire.pending ? "Saving..." : done ? "Marked done · tap to undo" : "Mark job done"}
    </button>
  );
}

/** Leave a note for Ryder. Lands on the job, stamped with name and time. */
export function CrewNoteForm({ jobId }: { jobId: string }) {
  const [text, setText] = useState("");
  const { pending, onSubmit } = useSubmit(crewAddNote, () => setText(""));

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="id" value={jobId} />
      <textarea
        name="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        required
        className="input !text-[14px]"
        placeholder="Anything Ryder should know? Filter looked worn, gate was open..."
      />
      <button className="btn w-full" disabled={pending || !text.trim()}>
        {pending ? "Sending..." : "Send note"}
      </button>
    </form>
  );
}
