"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Wire a form to a server action: builds FormData from the form element,
 * runs the action, refreshes server data, then calls onDone.
 */
export function useSubmit(
  action: (fd: FormData) => Promise<void>,
  onDone?: () => void
) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await action(fd);
      router.refresh();
      onDone?.();
    });
  };

  return { pending, onSubmit };
}

/** Fire a server action from a button (mark paid, toggle, delete). */
export function useFire(action: (fd: FormData) => Promise<void>) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const fire = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      await action(fd);
      router.refresh();
    });
  };

  return { pending, fire };
}
