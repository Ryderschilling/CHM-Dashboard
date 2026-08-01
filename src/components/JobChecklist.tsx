"use client";

import { useState } from "react";
import { addJobTask, toggleJobTask, deleteJobTask } from "@/actions/jobs";
import { useFire, useSubmit } from "./forms/useSubmit";
import { IconPlus, IconTrash } from "./icons";

export type JobTask = { id: string; title: string; done: boolean };

/**
 * Checklist attached to one job. Every change pushes the job back to Google,
 * so the list shows up in the event description on his phone.
 */
export default function JobChecklist({ jobId, tasks }: { jobId: string; tasks: JobTask[] }) {
  const [adding, setAdding] = useState(false);
  const toggle = useFire(toggleJobTask);
  const remove = useFire(deleteJobTask);
  const { pending, onSubmit } = useSubmit(addJobTask, () => setAdding(false));

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-1.5">
      {tasks.length > 0 && (
        <p className="eyebrow">
          Checklist {doneCount}/{tasks.length}
        </p>
      )}

      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2 group">
          <button
            type="button"
            onClick={() => toggle.fire({ id: t.id })}
            disabled={toggle.pending}
            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              t.done
                ? "bg-[var(--good)] border-[var(--good)] text-[#0a0a0b]"
                : "border-[var(--border)] hover:border-[var(--teal)]"
            }`}
            aria-label={t.done ? "Mark not done" : "Mark done"}
          >
            {t.done && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <span className={`text-[13px] ${t.done ? "line-through text-[var(--mut)]" : ""}`}>{t.title}</span>
          <button
            type="button"
            onClick={() => remove.fire({ id: t.id })}
            disabled={remove.pending}
            className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--mut)] hover:text-[var(--bad)] transition-opacity"
            aria-label="Delete step"
          >
            <IconTrash size={12} />
          </button>
        </div>
      ))}

      {adding ? (
        <form onSubmit={onSubmit} className="flex items-center gap-2 pt-1">
          <input type="hidden" name="jobId" value={jobId} />
          <input
            name="title"
            required
            autoFocus
            className="input !py-1 !text-[13px]"
            placeholder="Check AC filter"
          />
          <button className="btn btn-sm btn-primary" disabled={pending}>
            {pending ? "..." : "Add"}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="text-[12px] text-[var(--mut)] hover:text-[var(--teal)] inline-flex items-center gap-1 transition-colors pt-0.5"
          onClick={() => setAdding(true)}
        >
          <IconPlus size={11} /> Add a step
        </button>
      )}
    </div>
  );
}
