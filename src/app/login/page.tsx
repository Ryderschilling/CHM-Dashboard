"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <main className="min-h-dvh flex items-center justify-center aurora px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-[var(--teal)]">
            <span className="display font-bold text-xl text-[var(--teal-ink)]">C</span>
          </div>
          <h1 className="display font-semibold text-3xl tracking-tight" style={{ fontStretch: "118%" }}>
            CHM OPS
          </h1>
          <p className="text-[var(--mut)] text-sm mt-2">
            Coastal Home Management 30A command center
          </p>
        </div>

        <form
          action={action}
          className="card p-6 space-y-4"
          style={state?.error ? { animation: "shake 0.4s" } : undefined}
        >
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              className="input"
              placeholder="Enter dashboard password"
            />
          </div>
          {state?.error && (
            <p className="text-[13px] text-[var(--bad)]">{state.error}</p>
          )}
          <button className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Checking..." : "Unlock"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--mut)] mt-6">
          Private system. Client access codes live here, keep the password tight.
        </p>
      </div>
    </main>
  );
}
