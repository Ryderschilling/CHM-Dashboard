import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CREW_COOKIE, crewWorkerId } from "@/lib/auth";

/**
 * The signed-in crew member, verified against the database.
 * The middleware only checks the cookie signature (it runs on the Edge with
 * no DB); this is the authoritative check. Deactivating a worker on the Team
 * page locks them out on their next request.
 */
export async function getCrewWorker() {
  const jar = await cookies();
  const id = await crewWorkerId(jar.get(CREW_COOKIE)?.value);
  if (!id) redirect("/login");
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker || !worker.active || !worker.pinHash) redirect("/login");
  return worker;
}
