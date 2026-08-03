import { getCrewWorker } from "@/lib/crew";
import { logout } from "@/actions/auth";

/**
 * The employee shell. Deliberately minimal: no sidebar, no dashboard,
 * no money, one column sized for a phone in the field.
 */
export default async function CrewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const worker = await getCrewWorker();
  const firstName = worker.name.split(" ")[0];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto max-w-[640px] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chm-logo.png" alt="CHM" className="h-[20px] w-auto" />
            <span className="text-[12px] text-[var(--mut)]">Crew · {firstName}</span>
          </div>
          <form action={logout}>
            <button className="btn btn-sm" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-16">{children}</main>
    </div>
  );
}
