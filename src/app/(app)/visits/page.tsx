import { redirect } from "next/navigation";

/**
 * The Visits index is gone as of 2026-08-05. Reports were never deleted, they
 * live on each client's page now (and at /visits/[id], which is still a real
 * page and still what the printed Coverage Record is built from).
 */
export default async function VisitsMoved({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.client ? `/clients/${sp.client}` : "/clients");
}
