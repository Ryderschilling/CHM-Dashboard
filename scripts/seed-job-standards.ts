/**
 * Standard job times, as measured.
 *
 * Ryder times a job on the route, the number goes in the list below, this runs
 * once and every occurrence of that job starts counting itself. Safe to re-run:
 * rows are matched on the calendar series when there is one, otherwise on the
 * label, and updated in place.
 *
 * Run: npx tsx scripts/seed-job-standards.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Entry = {
  label: string;
  minutes: number;
  /** Google Calendar recurringEventId. The exact matcher, use it when known. */
  gcalSeriesId?: string;
  /** Case-insensitive substring of the job title. Defaults to the label. */
  titleMatch?: string;
  /** Client name exactly as it reads in CHM Ops. Optional. */
  client?: string;
  notes?: string;
};

const ENTRIES: Entry[] = [
  {
    label: "Beth Tedesco Mail",
    minutes: 15,
    gcalSeriesId: "p6smrl4j9srh09h642u6be9ni0",
    titleMatch: "Tedesco Mail",
    client: "Beth Tedesco",
    notes: "Timed 2026-08-03. Garage, lockbox, mailbox 37 at the back, back to the stool. No real variation.",
  },
  // Add the rest of the route here as Ryder times it.
];

async function main() {
  for (const e of ENTRIES) {
    const client = e.client
      ? await prisma.client.findFirst({ where: { name: { equals: e.client, mode: "insensitive" } } })
      : null;
    if (e.client && !client) {
      console.warn(`  ! no client named "${e.client}" - saving the standard without a client link`);
    }

    const data = {
      label: e.label,
      minutes: e.minutes,
      gcalSeriesId: e.gcalSeriesId ?? null,
      titleMatch: e.titleMatch ?? e.label,
      clientId: client?.id ?? null,
      notes: e.notes ?? null,
      active: true,
    };

    const existing = e.gcalSeriesId
      ? await prisma.jobStandard.findUnique({ where: { gcalSeriesId: e.gcalSeriesId } })
      : await prisma.jobStandard.findFirst({ where: { label: e.label } });

    if (existing) {
      await prisma.jobStandard.update({ where: { id: existing.id }, data });
      console.log(`  updated  ${e.label} -> ${e.minutes}m`);
    } else {
      await prisma.jobStandard.create({ data });
      console.log(`  created  ${e.label} -> ${e.minutes}m`);
    }
  }

  const total = await prisma.jobStandard.count();
  console.log(`\n${total} standard time${total === 1 ? "" : "s"} on file.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
