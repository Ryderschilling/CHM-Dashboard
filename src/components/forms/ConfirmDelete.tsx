"use client";

import { useState } from "react";
import { useFire } from "./useSubmit";
import { IconTrash } from "../icons";

/** Two-tap delete: first tap arms it, second tap fires the action. */
export default function ConfirmDelete({
  action,
  id,
  label = "Delete",
  small = true,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label?: string;
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const { pending, fire } = useFire(action);

  if (!armed) {
    return (
      <button
        type="button"
        className={`btn ${small ? "btn-sm" : ""} btn-danger`}
        onClick={() => {
          setArmed(true);
          setTimeout(() => setArmed(false), 3500);
        }}
        title={label}
      >
        <IconTrash size={13} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn ${small ? "btn-sm" : ""} btn-danger`}
      style={{ borderColor: "var(--bad)", background: "rgba(229,72,77,0.12)" }}
      disabled={pending}
      onClick={() => fire({ id })}
    >
      {pending ? "..." : "Sure?"}
    </button>
  );
}
