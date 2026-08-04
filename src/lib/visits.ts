import { prisma } from "@/lib/db";
import { fmtDur } from "@/lib/duration";

/**
 * Shared loaders for anything that renders visit reports: the /visits page,
 * the client page, and both print views.
 */

/** Everything the report form needs to render its dropdowns and checklists. */
export async function loadFormOptions() {
  const [clients, properties, areas] = await Promise.all([
    prisma.client.findMany({
      where: { status: { in: ["ACTIVE", "LEAD", "PAUSED"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({ select: { id: true, clientId: true, address: true } }),
    prisma.propertyCheckArea.findMany({
      where: { active: true },
      select: { id: true, propertyId: true, label: true, category: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { clients, properties, areas };
}

const reportInclude = {
  client: { select: { id: true, name: true, planName: true, email: true } },
  property: { select: { id: true, address: true, label: true } },
  findings: { orderBy: { sortOrder: "asc" } },
  photos: { orderBy: { sortOrder: "asc" } },
} as const;

export type FullReport = NonNullable<Awaited<ReturnType<typeof getReport>>>;

export async function getReport(id: string) {
  return prisma.visitReport.findUnique({
    where: { id },
    include: {
      ...reportInclude,
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, caption: true, bytes: true, findingId: true, sortOrder: true },
      },
    },
  });
}

/**
 * Every FINAL report for one client inside a date window, oldest first, which
 * is the order the annual record reads in. DRAFTs are deliberately excluded:
 * a half-finished write-up must never end up in a document a client could
 * hand to an adjuster.
 */
export async function getReportsInPeriod(clientId: string, start: Date, end: Date) {
  return prisma.visitReport.findMany({
    where: { clientId, status: "FINAL", visitDate: { gte: start, lte: end } },
    include: {
      ...reportInclude,
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, caption: true, bytes: true, findingId: true, sortOrder: true },
      },
    },
    orderBy: { visitDate: "asc" },
  });
}

/** Total photo bytes stored. Surfaced on /visits so it never surprises anyone. */
export async function photoStorageUsed() {
  const agg = await prisma.visitPhoto.aggregate({ _sum: { bytes: true }, _count: true });
  return { bytes: agg._sum.bytes ?? 0, count: agg._count };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function minutesLabel(min: number | null | undefined): string {
  return fmtDur(min);
}
