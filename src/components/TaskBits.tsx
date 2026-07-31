"use client";

import { toggleTask, deleteTask } from "@/actions/tasks";
import { addNote, deleteNote } from "@/actions/clients";
import { useFire, useSubmit } from "./forms/useSubmit";
import ConfirmDelete from "./forms/ConfirmDelete";
import { useRef } from "react";

/** Round check toggle for a task. */
export function TaskToggle({ id, done }: { id: string; done: boolean }) {
  const { pending, fire } = useFire(toggleTask);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => fire({ id })}
      aria-label={done ? "Mark not done" : "Mark done"}
      className={`shrink-0 w-[20px] h-[20px] rounded-full border-2 transition-all flex items-center justify-center ${
        done
          ? "bg-[var(--teal)] border-[var(--teal)]"
          : "border-[var(--border-strong)] hover:border-[var(--teal)]"
      } ${pending ? "opacity-50" : ""}`}
    >
      {done && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

export function TaskDelete({ id }: { id: string }) {
  return <ConfirmDelete action={deleteTask} id={id} />;
}

/** Inline note composer for the client activity log. */
export function NoteComposer({ clientId }: { clientId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const { pending, onSubmit } = useSubmit(addNote, () => ref.current?.reset());
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input
        name="body"
        required
        className="input"
        placeholder="Log something... talked to client, quoted a job, changed a code"
      />
      <button className="btn" disabled={pending}>
        {pending ? "..." : "Log"}
      </button>
    </form>
  );
}

export function NoteDelete({ id }: { id: string }) {
  return <ConfirmDelete action={deleteNote} id={id} />;
}
